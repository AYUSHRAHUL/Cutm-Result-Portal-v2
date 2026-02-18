import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { clientPromise } from "@/lib/mongodb";
import bcrypt from "bcryptjs";

function normalizeRole(input) {
  const raw = String(input || "user").trim().toLowerCase();
  if (["admin", "administrator", "adm", "admn", "adim"].includes(raw)) return "admin";
  if (["teacher", "faculty", "prof", "instructor"].includes(raw)) return "teacher";
  if (["user", "student"].includes(raw)) return "user";
  return "user";
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Check for OAuth errors
    if (error) {
      return NextResponse.redirect(
        `${req.nextUrl.origin}/login?error=${encodeURIComponent("Google sign-in was cancelled")}`
      );
    }

    // Verify state to prevent CSRF attacks
    const storedState = req.cookies.get("oauth_state")?.value;
    if (!state || state !== storedState) {
      return NextResponse.redirect(
        `${req.nextUrl.origin}/login?error=${encodeURIComponent("Invalid state parameter")}`
      );
    }

    if (!code) {
      return NextResponse.redirect(
        `${req.nextUrl.origin}/login?error=${encodeURIComponent("Authorization code not received")}`
      );
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.nextUrl.origin}/api/auth/callback/google`;

    // Validate credentials
    if (!clientId || !clientSecret) {
      console.error("Google OAuth: Missing credentials", {
        hasClientId: !!clientId,
        hasClientSecret: !!clientSecret,
      });
      return NextResponse.redirect(
        `${req.nextUrl.origin}/login?error=${encodeURIComponent("Google OAuth not configured. Please check your environment variables.")}`
      );
    }

    // Log redirect URI for debugging (without exposing secrets)
    console.log("Google OAuth: Using redirect URI:", redirectUri);
    console.log("Google OAuth: Request origin:", req.nextUrl.origin);
    console.log("Google OAuth: Client ID prefix:", clientId?.substring(0, 20) + "...");

    // Exchange authorization code for access token
    // Log request details (without exposing secret)
    console.log("Google OAuth Token Exchange Request:", {
      hasCode: !!code,
      codeLength: code?.length,
      clientIdPrefix: clientId?.substring(0, 20) + "...",
      redirectUri: redirectUri,
      grantType: "authorization_code",
    });

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({ error: "Unknown error" }));
      console.error("Token exchange error:", {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        error: errorData,
        redirectUri: redirectUri,
        hasCode: !!code,
      });

      // Provide more specific error messages
      let errorMessage = "Failed to authenticate with Google";
      if (errorData.error === "invalid_client") {
        errorMessage = `Invalid Google OAuth credentials. Possible issues:
1. Client ID and Secret don't match in Google Cloud Console
2. OAuth consent screen is not configured/published
3. Redirect URI mismatch - make sure "${redirectUri}" is EXACTLY added in Google Cloud Console
4. Client credentials are for a different project`;
      } else if (errorData.error === "invalid_grant") {
        errorMessage = "Authorization code expired or invalid. Please try again.";
      } else if (errorData.error === "redirect_uri_mismatch") {
        errorMessage = `Redirect URI mismatch. Make sure "${redirectUri}" is EXACTLY added to Google Cloud Console authorized redirect URIs (no trailing slash, exact match).`;
      } else if (errorData.error_description) {
        errorMessage = errorData.error_description;
      }

      return NextResponse.redirect(
        `${req.nextUrl.origin}/login?error=${encodeURIComponent(errorMessage)}`
      );
    }

    const tokenData = await tokenResponse.json();
    const { access_token } = tokenData;

    if (!access_token) {
      console.error("Google OAuth: No access token received");
      return NextResponse.redirect(
        `${req.nextUrl.origin}/login?error=${encodeURIComponent("Failed to get access token")}`
      );
    }

    console.log("Google OAuth: Access token received, fetching user info...");

    // Get user info from Google
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      const errorText = await userInfoResponse.text();
      console.error("Google OAuth: Failed to fetch user info:", {
        status: userInfoResponse.status,
        error: errorText,
      });
      return NextResponse.redirect(
        `${req.nextUrl.origin}/login?error=${encodeURIComponent("Failed to fetch user information")}`
      );
    }

    const googleUser = await userInfoResponse.json();
    console.log("Google OAuth: User info received:", {
      email: googleUser.email,
      name: googleUser.name,
      hasPicture: !!googleUser.picture,
    });

    const { email, name, picture } = googleUser;

    if (!email) {
      return NextResponse.redirect(
        `${req.nextUrl.origin}/login?error=${encodeURIComponent("Email not provided by Google")}`
      );
    }

    // Check email domain - Only allow CUTM email addresses
    const allowedDomains = ['@cutm.ac.in', '@centurionuniv.edu.in'];
    const emailDomain = email.substring(email.lastIndexOf('@'));

    if (!allowedDomains.includes(emailDomain)) {
      console.log("Google OAuth: Email domain not allowed:", emailDomain);
      return NextResponse.redirect(
        `${req.nextUrl.origin}/login?error=${encodeURIComponent("Only @cutm.ac.in or @centurionuniv.edu.in email addresses are allowed for Google sign-in.")}`
      );
    }

    console.log("Google OAuth: Email domain verified:", emailDomain);

    // Connect to database
    console.log("Google OAuth: Connecting to database...");
    const client = await clientPromise;
    const db = client.db("USER");

    // Check if user exists
    console.log("Google OAuth: Checking for existing user with email:", email);
    let user = await db.collection("users").findOne({ email });
    console.log("Google OAuth: User found:", !!user);

    if (!user) {
      // Create new user for Google sign-in
      // Generate a random password (user won't need it for Google sign-in)
      const randomPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      const newUser = {
        name: name || email.split("@")[0],
        email,
        password: hashedPassword,
        role: "user", // Default role, can be changed by admin
        googleId: googleUser.id,
        picture: picture || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const insertResult = await db.collection("users").insertOne(newUser);
      user = { ...newUser, _id: insertResult.insertedId };
    } else {
      // Update existing user with Google ID if not present
      if (!user.googleId) {
        await db.collection("users").updateOne(
          { email },
          {
            $set: {
              googleId: googleUser.id,
              picture: picture || user.picture,
              updatedAt: new Date(),
            },
          }
        );
        user.googleId = googleUser.id;
        user.picture = picture || user.picture;
      }
    }

    // Check if user is blocked
    if (user.isBlocked === true) {
      return NextResponse.redirect(
        `${req.nextUrl.origin}/login?error=${encodeURIComponent("Your account has been blocked. Please contact administrator.")}`
      );
    }

    // Generate JWT token (same as regular login)
    const normalizedRole = normalizeRole(user.role);
    console.log("Google OAuth: User role:", normalizedRole);

    // Detect campus from employee ID for teachers
    let campus = null;
    if (normalizedRole === "teacher" && user.employeeId) {
      const { detectCampus } = await import("@/lib/campus");
      campus = detectCampus(user.employeeId);
    }

    const token = jwt.sign(
      {
        id: user._id.toString(),
        role: normalizedRole,
        email: user.email,
        campus: campus || null,
        employeeId: user.employeeId || null
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Determine redirect based on role and campus
    const role = normalizedRole;
    const { getTeacherDashboardPath } = await import("@/lib/campus");

    let target;

    // Check if user needs to complete profile (Teacher with @cutm.ac.in but no Employee ID)
    if (email.endsWith('@cutm.ac.in') && !user.employeeId) {
      target = "/complete-profile";
    } else {
      target =
        role === "admin"
          ? "/dashboard/admin"
          : role === "teacher"
            ? getTeacherDashboardPath(campus)
            : "/dashboard/user";
    }

    console.log("Google OAuth: Redirecting to:", target);
    console.log("Google OAuth: Full redirect URL:", `${req.nextUrl.origin}${target}`);

    // Create redirect URL using URL constructor (same as middleware)
    const redirectUrl = new URL(target, req.url);
    console.log("Google OAuth: Constructed redirect URL:", redirectUrl.toString());

    // Create response with redirect (307 Temporary Redirect)
    const response = NextResponse.redirect(redirectUrl, { status: 307 });

    // Set JWT token cookie
    // Use "lax" for sameSite to allow redirect to work properly
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax", // Changed from "strict" to "lax" for redirect compatibility
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    // Clear OAuth state cookie
    response.cookies.delete("oauth_state");

    console.log("Google OAuth: Success! Redirecting to dashboard...");
    console.log("Google OAuth: Response status:", response.status);
    console.log("Google OAuth: Response headers:", Object.fromEntries(response.headers.entries()));

    return response;
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    console.error("Google OAuth error stack:", err.stack);
    return NextResponse.redirect(
      `${req.nextUrl.origin}/login?error=${encodeURIComponent("Authentication failed: " + err.message)}`
    );
  }
}


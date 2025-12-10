import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || req.nextUrl.origin;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${baseUrl}/api/auth/callback/google`;

    if (!clientId) {
      console.error("Google OAuth: GOOGLE_CLIENT_ID not set in environment variables");
      return NextResponse.json(
        { error: "Google OAuth not configured. Please set GOOGLE_CLIENT_ID in your .env file." },
        { status: 500 }
      );
    }

    console.log("Google OAuth: Initiating sign-in", {
      redirectUri: redirectUri,
      baseUrl: baseUrl,
    });

    // Generate state for CSRF protection
    const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    // Store state in a cookie (you could also use Redis for production)
    const response = NextResponse.redirect(
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent("openid email profile")}&` +
      `state=${state}&` +
      `access_type=online&` +
      `prompt=select_account`
    );

    // Store state in httpOnly cookie for verification
    response.cookies.set("oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600, // 10 minutes
    });

    return response;
  } catch (err) {
    console.error("Google OAuth initiation error:", err);
    return NextResponse.json(
      { error: "Failed to initiate Google sign-in" },
      { status: 500 }
    );
  }
}


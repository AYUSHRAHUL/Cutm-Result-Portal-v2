import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { clientPromise } from "@/lib/mongodb";
import { detectCampus } from "@/lib/campus";

async function decode(token) {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

export async function GET(req) {
  try {
    const token = req.cookies.get("token")?.value;
    console.log('[AUTH/ME] Token present:', !!token);
    
    if (!token) {
      console.warn('[AUTH/ME] No token found');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await decode(token);
    console.log('[AUTH/ME] JWT Payload:', payload);
    
    if (!payload?.email) {
      console.warn('[AUTH/ME] No email in JWT payload');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("USER");
    const user = await db.collection("users").findOne({ email: payload.email }, { projection: { password: 0 } });
    
    console.log('[AUTH/ME] User found:', {
      email: user?.email,
      role: user?.role,
      employeeId: user?.employeeId,
      campus: user?.campus
    });
    
    if (!user) {
      console.warn('[AUTH/ME] User not found in database');
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user is blocked
    if (user.isBlocked === true) {
      console.warn('[AUTH/ME] User is blocked');
      // Clear the token cookie
      const response = NextResponse.json({ error: "Your account has been blocked. Please contact administrator." }, { status: 403 });
      response.cookies.set("token", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 0,
      });
      return response;
    }

    // Ensure campus is set for teachers based on employee ID
    let campus = payload.campus || user.campus || null;
    const userRole = String(user.role || '').toLowerCase();
    
    console.log('[AUTH/ME] Initial campus detection:', {
      fromPayload: payload.campus,
      fromUser: user.campus,
      userRole: userRole,
      employeeId: user.employeeId
    });
    
    // For teachers, always try to detect campus from employeeId if not already set
    if (userRole === 'teacher') {
      if (!campus && user.employeeId) {
        console.log('[AUTH/ME] Detecting campus for teacher from employeeId...');
        campus = detectCampus(user.employeeId);
        console.log('[AUTH/ME] Detected campus:', campus);
      }
      // Default to PKD if still no campus detected
      if (!campus) {
        console.log('[AUTH/ME] No campus detected, defaulting to PKD for teacher');
        campus = 'pkd';
      }
    }
    
    console.log('[AUTH/ME] Final response campus:', campus);

    // Return user with campus information
    return NextResponse.json({ 
      success: true, 
      user: {
        ...user,
        campus: campus,
        role: user.role
      }
    });
  } catch (err) {
    console.error('[AUTH/ME] Error:', err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}



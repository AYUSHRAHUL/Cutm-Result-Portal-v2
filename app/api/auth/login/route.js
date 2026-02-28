import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { clientPromise } from "@/lib/mongodb"; // ✅ use clientPromise instead of connectDB
import User from "@/models/User"; // assuming you have a Mongoose-style model
import { detectCampus, detectSchool } from "@/lib/campus";

export async function POST(req) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const client = await clientPromise; // ✅ connect to DB
    const db = client.db("USER");      // USER database for authentication
    const user = await db.collection("users").findOne({ email });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user is blocked
    if (user.isBlocked === true) {
      return NextResponse.json({ error: "Your account has been blocked. Please contact administrator." }, { status: 403 });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    let normalizedRole = String(user.role || "user").trim().toLowerCase();
    console.log(`[LOGIN] User role detected: ${normalizedRole}`);
    
    // Handle super admin role
    if (normalizedRole === "superadmin" || normalizedRole === "super_admin" || normalizedRole === "super-admin") {
      normalizedRole = "superadmin";
    }
    
    // Detect campus from employee ID for teachers
    let campus = null;
    if (normalizedRole === "teacher") {
      if (user.employeeId) {
        console.log(`[LOGIN] Teacher found with employeeId: ${user.employeeId}`);
        campus = detectCampus(user.employeeId);
        console.log(`[LOGIN] Campus detection result: ${campus}`);
      } else {
        console.warn(`[LOGIN] Teacher found but NO employeeId - Email: ${email}`);
      }
    }
    
    // Detect school from user data (for all roles)
    let school = null;
    if (user.school) {
      school = detectSchool(user.school);
    }
    
    const token = jwt.sign(
      { 
        id: user._id, 
        role: normalizedRole, 
        email: user.email,
        campus: campus || null,
        employeeId: user.employeeId || null,
        school: school || null
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    console.log(`[LOGIN] Response being sent: role=${normalizedRole}, campus=${campus}, employeeId=${user.employeeId}`);
    
    // Update last login time and mark user online
    try {
      await db.collection("users").updateOne(
        { email: user.email },
        { $set: { lastLogin: new Date(), isOnline: true, updatedAt: new Date() } }
      );
      // refresh user object with latest fields
      const refreshedUser = await db.collection("users").findOne({ email: user.email }, { projection: { password: 0 } });

      const res = NextResponse.json({
        success: true,
        message: "Login successful",
        user: {
          name: refreshedUser.name,
          role: normalizedRole,
          email: refreshedUser.email,
          campus: campus,
          employeeId: refreshedUser.employeeId || null,
          school: school || null,
          lastLogin: refreshedUser.lastLogin || null,
          isOnline: refreshedUser.isOnline || false
        },
      });

      res.cookies.set("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      });

      return res;
    } catch (e) {
      console.error('[LOGIN] Failed to update lastLogin/isOnline', e);
      const res = NextResponse.json({
        success: true,
        message: "Login successful",
        user: { 
          name: user.name, 
          role: normalizedRole, 
          email: user.email,
          campus: campus,
          employeeId: user.employeeId || null,
          school: school || null
        },
      });

      res.cookies.set("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      });

      return res;
    }
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

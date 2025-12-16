import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { clientPromise } from "@/lib/mongodb";
import bcrypt from "bcryptjs";

export async function POST(req) {
  try {
    // Check authentication
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized - Please login first" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.email) {
      return NextResponse.json({ error: "Unauthorized - Invalid token" }, { status: 401 });
    }

    const { currentPassword, newPassword } = await req.json();

    // Validate input
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ 
        error: "Current password and new password are required" 
      }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ 
        error: "New password must be at least 6 characters long" 
      }, { status: 400 });
    }

    if (currentPassword === newPassword) {
      return NextResponse.json({ 
        error: "New password must be different from current password" 
      }, { status: 400 });
    }

    // Get user from database
    const client = await clientPromise;
    const db = client.db("USER");
    const user = await db.collection("users").findOne({ email: payload.email });

    if (!user) {
      return NextResponse.json({ 
        error: "User not found" 
      }, { status: 404 });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return NextResponse.json({ 
        error: "Current password is incorrect" 
      }, { status: 400 });
    }

    // Hash new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password in database
    const result = await db.collection("users").updateOne(
      { email: payload.email },
      { 
        $set: { 
          password: hashedNewPassword,
          updatedAt: new Date()
        } 
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ 
        error: "Failed to update password" 
      }, { status: 500 });
    }

    // Log password change for security
    console.log(`Password changed for user: ${payload.email} at ${new Date().toISOString()}`);

    return NextResponse.json({ 
      success: true,
      message: "Password changed successfully" 
    });

  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}

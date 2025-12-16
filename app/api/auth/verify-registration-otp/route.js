import { clientPromise } from "@/lib/mongodb";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { verifyOTP, removeOTP } from "@/lib/otpStore";

export async function POST(req) {
  try {
    const { email, otp, password } = await req.json();

    if (!email || !otp || !password) {
      return NextResponse.json(
        { success: false, error: "Email, OTP, and password are required" },
        { status: 400 }
      );
    }

    // Verify OTP using shared store
    const otpResult = verifyOTP(email, otp);
    
    if (!otpResult.success) {
      return NextResponse.json(
        { success: false, error: otpResult.error },
        { status: 400 }
      );
    }

    const storedData = otpResult.data;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const client = await clientPromise;
    const db = client.db("USER");
    
    const user = {
      name: storedData.name,
      email: storedData.email,
      password: hashedPassword,
      role: storedData.role,
      employeeId: storedData.employeeId || "",
      createdAt: new Date(),
      verified: true
    };

    const result = await db.collection("users").insertOne(user);

    // Remove OTP from store
    removeOTP(email);

    return NextResponse.json({
      success: true,
      message: "Registration completed successfully",
      user: {
        id: result.insertedId,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error("Verify registration OTP error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

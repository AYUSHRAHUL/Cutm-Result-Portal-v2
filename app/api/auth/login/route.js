import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { clientPromise } from "@/lib/mongodb"; // ✅ use clientPromise instead of connectDB
import User from "@/models/User"; // assuming you have a Mongoose-style model

export async function POST(req) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const client = await clientPromise; // ✅ connect to DB
    const db = client.db("cutm1");      // your DB name
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

    const normalizedRole = String(user.role || "user").trim().toLowerCase();
    const token = jwt.sign(
      { id: user._id, role: normalizedRole, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const res = NextResponse.json({
      success: true,
      message: "Login successful",
      user: { name: user.name, role: normalizedRole, email: user.email },
    });

    res.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return res;
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

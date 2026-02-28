import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { clientPromise } from "@/lib/mongodb";

async function decode(token) {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

export async function POST(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (token) {
      const payload = await decode(token);
      if (payload?.email) {
        const client = await clientPromise;
        const db = client.db("USER");
        await db.collection("users").updateOne(
          { email: payload.email },
          { $set: { isOnline: false, updatedAt: new Date() } }
        );
      }
    }

    const res = NextResponse.json({ success: true, message: "Logged out" });
    // Clear HttpOnly JWT cookie
    res.cookies.set("token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(0),
    });
    return res;
  } catch (err) {
    console.error('[AUTH/LOGOUT] Error:', err);
    const res = NextResponse.json({ success: true, message: "Logged out" });
    res.cookies.set("token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(0),
    });
    return res;
  }
}



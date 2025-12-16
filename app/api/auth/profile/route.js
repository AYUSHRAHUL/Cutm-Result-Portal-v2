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

export async function PUT(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const payload = await decode(token);
    if (!payload?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { name } = await req.json();
    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("USER");
    const res = await db.collection("users").findOneAndUpdate(
      { email: payload.email },
      { $set: { name, updatedAt: new Date() } },
      { returnDocument: "after", projection: { password: 0 } }
    );

    if (!res?.value) return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json({ success: true, user: res.value });
  } catch (err) {
    console.error("/api/auth/profile PUT error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}



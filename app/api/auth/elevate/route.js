import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";

export async function POST(req) {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Not allowed in production" }, { status: 403 });
    }

    const { email, role } = await req.json();
    if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
    const normalizedRole = String(role || "admin").trim().toLowerCase();
    if (!["admin", "teacher", "user"].includes(normalizedRole)) {
      return NextResponse.json({ error: "invalid role" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("USER");
    const res = await db.collection("users").findOneAndUpdate(
      { email },
      { $set: { role: normalizedRole, updatedAt: new Date() } },
      { returnDocument: "after", projection: { password: 0 } }
    );
    if (!res?.value) return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json({ success: true, user: res.value });
  } catch (err) {
    console.error("/api/auth/elevate error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}



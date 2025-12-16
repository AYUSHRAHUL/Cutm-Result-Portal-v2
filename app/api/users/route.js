import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { jwtVerify } from "jose";
import { ObjectId } from "mongodb";

// JWT verification helper
async function verifyToken(token) {
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
    // Check authentication
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized - Please login first" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.email) {
      return NextResponse.json({ error: "Unauthorized - Invalid token" }, { status: 401 });
    }

    // Check if user is admin
    const client = await clientPromise;
    const db = client.db("USER");
    const currentUser = await db.collection("users").findOne({ email: payload.email });
    
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    // Fetch all users (excluding passwords)
    const users = await db.collection("users")
      .find({})
      .project({ password: 0 })
      .sort({ createdAt: -1 })
      .toArray();
    
    return NextResponse.json({ users }, { status: 200 });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function PUT(req) {
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

    // Check if user is admin
    const client = await clientPromise;
    const db = client.db("USER");
    const currentUser = await db.collection("users").findOne({ email: payload.email });
    
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { userId, updates } = body;

    if (!userId || !updates) {
      return NextResponse.json({ error: "Missing userId or updates" }, { status: 400 });
    }

    // Convert userId to ObjectId
    let userObjectId;
    try {
      userObjectId = new ObjectId(userId);
    } catch (error) {
      return NextResponse.json({ error: "Invalid user ID format" }, { status: 400 });
    }

    // Prevent self-modification of role or blocking
    if (userObjectId.toString() === currentUser._id.toString() && (updates.role || updates.isBlocked)) {
      return NextResponse.json({ error: "Cannot modify your own role or block status" }, { status: 400 });
    }

    // Check if user exists first
    const existingUser = await db.collection("users").findOne({ _id: userObjectId });
    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Update user
    const updateResult = await db.collection("users").updateOne(
      { _id: userObjectId },
      { $set: { ...updates, updatedAt: new Date() } }
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (updateResult.modifiedCount === 0 && updateResult.matchedCount > 0) {
      // User found but no changes made (might be same values)
      const updatedUser = await db.collection("users").findOne(
        { _id: userObjectId },
        { projection: { password: 0 } }
      );
      return NextResponse.json({ 
        message: "User updated successfully", 
        user: updatedUser 
      }, { status: 200 });
    }

    // Fetch updated user
    const updatedUser = await db.collection("users").findOne(
      { _id: userObjectId },
      { projection: { password: 0 } }
    );

    if (!updatedUser) {
      return NextResponse.json({ error: "Failed to fetch updated user" }, { status: 500 });
    }

    return NextResponse.json({ 
      message: "User updated successfully", 
      user: updatedUser 
    }, { status: 200 });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}


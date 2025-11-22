import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { verifyToken } from "@/lib/auth";
import { ObjectId } from "mongodb";

export async function DELETE(req, { params }) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.email || payload.role?.toLowerCase() !== "admin") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { id } = params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("cutm1");

    const result = await db.collection("honours_students")
      .deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: "Student removed from honours list successfully" 
    });
  } catch (error) {
    console.error("Error removing honours student:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}




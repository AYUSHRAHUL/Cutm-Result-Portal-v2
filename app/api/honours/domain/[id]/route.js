import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { verifyToken } from "@/lib/auth";
import { ObjectId } from "mongodb";

export async function PUT(req, { params }) {
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

    const body = await req.json();
    const { Domain, SubjectCode, SubjectName, Credits } = body;

    if (!Domain || !SubjectCode || !SubjectName || !Credits) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("cutm1");

    const update = {
      Domain,
      "Subject Code": SubjectCode,
      SubjectCode,
      Subject_Name: SubjectName,
      Credits: String(Credits),
      updatedAt: new Date()
    };

    const result = await db.collection("honours_domain_subjects")
      .updateOne(
        { _id: new ObjectId(id) },
        { $set: update }
      );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: "Domain subject updated successfully" 
    });
  } catch (error) {
    console.error("Error updating domain subject:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

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

    const result = await db.collection("honours_domain_subjects")
      .deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: "Domain subject deleted successfully" 
    });
  } catch (error) {
    console.error("Error deleting domain subject:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}



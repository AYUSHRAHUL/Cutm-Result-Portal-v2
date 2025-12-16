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
    // Get database based on campus and school
    const { searchParams } = new URL(req.url);
    const campusParam = searchParams.get('campus');
    const schoolParam = searchParams.get('school');
    const campus = campusParam || payload.campus || null;
    const school = schoolParam || payload.school || null;
    const { getCampusSchoolDatabase } = await import("@/lib/campus");
    const dbName = getCampusSchoolDatabase(campus, school);
    const db = client.db(dbName);

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




import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { jwtVerify } from "jose";
import { getCampusSchoolDatabase } from "@/lib/campus";

async function verifyToken(token) {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

/**
 * DELETE /api/soet/placement/delete
 * Delete a placement record
 */
export async function DELETE(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized - Please login first" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.email) {
      return NextResponse.json({ error: "Unauthorized - Invalid token" }, { status: 401 });
    }

    const userRole = payload.role?.toLowerCase();
    if (!["admin"].includes(userRole)) {
      return NextResponse.json({
        error: "Access denied - Only admins can delete placements"
      }, { status: 403 });
    }

    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Placement ID is required" }, { status: 400 });
    }

    const client = await clientPromise;
    const campus = payload.campus || null;
    const school = 'SOET';
    const dbName = getCampusSchoolDatabase(campus, school);
    const db = client.db(dbName);
    const placementsCollection = db.collection("placements");

    const { ObjectId } = await import('mongodb');
    const result = await placementsCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Placement record not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Placement record deleted successfully",
      deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error('Error deleting placement:', error);
    return NextResponse.json({
      error: `Failed to delete placement: ${error.message}`
    }, { status: 500 });
  }
}


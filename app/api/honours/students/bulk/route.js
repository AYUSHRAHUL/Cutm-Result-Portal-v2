import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { verifyToken } from "@/lib/auth";
import { ObjectId } from "mongodb";

export async function DELETE(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.email || payload.role?.toLowerCase() !== "admin") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await req.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Invalid IDs array" }, { status: 400 });
    }

    const validIds = ids.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id));
    if (validIds.length === 0) {
      return NextResponse.json({ error: "No valid IDs provided" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = await (async () => { const { getDatabaseFromRequest } = await import("@/lib/db-helper"); const dbName = await getDatabaseFromRequest(req); return client.db(dbName); })();

    const result = await db.collection("honours_students")
      .deleteMany({ _id: { $in: validIds } });

    return NextResponse.json({ 
      success: true, 
      message: `${result.deletedCount} student(s) removed successfully`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error("Error bulk removing honours students:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}





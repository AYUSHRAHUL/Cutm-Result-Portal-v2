import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { jwtVerify } from "jose";

async function verifyToken(token) {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

export async function POST(request) {
  try {
    const token = request.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const payload = await verifyToken(token);
    const role = String(payload?.role || "").toLowerCase();
    if (role !== "admin" && role !== "teacher") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { duplicateGroup } = await request.json();
    const regNo = duplicateGroup?.regNo;
    const subjectCode = duplicateGroup?.subjectCode;
    if (!regNo || !subjectCode) return NextResponse.json({ error: "regNo and subjectCode required" }, { status: 400 });

    const client = await clientPromise;
    const { getCampusSchoolDatabase, getSchoolFromRequest, getCampusFromRequest } = await import("@/lib/campus");
    const { searchParams } = new URL(request.url);
    const campusParam = searchParams.get('campus');
    const schoolParam = searchParams.get('school');
    const campus = campusParam || payload.campus || await getCampusFromRequest(request);
    const school = schoolParam || payload.school || await getSchoolFromRequest(request);
    const dbName = getCampusSchoolDatabase(campus, school);
    console.log(`[Cleanup Delete Specific] Database selection: campus=${campus}, school=${school}, dbName=${dbName}`);
    const db = client.db(dbName);
    const collection = db.collection("result");

    const docs = await collection.find({ Reg_No: regNo, Subject_Code: subjectCode }).toArray();
    if (docs.length <= 1) return NextResponse.json({ success: true, deletedCount: 0 });

    const toDelete = docs.length - 1; // keep 1
    const ids = docs.slice(0, toDelete).map(d => d._id);
    const res = await collection.deleteMany({ _id: { $in: ids } });

    return NextResponse.json({ success: true, deletedCount: res.deletedCount || 0 });
  } catch (err) {
    return NextResponse.json({ error: "Failed to delete duplicate group", details: err.message }, { status: 500 });
  }
}




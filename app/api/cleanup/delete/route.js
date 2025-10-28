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

    const { duplicates = [] } = await request.json();
    if (!Array.isArray(duplicates) || duplicates.length === 0) {
      return NextResponse.json({ error: "No duplicates provided" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("cutm1");
    const collection = db.collection("CUTM1");

    let deletedCount = 0;
    for (const group of duplicates) {
      const regNo = group.regNo;
      const subjectCode = group.subjectCode;
      if (!regNo || !subjectCode) continue;

      const docs = await collection.find({ Reg_No: regNo, Subject_Code: subjectCode }).toArray();
      if (docs.length > 1) {
        const toDelete = docs.length - 1; // keep 1
        const ids = docs.slice(0, toDelete).map(d => d._id);
        if (ids.length) {
          const res = await collection.deleteMany({ _id: { $in: ids } });
          deletedCount += res.deletedCount || 0;
        }
      }
    }

    return NextResponse.json({ success: true, deletedCount });
  } catch (err) {
    return NextResponse.json({ error: "Failed to delete duplicates", details: err.message }, { status: 500 });
  }
}



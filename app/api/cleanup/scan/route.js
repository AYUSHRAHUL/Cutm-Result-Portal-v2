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

    const { batch = "", semester = "" } = await request.json();

    const client = await clientPromise;
    const db = client.db("cutm1");
    const collection = db.collection("CUTM1");

    const match = {};
    if (batch) {
      const yy = String(batch).length === 4 && String(batch).startsWith("20")
        ? String(batch).slice(2)
        : String(batch).slice(-2);
      match.Reg_No = { $regex: `^(?:${yy}|20${yy})` };
    }
    if (semester) {
      match.Sem = semester;
    }

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: { regNo: "$Reg_No", subjectCode: "$Subject_Code" },
          count: { $sum: 1 },
          records: { $push: "$$ROOT" },
          subjectName: { $first: "$Subject_Name" },
          semester: { $first: "$Sem" }
        }
      },
      { $match: { count: { $gt: 1 } } },
      { $sort: { "_id.regNo": 1, "_id.subjectCode": 1 } }
    ];

    const groups = await collection.aggregate(pipeline).toArray();

    const duplicates = groups.map(g => ({
      regNo: g._id.regNo,
      subjectCode: g._id.subjectCode,
      subjectName: g.subjectName,
      semester: g.semester,
      count: g.count,
      records: g.records,
    }));

    const totalRecords = await collection.countDocuments(match);
    const duplicateGroups = duplicates.length;
    const duplicateRecords = duplicates.reduce((s, d) => s + d.count, 0);

    return NextResponse.json({
      success: true,
      duplicates,
      stats: { totalRecords, duplicateGroups, duplicateRecords },
      message: `Found ${duplicateGroups} duplicate groups with ${duplicateRecords} records`,
    });
  } catch (err) {
    return NextResponse.json({ error: "Failed to scan for duplicates", details: err.message }, { status: 500 });
  }
}



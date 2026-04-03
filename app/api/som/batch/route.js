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
 * SOM (School of Management) Batch Route
 * Handles SOM (BBA/MBA) data ONLY
 */
export async function POST(req) {
  try {
    const token = req.cookies.get("token")?.value;
    const payload = token ? await verifyToken(token) : null;
    
    const { branch, batch } = await req.json();
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode');
    const campus = searchParams.get('campus') || payload?.campus || 'pkd';

    const dbName = getCampusSchoolDatabase(campus, 'SOM');
    const client = await clientPromise;
    const db = client.db(dbName);
    const collection = db.collection("som_result");

    // Build Match Conditions
    const matchConditions = [];

    // 1. Batch Filter (YY or YYYY)
    if (batch && batch !== 'All') {
      const b = String(batch).trim();
      const yy = b.length === 4 ? b.slice(-2) : b;
      const yyyy = b.length === 2 ? `20${b}` : b;
      
      // Match starts with YY or YYYY (as string) or matches numerically via $expr
      matchConditions.push({
        $or: [
          { Reg_No: { $regex: `^(?:${yy}|${yyyy})` } },
          { $expr: { $in: [{ $substr: [{ $toString: "$Reg_No" }, 0, 2] }, [yy, yyyy.slice(0, 2)]] } }
        ]
      });
    }

    // 2. Branch Filter (BBA/MBA)
    if (branch && branch !== 'All') {
      const b = String(branch).trim().toUpperCase();
      const codes = b === 'BBA' ? ['912'] : (b === 'MBA' ? ['214'] : []);
      const names = [b];
      if (b === 'BBA') names.push('Bachelor of Business Administration', 'Bachelor of Business Administration (BBA)');
      if (b === 'MBA') names.push('Master of Business Administration', 'Master of Business Administration (MBA)');

      const branchOr = [{ Branch: { $in: names } }];
      if (codes.length > 0) {
        branchOr.push({
          $expr: { $in: [{ $substr: [{ $toString: "$Reg_No" }, 5, 3] }, codes] }
        });
      }
      matchConditions.push({ $or: branchOr });
    }

    // 3. Final Query
    let query = matchConditions.length > 1 ? { $and: matchConditions } : (matchConditions[0] || {});

    // Inactive filter
    const inactiveDocs = await db.collection("student_status").find({ isActive: { $in: [false, "false"] } }).project({ Reg_No: 1 }).toArray();
    const inactiveRegs = inactiveDocs.map(d => String(d.Reg_No)).filter(Boolean);
    if (inactiveRegs.length > 0) {
      query = { $and: [query, { Reg_No: { $nin: inactiveRegs } }] };
    }

    // Projections
    const projection = { _id: 0, Reg_No: 1, Name: 1, Branch: 1, Subject_Code: 1, Subject_Name: 1, Credits: 1, Grade: 1, Sem: 1 };

    if (mode === 'summary') {
      const pipeline = [
        { $match: query },
        {
          $group: {
            _id: "$Reg_No",
            Name: { $first: "$Name" },
            Branch: { $first: "$Branch" },
            subjects: { $push: "$$ROOT" }
          }
        },
        {
          $project: {
            _id: 0,
            Reg_No: "$_id",
            Name: { $ifNull: ["$Name", "Unknown"] },
            Branch: { $ifNull: ["$Branch", "SOM"] },
            subjects: 1
          }
        }
      ];

      const students = await collection.aggregate(pipeline).toArray();
      const flatRecords = students.flatMap(s => s.subjects);
      
      return NextResponse.json({
        success: true,
        students,
        records: flatRecords.map(r => ({ ...r, Reg_No: String(r.Reg_No) })),
        message: `${students.length} students loaded`,
        school: 'SOM'
      });
    }

    // Default mode
    const records = await collection.find(query).project(projection).toArray();
    return NextResponse.json({
      success: true,
      records: records.map(r => ({ ...r, Reg_No: String(r.Reg_No) })),
      message: `${records.length} records loaded`,
      school: 'SOM'
    });

  } catch (error) {
    console.error("SOM Batch API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

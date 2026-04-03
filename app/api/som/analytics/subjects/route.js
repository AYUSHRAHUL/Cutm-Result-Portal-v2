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
 * SOM Analytics Subjects Route - SOM (BBA/MBA) only
 * Provides a list of unique subjects available in the result database
 * filtered by batch, branch, or semester.
 */
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

    // Role-based access control
    const userRole = payload.role?.toLowerCase();
    if (!["admin", "teacher"].includes(userRole)) {
      return NextResponse.json({
        error: "Access denied - Only admins or teachers can access analytics data"
      }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const batchFilter = searchParams.getAll('batch');
    const branchFilter = searchParams.getAll('branch');
    const semesterFilter = searchParams.getAll('semester');

    const client = await clientPromise;
    const campusParam = searchParams.get('campus');
    const campus = campusParam || payload.campus || null;
    
    // Force school to SOM
    const school = 'SOM';
    const dbName = getCampusSchoolDatabase(campus, school);
    const db = client.db(dbName);
    const cutm = db.collection("som_result");

    // Inactive students (Global Exclusion)
    const statusCollection = db.collection("student_status");
    const inactiveDocs = await statusCollection.find({ isActive: { $in: [false, "false"] } }).project({ Reg_No: 1 }).toArray();
    const inactiveRegs = inactiveDocs.map(d => String(d.Reg_No || "").toUpperCase()).filter(Boolean);

    // Initial match: must have subject code and must be a SOM student (912/214)
    // AND must NOT be an inactive student
    const match = {
      Reg_No: { $nin: inactiveRegs },
      $or: [
        { Subject_Code: { $exists: true, $ne: null, $ne: "" } },
        { "Subject Code": { $exists: true, $ne: null, $ne: "" } }
      ],
      $expr: {
        $and: [
          // Filter only SOM branch codes
          { $in: [{ $substr: [{ $toString: "$Reg_No" }, 5, 3] }, ["912", "214"]] }
        ]
      }
    };

    // Apply batch filter at DB level (supports multiple batches)
    if (batchFilter.length > 0 && !batchFilter.includes("all")) {
      const yearCodes = batchFilter.map(b => String(b).trim().slice(-2)).filter(Boolean);
      if (yearCodes.length > 0) {
        match.$expr.$and.push({ $in: [{ $substr: [{ $toString: "$Reg_No" }, 0, 2] }, yearCodes] });
      }
    }

    // Apply branch filter at DB level (supports multiple branches)
    if (branchFilter.length > 0 && !branchFilter.includes("all")) {
      const branchMap = { 'BBA': '912', 'MBA': '214' };
      const wantedCodes = branchFilter.map(b => branchMap[b.toUpperCase()]).filter(Boolean);
      if (wantedCodes.length > 0) {
        match.$expr.$and.push({ $in: [{ $substr: [{ $toString: "$Reg_No" }, 5, 3] }, wantedCodes] });
      }
    }

    // Apply semester filter
    if (semesterFilter.length > 0 && !semesterFilter.includes("all")) {
      const cleanSems = semesterFilter.map(s => String(s).replace(/^Sem\s*/i, "").trim()).filter(Boolean);
      if (cleanSems.length > 0) {
        match.$or = [
          { Sem: { $in: cleanSems } },
          { Sem: { $in: cleanSems.map(s => `Sem ${s}`) } },
          { Sem: { $in: cleanSems.map(s => `Sem${s}`) } }
        ];
      }
    }

    const formattedSubjects = await cutm.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            $toUpper: { $trim: { input: { $ifNull: ["$Subject_Code", "$Subject Code"] } } }
          },
          name: {
            $first: { $ifNull: [{ $trim: { input: { $ifNull: ["$Subject_Name", "$Subject Name"] } } }, ""] }
          },
          totalStudents: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          code: "$_id",
          name: {
            $cond: {
              if: { $eq: ["$name", ""] },
              then: "$_id",
              else: "$name"
            }
          },
          totalStudents: 1
        }
      },
      {
        $match: {
          code: { $ne: "" },
          totalStudents: { $gt: 0 }
        }
      },
      { $sort: { code: 1 } }
    ]).toArray();

    return NextResponse.json({
      success: true,
      source: "som_result",
      subjects: formattedSubjects,
      count: formattedSubjects.length,
      school: 'SOM'
    });

  } catch (error) {
    return NextResponse.json({
      error: `Failed to fetch subjects: ${error.message}`
    }, { status: 500 });
  }
}

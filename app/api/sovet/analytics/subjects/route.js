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
 * SOVET Analytics Subjects Route - Diploma only
 */
export async function GET(req) {
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
    if (!["admin", "teacher"].includes(userRole)) {
      return NextResponse.json({
        error: "Access denied - Only admins or teachers can access analytics data"
      }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const batchFilter = searchParams.get('batch');
    const branchFilter = searchParams.get('branch');
    const semesterFilter = searchParams.get('semester');

    const client = await clientPromise;
    const campusParam = searchParams.get('campus');
    const campus = campusParam || payload.campus || null;
    
    // Force school to SOVET
    const school = 'SOVET';
    const dbName = getCampusSchoolDatabase(campus, school);
    
    console.log(`[SOVET Analytics Subjects] Database selection: campus=${campus}, school=${school}, dbName=${dbName}`);
    
    const db = client.db(dbName);
    const cutm = db.collection("result");

    const matchConditions = [
      {
        $or: [
          { Subject_Code: { $exists: true, $ne: null, $ne: "" } },
          { "Subject Code": { $exists: true, $ne: null, $ne: "" } }
        ]
      }
    ];

    if (batchFilter && batchFilter !== "all") {
      const batchPrefix = batchFilter.length === 4 ? batchFilter.substring(2, 4) : batchFilter;
      matchConditions.push({
        Reg_No: { $regex: `^${batchPrefix}` }
      });
    }

    // Diploma branch mapping (8th digit)
    if (branchFilter && branchFilter !== "all") {
      const branchMap = {
        'CSE': ['4'],
        'EE': ['1'],
        'ME': ['2'],
        'CIVIL': ['3'],
        'MINING': ['6'],
        'AUTOMOBILE': ['7']
      };

      const branchCodes = branchMap[branchFilter] || [];
      const orConditions = [];

      if (branchCodes.length > 0) {
        // For Diploma, use 8th digit (index 7)
        branchCodes.forEach(code => {
          orConditions.push({
            Reg_No: { $regex: `^.{7}${code}` }
          });
        });
      }

      if (orConditions.length > 0) {
        matchConditions.push({ $or: orConditions });
      }
    }

    if (semesterFilter && semesterFilter !== "all") {
      const cleanSem = String(semesterFilter).replace(/^Sem\s*/i, "").trim();
      matchConditions.push({
        $or: [
          { Sem: semesterFilter },
          { Sem: cleanSem },
          { Sem: `Sem ${cleanSem}` },
          { Sem: `Sem${cleanSem}` },
          { Sem: { $regex: new RegExp(`^${cleanSem}$`, 'i') } },
          { Sem: { $regex: new RegExp(`^Sem\\s*${cleanSem}`, 'i') } }
        ]
      });
    }

    const formattedSubjects = await cutm.aggregate([
      {
        $match: {
          $and: matchConditions
        }
      },
      {
        $group: {
          _id: {
            $toUpper: {
              $trim: {
                input: {
                  $ifNull: ["$Subject_Code", "$Subject Code"]
                }
              }
            }
          },
          name: {
            $first: {
              $ifNull: [
                { $trim: { input: { $ifNull: ["$Subject_Name", "$Subject Name"] } } },
                ""
              ]
            }
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
      {
        $sort: { code: 1 }
      }
    ]).toArray();

    return NextResponse.json({
      success: true,
      source: "CUTM1",
      subjects: formattedSubjects,
      count: formattedSubjects.length,
      school: 'SOVET'
    });

  } catch (error) {
    console.error('SOVET Subjects API error:', error);
    return NextResponse.json({
      error: `Failed to fetch subjects: ${error.message}`
    }, { status: 500 });
  }
}

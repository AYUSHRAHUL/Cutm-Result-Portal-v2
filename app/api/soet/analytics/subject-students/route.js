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
 * SOET Analytics Subject Students Route - B.Tech only
 * Returns list of students for a specific subject with filters
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
    const subjectCode = searchParams.get('subject');
    const batchFilter = searchParams.get('batch');
    const branchFilter = searchParams.get('branch');
    const semesterFilter = searchParams.get('semester');

    if (!subjectCode) {
      return NextResponse.json({ error: "Subject code is required" }, { status: 400 });
    }

    const client = await clientPromise;
    const campusParam = searchParams.get('campus');
    const campus = campusParam || payload.campus || null;
    
    // Force school to SOET
    const school = 'SOET';
    const dbName = getCampusSchoolDatabase(campus, school);
    
    console.log(`[SOET Subject Students] Database selection: campus=${campus}, school=${school}, dbName=${dbName}`);
    
    const db = client.db(dbName);
    const cutm = db.collection("result");

    // Filter for B.Tech students only (parser used after DB query)
    const { parseBTechRegistration } = await import('../../parse-registration/route');

    // Build query so that ALL four parameters are applied together:
    // subject (mandatory) AND optional batch AND optional semester.
    // We avoid mixing subject and semester in the same $or, otherwise
    // Mongo would return records that match subject OR semester.
    const andConditions = [
      {
        $or: [
          { Subject_Code: subjectCode.toUpperCase() },
          { "Subject Code": subjectCode.toUpperCase() }
        ]
      }
    ];

    // Add batch filter (Reg_No prefix based on batch year)
    if (batchFilter && batchFilter !== "all") {
      const batchPrefix = batchFilter.length === 4 ? batchFilter.substring(2, 4) : batchFilter;
      andConditions.push({
        Reg_No: { $regex: `^${batchPrefix}` }
      });
    }

    // Add semester filter
    if (semesterFilter && semesterFilter !== "all") {
      const cleanSem = String(semesterFilter).replace(/^Sem\s*/i, "").trim();
      andConditions.push({
        $or: [
          { Sem: semesterFilter },
          { Sem: cleanSem },
          { Sem: `Sem ${cleanSem}` },
          { Sem: { $regex: new RegExp(`^${cleanSem}$`, "i") } }
        ]
      });
    }

    const query = andConditions.length > 1 ? { $and: andConditions } : andConditions[0];

    // Fetch records with limit to prevent excessive MongoDB connections
    const MAX_SUBJECT_STUDENTS_RECORDS = 10000; // Limit to 10k records
    let records = await cutm.find(query).limit(MAX_SUBJECT_STUDENTS_RECORDS).toArray();

    // Filter for B.Tech students
    records = records.filter(record => {
      if (!record.Reg_No) return false;
      const parsed = parseBTechRegistration(String(record.Reg_No).trim());
      return parsed && parsed.isValid && parsed.isBTech;
    });

    // Filter by branch if specified (normalize to short codes to avoid CSE/AIML merge)
    if (branchFilter && branchFilter !== "all") {
      const branchShortMap = {
        '111': 'CIVIL',
        '112': 'CSE',
        '113': 'ECE',
        '115': 'EEE',
        '116': 'ME',
        '137': 'AIML'
      };
      const filterShortMap = {
        'CSE': 'CSE',
        'AIML': 'AIML',
        'ECE': 'ECE',
        'EEE': 'EEE',
        'ME': 'ME',
        'MECHANICAL': 'ME',
        'CIVIL': 'CIVIL'
      };
      const filterShort = filterShortMap[branchFilter.toUpperCase()] || branchFilter.toUpperCase();

      records = records.filter(record => {
        if (!record.Reg_No) return false;
        const parsed = parseBTechRegistration(String(record.Reg_No).trim());
        if (!parsed || !parsed.isValid || !parsed.isBTech) return false;

        const parsedShort = branchShortMap[parsed.branchCode] || (parsed.branch || '').toUpperCase().trim();
        return parsedShort === filterShort;
      });
    }

    // Group by student registration number
    const studentMap = new Map();
    records.forEach(record => {
      const regNo = String(record.Reg_No).trim();
      if (!studentMap.has(regNo)) {
        const parsed = parseBTechRegistration(regNo);
        const branchShortMap = {
          '111': 'CIVIL',
          '112': 'CSE',
          '113': 'ECE',
          '115': 'EEE',
          '116': 'ME',
          '137': 'AIML'
        };
        const branchShort = branchShortMap[parsed?.branchCode] || (parsed?.branch || 'Unknown');
        studentMap.set(regNo, {
          regNo: regNo,
          name: record.Name || record.name || 'Unknown',
          branch: branchShort,
          batch: parsed?.year || 'Unknown',
          grade: record.Grade || '',
          semester: record.Sem || '',
          subjectCode: subjectCode.toUpperCase(),
          subjectName: record.Subject_Name || record["Subject Name"] || record.Subject_name || ''
        });
      }
    });

    const students = Array.from(studentMap.values());

    return NextResponse.json({
      success: true,
      students: students,
      count: students.length,
      subjectCode: subjectCode.toUpperCase(),
      school: 'SOET'
    });

  } catch (error) {
    // Removed console.error to reduce overhead
    return NextResponse.json({
      error: `Failed to fetch subject students: ${error.message}`
    }, { status: 500 });
  }
}

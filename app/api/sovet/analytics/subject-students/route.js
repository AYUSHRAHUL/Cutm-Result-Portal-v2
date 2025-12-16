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
 * SOVET Analytics Subject Students Route - Diploma only
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
    
    // Force school to SOVET
    const school = 'SOVET';
    const dbName = getCampusSchoolDatabase(campus, school);
    
    // Removed console.log to reduce overhead
    
    const db = client.db(dbName);
    const cutm = db.collection("result");

    // Build query
    const query = {
      $or: [
        { Subject_Code: subjectCode.toUpperCase() },
        { "Subject Code": subjectCode.toUpperCase() }
      ]
    };

    // Filter for Diploma students only
    const { parseDiplomaRegistration } = await import('../../parse-registration/route');
    
    // Add batch filter
    if (batchFilter && batchFilter !== "all") {
      const batchPrefix = batchFilter.length === 4 ? batchFilter.substring(2, 4) : batchFilter;
      query.Reg_No = { ...(query.Reg_No || {}), $regex: `^${batchPrefix}` };
    }

    // Add semester filter
    if (semesterFilter && semesterFilter !== "all") {
      const cleanSem = String(semesterFilter).replace(/^Sem\s*/i, "").trim();
      query.$or = [
        ...(query.$or || []),
        { Sem: semesterFilter },
        { Sem: cleanSem },
        { Sem: `Sem ${cleanSem}` },
        { Sem: { $regex: new RegExp(`^${cleanSem}$`, 'i') } }
      ];
    }

    // Fetch records with limit to prevent excessive MongoDB connections
    const MAX_SUBJECT_STUDENTS_RECORDS = 10000; // Limit to 10k records
    let records = await cutm.find(query).limit(MAX_SUBJECT_STUDENTS_RECORDS).toArray();

    // Filter for Diploma students
    records = records.filter(record => {
      if (!record.Reg_No) return false;
      const parsed = parseDiplomaRegistration(String(record.Reg_No).trim());
      return parsed && parsed.isValid && parsed.isDiploma;
    });

    // Filter by branch if specified
    if (branchFilter && branchFilter !== "all") {
      records = records.filter(record => {
        if (!record.Reg_No) return false;
        const parsed = parseDiplomaRegistration(String(record.Reg_No).trim());
        if (!parsed || !parsed.isValid || !parsed.isDiploma) return false;
        
        // Map parsed branch names to filter values
        const branchNameMap = {
          'Electrical': ['EE', 'ELECTRICAL'],
          'Mechanical': ['ME', 'MECHANICAL'],
          'Civil': ['CIVIL'],
          'CSE': ['CSE'],
          'Automobile': ['AUTOMOBILE'],
          'Mining': ['MINING']
        };
        
        const branchAliases = branchNameMap[parsed.branch] || [parsed.branch.toUpperCase()];
        const filterUpper = branchFilter.toUpperCase();
        
        return branchAliases.some(alias => 
          filterUpper === alias || 
          filterUpper === `DIPLOMA-${alias}` ||
          filterUpper.includes(alias) ||
          alias.includes(filterUpper)
        ) || filterUpper === parsed.branch.toUpperCase();
      });
    }

    // Group by student registration number
    const studentMap = new Map();
    records.forEach(record => {
      const regNo = String(record.Reg_No).trim();
      if (!studentMap.has(regNo)) {
        const parsed = parseDiplomaRegistration(regNo);
        studentMap.set(regNo, {
          regNo: regNo,
          name: record.Name || record.name || 'Unknown',
          branch: parsed?.branch || 'Unknown',
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
      school: 'SOVET'
    });

  } catch (error) {
    // Removed console.error to reduce overhead
    return NextResponse.json({
      error: `Failed to fetch subject students: ${error.message}`
    }, { status: 500 });
  }
}


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
 * GET /api/som/result-data/students
 * Get all students for a specific subject
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
    if (!["admin"].includes(userRole)) {
      return NextResponse.json({
        error: "Access denied - Only admins can access this data"
      }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const subjectCode = searchParams.get('subject');
    const batchFilter = searchParams.get('batch');
    const branchFilter = searchParams.get('branch');
    const semesterFilter = searchParams.get('semester');

    if (!subjectCode || !batchFilter || !branchFilter || !semesterFilter) {
      return NextResponse.json({ 
        error: "Subject, batch, branch, and semester are required" 
      }, { status: 400 });
    }

    const client = await clientPromise;
    const campusParam = searchParams.get('campus');
    const campus = campusParam || payload.campus || null;
    
    const school = 'SOM';
    const dbName = getCampusSchoolDatabase(campus, school);
    const db = client.db(dbName);
    const cutm = db.collection("som_result");

    // Parse registration to get branch code
    const { parseSOMRegistration } = await import('../../parse-registration/route');

    // Build query
    const andConditions = [
      {
        Reg_No: { $type: "string", $exists: true },
        Grade: { $exists: true }
      }
    ];

    // Add subject filter
    const normalizedSubjectCode = subjectCode.toUpperCase().trim();
    andConditions.push({
      $or: [
        { Subject_Code: normalizedSubjectCode },
        { "Subject Code": normalizedSubjectCode },
        { Subject_Code: { $regex: `^${normalizedSubjectCode}`, $options: 'i' } }
      ]
    });

    // Add batch filter
    if (batchFilter && batchFilter !== "all") {
      let batchPrefix;
      if (batchFilter.length === 4) {
        batchPrefix = batchFilter.substring(2, 4);
      } else if (batchFilter.length === 2) {
        batchPrefix = batchFilter;
      } else {
        const match = batchFilter.match(/(\d{2})$/);
        batchPrefix = match ? match[1] : batchFilter;
      }
      andConditions.push({
        Reg_No: { $regex: `^${batchPrefix}`, $options: 'i' }
      });
    }

    // Add semester filter
    if (semesterFilter && semesterFilter !== "all") {
      const cleanSem = String(semesterFilter).replace(/^Sem\s*/i, "").trim();
      const semNum = parseInt(cleanSem);
      andConditions.push({
        Sem: {
          $in: [
            semesterFilter,
            cleanSem,
            `Sem ${cleanSem}`,
            `Sem${cleanSem}`,
            ...(isNaN(semNum) ? [] : [semNum, String(semNum)])
          ].filter(Boolean)
        }
      });
    }

    const query = andConditions.length > 1 ? { $and: andConditions } : andConditions[0];

    // Fetch records
    const MAX_STUDENTS_RECORDS = 10000;
    let records = await cutm.find(query).limit(MAX_STUDENTS_RECORDS).toArray();

    // Filter for SOM (BBA/MBA) students and specific branch
    const branchCodeMap = {
      '912': ['BBA', 'BBA', 'Bachelor of Business Administration', 'Bachelor of Business Administration (BBA)'],
      '214': ['MBA', 'MBA', 'Master of Business Administration', 'Master of Business Administration (MBA)']
    };

    records = records.filter(record => {
      if (!record.Reg_No) return false;
      const parsed = parseSOMRegistration(String(record.Reg_No).trim());
      if (!parsed || !parsed.isValid || !parsed.isSOM) return false;

      const normalizedFilter = branchFilter.toUpperCase().trim();
      const parsedBranchNames = branchCodeMap[parsed.branchCode] || [];
      
      const matches = parsedBranchNames.some(name => {
        const normalizedName = name.toUpperCase().trim();
        return normalizedName === normalizedFilter || 
               normalizedName.includes(normalizedFilter) || 
               normalizedFilter.includes(normalizedName);
      });
      
      return matches;
    });

    // Group by student (Reg_No) to get unique students with their data
    const studentMap = new Map();
    records.forEach(record => {
      const regNo = String(record.Reg_No || '').trim();
      if (!regNo) return;

      if (!studentMap.has(regNo)) {
        studentMap.set(regNo, {
          regNo: regNo,
          name: record.Name || record.name || '',
          subjectCode: (record.Subject_Code || record["Subject Code"] || '').toUpperCase().trim(),
          subjectName: record.Subject_Name || record["Subject Name"] || record.Subject_name || '',
          semester: record.Sem || semesterFilter,
          grade: record.Grade || '',
          credits: record.Credits || record.Credit || '',
          cgpa: record.CGPA || null,
          sgpa: record.SGPA || null
        });
      }
    });

    const students = Array.from(studentMap.values()).sort((a, b) => 
      a.regNo.localeCompare(b.regNo)
    );

    return NextResponse.json({
      success: true,
      students: students,
      count: students.length
    });

  } catch (error) {
    console.error('Error fetching students:', error);
    return NextResponse.json({
      error: `Failed to fetch students: ${error.message}`
    }, { status: 500 });
  }
}


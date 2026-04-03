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
 * GET /api/som/result-data/subjects
 * Get subjects by batch, branch, and semester with student counts
 */
export async function GET(req) {
  let batchFilter, branchFilter, semesterFilter, campus;
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
    batchFilter = searchParams.get('batch')?.trim();
    branchFilter = searchParams.get('branch')?.trim();
    semesterFilter = searchParams.get('semester')?.trim();

    // Log received parameters for debugging
    console.log('[SUBJECTS API] Received params:', { batchFilter, branchFilter, semesterFilter, campus });

    if (!batchFilter || !branchFilter || !semesterFilter) {
      console.error('[SUBJECTS API] Missing required params:', { 
        batchFilter: !!batchFilter, 
        branchFilter: !!branchFilter, 
        semesterFilter: !!semesterFilter 
      });
      return NextResponse.json({ 
        error: "Batch, branch, and semester are required",
        received: { batchFilter, branchFilter, semesterFilter }
      }, { status: 400 });
    }

    const client = await clientPromise;
    const campusParam = searchParams.get('campus');
    campus = campusParam || payload.campus || null;
    
    const school = 'SOM';
    const dbName = getCampusSchoolDatabase(campus, school);
    const db = client.db(dbName);
    const cutm = db.collection("som_result");

    // Parse registration to get branch code
    const { parseSOMRegistration } = await import('../../parse-registration/route');

    // Build query using $and pattern for proper MongoDB query construction
    const andConditions = [
      {
        Reg_No: { $type: "string", $exists: true },
        Grade: { $exists: true }
      }
    ];

    // Add batch filter - handle both 4-digit (2022) and 2-digit (22) formats
    if (batchFilter && batchFilter !== "all") {
      let batchPrefix;
      if (batchFilter.length === 4) {
        // Full year like "2022" -> extract last 2 digits "22"
        batchPrefix = batchFilter.substring(2, 4);
      } else if (batchFilter.length === 2) {
        // Already 2 digits like "22"
        batchPrefix = batchFilter;
      } else {
        // Try to extract from string
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

    // Build final query
    const query = andConditions.length > 1 ? { $and: andConditions } : andConditions[0];

    // Fetch records with limit to prevent excessive MongoDB connections
    const MAX_SUBJECTS_RECORDS = 50000; // Limit to 50k records
    let records = await cutm.find(query).limit(MAX_SUBJECTS_RECORDS).toArray();

    // Filter for SOM (BBA/MBA) students and specific branch
    records = records.filter(record => {
      if (!record.Reg_No) return false;
      const parsed = parseSOMRegistration(String(record.Reg_No).trim());
      if (!parsed || !parsed.isValid || !parsed.isSOM) return false;

      // Filter by branch - normalize branch codes and names
      const branchCodeMap = {
      '912': ['BBA', 'BBA', 'Bachelor of Business Administration', 'Bachelor of Business Administration (BBA)'],
      '214': ['MBA', 'MBA', 'Master of Business Administration', 'Master of Business Administration (MBA)']
    };
      
      const normalizedFilter = branchFilter.toUpperCase().trim();
      const parsedBranchNames = branchCodeMap[parsed.branchCode] || [];
      
      // Check if filter matches any of the parsed branch names (exact or contains match)
      const matches = parsedBranchNames.some(name => {
        const normalizedName = name.toUpperCase().trim();
        return normalizedName === normalizedFilter || 
               normalizedName.includes(normalizedFilter) || 
               normalizedFilter.includes(normalizedName);
      });
      
      return matches;
    });

    // Group by subject and count students
    const subjectMap = new Map();
    records.forEach(record => {
      const subjectCode = (record.Subject_Code || record["Subject Code"] || '').toUpperCase().trim();
      const subjectName = record.Subject_Name || record["Subject Name"] || record.Subject_name || subjectCode;
      const regNo = String(record.Reg_No || '').trim();

      if (!subjectCode || !regNo) return;

      if (!subjectMap.has(subjectCode)) {
        subjectMap.set(subjectCode, {
          code: subjectCode,
          name: subjectName,
          students: new Set()
        });
      }
      subjectMap.get(subjectCode).students.add(regNo);
    });

    // Convert to array with student counts
    const subjects = Array.from(subjectMap.values()).map(subject => ({
      code: subject.code,
      name: subject.name,
      studentCount: subject.students.size
    })).sort((a, b) => a.code.localeCompare(b.code));

    return NextResponse.json({
      success: true,
      subjects: subjects,
      count: subjects.length
    });

  } catch (error) {
    console.error('Error fetching subjects:', error);
    console.error('Error stack:', error.stack);
    console.error('Query params:', { batchFilter, branchFilter, semesterFilter, campus });
    return NextResponse.json({
      error: `Failed to fetch subjects: ${error.message}`,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}


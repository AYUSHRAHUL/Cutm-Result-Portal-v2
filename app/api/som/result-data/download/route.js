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
 * GET /api/som/result-data/download
 * Download student data for a specific subject
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
        error: "Access denied - Only admins can download data"
      }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const subjectCode = searchParams.get('subject');
    const batchFilter = searchParams.get('batch');
    const branchFilter = searchParams.get('branch');
    const semesterFilter = searchParams.get('semester');

    if (!subjectCode || !batchFilter || !branchFilter || !semesterFilter) {
      return NextResponse.json({ error: "Subject, batch, branch, and semester are required" }, { status: 400 });
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

    // Build query using $and pattern for proper MongoDB query construction
    const andConditions = [
      {
        $or: [
          { Subject_Code: subjectCode.toUpperCase() },
          { "Subject Code": subjectCode.toUpperCase() }
        ],
        Reg_No: { $type: "string" },
        Grade: { $exists: true }
      }
    ];

    // Add batch filter
    if (batchFilter && batchFilter !== "all") {
      const batchPrefix = batchFilter.length === 4 ? batchFilter.substring(2, 4) : batchFilter;
      andConditions.push({
        Reg_No: { $regex: `^${batchPrefix}` }
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
    const MAX_DOWNLOAD_RECORDS = 50000; // Limit to 50k records
    let records = await cutm.find(query).limit(MAX_DOWNLOAD_RECORDS).toArray();

    // Filter for SOM (BBA/MBA) students and specific branch
    records = records.filter(record => {
      if (!record.Reg_No) return false;
      const parsed = parseSOMRegistration(String(record.Reg_No).trim());
      if (!parsed || !parsed.isValid || !parsed.isSOM) return false;

      // Filter by branch
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
      const parsedShort = branchShortMap[parsed.branchCode] || (parsed.branch || '').toUpperCase().trim();
      
      return parsedShort === filterShort;
    });

    // Convert to CSV
    const headers = ['Reg_No', 'Name', 'Subject_Code', 'Subject_Name', 'Sem', 'Grade', 'Credits'];
    const rows = records.map(record => [
      record.Reg_No || '',
      record.Name || record.name || '',
      record.Subject_Code || record["Subject Code"] || '',
      record.Subject_Name || record["Subject Name"] || record.Subject_name || '',
      record.Sem || '',
      record.Grade || '',
      record.Credits || record.Credit || ''
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const csvFileName = `student_data_${subjectCode}_${batchFilter}_${branchFilter}_${semesterFilter}.csv`;
    
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${csvFileName}"`
      }
    });

  } catch (error) {
    console.error('Error downloading data:', error);
    return NextResponse.json({
      error: `Failed to download data: ${error.message}`
    }, { status: 500 });
  }
}


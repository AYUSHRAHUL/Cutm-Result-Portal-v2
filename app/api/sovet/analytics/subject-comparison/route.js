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
 * SOVET Analytics Subject Comparison Route - Diploma only
 * Compares passing rates across multiple subjects
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
    const subjectsParam = searchParams.get('subjects');
    const batchFilter = searchParams.get('batch');
    const branchFilter = searchParams.get('branch');
    const semesterFilter = searchParams.get('semester');

    if (!subjectsParam) {
      return NextResponse.json({ error: "Subjects parameter is required" }, { status: 400 });
    }

    const subjectCodes = subjectsParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

    if (subjectCodes.length === 0) {
      return NextResponse.json({ error: "At least one subject code is required" }, { status: 400 });
    }

    const client = await clientPromise;
    const campusParam = searchParams.get('campus');
    const campus = campusParam || payload.campus || null;
    
    // Force school to SOVET
    const school = 'SOVET';
    const dbName = getCampusSchoolDatabase(campus, school);
    
    console.log(`[SOVET Subject Comparison] Database selection: campus=${campus}, school=${school}, dbName=${dbName}`);
    
    const db = client.db(dbName);
    const cutm = db.collection("result");

    // Build base query
    const baseQuery = {
      $or: subjectCodes.map(code => [
        { Subject_Code: code },
        { "Subject Code": code }
      ]).flat()
    };

    // Add batch filter
    if (batchFilter && batchFilter !== "all") {
      const batchPrefix = batchFilter.length === 4 ? batchFilter.substring(2, 4) : batchFilter;
      baseQuery.Reg_No = { ...(baseQuery.Reg_No || {}), $regex: `^${batchPrefix}` };
    }

    // Add semester filter
    if (semesterFilter && semesterFilter !== "all") {
      const cleanSem = String(semesterFilter).replace(/^Sem\s*/i, "").trim();
      baseQuery.$or = [
        ...(baseQuery.$or || []),
        { Sem: semesterFilter },
        { Sem: cleanSem },
        { Sem: `Sem ${cleanSem}` }
      ];
    }

    // Fetch records
    let records = await cutm.find(baseQuery).toArray();

    // Filter for Diploma students
    const { parseDiplomaRegistration } = await import('../../parse-registration/route');
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

    // Calculate statistics for each subject
    const subjectStats = subjectCodes.map(subjectCode => {
      const subjectRecords = records.filter(record => {
        const code = (record.Subject_Code || record["Subject Code"] || '').toUpperCase();
        return code === subjectCode;
      });

      const total = subjectRecords.length;
      const passed = subjectRecords.filter(r => !['F', 'S', 'M', 'I', 'R'].includes((r.Grade || '').toUpperCase())).length;
      const failed = total - passed;
      const passRate = total > 0 ? ((passed / total) * 100).toFixed(2) : '0.00';

      return {
        subjectCode: subjectCode,
        subjectName: subjectRecords[0]?.Subject_Name || subjectRecords[0]?.["Subject Name"] || subjectRecords[0]?.Subject_name || subjectCode,
        total: total,
        passed: passed,
        failed: failed,
        passRate: parseFloat(passRate)
      };
    });

    return NextResponse.json({
      success: true,
      data: subjectStats.map(stat => ({
        subject: stat.subjectCode,
        subjectName: stat.subjectName,
        totalStudents: stat.total,
        passed: stat.passed,
        failed: stat.failed,
        passRate: stat.passRate
      })),
      count: subjectStats.length,
      school: 'SOVET'
    });

  } catch (error) {
    console.error('SOVET Subject Comparison API error:', error);
    return NextResponse.json({
      error: `Failed to compare subjects: ${error.message}`
    }, { status: 500 });
  }
}


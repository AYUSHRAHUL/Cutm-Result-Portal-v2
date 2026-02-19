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

    // Load Overrides
    const overridesCol = db.collection("branch_overrides");
    const overridesArr = await overridesCol.find({}, { projection: { _id: 0, reg: 1, branch: 1, batch: 1 } }).toArray();
    const overrideMap = new Map(overridesArr.map(o => [String(o.reg || "").toUpperCase(), o]));

    // Helper functions
    const getEffectiveBranch = (regNo, parsedBranch) => {
      const ov = overrideMap.get(String(regNo || "").toUpperCase());
      if (ov?.branch) return ov.branch;
      return parsedBranch || "";
    };
    const getEffectiveBatch = (regNo, parsedYear) => {
      const ov = overrideMap.get(String(regNo || "").toUpperCase());
      if (ov?.batch) return ov.batch;
      return parsedYear || "";
    };

    // Filter for B.Tech students only (parser used after DB query)
    const { parseBTechRegistration } = await import('../../parse-registration/route');

    // Build query so that ALL four parameters are applied together:
    // subject (mandatory) AND optional batch AND optional semester.
    const andConditions = [
      {
        $or: [
          { Subject_Code: subjectCode.toUpperCase() },
          { "Subject Code": subjectCode.toUpperCase() }
        ]
      }
    ];

    // Add batch filter (Reg_No prefix based on batch year OR override)
    if (batchFilter && batchFilter !== "all") {
      const batchPrefix = batchFilter.length === 4 ? batchFilter.substring(2, 4) : batchFilter;
      const targetBatch = batchFilter.length === 4 ? batchFilter : `20${batchFilter}`;

      const batchOverrideRegs = [];
      overridesArr.forEach(ov => {
        if (ov.batch === targetBatch) batchOverrideRegs.push(ov.reg.toUpperCase());
      });

      const batchCondition = {
        $or: [
          { Reg_No: { $regex: `^${batchPrefix}` } }
        ]
      };

      if (batchOverrideRegs.length > 0) {
        batchCondition.$or.push({ Reg_No: { $in: batchOverrideRegs } });
      }

      andConditions.push(batchCondition);
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

    // Filter for B.Tech students and check effective BATCH (if we retrieved via override)
    records = records.filter(record => {
      if (!record.Reg_No) return false;
      const parsed = parseBTechRegistration(String(record.Reg_No).trim());
      if (!parsed || !parsed.isValid || !parsed.isBTech) return false;

      // If batch filter is active, verify effective batch
      if (batchFilter && batchFilter !== "all") {
        const effectiveBatch = getEffectiveBatch(record.Reg_No, parsed.year);
        const targetBatch = batchFilter.length === 4 ? batchFilter : `20${batchFilter}`;
        const targetShort = targetBatch.slice(-2);
        const effectiveShort = effectiveBatch.slice(-2);

        if (effectiveBatch !== targetBatch && effectiveShort !== targetShort) return false;
      }

      return true;
    });

    // Filter by branch if specified (normalize to short codes to avoid CSE/AIML merge)
    if (branchFilter && branchFilter !== "all") {
      // Helper to normalize branch
      const normalizeBranchForCompare = (br) => {
        if (!br) return "";
        const brStr = String(br).trim().toUpperCase();
        const branchMap = {
          'CIVIL ENGINEERING': 'CIVIL',
          'COMPUTER SCIENCE AND ENGINEERING': 'CSE',
          'COMPUTER SCIENCE ENGINEERING': 'CSE',
          'ELECTRONICS AND COMMUNICATION ENGINEERING': 'ECE',
          'ELECTRICAL AND ELECTRONICS ENGINEERING': 'EEE',
          'MECHANICAL ENGINEERING': 'ME', // Keep ME for now as per previous analytics usage
          'ME': 'ME',
          'AIML': 'AIML',
          // Map short params
          'CSE': 'CSE', 'ECE': 'ECE', 'EEE': 'EEE', 'CIVIL': 'CIVIL', 'AIML': 'AIML'
        };
        return branchMap[brStr] || brStr;
      };

      const filterShort = normalizeBranchForCompare(branchFilter);

      records = records.filter(record => {
        const parsed = parseBTechRegistration(String(record.Reg_No).trim());
        // Parsed check already done above, but safe to keep or assume valid

        const effectiveBranch = getEffectiveBranch(record.Reg_No, parsed.branch);
        const effectiveShort = normalizeBranchForCompare(effectiveBranch);

        return effectiveShort === filterShort;
      });
    }

    // Group by student registration number
    const studentMap = new Map();
    records.forEach(record => {
      const regNo = String(record.Reg_No).trim();
      if (!studentMap.has(regNo)) {
        const parsed = parseBTechRegistration(regNo);
        const effectiveBranch = getEffectiveBranch(regNo, parsed?.branch);
        const effectiveBatch = getEffectiveBatch(regNo, parsed?.year);

        // Map effective branch to short code for display/consistency
        const branchShortMap = {
          'Civil Engineering': 'CIVIL',
          'CIVIL': 'CIVIL',
          'Computer Science Engineering': 'CSE',
          'CSE': 'CSE',
          'Electronics & Communication Engineering': 'ECE',
          'ECE': 'ECE',
          'Electrical & Electronics Engineering': 'EEE',
          'EEE': 'EEE',
          'Mechanical Engineering': 'ME',
          'ME': 'ME',
          'AIML': 'AIML'
        };
        // Reuse logic or simplify
        let branchShort = effectiveBranch.toUpperCase();
        if (effectiveBranch === 'Computer Science Engineering') branchShort = 'CSE';
        else if (effectiveBranch === 'Civil Engineering') branchShort = 'CIVIL';
        else if (effectiveBranch === 'Electronics & Communication Engineering') branchShort = 'ECE';
        else if (effectiveBranch === 'Electrical & Electronics Engineering') branchShort = 'EEE';
        else if (effectiveBranch === 'Mechanical Engineering') branchShort = 'ME';

        studentMap.set(regNo, {
          regNo: regNo,
          name: record.Name || record.name || 'Unknown',
          branch: branchShort,
          batch: effectiveBatch || 'Unknown',
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

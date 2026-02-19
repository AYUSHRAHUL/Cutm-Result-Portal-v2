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
 * SOET Analytics Subject Comparison Route - B.Tech only
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

    // Force school to SOET
    const school = 'SOET';
    const dbName = getCampusSchoolDatabase(campus, school);

    console.log(`[SOET Subject Comparison] Database selection: campus=${campus}, school=${school}, dbName=${dbName}`);

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

    // Build base query
    const baseQuery = {
      $or: subjectCodes.map(code => [
        { Subject_Code: code },
        { "Subject Code": code }
      ]).flat()
    };

    // Add batch filter (Reg_No prefix based on batch year OR override)
    if (batchFilter && batchFilter !== "all") {
      const batchPrefix = batchFilter.length === 4 ? batchFilter.substring(2, 4) : batchFilter;
      const targetBatch = batchFilter.length === 4 ? batchFilter : `20${batchFilter}`;

      const batchOverrideRegs = [];
      overridesArr.forEach(ov => {
        if (ov.batch === targetBatch) batchOverrideRegs.push(ov.reg.toUpperCase());
      });

      // We need to AND this batch condition with the existing subject codes
      // But baseQuery structure is currently just the subject OR.
      // We can add Reg_No filtering to baseQuery directly if it's strict regex, 
      // but for OR logic we need to be careful not to break the subject OR.
      // MongoDB allows implicit AND of fields.

      const batchCondition = {
        $or: [
          { Reg_No: { $regex: `^${batchPrefix}` } }
        ]
      };

      if (batchOverrideRegs.length > 0) {
        batchCondition.$or.push({ Reg_No: { $in: batchOverrideRegs } });
      }

      // Merge into baseQuery. Since overlapping $or fields is tricky, 
      // we'll move the subject criteria into an explicit $and along with batch.
      if (baseQuery.$or) {
        // baseQuery is currently just { $or: [subjects] }
        const subjectCondition = { $or: baseQuery.$or };
        delete baseQuery.$or;
        baseQuery.$and = [subjectCondition, batchCondition];
      } else {
        // Should not happen based on code above, but separate logic just in case
        baseQuery.$and = [batchCondition];
      }
    }

    // Add semester filter
    if (semesterFilter && semesterFilter !== "all") {
      const cleanSem = String(semesterFilter).replace(/^Sem\s*/i, "").trim();

      const semCondition = {
        $or: [
          { Sem: semesterFilter },
          { Sem: cleanSem },
          { Sem: `Sem ${cleanSem}` }
        ]
      };

      if (baseQuery.$and) {
        baseQuery.$and.push(semCondition);
      } else {
        // If we didn't add batch filter loop to create $and
        if (baseQuery.$or) {
          const subjectCondition = { $or: baseQuery.$or };
          delete baseQuery.$or;
          baseQuery.$and = [subjectCondition, semCondition];
        } else {
          baseQuery.$and = [semCondition];
        }
      }
    }

    // Fetch records
    // Limit records to prevent excessive MongoDB connections
    const MAX_SUBJECT_COMPARISON_RECORDS = 10000; // Limit to 10k records
    let records = await cutm.find(baseQuery).limit(MAX_SUBJECT_COMPARISON_RECORDS).toArray();

    // Filter for B.Tech students
    const { parseBTechRegistration } = await import('../../parse-registration/route');

    // Filter by Batch (Effective) and B.Tech validity
    records = records.filter(record => {
      if (!record.Reg_No) return false;
      const parsed = parseBTechRegistration(String(record.Reg_No).trim());
      if (!parsed || !parsed.isValid || !parsed.isBTech) return false;

      // If batch filter is active, verify effective batch matches
      if (batchFilter && batchFilter !== "all") {
        const effectiveBatch = getEffectiveBatch(record.Reg_No, parsed.year);
        const targetBatch = batchFilter.length === 4 ? batchFilter : `20${batchFilter}`;
        const targetShort = targetBatch.slice(-2);
        const effectiveShort = effectiveBatch.slice(-2);

        if (effectiveBatch !== targetBatch && effectiveShort !== targetShort) return false;
      }

      return true;
    });

    // Filter by branch if specified (use effective branch)
    if (branchFilter && branchFilter !== "all") {
      const normalizeBranchForCompare = (br) => {
        if (!br) return "";
        const brStr = String(br).trim().toUpperCase();
        const branchMap = {
          'CIVIL ENGINEERING': 'CIVIL',
          'COMPUTER SCIENCE AND ENGINEERING': 'CSE',
          'COMPUTER SCIENCE ENGINEERING': 'CSE',
          'ELECTRONICS AND COMMUNICATION ENGINEERING': 'ECE',
          'ELECTRICAL AND ELECTRONICS ENGINEERING': 'EEE',
          'MECHANICAL ENGINEERING': 'ME',
          'ME': 'ME',
          'AIML': 'AIML',
          'CSE': 'CSE', 'ECE': 'ECE', 'EEE': 'EEE', 'CIVIL': 'CIVIL'
        };
        return branchMap[brStr] || brStr;
      };

      const filterShort = normalizeBranchForCompare(branchFilter);

      records = records.filter(record => {
        const parsed = parseBTechRegistration(String(record.Reg_No).trim());
        const effectiveBranch = getEffectiveBranch(record.Reg_No, parsed.branch);
        const effectiveShort = normalizeBranchForCompare(effectiveBranch);

        return effectiveShort === filterShort;
      });
    }

    // Calculate statistics for each subject
    // S and R grades are unattempted (neither pass nor fail)
    // F, M, I grades are failed
    const subjectStats = subjectCodes.map(subjectCode => {
      const subjectRecords = records.filter(record => {
        const code = (record.Subject_Code || record["Subject Code"] || '').toUpperCase();
        return code === subjectCode;
      });

      const total = subjectRecords.length;
      // Passed: grades that are not F, S, M, I, R
      const passed = subjectRecords.filter(r => {
        const grade = (r.Grade || '').toUpperCase();
        return !['F', 'S', 'M', 'I', 'R'].includes(grade);
      }).length;

      // Unattempted: S and R grades
      const unattempted = subjectRecords.filter(r => {
        const grade = (r.Grade || '').toUpperCase();
        return ['S', 'R'].includes(grade);
      }).length;

      // Failed: F, M, I grades (excluding S and R)
      const failed = subjectRecords.filter(r => {
        const grade = (r.Grade || '').toUpperCase();
        return ['F', 'M', 'I'].includes(grade);
      }).length;

      // Calculate all percentages based on total students so they add up to 100%
      const attempted = total - unattempted;
      const passRate = total > 0 ? ((passed / total) * 100).toFixed(2) : '0.00';
      const failRate = total > 0 ? ((failed / total) * 100).toFixed(2) : '0.00';
      const unattemptedRate = total > 0 ? ((unattempted / total) * 100).toFixed(2) : '0.00';

      return {
        subjectCode: subjectCode,
        subjectName: subjectRecords[0]?.Subject_Name || subjectRecords[0]?.["Subject Name"] || subjectRecords[0]?.Subject_name || subjectCode,
        total: total,
        passed: passed,
        failed: failed,
        unattempted: unattempted,
        attempted: attempted,
        passRate: parseFloat(passRate),
        failRate: parseFloat(failRate),
        unattemptedRate: parseFloat(unattemptedRate)
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
        unattempted: stat.unattempted,
        attempted: stat.attempted,
        passRate: stat.passRate,
        failRate: stat.failRate,
        unattemptedRate: stat.unattemptedRate
      })),
      count: subjectStats.length,
      school: 'SOET'
    });

  } catch (error) {
    // Removed console.error to reduce overhead
    return NextResponse.json({
      error: `Failed to compare subjects: ${error.message}`
    }, { status: 500 });
  }
}

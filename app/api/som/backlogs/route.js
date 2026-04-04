import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { verifyToken } from "@/lib/auth";
import { getCampusSchoolDatabase, getSomStudentDatabaseCandidates } from "@/lib/campus";

// Hard safety cap for very broad admin queries
const MAX_BACKLOG_ROWS = 2000;

/**
 * SOM (School of Management) Backlogs Route
 * Handles SOM (BBA/MBA) students only
 */
export async function POST(req) {
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

    const body = await req.json();
    const client = await clientPromise;

    const userRole = payload.role?.toLowerCase();
    const isStudent = userRole === "user" || userRole === "student";

    if (isStudent) {
      const email = payload.email || "";
      const campusStudent =
        email.includes("@cutm.ac.in") || email.includes("@centurionuniv.edu.in");
      if (campusStudent) {
        const userRegNumber = email.split("@")[0].toUpperCase();
        if (body.registration && String(body.registration).toUpperCase() !== userRegNumber) {
          return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }
        body.registration = userRegNumber;
      }
    }

    const { searchParams } = new URL(req.url);
    const campusParam = searchParams.get("campus");
    const campus = campusParam || payload.campus || null;
    const school = "SOM";

    const { registration, subject_code, registrations, bulkSummary } = body;
    let { branch, year } = body;

    const dbNames = isStudent && registration
      ? getSomStudentDatabaseCandidates(String(registration).toUpperCase())
      : [getCampusSchoolDatabase(campus, school)];

    const overrideMap = new Map();
    const inactiveRegsSet = new Set();
    for (const name of dbNames) {
      const dbc = client.db(name);
      const overridesArr = await dbc
        .collection("branch_overrides")
        .find({}, { projection: { _id: 0, reg: 1, branch: 1, batch: 1 } })
        .toArray();
      overridesArr.forEach((o) => overrideMap.set(String(o.reg || "").toUpperCase(), o));
      const inactiveDocs = await dbc
        .collection("student_status")
        .find({ isActive: { $in: [false, "false"] } })
        .project({ Reg_No: 1 })
        .toArray();
      inactiveDocs.forEach((d) => {
        if (d.Reg_No) inactiveRegsSet.add(String(d.Reg_No).toUpperCase());
      });
    }
    const inactiveRegs = Array.from(inactiveRegsSet);

    const adminDb = client.db(dbNames[0]);
    const cutm = adminDb.collection("som_result");

    // Helper functions
    const getEffectiveBranch = (regNo, recordBranch) => {
      const ov = overrideMap.get(String(regNo || "").toUpperCase());
      if (ov?.branch) return ov.branch;
      return recordBranch || "";
    };
    const getEffectiveBatch = (regNo, recordBatch) => {
      const ov = overrideMap.get(String(regNo || "").toUpperCase());
      if (ov?.batch) return ov.batch;
      if (recordBatch) return recordBatch;
      if (regNo && regNo.length >= 2) return `20${regNo.slice(0, 2)}`;
      return "";
    };

    // Helper to normalize SOM branch names
    const normalizeBranch = (br) => {
      if (!br) return "";
      const brStr = String(br).trim().toUpperCase();
      const branchMap = {
        'BACHELOR OF BUSINESS ADMINISTRATION': 'BBA',
        'BACHELOR OF BUSINESS ADMINISTRATION (BBA)': 'BBA',
        'BBA': 'BBA',
        'MASTER OF BUSINESS ADMINISTRATION': 'MBA',
        'MASTER OF BUSINESS ADMINISTRATION (MBA)': 'MBA',
        'MBA': 'MBA'
      };
      return branchMap[brStr] || brStr;
    };

    // Handle bulk summary request (optimized for admin dashboard)
    if (bulkSummary && registrations && Array.isArray(registrations)) {
      if (userRole !== 'admin' && userRole !== 'teacher') {
        return NextResponse.json({ error: "Access denied - Bulk summary only for admins/teachers" }, { status: 403 });
      }

      // Limit to prevent abuse
      const MAX_BULK_REGISTRATIONS = 5000;
      const regNosToQuery = registrations.slice(0, MAX_BULK_REGISTRATIONS).map(r => String(r).trim().toUpperCase());

      // Single optimized query to get all backlogs for all students
      const bulkQuery = {
        Reg_No: { $in: regNosToQuery },
        Grade: { $in: ["F", "M", "S", "I", "R"] }
      };

      // Exclude inactive students from bulk summary
      if (inactiveRegs.length > 0) {
        bulkQuery.Reg_No = { $in: regNosToQuery, $nin: inactiveRegs };
      }

      // Use aggregation pipeline for better performance with large datasets
      const allBacklogs = await cutm.find(bulkQuery, {
        projection: { _id: 0, Reg_No: 1, Name: 1, Branch: 1 }
      }).toArray();

      // Group by registration number and count
      const summaryMap = new Map();

      // Initialize students with 0 backlogs (only those that are NOT inactive)
      regNosToQuery.forEach(regNo => {
        if (!inactiveRegs.includes(regNo)) {
          summaryMap.set(regNo, { Reg_No: regNo, Name: "", Branch: "", TotalBacklogs: 0 });
        }
      });

      // Count backlogs per student
      allBacklogs.forEach(record => {
        const regNo = String(record.Reg_No || "").toUpperCase();
        if (summaryMap.has(regNo)) {
          const existing = summaryMap.get(regNo);
          existing.TotalBacklogs += 1;
          if (!existing.Name && record.Name) existing.Name = record.Name;

          // Use effective branch if available
          const effectiveBranch = getEffectiveBranch(regNo, record.Branch);
          const displayBranch = normalizeBranch(effectiveBranch);

          if (!existing.Branch && displayBranch) existing.Branch = displayBranch;
        }
      });

      const summaries = Array.from(summaryMap.values());

      return NextResponse.json({
        summaries,
        total: summaries.length,
        school: 'SOM'
      });
    }

    // Standard search query construction
    const query = { Grade: { $in: ["F", "M", "S", "I", "R"] } };

    if (registration) {
      query.Reg_No = registration.toUpperCase();
    } else {
      if (subject_code && String(subject_code).toUpperCase() !== 'ALL') {
        query.Subject_Code = String(subject_code).toUpperCase();
      }
      
      // Batch filter
      if (year && year !== 'All') {
        const yy = year.length === 4 ? year.slice(-2) : year;
        const targetBatch = year.length === 4 ? year : `20${year}`;
        const yearOverrideRegs = overridesArr.filter(ov => ov.batch === targetBatch).map(ov => ov.reg.toUpperCase());
        
        query.$and = query.$and || [];
        query.$and.push({
          $or: [
            { Reg_No: { $regex: new RegExp(`^${yy}`) } },
            { Reg_No: { $in: yearOverrideRegs } }
          ]
        });
      }

      // Branch filter
      if (branch && branch !== 'All') {
        const branchCodeMap = { 'BBA': '912', 'MBA': '214' };
        const branchCode = branchCodeMap[branch.toUpperCase()];
        const targetBranchRaw = branch.toUpperCase();
        
        const branchOverrideRegs = overridesArr
          .filter(ov => {
            const ovBr = normalizeBranch(ov.branch);
            return ovBr === targetBranchRaw || (targetBranchRaw === 'BBA' && ovBr.includes('BUSINESS'));
          })
          .map(ov => ov.reg.toUpperCase());

        const branchCondition = { $or: [] };
        if (branchCode) {
          branchCondition.$or.push({ Reg_No: { $regex: new RegExp(`^.{5}${branchCode}`) } });
        }
        if (branchOverrideRegs.length > 0) {
          branchCondition.$or.push({ Reg_No: { $in: branchOverrideRegs } });
        }
        
        if (branchCondition.$or.length > 0) {
          query.$and = query.$and || [];
          query.$and.push(branchCondition);
        }
      }
    }

    // Exclude inactive
    if (inactiveRegs.length > 0) {
      query.$and = query.$and || [];
      query.$and.push({ Reg_No: { $nin: inactiveRegs } });
    }

    const projection = {
      projection: { _id: 0, Reg_No: 1, Name: 1, Branch: 1, Sem: 1, Subject_Code: 1, Subject_Name: 1, Grade: 1 },
    };
    const sortSpec = { Sem: 1, Subject_Code: 1 };

    let backlogs = [];

    if (isStudent && registration) {
      for (const name of dbNames) {
        const tryDb = client.db(name);
        const rows = await tryDb.collection("som_result").find(query, projection).sort(sortSpec).toArray();
        if (rows.length > 0) {
          backlogs = rows;
          break;
        }
      }
    } else {
      let cursor = cutm.find(query, projection).sort(sortSpec);
      if (!registration && !subject_code) {
        cursor = cursor.limit(MAX_BACKLOG_ROWS);
      }
      backlogs = await cursor.toArray();
    }

    // Final Processing
    const processed = backlogs.map(record => {
      const regNo = String(record.Reg_No || "").toUpperCase();
      return {
        ...record,
        Branch: normalizeBranch(getEffectiveBranch(regNo, record.Branch)),
        Batch: getEffectiveBatch(regNo, null)
      };
    });

    return NextResponse.json({
      backlogs: processed,
      total: processed.length,
      school: 'SOM'
    });
  } catch (err) {
    return NextResponse.json({ error: "Server error: " + err.message }, { status: 500 });
  }
}

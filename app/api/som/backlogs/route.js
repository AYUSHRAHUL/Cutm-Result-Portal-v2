import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { verifyToken } from "@/lib/auth";
import { getCampusSchoolDatabase } from "@/lib/campus";

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

    // Get user role for access control
    const userRole = payload.role?.toLowerCase();

    // Get campus and database
    const { searchParams } = new URL(req.url);
    const campusParam = searchParams.get('campus');
    const campus = campusParam || payload.campus || null;
    const school = 'SOM';
    const dbName = getCampusSchoolDatabase(campus, school);

    const db = client.db(dbName);
    const cutm = db.collection("som_result");

    // Load Overrides
    const overridesCol = db.collection("branch_overrides");
    const overridesArr = await overridesCol.find({}, { projection: { _id: 0, reg: 1, branch: 1, batch: 1 } }).toArray();
    const overrideMap = new Map(overridesArr.map(o => [String(o.reg || "").toUpperCase(), o]));

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

    // Fetch inactive students list
    const statusCollection = db.collection("student_status");
    const inactiveDocs = await statusCollection.find({ isActive: { $in: [false, "false"] } }).project({ Reg_No: 1 }).toArray();
    const inactiveRegs = inactiveDocs.map(d => String(d.Reg_No || "").toUpperCase()).filter(Boolean);

    // Security check: Role-based access control
    if (userRole === 'user' || userRole === 'student') {
      const userRegNumber = payload.email?.split('@')[0]?.toUpperCase();
      if (body.registration && body.registration.toUpperCase() !== userRegNumber) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
      body.registration = userRegNumber;
    }

    // Search for backlogs
    const { registration, subject_code, registrations, bulkSummary } = body;
    let { branch, year } = body;

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

    let cursor = cutm.find(query, {
      projection: { _id: 0, Reg_No: 1, Name: 1, Branch: 1, Sem: 1, Subject_Code: 1, Subject_Name: 1, Grade: 1 }
    }).sort({ Sem: 1, Subject_Code: 1 });

    if (!registration && !subject_code) {
      cursor = cursor.limit(MAX_BACKLOG_ROWS);
    }

    const backlogs = await cursor.toArray();

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

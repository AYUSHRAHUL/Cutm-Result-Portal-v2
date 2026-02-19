import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { verifyToken } from "@/lib/auth";
import { getCampusSchoolDatabase, getDatabaseFromRegistration } from "@/lib/campus";

// Hard safety cap for very broad admin queries
const MAX_BACKLOG_ROWS = 2000;

/**
 * SOET (School of Engineering & Technology) Backlogs Route
 * Handles B.Tech students only
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

    // For user role, determine database from registration number (indices 2-5)
    // For admin/teacher, use campus/school from params or JWT
    let dbName;
    if (userRole === 'user' || userRole === 'student') {
      const registration = body.registration || (payload.email && payload.email.includes('@cutm.ac.in') ? payload.email.split('@')[0] : null);
      if (registration) {
        dbName = getDatabaseFromRegistration(registration);
      } else {
        // Fallback to default
        const { searchParams } = new URL(req.url);
        const campusParam = searchParams.get('campus');
        const campus = campusParam || payload.campus || null;
        const school = 'SOET';
        dbName = getCampusSchoolDatabase(campus, school);
      }
    } else {
      // Get campus from query params (priority) or payload
      const { searchParams } = new URL(req.url);
      const campusParam = searchParams.get('campus');
      const campus = campusParam || payload.campus || null;
      // Force school to SOET for this route
      const school = 'SOET';
      dbName = getCampusSchoolDatabase(campus, school);
    }

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
      // Derived from Reg_No if no override
      if (parsedYear) return parsedYear;
      if (regNo && regNo.length >= 2) return `20${regNo.slice(0, 2)}`;
      return "";
    };

    // Helper to normalize branch names
    const normalizeBranch = (br) => {
      if (!br) return "";
      const brStr = String(br).trim().toUpperCase();
      const branchMap = {
        'CIVIL ENGINEERING': 'Civil',
        'CIVIL': 'Civil',
        'COMPUTER SCIENCE AND ENGINEERING': 'CSE',
        'COMPUTER SCIENCE ENGINEERING': 'CSE',
        'CSE': 'CSE',
        'ELECTRONICS AND COMMUNICATION ENGINEERING': 'ECE',
        'ELECTRONICS & COMMUNICATION ENGINEERING': 'ECE',
        'ECE': 'ECE',
        'ELECTRICAL AND ELECTRONICS ENGINEERING': 'EEE',
        'ELECTRICAL & ELECTRONICS ENGINEERING': 'EEE',
        'EEE': 'EEE',
        'MECHANICAL ENGINEERING': 'Mechanical',
        'MECHANICAL': 'Mechanical',
        'ME': 'Mechanical',
        'AIML': 'AIML'
      };
      return branchMap[brStr] || brStr; // Return mapped value or original
    };

    // Fetch inactive students list (Global Exclusion)
    const statusCollection = db.collection("student_status");
    const inactiveDocs = await statusCollection.find({ isActive: false }).project({ Reg_No: 1 }).toArray();
    const inactiveRegs = inactiveDocs.map(d => d.Reg_No);

    // Ensure indexes exist for optimal performance (creates only if not exist)
    try {
      await cutm.createIndex({ Grade: 1 });
      await cutm.createIndex({ Reg_No: 1, Grade: 1 });
    } catch (indexErr) {
      // Index creation failures are non-fatal
    }

    // Security check: Role-based access control
    if (userRole === 'user' || userRole === 'student') {
      // Students can only view their own backlog data
      const userEmail = payload.email;
      if (userEmail && userEmail.includes('@cutm.ac.in')) {
        const userRegNumber = userEmail.split('@')[0];
        if (body.registration && body.registration !== userRegNumber) {
          return NextResponse.json({
            error: "Access denied - Students can only view their own backlog data"
          }, { status: 403 });
        }
        // Auto-fill registration for students
        if (!body.registration) {
          body.registration = userRegNumber;
        }
      }
    } else if (userRole === 'teacher' || userRole === 'admin') {
      // Teachers and admins can view any student's backlog data
    } else {
      return NextResponse.json({
        error: "Access denied - Invalid user role"
      }, { status: 403 });
    }

    // Clear action (only for admins)
    if (body.action === "clear") {
      if (userRole !== 'admin') {
        return NextResponse.json({
          error: "Access denied - Only administrators can clear backlogs"
        }, { status: 403 });
      }

      const { registration, subject_code } = body;
      if (!registration || !subject_code) return NextResponse.json({ error: "registration and subject_code required" }, { status: 400 });
      const res = await cutm.updateOne(
        { Reg_No: registration.toUpperCase(), Subject_Code: subject_code.toUpperCase() },
        { $set: { Grade: "P" } }
      );
      if (res.matchedCount === 0) return NextResponse.json({ error: "Record not found" }, { status: 404 });
      return NextResponse.json({ success: true });
    }

    // Search for backlogs
    const { registration, subject_code, registrations } = body;
    let { branch, year, semesters = [], allowAll, bulkSummary } = body;

    // Handle bulk summary request (optimized for admin dashboard)
    if (bulkSummary && registrations && Array.isArray(registrations)) {
      if (userRole !== 'admin' && userRole !== 'teacher') {
        return NextResponse.json({ error: "Access denied - Bulk summary only for admins/teachers" }, { status: 403 });
      }

      // Limit to prevent abuse
      const MAX_BULK_REGISTRATIONS = 5000;
      const regNosToQuery = registrations.slice(0, MAX_BULK_REGISTRATIONS).map(r => r.toUpperCase());

      // Single optimized query to get all backlogs for all students
      const bulkQuery = {
        Reg_No: { $in: regNosToQuery },
        Grade: { $in: ["F", "M", "S", "I", "R"] }
      };

      // Exclude inactive students from bulk summary
      if (inactiveRegs.length > 0) {
        // If Reg_No is already filtered by specific list ($in: regNosToQuery),
        // we should remove inactive ones from that list effectively.
        // Or simply add a $nin clause which Mongo handles.
        // Ideally, modify regNosToQuery before query construction?
        bulkQuery.Reg_No = { $in: regNosToQuery, $nin: inactiveRegs };
      }

      // Use aggregation pipeline for better performance with large datasets
      const allBacklogs = await cutm.aggregate([
        { $match: bulkQuery },
        { $project: { _id: 0, Reg_No: 1, Name: 1, Branch: 1 } },
        { $limit: regNosToQuery.length * 50 } // Safety limit: max 50 backlogs per student
      ]).toArray();

      // Group by registration number and count
      const summaryMap = new Map();

      // Initialize all students with 0 backlogs
      regNosToQuery.forEach(regNo => {
        summaryMap.set(regNo, { Reg_No: regNo, Name: "", Branch: "", TotalBacklogs: 0 });
      });

      // Count backlogs per student
      allBacklogs.forEach(record => {
        const regNo = record.Reg_No;
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
        school: 'SOET'
      });
    }

    const query = { Grade: { $in: ["F", "M", "S", "I", "R"] } };

    // Guard: avoid returning entire collection when no filters given
    if (!registration && !subject_code && !branch && !year && (!semesters || semesters.length === 0)) {
      // Allow explicit "allowAll" for admin and teacher only
      if (!(allowAll && (userRole === 'admin' || userRole === 'teacher'))) {
        return NextResponse.json({ error: "Please provide at least one filter (registration, subject code, branch, year, or semester)" }, { status: 400 });
      }
    }

    if (registration) {
      // Support both string and numeric Reg_No in database (like result route does)
      const regUpper = registration.toUpperCase();
      const regAsInt = parseInt(regUpper, 10);
      const regQuery = isNaN(regAsInt)
        ? [{ Reg_No: regUpper }]
        : [{ Reg_No: regUpper }, { Reg_No: regAsInt }];

      // Combine Grade condition with Reg_No condition using $and
      // This ensures both conditions are applied correctly
      query.$and = [
        { Grade: { $in: ["F", "M", "S", "I", "R"] } },
        { $or: regQuery }
      ];
      // Remove the top-level Grade since it's now in $and
      delete query.Grade;
    }

    if (subject_code) {
      const sc = String(subject_code).toUpperCase();
      if (sc !== 'ALL') {
        query.Subject_Code = sc;
      }
    }

    // Apply semester filter if provided
    if (semesters.length > 0 && !semesters.includes("All")) {
      query.Sem = { $in: semesters };
    }

    // Filter by year if provided (Database level optimization)
    // Skip year filter if we already have an exact registration match
    if (year && year !== 'All' && !registration) {
      const yy = year.length === 4 ? year.slice(-2) : year;
      const targetBatch = year.length === 4 ? year : `20${year}`;

      // Find overrides for this batch
      const yearOverrideRegs = [];
      overridesArr.forEach(ov => {
        if (ov.batch === targetBatch) yearOverrideRegs.push(ov.reg.toUpperCase());
      });

      // Construct regex for standard matching
      const yearRegex = new RegExp(`^${yy}`); // Match registrations starting with 2-digit year

      if (yearOverrideRegs.length > 0) {
        // Add $and clause if it doesn't exist, else append
        if (!query.$and) query.$and = [];

        query.$and.push({
          $or: [
            { Reg_No: { $regex: yearRegex } },
            { Reg_No: { $in: yearOverrideRegs } }
          ]
        });
      } else {
        // Standard regex match only
        query.Reg_No = { $regex: yearRegex };
      }
    }

    // Optimize branch filtering at database level when possible
    if (branch && branch !== 'All' && !registration) {
      // Map branch names to codes for database-level filtering
      // B.Tech branch codes are at positions 5-7 (0-indexed) in registration number
      const branchCodeMap = {
        'Civil Engineering': '111',
        'Computer Science and Engineering': '112',
        'Electronics and Communication Engineering': '113',
        'Electrical and Electronics Engineering': '115',
        'Mechanical Engineering': '116',
        'AIML': '137',
        'Civil': '111',
        'CSE': '112',
        'ECE': '113',
        'EEE': '115',
        'Mechanical': '116',
        'ME': '116'
      };

      const branchCode = branchCodeMap[branch];

      // Find overrides for this branch
      const branchOverrideRegs = [];
      const targetBranchRaw = branch.toUpperCase();
      const lookupBranches = [];
      if (targetBranchRaw.includes('CSE') || targetBranchRaw.includes('COMPUTER')) lookupBranches.push('Computer Science Engineering');
      else if (targetBranchRaw.includes('CIVIL')) lookupBranches.push('Civil Engineering');
      else if (targetBranchRaw.includes('ECE') || targetBranchRaw.includes('ELECTRONICS')) lookupBranches.push('Electronics & Communication Engineering');
      else if (targetBranchRaw.includes('EEE') || targetBranchRaw.includes('ELECTRICAL')) lookupBranches.push('Electrical & Electronics Engineering');
      else if (targetBranchRaw.includes('ME') || targetBranchRaw.includes('MECHANICAL')) lookupBranches.push('Mechanical Engineering');
      else if (targetBranchRaw.includes('AIML')) lookupBranches.push('AIML');

      if (lookupBranches.length > 0) {
        overridesArr.forEach(ov => {
          if (lookupBranches.includes(ov.branch)) branchOverrideRegs.push(ov.reg.toUpperCase());
        });
      }

      if (branchCode) {
        // Add regex to match branch code at positions 5-7 for B.Tech
        // Registration format: YY III BB SSSS (positions 0-1=year, 2-4=inst, 5-7=branch, 8-11=serial)

        // If year filter set query.Reg_No as strict regex, appending here will conflict if we overwrite.
        // If we moved year filter to $and logic (above), query.Reg_No might be undefined here.

        // Standard regex for match: (year regex + digits) OR (\d{5} + branchCode)
        // Since year filter logic is complex now, let's treat branch filter as independent AND condition
        const regexPattern = `^\\d{5}${branchCode}`;

        const branchCondition = {};
        if (branchOverrideRegs.length > 0) {
          branchCondition.$or = [
            { Reg_No: { $regex: regexPattern } },
            { Reg_No: { $in: branchOverrideRegs } }
          ];
        } else {
          branchCondition.Reg_No = { $regex: regexPattern };
        }

        if (!query.$and) query.$and = [];
        query.$and.push(branchCondition);
      } else if (branchOverrideRegs.length > 0) {
        // No standard code map match, but maybe overrides exist?
        if (!query.$and) query.$and = [];
        query.$and.push({ Reg_No: { $in: branchOverrideRegs } });
      }
    }

    // Exclude inactive students from main query
    if (inactiveRegs.length > 0) {
      // Add globally to $and to be safe
      if (!query.$and) query.$and = [];
      query.$and.push({ Reg_No: { $nin: inactiveRegs } });
    }

    // Build cursor with lean projection and sort
    let cursor = cutm.find(query, {
      projection: {
        _id: 0,
        Reg_No: 1,
        Name: 1,
        Branch: 1,
        Sem: 1,
        Subject_Code: 1,
        Subject_Name: 1,
        Grade: 1
      }
    }).sort({ Sem: 1, Subject_Code: 1 });

    // For very broad "allowAll" admin queries, cap rows for performance
    if (!registration && !subject_code && allowAll && (userRole === 'admin' || userRole === 'teacher')) {
      cursor = cursor.limit(MAX_BACKLOG_ROWS);
    }

    const backlogs = await cursor.toArray();

    // Quick validation: Filter B.Tech records by checking branch codes at positions 5-7
    // B.Tech format: YY IIII BB SSSS (12 digits), branch codes: 111, 112, 113, 115, 116, 137
    // Quick validation: Filter B.Tech records by checking branch codes at positions 5-7
    // B.Tech format: YY IIII BB SSSS (12 digits), branch codes: 111, 112, 113, 115, 116, 137
    const validBacklogs = backlogs.filter(record => {
      // Handle both string and numeric Reg_No formats
      let regNo = record.Reg_No;
      if (typeof regNo === 'number') {
        // Convert number to string, pad with leading zeros if needed
        regNo = String(regNo).padStart(12, '0');
      } else {
        regNo = String(regNo || '').trim();
      }

      if (regNo.length !== 12) return false;

      // Override Bypass: If this student has an override, they are valid regardless of reg format
      if (overrideMap.has(regNo.toUpperCase())) return true;

      // Check if program code (positions 4-5) is NOT '07' (Diploma)
      const programCode = regNo.slice(4, 6);
      if (programCode === '07') return false; // Skip Diploma
      // Check if branch code (positions 5-7) is a valid B.Tech branch code
      const branchCode = regNo.slice(5, 8);
      const validBranchCodes = ['111', '112', '113', '115', '116', '137'];
      return validBranchCodes.includes(branchCode);
    });

    // Parse and enrich only valid records
    const processedBacklogs = validBacklogs.map(record => {
      const regNo = String(record.Reg_No || '').trim();

      // Fast extraction without full parsing
      let batch = getEffectiveBatch(regNo, null); // will use default logic if no override
      let branchName = record.Branch || 'N/A';

      const effectiveBranch = getEffectiveBranch(regNo, null);
      if (effectiveBranch) {
        branchName = normalizeBranch(effectiveBranch);
      } else {
        // If no override, try to parse from Reg_No if available
        if (regNo.length >= 12) {
          const branchCode = regNo.slice(5, 8);
          const branchCodeMap = {
            '111': 'Civil',
            '112': 'CSE',
            '113': 'ECE',
            '115': 'EEE',
            '116': 'Mechanical',
            '137': 'AIML'
          };
          // Only update if standard extraction works and we didn't have a good DB value
          if (branchCodeMap[branchCode]) branchName = branchCodeMap[branchCode];
        }
      }

      return {
        ...record,
        Batch: batch,
        Branch: branchName
      };
    });

    // Since we already filtered at DB level (if branch was provided), no need for additional JS filtering
    const finalBacklogs = processedBacklogs;

    return NextResponse.json({
      backlogs: finalBacklogs,
      total: finalBacklogs.length,
      registration: registration || "auto-filled",
      school: 'SOET'
    });
  } catch (err) {
    // Removed console.error to reduce overhead
    return NextResponse.json({ error: "Server error: " + err.message }, { status: 500 });
  }
}

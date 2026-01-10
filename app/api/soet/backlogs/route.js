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
          if (!existing.Branch && record.Branch) existing.Branch = record.Branch;
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
      // Match registrations starting with the 2-digit batch year (index friendly prefix)
      query.Reg_No = { $regex: `^${yy}` };
    }

    // Optimize branch filtering at database level when possible
    if (branch && branch !== 'All' && !registration) {
      // Map branch names to codes for database-level filtering
      // B.Tech branch codes are at positions 5-7 (0-indexed) in registration number
      // Format: YY IIII BB SSSS (12 digits), branch codes: 111, 112, 113, 115, 116, 137
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
      if (branchCode) {
        // Add regex to match branch code at positions 5-7 for B.Tech
        // Registration format: YY III BB SSSS (positions 0-1=year, 2-4=inst, 5-7=branch, 8-11=serial)
        const existingRegex = query.Reg_No?.$regex;
        if (existingRegex) {
          // Combine with year filter - year is first 2 digits, then 3 inst digits, then branch code
          // If year regex is ^22, we need ^22\\d{3}${branchCode} (year + 3 digits of inst code + branch code)
          const yearPattern = existingRegex.slice(1); // Remove ^ from regex
          query.Reg_No = { $regex: `^${yearPattern}\\d{3}${branchCode}` };
        } else {
          // Just branch filter - branch code is at positions 5-7, so after first 5 digits (year + inst)
          query.Reg_No = { $regex: `^\\d{5}${branchCode}` };
        }
      }
    }

    // Exclude inactive students from main query
    if (inactiveRegs.length > 0) {
      if (query.Reg_No) {
        // If Reg_No exists (string, regex, or object), merge with $nin
        if (typeof query.Reg_No === 'string') {
          if (inactiveRegs.includes(query.Reg_No)) {
            query.Reg_No = { $in: [] }; // Force empty result
          }
        } else if (query.Reg_No.$regex) {
          // If existing is regex, convert to object with $regex AND $nin
          query.Reg_No = { $regex: query.Reg_No.$regex, $nin: inactiveRegs };
        } else {
          // If it's already an object (e.g. { $in: ... }), add $nin
          query.Reg_No.$nin = inactiveRegs;
        }
      } else if (query.$and) {
        // If query uses $and (e.g. for registration search), add exclusion there
        query.$and.push({ Reg_No: { $nin: inactiveRegs } });
      } else {
        // Simple case: add direct exclusion
        query.Reg_No = { $nin: inactiveRegs };
      }
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
      const regNo = record.Reg_No || '';

      // Fast extraction without full parsing
      let batch = 'N/A';
      let branchName = record.Branch || 'N/A';

      if (regNo.length >= 12) {
        const yy = regNo.slice(0, 2);
        batch = `20${yy}`;

        // Extract branch code (positions 5-7, 0-indexed)
        const branchCode = regNo.slice(5, 8);
        const branchCodeMap = {
          '111': 'Civil',
          '112': 'CSE',
          '113': 'ECE',
          '115': 'EEE',
          '116': 'Mechanical',
          '137': 'AIML'
        };
        branchName = branchCodeMap[branchCode] || branchName;
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

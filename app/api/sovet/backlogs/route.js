import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { verifyToken } from "@/lib/auth";
import { getCampusSchoolDatabase, getDatabaseFromRegistration } from "@/lib/campus";
import { parseDiplomaRegistration } from "@/lib/parse-diploma-registration";

// Hard safety cap for very broad admin queries
const MAX_BACKLOG_ROWS = 2000;

/**
 * SOVET (School of Vocational Education & Training) Backlogs Route
 * Handles Diploma students only
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
        const school = 'SOVET';
        dbName = getCampusSchoolDatabase(campus, school);
      }
    } else {
      // Get campus from query params (priority) or payload
      const { searchParams } = new URL(req.url);
      const campusParam = searchParams.get('campus');
      const campus = campusParam || payload.campus || null;
      // Force school to SOVET for this route
      const school = 'SOVET';
      dbName = getCampusSchoolDatabase(campus, school);
    }
    
    // Removed console.log to reduce overhead
    
    const db = client.db(dbName);
    const cutm = db.collection("result");

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
      // Removed console.log to reduce overhead
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
        school: 'SOVET'
      });
    }

    // Use unified parser
    // Already imported at top

    const query = { Grade: { $in: ["F", "M", "S", "I", "R"] } };

    // Guard: avoid returning entire collection when no filters given
    if (!registration && !subject_code && !branch && !year && (!semesters || semesters.length === 0)) {
      // Allow explicit "allowAll" for admin and teacher only
      if (!(allowAll && (userRole === 'admin' || userRole === 'teacher'))) {
        return NextResponse.json({ error: "Please provide at least one filter (registration, subject code, branch, year, or semester)" }, { status: 400 });
      }
    }

    if (registration) {
      query.Reg_No = registration.toUpperCase();
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
    if (year && year !== 'All') {
      const yy = year.length === 4 ? year.slice(-2) : year;
      // Match registrations starting with the 2-digit batch year (index friendly prefix)
      query.Reg_No = { $regex: `^${yy}` };
    }

    // Optimize branch filtering at database level for Diploma
    if (branch && branch !== 'All' && !registration) {
      // Map branch names to codes for Diploma (positions 5-7: 071XX)
      const branchCodeMap = {
        'Civil Engineering': '13',
        'Civil': '13',
        'Mechanical Engineering': '12',
        'Mechanical': '12',
        'ME': '12',
        'Electrical Engineering': '11',
        'Electrical': '11',
        'EEE': '11',
        'Computer Science Engineering': '(40|41|14|43)',
        'CSE': '(40|41|14|43)',
        'Automobile Engineering': '(15|44)',
        'Automobile': '(15|44)',
        'AE': '(15|44)',
        'Mining Engineering': '(16|46)',
        'Mining': '(16|46)',
        'MiE': '(16|46)'
      };

      const branchCode = branchCodeMap[branch];
      if (branchCode) {
        const existingRegex = query.Reg_No?.$regex;
        if (existingRegex) {
          // Combine with year filter
          query.Reg_No = { $regex: `^${existingRegex.slice(1)}071${branchCode}` };
        } else {
          // Just branch filter (071 = Diploma)
          query.Reg_No = { $regex: `^\\d{4}071${branchCode}` };
        }
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

    // Parse and enrich records (Diploma only)
    const processedBacklogs = backlogs.map(record => {
      const regNo = record.Reg_No || '';
      const parsed = parseDiplomaRegistration(regNo);

      let batch = 'N/A';
      let branchName = record.Branch || 'N/A';

      if (parsed && parsed.isValid && parsed.isDiploma) {
        batch = parsed.year; // "2023"
        branchName = parsed.branch; // "Civil", "CSE", etc.
      } else if (regNo.length >= 2) {
        // Fallback
        batch = `20${regNo.slice(0, 2)}`;
      }

      return {
        ...record,
        Batch: batch,
        Branch: branchName,
        _parsed: parsed // Keep parsed object for filtering
      };
    }).filter(item => {
      // Filter out non-Diploma records
      return item._parsed && item._parsed.isValid && item._parsed.isDiploma;
    });

    // Apply strict Branch Filtering in JS (Diploma branches only)
    let filteredBacklogs = processedBacklogs;

    if (branch && branch !== 'All') {
      filteredBacklogs = filteredBacklogs.filter(item => {
        const parsed = item._parsed;
        if (!parsed || !parsed.isValid || !parsed.isDiploma) return false;

        // Handle Diploma branches
        if (branch.startsWith('Diploma-')) {
          const diplomaBranchCode = branch.replace('Diploma-', '');
          const branchCodeMap = {
            'EE': '11',   // Electrical
            'ME': '12',   // Mechanical
            'CE': '13',   // Civil
            'AE': '15',   // Automobile
            'MiE': '16',  // Mining
            'CSE': '40',  // Computer Science
            'ECE': '47'   // Electronics
          };
          const expectedCode = branchCodeMap[diplomaBranchCode];
          return parsed.branchCode === expectedCode;
        }

        // Handle Generic Branch names for Diploma
        if (branch === 'Civil Engineering' || branch === 'Civil') return parsed.branchCode === '13';
        if (branch === 'Mechanical Engineering' || branch === 'Mechanical') return parsed.branchCode === '12';
        if (branch === 'Electrical Engineering' || branch === 'EEE' || branch === 'Electrical') return parsed.branchCode === '11';
        if (branch === 'Computer Science Engineering' || branch === 'CSE') return parsed.branchCode === '40' || parsed.branchCode === '41' || parsed.branchCode === '14' || parsed.branchCode === '43';
        if (branch === 'Automobile Engineering' || branch === 'Automobile' || branch === 'AE') return parsed.branchCode === '15' || parsed.branchCode === '44';
        if (branch === 'Mining Engineering' || branch === 'Mining' || branch === 'MiE') return parsed.branchCode === '16' || parsed.branchCode === '46';
        
        return false;
      });
    }

    // Clean up internal _parsed property before returning
    const finalBacklogs = filteredBacklogs.map(({ _parsed, ...rest }) => rest);

    // Removed console.log to reduce overhead

    return NextResponse.json({
      backlogs: finalBacklogs,
      total: finalBacklogs.length,
      registration: registration || "auto-filled",
      school: 'SOVET'
    });
  } catch (err) {
    // Removed console.error to reduce overhead
    return NextResponse.json({ error: "Server error: " + err.message }, { status: 500 });
  }
}

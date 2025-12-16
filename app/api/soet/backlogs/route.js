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
    const { registration, subject_code } = body;
    let { branch, year, semesters = [], allowAll } = body;

    // Use unified parser
    const { parseBTechRegistration } = await import('../parse-registration/route');

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

    console.log("SOET Backlog search query:", JSON.stringify(query));

    // Build cursor with projection and sort
    let cursor = cutm.find(query).project({
      _id: 0,
      Reg_No: 1,
      Name: 1,
      Branch: 1,
      Sem: 1,
      Subject_Code: 1,
      Subject_Name: 1,
      Grade: 1
    }).sort({ Sem: 1, Subject_Code: 1 });

    // For very broad "allowAll" admin queries, cap rows for performance
    if (!registration && !subject_code && allowAll && (userRole === 'admin' || userRole === 'teacher')) {
      cursor = cursor.limit(MAX_BACKLOG_ROWS);
    }

    const backlogs = await cursor.toArray();

    // Parse and enrich records (B.Tech only)
    const processedBacklogs = backlogs.map(record => {
      const regNo = record.Reg_No || '';
      const parsed = parseBTechRegistration(regNo);

      let batch = 'N/A';
      let branchName = record.Branch || 'N/A';

      if (parsed && parsed.isValid && parsed.isBTech) {
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
      // Filter out non-B.Tech records
      return item._parsed && item._parsed.isValid && item._parsed.isBTech;
    });

    // Apply strict Branch Filtering in JS (B.Tech branches only)
    let filteredBacklogs = processedBacklogs;

    if (branch && branch !== 'All') {
      filteredBacklogs = filteredBacklogs.filter(item => {
        const parsed = item._parsed;
        if (!parsed || !parsed.isValid || !parsed.isBTech) return false;

        // Handle B.Tech branches only
        const branchMap = {
          'Civil Engineering': 'Civil',
          'Computer Science and Engineering': 'CSE',
          'Electronics and Communication Engineering': 'ECE',
          'Electrical and Electronics Engineering': 'EEE',
          'Mechanical Engineering': 'Mechanical',
          'AIML': 'AIML',
          'Civil': 'Civil',
          'CSE': 'CSE',
          'ECE': 'ECE',
          'EEE': 'EEE',
          'Mechanical': 'Mechanical',
          'ME': 'Mechanical'
        };

        const targetBranch = branchMap[branch] || branch;
        return parsed.branch === targetBranch;
      });
    }

    // Clean up internal _parsed property before returning
    const finalBacklogs = filteredBacklogs.map(({ _parsed, ...rest }) => rest);

    return NextResponse.json({
      backlogs: finalBacklogs,
      total: finalBacklogs.length,
      registration: registration || "auto-filled",
      school: 'SOET'
    });
  } catch (err) {
    console.error("/api/soet/backlogs error", err);
    return NextResponse.json({ error: "Server error: " + err.message }, { status: 500 });
  }
}

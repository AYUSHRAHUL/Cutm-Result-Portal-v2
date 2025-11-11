import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { verifyToken } from "@/lib/auth";

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
    const db = client.db("cutm1");
    const cutm = db.collection("CUTM1");

    // Get user role for access control
    const userRole = payload.role?.toLowerCase();

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
      console.log(`Access granted to ${userRole}: ${payload.email} accessing backlog data`);
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

    // Normalize inputs
    const branchKey = normalizeBranchKey(String(branch || ""));
    year = typeof year === "string" ? year.trim() : year;
    const query = { Grade: { $in: ["F","M","S","I","R"] } };
    
    // Guard: avoid returning entire collection when no filters given
    if (!registration && !subject_code && !branchKey && !year && (!semesters || semesters.length === 0)) {
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
    
    // Optional branch/year filters by Reg_No patterns
    const and = [];
    if (branchKey) {
      const codes = branchCodes(branchKey);
      if (codes && codes.length > 0) {
        // Match any of the valid department codes at 8th character
        and.push({
          $or: codes.map(c => ({ Reg_No: { $regex: `^.{7}${c}` } }))
        });
      }
    }
    if (year && year !== 'All') {
      const yy = year.length === 4 ? year.slice(-2) : year;
      and.push({ Reg_No: { $regex: `^${yy}` } });
    }
    if (and.length) query.$and = and;

    console.log("Backlog search query:", JSON.stringify(query));

    // Get backlogs with Name and Branch fields
    const backlogs = await cutm.find(query).project({ 
      _id: 0, 
      Reg_No: 1, 
      Name: 1, 
      Branch: 1,
      Sem: 1,
      Subject_Code: 1,
      Subject_Name: 1,
      Grade: 1
    }).sort({ Sem: 1, Subject_Code: 1 }).toArray();
    
    // Helper function to derive branch from Reg_No
    function getBranchFromRegNo(regNo) {
      if (!regNo || regNo.length < 8) return 'N/A';
      const deptCode = regNo.charAt(7);
      const branchMap = {
        '1': 'Civil Engineering',
        '2': 'Computer Science Engineering',
        '3': 'Electronics & Communication Engineering',
        '4': 'Electronics & Communication Engineering', // Alternative code
        '5': 'Electrical & Electronics Engineering',
        '6': 'Mechanical Engineering',
        '7': 'AIML',
        '8': 'Computer Science Engineering', // Alternative code
        '9': 'Civil Engineering' // Alternative code
      };
      return branchMap[deptCode] || 'N/A';
    }
    
    // Load branch overrides for all registrations in this result
    const regSet = Array.from(new Set(backlogs.map(r => r.Reg_No).filter(Boolean)));
    let overrides = new Map();
    try {
      const ovDocs = await db.collection("branch_overrides").find({ reg: { $in: regSet } }).project({ reg: 1, branch: 1 }).toArray();
      overrides = new Map(ovDocs.map(d => [d.reg, d.branch]));
    } catch {}

    // Extract batch from Reg_No for each record and derive Branch if missing
    const backlogsWithBatch = backlogs.map(record => {
      let batch = 'N/A';
      if (record.Reg_No && record.Reg_No.length >= 2) {
        const batchDigits = record.Reg_No.slice(0, 2);
        batch = `20${batchDigits}`;
      }
      
      // Derive branch from Reg_No if not in the record
      const branch = overrides.get(record.Reg_No) || record.Branch || getBranchFromRegNo(record.Reg_No);
      
      return {
        ...record,
        Batch: batch,
        Branch: branch
      };
    });

    // If branch filter was requested, apply a robust branch match using overrides/name synonyms
    let filteredBacklogs = backlogsWithBatch;
    if (branchKey) {
      const target = String(branchKey).toUpperCase();
      const branchSynonyms = {
        'CSE': ['CSE','COMPUTER SCIENCE','COMPUTER SCIENCE ENGINEERING'],
        'ECE': ['ECE','ELECTRONICS & COMMUNICATION','ELECTRONICS AND COMMUNICATION','ELECTRONICS COMMUNICATION'],
        'EEE': ['EEE','ELECTRICAL & ELECTRONICS','ELECTRICAL AND ELECTRONICS','ELECTRICAL ELECTRONICS'],
        'ME': ['ME','MECHANICAL','MECHANICAL ENGINEERING'],
        'CIVIL': ['CIVIL','CIVIL ENGINEERING'],
        'AIML': ['AIML','ARTIFICIAL INTELLIGENCE','MACHINE LEARNING'],
        'Civil': ['CIVIL','CIVIL ENGINEERING'],
        'Mechanical': ['ME','MECHANICAL','MECHANICAL ENGINEERING']
      };
      const validNames = branchSynonyms[target] || branchSynonyms[target.toUpperCase()] || [target];
      function nameMatches(b) {
        const s = String(b || '').toUpperCase();
        return validNames.some(v => s.includes(v));
      }
      filteredBacklogs = backlogsWithBatch.filter(item => nameMatches(item.Branch));
    }
    
    console.log(`Found ${backlogsWithBatch.length} backlog records`);
    console.log(`Sample records:`, backlogsWithBatch.slice(0, 2));
    
    return NextResponse.json({ 
      backlogs: filteredBacklogs,
      total: filteredBacklogs.length,
      registration: registration || "auto-filled"
    });
  } catch (err) {
    console.error("/api/backlogs error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

function branchCodes(name) {
  // Include alternate codes used historically for some branches
  const map = {
    Civil: ['1','9'],
    CSE: ['2','8'],
    ECE: ['3','4'],
    EEE: ['5'],
    Mechanical: ['6'],
    AIML: ['7'],
  };
  return map[name] || [];
}

function normalizeBranchKey(input) {
  const s = String(input || "").trim().toUpperCase();
  if (!s) return "";
  if (s === 'ALL' || s === 'ALL BRANCHES') return "";
  if (s === 'CSE' || s.includes('COMPUTER')) return 'CSE';
  if (s === 'ECE' || s.includes('ELECTRONICS') && s.includes('COMMUNICATION')) return 'ECE';
  if (s === 'EEE' || (s.includes('ELECTRICAL') && !s.includes('COMMUNICATION'))) return 'EEE';
  if (s.includes('MECHANICAL') || s === 'ME') return 'Mechanical';
  if (s.includes('CIVIL')) return 'Civil';
  if (s.includes('AIML') || s.includes('ARTIFICIAL')) return 'AIML';
  return s;
}



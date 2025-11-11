import { clientPromise } from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

// 🧮 Map CUTM grades to numeric values
const GRADE_MAP = {
  O: 10, // Outstanding
  E: 9,  // Excellent
  A: 8,  // Very Good
  B: 7,  // Good
  C: 6,  // Average
  D: 5,  // Below Average
  S: 0,  // Supplementary
  F: 0,  // Fail
  I: 0,  // Incomplete
  M: 0,  // Malpractice
  R: 0,  // Reappear
};

// Helper to safely parse credits like "3+1" or "3"
function parseCredits(creditStr) {
  if (!creditStr) return 0;
  const parts = creditStr
    .toString()
    .split("+")
    .map((p) => parseFloat(p.trim()) || 0);
  return parts.reduce((a, b) => a + b, 0);
}

// SGPA calculation
function calculateSGPA(subjects) {
  let totalCredits = 0;
  let weightedSum = 0;

  subjects.forEach((sub) => {
    const credits = parseCredits(sub.Credits);
    const grade = (sub.Grade || "").toUpperCase().trim();
    const gradePoint = GRADE_MAP[grade] ?? 0;

    // Only count subject credits if grade exists (even 0)
    if (!isNaN(credits)) {
      totalCredits += credits;
      weightedSum += credits * gradePoint;
    }
  });

  const sgpa = totalCredits ? weightedSum / totalCredits : 0;
  return { sgpa: sgpa.toFixed(2), totalCredits };
}

// JWT verification helper
async function verifyToken(token) {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

// CGPA calculation across all semesters
async function calculateCGPA(db, registration) {
  const cutm = db.collection("CUTM1");
  const cursor = await cutm.find({ Reg_No: registration.toUpperCase() }).toArray();

  let totalCredits = 0;
  let weightedSum = 0;

  cursor.forEach((row) => {
    const credits = parseCredits(row.Credits);
    const grade = (row.Grade || "").toUpperCase().trim();
    const gradePoint = GRADE_MAP[grade] ?? 0;

    if (!isNaN(credits)) {
      totalCredits += credits;
      weightedSum += credits * gradePoint;
    }
  });

  const cgpa = totalCredits ? weightedSum / totalCredits : 0;
  return cgpa.toFixed(2);
}

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

    const { registration, semester } = await req.json();
    
    // Get user role for access control
    const userRole = payload.role?.toLowerCase();
    
    // Security check: Role-based access control
    if (userRole === 'user' || userRole === 'student') {
      // Students can only view their own results
      const userEmail = payload.email;
      if (userEmail && userEmail.includes('@cutm.ac.in')) {
        const userRegNumber = userEmail.split('@')[0];
        if (registration !== userRegNumber) {
          return NextResponse.json({ 
            error: "Access denied - Students can only view their own results" 
          }, { status: 403 });
        }
      }
    } else if (userRole === 'teacher' || userRole === 'admin') {
      // Teachers and admins can view any student's results
      console.log(`Access granted to ${userRole}: ${payload.email} viewing results for ${registration}`);
    } else {
      return NextResponse.json({ 
        error: "Access denied - Invalid user role" 
      }, { status: 403 });
    }
    
    const client = await clientPromise;
    const db = client.db("cutm1");
    const cutm = db.collection("CUTM1");

    // Convert "Semester 2" to "Sem 2" format to match database
    const dbSemester = semester.replace('Semester ', 'Sem ');

    const subjects = await cutm
      .find({ Reg_No: registration.toUpperCase(), Sem: dbSemester })
      .project({
        _id: 0,
        Reg_No: 1,
        Name: 1,
        Subject_Code: 1,
        Subject_Name: 1,
        Credits: 1,
        Grade: 1,
        Subject_Type: 1,
      })
      .toArray();

    if (!subjects.length) {
      return NextResponse.json({ error: "No result found" }, { status: 404 });
    }

    const { sgpa } = calculateSGPA(subjects);
    let cgpa = await calculateCGPA(db, registration);
    // Business rule: For 1st semester view, CGPA should equal SGPA
    if (dbSemester && /Sem\s*1/i.test(dbSemester)) {
      cgpa = sgpa;
    }

    // Try to fetch stable student metadata across all records for this registration
    const meta = await cutm.findOne(
      { Reg_No: registration.toUpperCase() },
      { projection: { _id: 0, Name: 1, Course: 1, Branch: 1, Department: 1 } }
    );
    const allMeta = await cutm
      .find({ Reg_No: registration.toUpperCase() })
      .project({ _id: 0, Branch: 1, Department: 1 })
      .toArray();

    // Name
    const firstRecord = subjects[0];
    const studentName = (meta?.Name || firstRecord?.Name || "").toString();

    // Batch from registration (first 2 digits)
    const batchMatch = registration.match(/^(\d{2})/);
    const batch = batchMatch ? `20${batchMatch[1]}` : "";

    // Prefer explicit fields if available
    let branch = meta?.Branch || meta?.Department || "";
    // Institute course for UG is B.Tech; override noisy values
    let course = "B.Tech";

    // Normalize branch names to a canonical format
    function normalizeBranch(value) {
      const s = String(value || "").toUpperCase();
      if (!s) return "";
      if (/(AIML|ARTIFICIAL\s*INTELLIGENCE)/.test(s)) return "AIML";
      if (/(CSE|COMPUTER\s*SCIENCE)/.test(s)) return "Computer Science and Engineering";
      if (/(ECE|ELECTRONICS\s*AND\s*COMMUNICATION)/.test(s)) return "Electronics and Communication Engineering";
      if (/(EEE|ELECTRICAL\s*AND\s*ELECTRONICS)/.test(s)) return "Electrical and Electronics Engineering";
      if (/(MECH|MECHANICAL)/.test(s)) return "Mechanical Engineering";
      if (/(CIVIL|CE\b)/.test(s)) return "Civil Engineering";
      return value;
    }
    // If branch empty or unreliable, compute the most frequent branch/department across records
    function pickMostFrequent(arr) {
      const counts = new Map();
      for (const v of arr) {
        const k = normalizeBranch(v);
        if (!k) continue;
        counts.set(k, (counts.get(k) || 0) + 1);
      }
      let best = ""; let bestCount = 0;
      counts.forEach((c, k) => { if (c > bestCount) { best = k; bestCount = c; } });
      return best;
    }
    if (!branch) {
      const freq = pickMostFrequent([...(allMeta?.map(m => m.Branch) || []), ...(allMeta?.map(m => m.Department) || [])]);
      if (freq) branch = freq;
    }

    // Fallback: infer from registration department code
    const deptCode = registration?.substring(4, 6) || "";
    const deptMap = {
      '01': { branch: 'Computer Science and Engineering' },
      '02': { branch: 'Mechanical Engineering' },
      '03': { branch: 'Civil Engineering' },
      '04': { branch: 'Electrical and Electronics Engineering' },
      '13': { branch: 'Electronics and Communication Engineering' },
    };
    if (!branch || !course) {
      const mapped = deptMap[deptCode];
      if (mapped) {
        branch = branch || mapped.branch;
      }
    }

    // Check branch override first (authoritative)
    async function getOverriddenBranch(db, reg) {
      try {
        const ov = await db.collection("branch_overrides").findOne({ reg }, { projection: { branch: 1 } });
        return ov?.branch || null;
      } catch { return null; }
    }
    const ovBranch = await getOverriddenBranch(db, registration.toUpperCase());
    if (ovBranch) {
      branch = ovBranch;
    }

    // Additional rule: CUTM 8th-character mapping (authoritative when no override)
    // 0-based indexing -> index 7 is the 8th character
    const idx8 = registration?.[7];
    const idx8Map = {
      '1': 'Civil Engineering',
      '2': 'Computer Science and Engineering',
      '3': 'Electronics and Communication Engineering',
      '4': 'Electronics and Communication Engineering', // alternative code
      '5': 'Electrical and Electronics Engineering',
      '6': 'Mechanical Engineering',
      '7': 'AIML', // AIML branch
      '8': 'Computer Science and Engineering', // alternative code
      '9': 'Civil Engineering', // alternative code
    };
    if (!ovBranch && idx8 && idx8Map[idx8]) {
      branch = idx8Map[idx8];
    }

    // Final fallback: infer from subject code
    if ((!branch || !course) && firstRecord?.Subject_Code) {
      const code = String(firstRecord.Subject_Code).toUpperCase();
      if (!branch && (code.includes('CSE') || /\bCS\b/.test(code))) { branch = 'Computer Science and Engineering'; }
      else if (!branch && (code.includes('ECE') || /\bEC\b/.test(code))) { branch = 'Electronics and Communication Engineering'; }
      else if (!branch && /\bME\b/.test(code)) { branch = 'Mechanical Engineering'; }
      else if (!branch && (code.includes('CIVIL') || /\bCE\b/.test(code))) { branch = 'Civil Engineering'; }
      else if (!branch && (code.includes('EEE') || /\bEE\b/.test(code))) { branch = 'Electrical and Electronics Engineering'; }
    }

    // Sensible defaults if still missing
    branch = normalizeBranch(branch) || 'Engineering';

    return NextResponse.json({
      registration,
      semester: dbSemester, // Return the database format
      name: studentName,
      batch,
      branch,
      course,
      subjects,
      sgpa,
      cgpa,
    });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { clientPromise } from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getCampusSchoolDatabase, getDatabaseFromRegistration, getSomStudentDatabaseCandidates } from "@/lib/campus";
import { parseSOMRegistration } from "../parse-registration/route";

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

    if (!isNaN(credits) && credits > 0) {
      totalCredits += credits;
      weightedSum += credits * gradePoint;
    }
  });

  const sgpa = totalCredits > 0 ? weightedSum / totalCredits : 0;
  return { sgpa: parseFloat(sgpa.toFixed(2)), totalCredits };
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

// CGPA calculation up to a specific semester (cumulative)
async function calculateCGPA(db, registration, upToSemester = null) {
  const cutm = db.collection("som_result");

  // Support both string and numeric Reg_No
  const regUpper = String(registration || "").toUpperCase();
  const regAsInt = parseInt(regUpper, 10);
  const regQuery = Number.isNaN(regAsInt)
    ? [{ Reg_No: regUpper }]
    : [{ Reg_No: regUpper }, { Reg_No: regAsInt }];

  const andConditions = [{ $or: regQuery }];

  if (upToSemester) {
    // Build robust semester variants up to the target semester
    const semMatch = upToSemester.match(/(\d+)/);
    if (semMatch) {
      const semNum = parseInt(semMatch[1], 10);
      if (!Number.isNaN(semNum) && semNum > 0) {
        const semesters = [];
        for (let i = 1; i <= semNum; i++) {
          semesters.push(
            `Sem ${i}`,
            `Semester ${i}`,
            `SEM ${i}`,
            `SEM${i}`,
            `sem ${i}`,
            `sem${i}`,
            String(i)
          );
        }
        andConditions.push({ Sem: { $in: semesters } });
      }
    }
  }

  const query = andConditions.length > 1 ? { $and: andConditions } : andConditions[0];
  const cursor = await cutm.find(query).toArray();

  let totalCredits = 0;
  let weightedSum = 0;

  cursor.forEach((row) => {
    const credits = parseCredits(row.Credits);
    const grade = (row.Grade || "").toUpperCase().trim();
    const gradePoint = GRADE_MAP[grade] ?? 0;

    if (!isNaN(credits) && credits > 0) {
      totalCredits += credits;
      weightedSum += credits * gradePoint;
    }
  });

  const cgpa = totalCredits > 0 ? weightedSum / totalCredits : 0;
  return parseFloat(cgpa.toFixed(2));
}

function normalizeBranch(branch) {
  if (!branch) return null;
  const b = String(branch).trim();
  const lower = b.toLowerCase();
  
  if (lower === 'bba' || lower.includes('business administration')) return 'Bachelor of Business Administration (BBA)';
  if (lower === 'mba' || lower.includes('master of business administration')) return 'Master of Business Administration (MBA)';
  
  return b;
}

/**
 * SOM Result Route - BBA/MBA students only
 */
export async function POST(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized - Please login first" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.email) {
      return NextResponse.json({ error: "Unauthorized - Invalid token" }, { status: 401 });
    }

    const { registration, semester } = await req.json();

    const userRole = payload.role?.toLowerCase();

    if (userRole === "user" || userRole === "student") {
      const userEmail = payload.email;
      const isCampusStudentEmail =
        userEmail &&
        (userEmail.includes("@cutm.ac.in") || userEmail.includes("@centurionuniv.edu.in"));
      if (isCampusStudentEmail) {
        const userRegNumber = userEmail.split("@")[0].toUpperCase();
        if (String(registration || "").toUpperCase().trim() !== userRegNumber) {
          return NextResponse.json({
            error: "Access denied - Students can only view their own results",
          }, { status: 403 });
        }
      }
    } else if (userRole === 'teacher' || userRole === 'admin') {
      console.log(`Access granted to ${userRole}: ${payload.email} viewing SOM results for ${registration}`);
    } else {
      return NextResponse.json({
        error: "Access denied - Invalid user role"
      }, { status: 403 });
    }

    const client = await clientPromise;

    // Build flexible semester variants to handle different storage formats
    const semInput = String(semester || "").trim();
    const cleanSemNum = semInput
      .replace(/Semester\s*/i, "")
      .replace(/Sem\s*/i, "")
      .replace(/sem\s*/i, "")
      .trim();
    const dbSemester = semInput
      .replace(/Semester\s*/i, "Sem ")
      .replace(/sem\s*/i, "Sem ")
      .trim();
    const semesterVariants = Array.from(
      new Set(
        [
          semInput,
          dbSemester,
          cleanSemNum,
          `Sem ${cleanSemNum}`,
          `Semester ${cleanSemNum}`,
          `Sem${cleanSemNum}`,
          `SEM ${cleanSemNum}`,
          `SEM${cleanSemNum}`,
          semInput.toUpperCase(),
          dbSemester.toUpperCase(),
          cleanSemNum
        ].filter(Boolean)
      )
    );

    const regUpper = String(registration || "").toUpperCase().trim();
    const regAsInt = parseInt(regUpper, 10);
    const regQuery = Number.isNaN(regAsInt)
      ? [{ Reg_No: regUpper }]
      : [{ Reg_No: regUpper }, { Reg_No: regAsInt }];

    const subjectProject = {
      _id: 0,
      Reg_No: 1,
      Name: 1,
      Subject_Code: 1,
      Subject_Name: 1,
      Credits: 1,
      Grade: 1,
      Subject_Type: 1,
      Sem: 1,
    };

    const subjectFind = {
      $and: [{ $or: regQuery }, { Sem: { $in: semesterVariants } }],
    };

    let db;
    let subjects;

    if (userRole === "user" || userRole === "student") {
      const candidates = getSomStudentDatabaseCandidates(regUpper);
      subjects = [];
      db = null;
      for (const name of candidates) {
        const tryDb = client.db(name);
        const subs = await tryDb.collection("som_result").find(subjectFind).project(subjectProject).toArray();
        if (subs.length > 0) {
          db = tryDb;
          subjects = subs;
          break;
        }
      }
      if (!db) {
        db = client.db(candidates[0]);
      }
    } else {
      const { searchParams } = new URL(req.url);
      const campusParam = searchParams.get("campus");
      const campus = campusParam || payload.campus || null;
      const dbName = getCampusSchoolDatabase(campus, "SOM");
      db = client.db(dbName);
      subjects = await db.collection("som_result").find(subjectFind).project(subjectProject).toArray();
    }

    const cutm = db.collection("som_result");

    // If no subjects found for the specific semester, return error (don't fallback to all results)
    if (!subjects.length) {
      return NextResponse.json({ 
        error: `No result found for ${semester}. Results may not be available yet for this semester.` 
      }, { status: 404 });
    }

    // Verify all subjects belong to the requested semester (safety check)
    const mismatchedSemesters = subjects.filter(sub => {
      const subSem = String(sub.Sem || "").trim();
      return !semesterVariants.some(variant => 
        subSem.toLowerCase() === variant.toLowerCase() ||
        subSem.replace(/\s+/g, "").toLowerCase() === variant.replace(/\s+/g, "").toLowerCase()
      );
    });

    // If there are subjects from different semesters, filter them out
    if (mismatchedSemesters.length > 0) {
      subjects = subjects.filter(sub => !mismatchedSemesters.includes(sub));
    }

    // If after filtering we have no subjects, return error
    if (!subjects.length) {
      return NextResponse.json({ 
        error: `No result found for ${semester}. Results may not be available yet for this semester.` 
      }, { status: 404 });
    }

    // Verify this is a SOM (BBA/MBA) student
    const parsed = parseSOMRegistration(registration);
    if (!parsed || !parsed.isValid || !parsed.isSOM) {
      return NextResponse.json({ 
        error: "This route is for SOM students only. Please use the appropriate portal for Engineering or Diploma results." 
      }, { status: 400 });
    }

    const { sgpa } = calculateSGPA(subjects);
    let cgpa = await calculateCGPA(db, registration, dbSemester);

    if (dbSemester && /Sem\s*1/i.test(dbSemester)) {
      cgpa = sgpa;
    }

    cgpa = Math.max(0, cgpa).toFixed(2);
    const sgpaFormatted = typeof sgpa === 'number' ? sgpa.toFixed(2) : String(sgpa);

    const meta = await cutm.findOne(
      { Reg_No: registration.toUpperCase() },
      { projection: { _id: 0, Name: 1, Course: 1, Branch: 1, Department: 1 } }
    );

    const firstRecord = subjects[0];
    const studentName = (meta?.Name || firstRecord?.Name || "").toString();

    let batch = "";
    let branch = "";
    let course = "";
    let schoolName = "School Of Management";

    if (parsed && parsed.isValid) {
      batch = parsed.year;
      branch = parsed.branch;
      course = parsed.branch === "MBA" ? "MBA" : "BBA";
    } else {
      const batchMatch = registration.match(/^(\d{2})/);
      batch = batchMatch ? `20${batchMatch[1]}` : "";
      branch = meta?.Branch || meta?.Department || "";

      const branchCode = registration?.slice(5, 8);
      const branchCodeMap = {
        '912': 'Bachelor of Business Administration (BBA)',
        '214': 'Master of Business Administration (MBA)'
      };
      if (branchCode && branchCodeMap[branchCode]) {
        branch = branchCodeMap[branchCode];
        course = branchCode === "214" ? "MBA" : "BBA";
      }

      if (!branch && firstRecord?.Subject_Code) {
        const code = String(firstRecord.Subject_Code).toUpperCase();
        if (code.startsWith('BBA') || code.includes('BUSS')) { branch = 'Bachelor of Business Administration (BBA)'; course = "BBA"; }
        else if (code.startsWith('MBA') || code.includes('MGMT')) { branch = 'Master of Business Administration (MBA)'; course = "MBA"; }
      }
    }

    if (!branch) {
      branch = normalizeBranch(meta?.Branch || meta?.Department || "") || 'Engineering';
    }

    if (!course) {
      const b = String(branch || "").toUpperCase();
      if (b.includes("MBA") && !b.includes("BBA")) course = "MBA";
      else if (b.includes("BBA")) course = "BBA";
      else course = "BBA";
    }

    return NextResponse.json({
      registration,
      semester: dbSemester,
      name: studentName,
      batch,
      branch,
      course,
      schoolName,
      subjects,
      sgpa: sgpaFormatted,
      cgpa,
      school: 'SOM'
    });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

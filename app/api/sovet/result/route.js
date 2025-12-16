import { clientPromise } from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getCampusSchoolDatabase, getDatabaseFromRegistration } from "@/lib/campus";

// 🧮 Map CUTM grades to numeric values
const GRADE_MAP = {
  O: 10, E: 9, A: 8, B: 7, C: 6, D: 5,
  S: 0, F: 0, I: 0, M: 0, R: 0,
};

function parseCredits(creditStr) {
  if (!creditStr) return 0;
  const parts = creditStr.toString().split("+").map((p) => parseFloat(p.trim()) || 0);
  return parts.reduce((a, b) => a + b, 0);
}

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

async function verifyToken(token) {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

async function calculateCGPA(db, registration, upToSemester = null) {
  const cutm = db.collection("result");

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

/**
 * SOVET Result Route - Diploma students only
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

    if (userRole === 'user' || userRole === 'student') {
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
      console.log(`Access granted to ${userRole}: ${payload.email} viewing SOVET results for ${registration}`);
    } else {
      return NextResponse.json({
        error: "Access denied - Invalid user role"
      }, { status: 403 });
    }

    const client = await clientPromise;
    
    // For user role, determine database from registration number (indices 2-5)
    // For admin/teacher, use campus/school from params or JWT
    let dbName;
    if (userRole === 'user' || userRole === 'student') {
      dbName = getDatabaseFromRegistration(registration);
    } else {
      const { searchParams } = new URL(req.url);
      const campusParam = searchParams.get('campus');
      const campus = campusParam || payload.campus || null;
      const school = 'SOVET';
      dbName = getCampusSchoolDatabase(campus, school);
    }
    
    const db = client.db(dbName);
    const cutm = db.collection("result");

    // Normalize semester string for CGPA calculation (up to this semester)
    const semInput = String(semester || "").trim();
    const cleanSemNum = semInput
      .replace(/Semester\s*/i, "")
      .replace(/Sem\s*/i, "")
      .replace(/sem\s*/i, "")
      .trim();
    const dbSemester = cleanSemNum ? `Sem ${cleanSemNum}` : semInput || null;

    // Support numeric-stored Reg_No
    const regUpper = registration.toUpperCase();
    const regAsInt = parseInt(regUpper, 10);
    const regQuery = isNaN(regAsInt)
      ? [{ Reg_No: regUpper }]
      : [{ Reg_No: regUpper }, { Reg_No: regAsInt }];

    // Helper to normalize semester value to a numeric index (1,2,3,...)
    const normalizeSem = (value) => {
      if (value === null || value === undefined) return null;
      const str = String(value).trim();
      const match = str.match(/(\d+)/);
      if (!match) return null;
      const num = parseInt(match[1], 10);
      return Number.isNaN(num) ? null : num;
    };

    // Cumulative CGPA helper using all subjects up to the target semester
    const computeCumulativeCGPA = (allRows, targetSem) => {
      const rows = allRows.filter((row) => {
        const rowSem = normalizeSem(row.Sem);
        if (targetSem === null) return true;
        if (rowSem === null) return false;
        return rowSem <= targetSem;
      });
      let totalCredits = 0;
      let weightedSum = 0;
      rows.forEach((r) => {
        const credits = parseCredits(r.Credits);
        const grade = (r.Grade || "").toUpperCase().trim();
        const gp = GRADE_MAP[grade] ?? 0;
        if (!Number.isNaN(credits) && credits > 0) {
          totalCredits += credits;
          weightedSum += credits * gp;
        }
      });
      if (totalCredits === 0) return 0;
      return weightedSum / totalCredits;
    };

    const targetSemNum = normalizeSem(semester);

    // First, load all subjects for the registration (any semester)
    const allSubjects = await cutm
      .find({ $or: regQuery })
      .project({
        _id: 0,
        Reg_No: 1,
        Name: 1,
        Subject_Code: 1,
        Subject_Name: 1,
        Credits: 1,
        Grade: 1,
        Subject_Type: 1,
        Sem: 1,
      })
      .toArray();

    // Subjects for the requested semester (for display/SGPA)
    let subjects = allSubjects;
    // Apply robust semester-wise filtering in JavaScript
    if (targetSemNum !== null) {
      subjects = subjects.filter((row) => {
        const rowSemNum = normalizeSem(row.Sem);
        return rowSemNum === targetSemNum;
      });
    }

    if (!subjects.length) {
      return NextResponse.json({ error: "No result found" }, { status: 404 });
    }

    // Verify this is a Diploma student
    const { parseDiplomaRegistration } = await import('../parse-registration/route');
    const parsed = parseDiplomaRegistration(registration);
    if (!parsed || !parsed.isValid || !parsed.isDiploma) {
      return NextResponse.json({ 
        error: "This route is for Diploma (SOVET) students only. Please use /api/soet/result for B.Tech students." 
      }, { status: 400 });
    }

    const { sgpa } = calculateSGPA(subjects);
    // CGPA cumulative up to the selected semester (database-level, robust semester variants)
    let cgpa = await calculateCGPA(db, registration, dbSemester);
    if (!Number.isFinite(cgpa)) cgpa = 0;
    cgpa = Math.max(0, cgpa);
    const sgpaFormatted = typeof sgpa === 'number' ? sgpa.toFixed(2) : String(sgpa);
    const cgpaFormatted = typeof cgpa === 'number' ? cgpa.toFixed(2) : String(cgpa);

    const meta = await cutm.findOne(
      { Reg_No: registration.toUpperCase() },
      { projection: { _id: 0, Name: 1, Course: 1, Branch: 1, Department: 1 } }
    );

    const firstRecord = subjects[0];
    const studentName = (meta?.Name || firstRecord?.Name || "").toString();

    let batch = "";
    let branch = "";
    let course = "Diploma";
    let schoolName = "School Of Vocational Education & Training";

    if (parsed && parsed.isValid) {
      batch = parsed.year;
      branch = parsed.branch;

      // Map short codes to Full Names for Diploma
      const fullBranchMap = {
        'CE': 'Civil Engineering',
        'ME': 'Mechanical Engineering',
        'EE': 'Electrical Engineering',
        'AE': 'Automobile Engineering',
        'CSE': 'Computer Science and Engineering',
        'ECE': 'Electronics and Communication Engineering',
        'Mining': 'Mining Engineering',
        'MiE': 'Mining Engineering'
      };

      const cleanBranch = branch.replace(' (Diploma)', '').trim();
      if (fullBranchMap[cleanBranch]) {
        branch = fullBranchMap[cleanBranch];
      } else if (fullBranchMap[parsed.branch]) {
        branch = fullBranchMap[parsed.branch];
      }
    } else {
      // Fallback: Use 8th digit mapping for SOVET
      const batchMatch = registration.match(/^(\d{2})/);
      batch = batchMatch ? `20${batchMatch[1]}` : "";
      branch = meta?.Branch || meta?.Department || "";

      // SOVET 8th digit mapping
      if (registration.length >= 8) {
        const digit = registration.charAt(7);
        const digitMap = {
          '1': 'Electrical Engineering',
          '2': 'Mechanical Engineering',
          '3': 'Civil Engineering',
          '4': 'Computer Science and Engineering',
          '6': 'Mining Engineering',
          '7': 'Automobile Engineering'
        };
        if (digitMap[digit]) {
          branch = digitMap[digit];
        }
      }
    }

    if (!branch) {
      branch = meta?.Branch || meta?.Department || 'Engineering';
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
      cgpa: cgpaFormatted,
      school: 'SOVET'
    });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

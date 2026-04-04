import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { jwtVerify } from "jose";
import { getCampusDatabase, getCampusSchoolDatabase, getDatabaseFromRegistration, getSchoolFromRegistration, getSomDatabaseSearchOrder } from "@/lib/campus";
// Import diploma helpers from SOVET parse-registration API
async function getDiplomaHelpers() {
  const { isDiplomaStudent, isDiplomaLateralEntry, getDiplomaBranchName, getBranchFromRegistration } = await import('../../sovet/parse-registration/route');
  return { isDiplomaStudent, isDiplomaLateralEntry, getDiplomaBranchName, getBranchFromRegistration };
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

const FAIL_OR_INCOMPLETE_GRADES = new Set(["F", "S", "M", "I", "R"]);

const REQUIRED_CREDITS = {
  "Basket I": 17,
  "Basket II": 12,
  "Basket III": 25,
  "Basket IV": 58,
  "Basket V": 48,
};

// 2024 batch onwards (regular students) - updated credit split while total remains 160
const REQUIRED_CREDITS_2024_ONWARDS = {
  "Basket I": 17,
  "Basket II": 12,
  "Basket III": 25,
  "Basket IV": 60,
  "Basket V": 46,
};

// Lateral entry students have different credit requirements
const LATERAL_ENTRY_CREDITS = {
  "Basket I": 6,
  "Basket II": 9,
  "Basket III": 25,
  "Basket IV": 48,
  "Basket V": 32,
};

// Diploma Regular students credit requirements (120 credits total)
const DIPLOMA_REGULAR_CREDITS = {
  "Basket I": 12,  // Foundations in Sciences
  "Basket II": 13, // Lived in Learning
  "Basket III": 20, // Smart Stack
  "Basket IV": 26, // Core Engineering Courses (branch-specific)
  "Basket V": 49,  // Job Roles / Skill Courses
};

// Diploma Lateral Entry students credit requirements (80 credits total)
const DIPLOMA_LATERAL_ENTRY_CREDITS = {
  "Basket I": 0,   // Foundations in Sciences (exempted)
  "Basket II": 5,  // Lived in Learning
  "Basket III": 12, // Smart Stack
  "Basket IV": 26, // Core Engineering Courses (branch-specific)
  "Basket V": 37,  // Job Roles / Skill Courses
};

function parseCredits(creditStr) {
  if (!creditStr) return 0;
  const parts = creditStr
    .toString()
    .split(/[+\-]/) // handle "2+0+1" or possible "2--2--2" formats
    .map((p) => parseFloat(p.trim()) || 0);
  return parts.reduce((a, b) => a + b, 0);
}

function buildBasketState(required) {
  return {
    status: "Not Started",
    is_completed: false,
    earned_credits: 0,
    failed_credits: 0,
    attempted_credits: 0,
    required_credits: required,
    pending_credits: required,
    percentage: 0,
    has_default_subjects: false,
    default_assigned_count: 0,
    subjects: [],
  };
}

// Function to check if a student is lateral entry
function isLateralEntryStudent(registration) {
  // Lateral entry students have "1" as the 9th character (0-indexed position 8)
  // Example: 220101131056 (lateral) vs 220101130056 (normal)
  return registration && registration.length >= 9 && registration.charAt(8) === '1';
}

// Function to check if a student is diploma
async function isDiplomaStudent(registration, department = null, school = null) {
  if (school === 'SOVET') return true;
  if (!registration) return false;

  // Check registration number pattern first (most reliable)
  const { isDiplomaStudent: checkDiploma } = await getDiplomaHelpers();
  if (await checkDiploma(registration)) {
    return true;
  }

  // Fallback: Check if department name contains "Diploma" (case-insensitive)
  if (department && typeof department === 'string') {
    const deptLower = department.toLowerCase();
    if (deptLower.includes('diploma')) {
      return true;
    }
  }

  return false;
}

// Function to get required credits based on student type and batch year
// Function to get required credits based on student type and batch year
async function getRequiredCreditsForStudent(registration, department = null, school = null, overrideBatch = null, bbaDegreeType = "4year") {
  const isDiploma = await isDiplomaStudent(registration, department, school);
  const isLateral = isLateralEntryStudent(registration);

  // Diploma students have priority
  if (isDiploma) {
    if (isLateral) {
      return DIPLOMA_LATERAL_ENTRY_CREDITS;
    }
    return DIPLOMA_REGULAR_CREDITS;
  }

  // SOM (MBA/BBA) check
  const isMbaProgram = (school === 'SOM' || (department && (department.toUpperCase() === 'MBA' || department.toUpperCase().includes('MASTER OF BUSINESS')))) && !String(department).toUpperCase().includes('BBA');
  const isBbaProgram = (school === 'SOM' || (department && (department.toUpperCase() === 'BBA' || department.toUpperCase().includes('BACHELOR OF BUSINESS')))) && !String(department).toUpperCase().includes('MBA');

  // Detect 2023 onwards for BBA (NEP Cycle supports both 3yr and 4yr)
  const is2023Onwards = registration && (registration.startsWith('23') || registration.startsWith('24') || parseInt(registration.substring(0, 2)) >= 23);

  if (isMbaProgram) {
    // Return a flat 73 credits requirement for MBA
    return {
      "Total": 73
    };
  }

  // BBA Basket Structure (3yr - 120 credits OR 4yr - 160 credits)
  if (isBbaProgram) {
    if (is2023Onwards) {
      if (bbaDegreeType === "3year") {
        // 3-year BBA exit for NEP batches
        return {
          "Basket I": 60,
          "Basket II": 32,
          "Basket III": 12,
          "Basket IV": 12,
          "Basket V": 4
        };
      }
      // 4-year BBA (160 credits) as default for NEP
      return {
        "Basket I": 80,
        "Basket II": 40,
        "Basket III": 12,
        "Basket IV": 12,
        "Basket V": 4,
        "Basket VI": 12
      };
    } else {
      // 3-year BBA (120 credits) for earlier batches
      return {
        "Basket I": 60,
        "Basket II": 32,
        "Basket III": 12,
        "Basket IV": 12,
        "Basket V": 4
      };
    }
  }

  // Regular B.Tech students
  if (isLateral) {
    return LATERAL_ENTRY_CREDITS;
  }

  let batchNum;
  if (overrideBatch) {
    const batchStr = String(overrideBatch);
    batchNum = parseInt(batchStr.length === 4 ? batchStr.slice(2) : batchStr, 10);
  } else {
    // Extract first two digits of registration as batch year suffix: e.g., "24" => 2024
    const batchSuffix = (registration || "").slice(0, 2);
    batchNum = parseInt(batchSuffix, 10);
  }

  if (!Number.isNaN(batchNum) && batchNum >= 24) {
    return REQUIRED_CREDITS_2024_ONWARDS;
  }
  return REQUIRED_CREDITS;
}

function recalcBasket(b) {
  b.attempted_credits = (Number(b.earned_credits) || 0) + (Number(b.failed_credits) || 0);
  b.pending_credits = Math.max(0, (Number(b.required_credits) || 0) - (Number(b.earned_credits) || 0));
  const pct = b.required_credits > 0 ? Math.min(100, Math.round((b.earned_credits / b.required_credits) * 100)) : 0;
  b.percentage = pct;
  b.is_completed = pct >= 100;
  b.status = b.is_completed ? "Completed" : pct === 0 ? "Not Started" : "Pending";
  return b;
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

    // FIXED: Extract request data first
    let {
      department,
      batch,
      registration,
      semesters = [],
      basket,
      bbaDegreeType = "4year",
    } = await req.json();

    // Get user role for access control
    const userRole = payload.role?.toLowerCase();

    // Security check: Role-based access control
    if (userRole === "user" || userRole === "student") {
      const userEmail = payload.email;
      const isCampusStudentEmail =
        userEmail &&
        (userEmail.includes("@cutm.ac.in") || userEmail.includes("@centurionuniv.edu.in"));
      if (isCampusStudentEmail) {
        const userRegNumber = userEmail.split("@")[0].toUpperCase();
        const reqReg = String(registration || "").toUpperCase().trim();
        if (reqReg && reqReg !== userRegNumber) {
          return NextResponse.json({
            error: "Access denied - Students can only view their own progress",
          }, { status: 403 });
        }
      }
    } else if (userRole === 'teacher' || userRole === 'admin') {
      // Teachers and admins can view any student's progress
      console.log(`Access granted to ${userRole}: ${payload.email} accessing progress for ${registration}`);
    } else {
      return NextResponse.json({
        error: "Access denied - Invalid user role"
      }, { status: 403 });
    }
    const reg = String(registration || "").toUpperCase().trim();
    if (!reg) return NextResponse.json({ error: "Registration is required" }, { status: 400 });

    const client = await clientPromise;

    // For user role, determine database and school from registration number
    // For admin/teacher, use campus/school from params or JWT
    let dbName;
    let school = null;
    if (userRole === 'user' || userRole === 'student') {
      dbName = getDatabaseFromRegistration(reg);
      school = getSchoolFromRegistration(reg);
    } else {
      // Get campus database based on teacher's/admin's campus
      const { searchParams } = new URL(req.url);
      const campusParam = searchParams.get('campus');
      const schoolParam = searchParams.get('school');
      const campus = campusParam || payload.campus || null;
      school = schoolParam || payload.school || null;
      dbName = getCampusSchoolDatabase(campus, school);
    }

    if (school != null && school !== "") {
      school = String(school).toUpperCase();
    }

    // User panel BBA: always 120-credit basket split (Baskets I–V)
    if (
      (userRole === "user" || userRole === "student") &&
      school === "SOM" &&
      reg.length >= 8 &&
      reg.slice(5, 8) === "912"
    ) {
      bbaDegreeType = "3year";
    }

    const regAsInt = parseInt(reg);
    const useOrQuery = !isNaN(regAsInt) && String(regAsInt) === reg;
    const lookupQuery = useOrQuery ? { $or: [{ Reg_No: reg }, { Reg_No: regAsInt }] } : { Reg_No: reg };

    if (school === "SOM") {
      const { parseSOMRegistration } = await import("../../som/parse-registration/route");
      const parsed = parseSOMRegistration(reg);
      if (!parsed || !parsed.isSOM || !["BBA", "MBA"].includes(parsed.branch)) {
        return NextResponse.json({
          error: "Access denied - This page only supports BBA and MBA students",
        }, { status: 403 });
      }
    }

    const studentInfoCol = school === "SOVET" ? "diploma_result" : school === "SOM" ? "som_result" : "result";

    const somDbOrder =
      (userRole === "user" || userRole === "student") && school === "SOM"
        ? getSomDatabaseSearchOrder(reg)
        : [];
    const dbTryList = somDbOrder.length > 0 ? somDbOrder : [dbName];

    let db = null;
    let studentInfo = null;

    for (const tryName of dbTryList) {
      const tryDb = client.db(tryName);

      const inactiveStatus = await tryDb.collection("student_status").findOne({ Reg_No: reg, isActive: false });
      if (inactiveStatus) {
        return NextResponse.json({
          error: `Student ${reg} is inactive/disabled and cannot be accessed.`,
        }, { status: 404 });
      }

      let si = await tryDb
        .collection(studentInfoCol)
        .findOne(lookupQuery, { projection: { _id: 0, Name: 1, Reg_No: 1, Branch: 1 } });

      if (!si) {
        const regData = await tryDb
          .collection("RegistrationData")
          .findOne(lookupQuery, { projection: { _id: 0, Name: 1, Reg_No: 1, Sem: 1 } });
        if (regData) {
          si = {
            Name: regData.Name,
            Reg_No: regData.Reg_No,
            Branch: "From Registration Data",
            Sem: regData.Sem,
          };
        }
      }

      if (si) {
        db = tryDb;
        studentInfo = si;
        break;
      }
    }

    if (!studentInfo) {
      console.log(`Student not found in collections (tried DBs: ${dbTryList.join(", ")}): ${reg}`);
      const similarCol = school === "SOVET" ? "diploma_result" : school === "SOM" ? "som_result" : "result";
      const allSimilar = [];
      for (const tryName of dbTryList) {
        const tryDb = client.db(tryName);
        const sim1 = await tryDb
          .collection(similarCol)
          .find({ Reg_No: { $regex: `^${reg.slice(0, 6)}` } })
          .project({ _id: 0, Reg_No: 1, Name: 1 })
          .limit(3)
          .toArray();
        const sim2 = await tryDb
          .collection("RegistrationData")
          .find({ Reg_No: { $regex: `^${reg.slice(0, 6)}` } })
          .project({ _id: 0, Reg_No: 1, Name: 1 })
          .limit(3)
          .toArray();
        allSimilar.push(...sim1, ...sim2);
      }
      const suggestions =
        allSimilar.length > 0
          ? ` Similar registrations found: ${allSimilar.map((r) => r.Reg_No).join(", ")}`
          : "";

      return NextResponse.json({
        error: `Student not found with registration number: ${reg}.${suggestions} Please verify the registration number or upload registration data first.`,
      }, { status: 404 });
    }

    // Extract batch from registration (first 2 digits)
    const regBatch = reg.slice(0, 2);
    let actualBatch = `20${regBatch}`;

    // Extract department from registration number
    const { getBranchFromRegistration: getBranch } = await getDiplomaHelpers();
    let actualDepartment = await getBranch(reg, studentInfo?.Branch);

    // SOM detection: branch code is at positions 5-7 (e.g. 214=MBA, 912=BBA)
    if (school === 'SOM') {
      const somCode = reg.slice(5, 8);
      if (somCode === '214') actualDepartment = 'MBA';
      else if (somCode === '912') actualDepartment = 'BBA';
    }

    // If not found from registration pattern, try B.Tech mapping
    if (!actualDepartment || actualDepartment === 'Unknown') {
      const deptCode = reg.charAt(7); // 8th character (0-indexed) for B.Tech
      const deptMap = {
        '1': 'Civil Engineering',
        '2': 'Computer Science Engineering',
        '3': 'Electronics & Communication Engineering',
        '5': 'Electrical & Electronics Engineering',
        '6': 'Mechanical Engineering',
        '7': 'AIML',
        '8': 'Computer Science Engineering',
        '9': 'Civil Engineering'
      };
      actualDepartment = deptMap[deptCode];
    }

    // Override branch if admin set one
    // Also check for batch override
    try {
      const ov = await db.collection("branch_overrides").findOne({ reg });
      if (ov?.branch) {
        actualDepartment = ov.branch;
      }
      if (ov?.batch) {
        actualBatch = ov.batch;
      }
    } catch { }

    if (!actualDepartment) {
      // Try to get department from student info if available
      if (studentInfo && studentInfo.Branch) {
        // Map branch names to department names
        const branchMap = {
          'Civil': 'Civil Engineering',
          'CSE': 'Computer Science Engineering',
          'ECE': 'Electronics & Communication Engineering',
          'EEE': 'Electrical & Electronics Engineering',
          'ME': 'Mechanical Engineering',
          'Mechanical': 'Mechanical Engineering',
          'Computer Science': 'Computer Science Engineering',
          'Electronics': 'Electronics & Communication Engineering',
          'Electrical': 'Electrical & Electronics Engineering'
        };
        actualDepartment = branchMap[studentInfo.Branch] || studentInfo.Branch || "Unknown";
      } else {
        actualDepartment = "Unknown";
      }
    }

    console.log(`Department mapping for ${reg}: mapped=${actualDepartment}, studentInfo.Branch=${studentInfo?.Branch}`);

    // Validate department if provided (with flexible matching for Diploma suffix)
    if (department && department !== "All") {
      // Normalize both department names for comparison
      const normalizeDept = (dept) => {
        if (!dept) return '';
        return String(dept)
          .replace(/\s*\(Diploma\)\s*/gi, '') // Remove "(Diploma)" suffix
          .toLowerCase()
          .trim();
      };

      const normalizedSelected = normalizeDept(department);
      const normalizedActual = normalizeDept(actualDepartment);

      // Also check for partial matches (e.g., "Civil Engineering" matches "Civil Engineering (Diploma)")
      const selectedKeywords = normalizedSelected.split(/\s+/).filter(w => w.length > 2);
      const actualKeywords = normalizedActual.split(/\s+/).filter(w => w.length > 2);
      const hasKeywordMatch = selectedKeywords.length > 0 &&
        selectedKeywords.every(kw => actualKeywords.includes(kw));

      const matches = normalizedSelected === normalizedActual ||
        normalizedActual.includes(normalizedSelected) ||
        normalizedSelected.includes(normalizedActual) ||
        hasKeywordMatch;

      if (!matches) {
        return NextResponse.json({
          error: `Registration ${reg} belongs to department "${actualDepartment}", but you selected department "${department}". Please select the correct department. Check the browser console for more details or try different filters.`
        }, { status: 400 });
      }
    }

    // Validate batch if provided
    if (batch && batch !== "All" && batch !== regBatch && batch !== actualBatch && `20${batch}` !== actualBatch) {
      // Only fail if override batch also doesn't match
      return NextResponse.json({
        error: `Registration ${reg} belongs to batch ${actualBatch}, but you selected batch ${batch === "20" ? "2020" : batch === "21" ? "2021" : batch === "22" ? "2022" : batch === "23" ? "2023" : batch === "24" ? "2024" : batch === "25" ? "2025" : batch}. Please select the correct batch.`
      }, { status: 400 });
    }

    // FIXED: Load all results for the registration, optionally filtered by semesters
    const resultQuery = { Reg_No: reg };
    const semVals = (Array.isArray(semesters) ? semesters : []).filter(Boolean);
    if (semVals.length > 0 && !semVals.includes("All")) {
      resultQuery.Sem = { $in: semVals };
      console.log(`Applied semester filter for ${reg}: ${semVals.join(', ')}`);
    } else {
      console.log(`No semester filter applied for ${reg} - getting all semesters`);
    }

    console.log(`Querying results for ${reg} with query:`, JSON.stringify(resultQuery));
    console.log(`Registration number being searched: "${reg}"`);

    // Get results from correct collection based on school
    const studentCol = school === 'SOVET' ? 'diploma_result' : (school === 'SOM' ? 'som_result' : 'result');
    console.log(`Querying results for ${reg} in ${studentCol} with query:`, JSON.stringify(resultQuery));

    const resultsCUTM1 = await db
      .collection(studentCol)
      .find(resultQuery)
      .project({ _id: 0, Reg_No: 1, Name: 1, Subject_Code: 1, Subject_Name: 1, Credits: 1, Grade: 1, Sem: 1, Type: 1 })
      .toArray();

    // Get results from RegistrationData collection
    // Try both string and number for Reg_No since it might be stored as either
    const regAsNumber = parseInt(reg);
    const regDataQuery = {
      $or: [
        { Reg_No: reg },
        { Reg_No: regAsNumber }
      ]
    };

    // Add semester filter if present
    if (resultQuery.Sem) {
      regDataQuery.Sem = resultQuery.Sem;
    }

    const resultsRegData = await db
      .collection("RegistrationData")
      .find(regDataQuery)
      .project({ _id: 0, Reg_No: 1, Name: 1, Subject_Code: 1, Subject_Name: 1, Credits: 1, Grade: 1, Sem: 1, Type: 1 })
      .toArray();

    // Combine results from both collections
    const results = [...resultsCUTM1, ...resultsRegData];

    console.log(`Found ${resultsCUTM1.length} records from CUTM1 and ${resultsRegData.length} records from RegistrationData for ${reg}`);
    console.log(`Combined total: ${results.length} records for basket calculation`);

    if (results.length === 0) {
      // FIXED: Enhanced error message with debugging info
      console.log(`No academic records found for ${reg}`);

      // Check if student exists but has no results in both collections
      const studentExistsCUTM1 = await db
        .collection(studentCol)
        .findOne({ Reg_No: reg }, { projection: { _id: 0, Reg_No: 1, Name: 1 } });

      const studentExistsRegData = await db
        .collection("RegistrationData")
        .findOne({ Reg_No: reg }, { projection: { _id: 0, Reg_No: 1, Name: 1 } });

      if (studentExistsCUTM1 || studentExistsRegData) {
        const studentName = studentExistsCUTM1?.Name || studentExistsRegData?.Name || "Unknown";
        return NextResponse.json({
          error: `Student ${studentName} (${reg}) found but has no academic records. This could mean:
          1. No results have been uploaded for this student
          2. The semester filter is too restrictive
          3. Results are stored under a different registration format
          
          Try removing semester filters or contact the administrator.`
        }, { status: 404 });
      } else {
        return NextResponse.json({
          error: `No academic records found for registration ${reg}. Please verify the registration number or upload registration data first.`
        }, { status: 404 });
      }
    }

    // Build list of subject codes for all attempts (completed or failed)
    const codes = Array.from(
      new Set(
        results
          .map((r) => String(r.Subject_Code || "").toUpperCase().trim())
          .filter(Boolean)
      )
    );

    const codeMap = new Map();
    const codeDepartmentMap = new Map(); // NEW: Map subject codes to their departments

    // Load CBCS mappings for subjects (Used for B.Tech, Diploma and SOM BBA)
    if (codes.length > 0) {
      const cbcsDocs = await db
        .collection("cbcs")
        .find({
          $or: [
            { "Subject Code": { $in: codes } },
            { "Alternative Code": { $in: codes } },
          ],
        })
        .project({ _id: 0, "Subject Code": 1, "Alternative Code": 1, Basket: 1, Branch: 1, Department: 1 })
        .toArray();
      cbcsDocs.forEach((d) => {
        const code = String(d["Subject Code"]).toUpperCase().trim();
        const altRaw = String(d["Alternative Code"] || "").trim();
        const altCode = altRaw ? altRaw.toUpperCase() : "";
        let basketVal = String(d.Basket || "").trim();
        
        // Normalize numeric baskets for SOM/B.Tech (e.g. "1" -> "Basket I")
        const basketMap = {
          "1": "Basket I", "2": "Basket II", "3": "Basket III", "4": "Basket IV", "5": "Basket V", "6": "Basket VI",
          "I": "Basket I", "II": "Basket II", "III": "Basket III", "IV": "Basket IV", "V": "Basket V", "VI": "Basket VI"
        };
        
        if (basketMap[basketVal]) {
          basketVal = basketMap[basketVal];
        } else if (basketVal && !basketVal.startsWith("Basket")) {
          basketVal = `Basket ${basketVal}`;
        }
        
        const dept = String(d.Branch || d.Department || "").trim();
        codeMap.set(code, basketVal);
        codeDepartmentMap.set(code, dept);
        if (altCode) {
          codeMap.set(altCode, basketVal);
          codeDepartmentMap.set(altCode, dept);
        }
      });
    }

    // Function to check if a course belongs to a different branch's Basket IV
    // Uses the Branch field from CBCS database
    function checkIfCourseBelongsToDifferentBranch(subjectCode, studentDepartment) {
      const subjectBranch = codeDepartmentMap.get(subjectCode);
      console.log(`DEBUG: Checking ${subjectCode} - Student: ${studentDepartment}, Subject Branch: ${subjectBranch}`);
      if (!subjectBranch) {
        console.log(`DEBUG: ${subjectCode} has no branch info - keeping in original basket`);
        return false;
      }
      function normalizeBranchCode(input) {
        if (!input) return null;
        const up = String(input).trim().toUpperCase();
        if (up === 'AIML' || up.includes('ARTIFICIAL')) return 'AIML';
        if (up === 'CSE' || up.includes('COMPUTER')) return 'CSE';
        if (up === 'ECE' || up.includes('ELECTRONICS & COMMUNICATION')) return 'ECE';
        if (up === 'EEE' || (up.includes('ELECTRICAL') && !up.includes('COMMUNICATION'))) return 'EEE';
        if (up === 'ME' || up.includes('MECHANICAL')) return 'ME';
        if (up === 'CIVIL' || up.includes('CIVIL')) return 'CIVIL';
        return null;
      }
      const subjectBranchCodes = subjectBranch
        .split('/')
        .map(tok => normalizeBranchCode(tok))
        .filter(Boolean);
      const studentBranchCode = normalizeBranchCode(studentDepartment) || normalizeBranchCode(getBranchFromDepartment(studentDepartment));
      if (studentBranchCode && subjectBranchCodes.includes(studentBranchCode)) {
        console.log(`DEBUG: ${subjectCode} belongs to ${subjectBranch} (includes student's branch ${studentBranchCode}) - keeping in Basket IV`);
        return false;
      }
      if (!studentBranchCode || subjectBranchCodes.length === 0) {
        console.log(`DEBUG: Unable to normalize branches for ${subjectCode} - keeping in original basket`);
        return false;
      }
      console.log(`✅ Cross-branch detection: ${subjectCode} belongs to "${subjectBranch}" but taken by "${studentDepartment}" (${studentBranchCode}) student - MOVING TO BASKET V`);
      return true;
    }

    function subjectMatchesStudentBranch(subjectCode, studentDepartment) {
      const subjectBranch = codeDepartmentMap.get(subjectCode);
      if (!subjectBranch) return false;
      function normalizeBranchCode(input) {
        if (!input) return null;
        const up = String(input).trim().toUpperCase();
        if (up === 'AIML' || up.includes('ARTIFICIAL')) return 'AIML';
        if (up === 'CSE' || up.includes('COMPUTER')) return 'CSE';
        if (up === 'ECE' || up.includes('ELECTRONICS & COMMUNICATION')) return 'ECE';
        if (up === 'EEE' || (up.includes('ELECTRICAL') && !up.includes('COMMUNICATION'))) return 'EEE';
        if (up === 'ME' || up.includes('MECHANICAL')) return 'ME';
        if (up === 'CIVIL' || up.includes('CIVIL')) return 'CIVIL';
        return null;
      }
      const subjectBranchCodes = subjectBranch
        .split('/')
        .map(tok => normalizeBranchCode(tok))
        .filter(Boolean);
      const studentBranchCode = normalizeBranchCode(studentDepartment);
      return !!(studentBranchCode && subjectBranchCodes.includes(studentBranchCode));
    }

    // Helper function to convert department name to branch code
    function getBranchFromDepartment(dept) {
      if (!dept) return null;
      const upper = dept.toUpperCase();
      if (upper.includes('AIML') || upper.includes('ARTIFICIAL')) return 'AIML';
      if (upper.includes('COMPUTER') || upper.includes('CSE')) return 'CSE';
      if (upper.includes('ELECTRONICS & COMMUNICATION') || upper.includes('ECE')) return 'ECE';
      if (upper.includes('ELECTRICAL') || upper.includes('EEE')) return 'EEE';
      if (upper.includes('MECHANICAL') || upper.includes('ME')) return 'ME';
      if (upper.includes('CIVIL')) return 'CIVIL';
      return null;
    }

    // Initialize baskets with appropriate credit requirements
    // Force diploma if school detected as SOVET
    const isDiplomaSchool = (String(school || '').toUpperCase() === 'SOVET');
    // PASS EFFECTIVE BATCH AND DEGREE TYPE HERE
    const requiredCredits = await getRequiredCreditsForStudent(reg, actualDepartment, isDiplomaSchool ? 'SOVET' : school, actualBatch, bbaDegreeType);
    const basketNames = Object.keys(requiredCredits);
    const basketProgress = Object.fromEntries(
      basketNames.map((name) => [name, buildBasketState(requiredCredits[name])])
    );

    // Add lateral entry and diploma indicators to student info
    const { isDiplomaLateralEntry: checkLateral } = await getDiplomaHelpers();
    const isDiploma = isDiplomaSchool ? true : await isDiplomaStudent(reg, actualDepartment, school);
    // For diploma, use diploma-specific lateral entry check
    const isLateralEntry = isDiploma ? await checkLateral(reg) : isLateralEntryStudent(reg);

    const isBbaStudentSom =
      school === "SOM" && (actualDepartment === "BBA" || reg.slice(5, 8) === "912");
    const defaultBasketWhenMissing = isBbaStudentSom ? "Basket II" : "Basket V";

    // Assign subjects to baskets. Earn credits only for completed attempts
    results.forEach((r) => {
      const code = String(r.Subject_Code || "").toUpperCase().trim();
      const credits = parseCredits(r.Credits);
      const grade = String(r.Grade || "").toUpperCase().trim();

      // For registration data (Type: 'Registration'), treat empty grades as registered subjects
      // For CUTM1 data, use normal grade logic
      const isRegistrationData = r.Type === 'Registration';
      const isFailed = isRegistrationData ? false : FAIL_OR_INCOMPLETE_GRADES.has(grade);

      // Special handling for SOM: MBA uses 'Total', BBA uses Baskets I-V
      let targetBasket = codeMap.get(code) || defaultBasketWhenMissing;
      if (school === 'SOM') {
        const isMbaNow = actualDepartment === 'MBA' || reg.slice(5, 8) === '214';
        if (isMbaNow) {
          targetBasket = "Total"; // MBA uses flat structure
        }
        // BBA: mapped from cbcs, or default Basket II when code not in cbcs
      } else if (code === "CUTM1057") {
        if (actualDepartment === "Computer Science Engineering" || actualDepartment === "Electronics & Communication Engineering") {
          targetBasket = "Basket V";
        } else {
          targetBasket = "Basket IV";
        }
      } else if (code === "CUTM1046") {
        if (actualDepartment === "Computer Science Engineering") {
          targetBasket = "Basket V";
        } else if (actualDepartment === "Electronics & Communication Engineering") {
          targetBasket = "Basket IV";
        } else {
          targetBasket = "Basket IV"; // Default to Basket IV for other departments
        }
      }

      // Cross-branch course detection with bidirectional correction
      const courseBelongsToDifferentBranch = checkIfCourseBelongsToDifferentBranch(code, actualDepartment);
      const courseMatchesStudentBranch = subjectMatchesStudentBranch(code, actualDepartment);
      if (targetBasket === "Basket IV" && courseBelongsToDifferentBranch) {
        targetBasket = "Basket V";
        console.log(`Cross-branch course detected: ${code} moved from Basket IV to Basket V for ${actualDepartment} student`);
      } else if (targetBasket === "Basket V" && courseMatchesStudentBranch) {
        targetBasket = "Basket IV";
        console.log(`Branch-aligned subject: ${code} moved from Basket V to Basket IV for ${actualDepartment} student`);
      }

      if (!basketProgress[targetBasket]) {
        // ensure presence even if mapping contains unexpected basket name
        basketProgress[targetBasket] = buildBasketState(0);
      }
      // Determine if subject is completed
      // If result is not published, it should not be marked as completed
      const isCompleted = isRegistrationData ? false : !isFailed;

      // Determine status based on completion state
      let status = "Not Completed";
      if (isCompleted) {
        status = "Completed";
      } else if (isFailed && !isRegistrationData) {
        status = "Failed";
      }

      const subjectEntry = {
        code,
        name: r.Subject_Name || "",
        credits,
        grade: isRegistrationData ? 'Result Not Published' : grade, // Show "Result Not Published" for registration data
        completed: isCompleted,
        failed: isFailed,
        status: status, // Add status field to show proper status
        Sem: r.Sem != null && String(r.Sem).trim() !== "" ? String(r.Sem).trim() : "",
        semester: r.Sem != null && String(r.Sem).trim() !== "" ? String(r.Sem).trim() : (r.Semester != null ? String(r.Semester).trim() : ""),
        is_default_assigned:
          !codeMap.has(code) &&
          ((isBbaStudentSom && targetBasket === "Basket II") ||
            (!isBbaStudentSom && targetBasket === "Basket V")),
        dataSource: isRegistrationData ? 'Registration' : 'CUTM1', // Add data source indicator
      };
      basketProgress[targetBasket].subjects.push(subjectEntry);
      if (!isFailed) {
        basketProgress[targetBasket].earned_credits += credits;
      } else {
        basketProgress[targetBasket].failed_credits += credits;
      }
      if (subjectEntry.is_default_assigned) {
        basketProgress[targetBasket].has_default_subjects = true;
        basketProgress[targetBasket].default_assigned_count += 1;
      }
    });

    // Recalculate each basket
    Object.values(basketProgress).forEach(recalcBasket);

    // Optionally filter to single basket
    let filteredProgress = basketProgress;
    if (basket && basket !== "All" && basketProgress[basket]) {
      filteredProgress = { [basket]: basketProgress[basket] };
    }

    // Build student meta (including failed subjects in total)
    const totalEarned = Object.values(filteredProgress).reduce((s, b) => s + (Number(b.earned_credits) || 0), 0);
    const totalFailed = Object.values(filteredProgress).reduce((s, b) => s + (Number(b.failed_credits) || 0), 0);
    const totalCredits = totalEarned + totalFailed; // Include both earned and failed
    // Calculate total required credits based on student type
    let defaultTotalRequired = 160; // Default for B.Tech Regular
    if (school === 'SOM') {
      const isBbaProgram = actualDepartment === 'BBA' || reg.slice(5, 8) === '912';
      const is2023Onwards = reg && (reg.startsWith('23') || reg.startsWith('24') || parseInt(reg.substring(0, 2), 10) >= 23);
      const bba120 =
        isBbaProgram &&
        (bbaDegreeType === "3year" || !is2023Onwards);
      defaultTotalRequired = isBbaProgram ? (bba120 ? 120 : 160) : 73;
    } else if (isDiploma) {
      defaultTotalRequired = isLateralEntry ? 80 : 120; // Diploma: 80 (lateral) or 120 (regular)
    } else if (isLateralEntry) {
      defaultTotalRequired = 120; // B.Tech Lateral Entry
    }

    const totalRequired = Object.values(filteredProgress).reduce((s, b) => s + (Number(b.required_credits) || 0), 0) || defaultTotalRequired;
    const percentage = totalRequired > 0 ? Math.min(100, Math.round((totalEarned / totalRequired) * 100)) : 0;

    // Determine student type string
    let studentTypeStr = "Regular";
    if (isDiploma) {
      studentTypeStr = isLateralEntry ? "Diploma Lateral Entry" : "Diploma Regular";
    } else if (isLateralEntry) {
      studentTypeStr = "Lateral Entry";
    }

    const student = {
      name: studentInfo.Name || results[0]?.Name || `Student ${reg.slice(-4)}`,
      registration: reg,
      department: actualDepartment,
      actual_batch: actualBatch,
      is_lateral_entry: isLateralEntry,
      is_diploma: isDiploma,
      student_type: studentTypeStr,
      overall_stats: {
        overall_status: (() => {
          const basketsCompleted = Object.values(filteredProgress).filter((b) => b.is_completed).length;
          const totalBaskets = Object.keys(filteredProgress).length || 5;
          return basketsCompleted === totalBaskets && totalBaskets > 0 ? "Completed" : percentage === 0 ? "Not Started" : "In Progress";
        })(),
        baskets_completed: Object.values(filteredProgress).filter((b) => b.is_completed).length,
        total_baskets: Object.keys(filteredProgress).length || 5,
        total_earned_credits: totalEarned,
        total_failed_credits: totalFailed,
        total_credits: totalCredits,
        total_required_credits: totalRequired,
        percentage,
        default_assigned_subjects: Object.values(filteredProgress).reduce((s, b) => s + (Number(b.default_assigned_count) || 0), 0),
      },
    };

    return NextResponse.json({
      student,
      basketProgress: filteredProgress,
      dataSources: {
        resultRecords: resultsCUTM1.length,
        registrationDataRecords: resultsRegData.length,
        totalRecords: results.length,
        sources: {
          result: resultsCUTM1.length > 0,
          registrationData: resultsRegData.length > 0
        }
      }
    });
  } catch (err) {
    console.error("/api/cbcs/track error", err);
    console.error("Error stack:", err.stack);
    console.error("Error details:", {
      message: err.message,
      name: err.name,
      registration: registration || 'unknown'
    });
    return NextResponse.json({
      error: "Unable to load progress",
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    }, { status: 500 });
  }
}



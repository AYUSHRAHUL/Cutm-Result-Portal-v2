import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { jwtVerify } from "jose";

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

// Helper function to get department from registration number
function getDepartmentFromRegNo(regNo) {
  const deptCode = regNo.charAt(7);
  const deptMap = {
    '1': 'Civil Engineering',
    '2': 'Computer Science Engineering', 
    '3': 'Electronics & Communication Engineering',
    '4': 'Electronics & Communication Engineering', // Alternative code for ECE
    '5': 'Electrical & Electronics Engineering',
    '6': 'Mechanical Engineering',
    '7': 'AIML', // AIML
    '8': 'Computer Science Engineering', // Alternative code for CSE
    '9': 'Civil Engineering' // Alternative code for Civil
  };
  
  let department = deptMap[deptCode];
  
  // If not found in map, try to get from student data
  if (!department) {
    // This will be handled in the main function where we have access to student info
    department = 'Unknown';
  }
  
  return department;
}

// Function to check if a student is lateral entry
function isLateralEntryStudent(registration) {
  // Lateral entry students have "1" as the 9th character (0-indexed position 8)
  // Example: 220101131056 (lateral) vs 220101130056 (normal)
  return registration && registration.length >= 9 && registration.charAt(8) === '1';
}

// Function to get required credits based on student type and batch year
function getRequiredCreditsForStudent(registration) {
  if (isLateralEntryStudent(registration)) return LATERAL_ENTRY_CREDITS;
  const batchSuffix = (registration || "").slice(0, 2);
  const batchNum = parseInt(batchSuffix, 10);
  if (!Number.isNaN(batchNum) && batchNum >= 24) {
    return REQUIRED_CREDITS_2024_ONWARDS;
  }
  return REQUIRED_CREDITS;
}

function parseCredits(creditStr) {
  if (!creditStr) return 0;
  const parts = creditStr
    .toString()
    .split(/[+\-]/)
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
    console.log("Bulk API - Token present:", !!token);
    if (!token) {
      console.log("Bulk API - No token found");
      return NextResponse.json({ error: "Unauthorized - Please login first" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    console.log("Bulk API - Token payload:", payload ? { email: payload.email, role: payload.role } : "null");
    if (!payload?.email) {
      console.log("Bulk API - Invalid token payload");
      return NextResponse.json({ error: "Unauthorized - Invalid token" }, { status: 401 });
    }

    // Get user role for access control
    const userRole = payload.role?.toLowerCase();
    
    // Security check: Only teachers and admins can access bulk data
    if (userRole !== 'teacher' && userRole !== 'admin') {
      return NextResponse.json({ 
        error: "Access denied - Only teachers and admins can access bulk student data" 
      }, { status: 403 });
    }

    console.log(`Bulk access granted to ${userRole}: ${payload.email}`);

    let requestBody;
    try {
      requestBody = await req.json();
      console.log("Bulk API received request:", requestBody);
    } catch (parseError) {
      console.error("Bulk API - Error parsing request body:", parseError);
      return NextResponse.json({ 
        error: "Invalid request body",
        details: parseError.message 
      }, { status: 400 });
    }
    
    const { registration, department, batch, semesters = [], basket } = requestBody;
    
    // Department is optional for bulk analysis - if not provided, get all students

    console.log("Bulk API - Connecting to MongoDB...");
    const client = await clientPromise;
    const db = client.db("cutm1");
    console.log("Bulk API - MongoDB connection established");

    // Build query for students with proper filtering (supports overrides)
    let query = {};

    if (department && department !== "All" && department !== "Select Department" && department !== "") {
      // Map department names to department codes (8th character in registration)
      const deptMap = {
        'Civil Engineering': '1',
        'Computer Science Engineering': '2', 
        'Electronics & Communication Engineering': '3',
        'Electrical & Electronics Engineering': '5',
        'Mechanical Engineering': '6',
        'AIML': '7'
      };
      const deptCode = deptMap[department];

      const orConds = [];
      if (deptCode) {
        orConds.push({ Reg_No: { $regex: `^.{7}${deptCode}` } });
      }
      // Include overrides for this department
      try {
        const ovDocs = await db.collection("branch_overrides").find({ branch: department }).project({ reg: 1 }).toArray();
        const regs = ovDocs.map(d => d.reg).filter(Boolean);
        if (regs.length > 0) orConds.push({ Reg_No: { $in: regs } });
      } catch {}

      if (orConds.length > 0) {
        query.$or = orConds;
        console.log(`Applied department filter with overrides for ${department}`);
      }
    } else if (registration === "all") {
      console.log("No department filter applied - getting all students");
    }
    
    // FIXED: Apply batch filter
    if (batch && batch !== "All" && batch !== "") {
      // Combine batch with existing OR of regex/$in if present
      if (query.$or) {
        query.$and = [
          { $or: query.$or },
          { Reg_No: { $regex: `^${batch}` } }
        ];
        delete query.$or;
        console.log(`Combined batch filter (${batch}) with department/override conditions`);
      } else if (query.Reg_No && query.Reg_No.$regex) {
        // Rare case if only regex placed directly
        const deptCode = query.Reg_No.$regex.slice(-1);
        query.Reg_No = { $regex: `^${batch}.{5}${deptCode}` };
        console.log(`Combined batch + department regex: ^${batch}.{5}${deptCode}`);
      } else {
        query.Reg_No = { $regex: `^${batch}` };
        console.log(`Applied batch filter only: ^${batch}`);
      }
    }
    
    console.log(`Final query object:`, JSON.stringify(query));
    console.log(`Query keys:`, Object.keys(query));
    
    // Ensure query is valid - if empty, use empty object
    if (!query || Object.keys(query).length === 0) {
      query = {};
      console.log('Using empty query for all students');
    }
    
    // Additional validation for Reg_No queries
    if (query.Reg_No && query.Reg_No.$regex) {
      try {
        // Test if the regex is valid
        new RegExp(query.Reg_No.$regex);
        console.log('Regex validation passed:', query.Reg_No.$regex);
      } catch (regexError) {
        console.error('Invalid regex detected:', query.Reg_No.$regex, regexError);
        // Fallback to empty query
        query = {};
        console.log('Falling back to empty query due to invalid regex');
      }
    }
    
    // Get students with the combined query - check both CUTM1 and RegistrationData collections
    console.log(`Querying CUTM1 with query:`, JSON.stringify(query));
    let studentsCUTM1 = [];
    try {
      studentsCUTM1 = await db
        .collection("CUTM1")
        .find(query)
        .project({ _id: 0, Reg_No: 1, Name: 1 })
        .toArray();
      console.log(`Found ${studentsCUTM1.length} students in CUTM1`);
    } catch (error) {
      console.error('Error querying CUTM1:', error);
      studentsCUTM1 = [];
    }
    
    // Also get students from RegistrationData collection
    console.log(`Querying RegistrationData with query:`, JSON.stringify(query));
    let studentsRegData = [];
    try {
      studentsRegData = await db
        .collection("RegistrationData")
        .find(query)
        .project({ _id: 0, Reg_No: 1, Name: 1 })
        .toArray();
      console.log(`Found ${studentsRegData.length} students in RegistrationData`);
    } catch (error) {
      console.error('Error querying RegistrationData:', error);
      studentsRegData = [];
    }
    
    // Combine students from both collections, avoiding duplicates
    const studentMap = new Map();
    
    // Add students from CUTM1
    studentsCUTM1.forEach(student => {
      studentMap.set(student.Reg_No, {
        ...student,
        source: 'CUTM1'
      });
    });
    
    // Add students from RegistrationData (only if not already in CUTM1)
    studentsRegData.forEach(student => {
      if (!studentMap.has(student.Reg_No)) {
        studentMap.set(student.Reg_No, {
          ...student,
          source: 'RegistrationData'
        });
      }
    });
    
    let students = Array.from(studentMap.values());
    
    console.log(`Final query:`, JSON.stringify(query));
    console.log(`Found ${students.length} unique students`);
    if (students.length > 0) {
      console.log(`Sample students:`, students.slice(0, 3).map(s => ({ Reg_No: s.Reg_No, Name: s.Name, DeptCode: s.Reg_No.charAt(7) })));
    }
    
    // If no students found, return error with debug info
    if (students.length === 0) {
      const sampleStudents = await db
        .collection("CUTM1")
        .find({})
        .project({ _id: 0, Reg_No: 1, Name: 1 })
        .limit(5)
        .toArray();
      
      const totalStudents = await db.collection("CUTM1").countDocuments();
      
      return NextResponse.json({ 
        error: `No students found. Please check your filters.`,
        debug: {
          query,
          department,
          batch,
          registration,
          totalStudents,
          sampleStudents: sampleStudents.map(s => ({ 
            Reg_No: s.Reg_No, 
            Name: s.Name,
            DeptCode: s.Reg_No.charAt(7),
            DeptName: getDepartmentFromRegNo(s.Reg_No)
          })),
          suggestions: `Try these department codes: 1=Civil, 2=CSE, 3=ECE, 5=EEE, 6=ME`
        }
      }, { status: 404 });
    }

    // Get unique registration numbers
    const regNumbers = [...new Set(students.map(s => s.Reg_No))];

    // Build results query - no need for department filter since we already filtered students
    const resultQuery = { Reg_No: { $in: regNumbers } };
    
    // FIXED: Apply semester filter
    const semVals = (Array.isArray(semesters) ? semesters : []).filter(Boolean);
    if (semVals.length > 0 && !semVals.includes("All")) {
      resultQuery.Sem = { $in: semVals };
      console.log(`Applied semester filter: ${semVals.join(', ')}`);
    } else {
      console.log("No semester filter applied - getting all semesters");
    }

    // Get all results for these students from both collections
    const resultsCUTM1 = await db
      .collection("CUTM1")
      .find(resultQuery)
      .project({ _id: 0, Reg_No: 1, Name: 1, Subject_Code: 1, Subject_Name: 1, Credits: 1, Grade: 1, Sem: 1, Type: 1 })
      .toArray();
    
    // Try both string and number for Reg_No since it might be stored as either
    const regDataQuery = { 
      $or: [
        { Reg_No: { $in: regNumbers } },
        { Reg_No: { $in: regNumbers.map(r => parseInt(r)) } }
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
    
    console.log(`Found ${resultsCUTM1.length} records from CUTM1 and ${resultsRegData.length} records from RegistrationData`);
    console.log(`Combined total: ${results.length} records for bulk basket calculation`);
    
    // Debug: Show sample results from both collections
    if (resultsCUTM1.length > 0) {
      console.log(`Sample CUTM1 results:`, resultsCUTM1.slice(0, 2).map(r => ({
        Reg_No: r.Reg_No,
        Type: r.Type,
        Subject_Code: r.Subject_Code,
        Credits: r.Credits,
        Grade: r.Grade
      })));
    }
    if (resultsRegData.length > 0) {
      console.log(`Sample RegistrationData results:`, resultsRegData.slice(0, 2).map(r => ({
        Reg_No: r.Reg_No,
        Type: r.Type,
        Subject_Code: r.Subject_Code,
        Credits: r.Credits,
        Grade: r.Grade
      })));
    }

    if (results.length === 0) {
      return NextResponse.json({ 
        error: `No academic records found for students in department ${department}` 
      }, { status: 404 });
    }

    // Get CBCS mappings
    const codes = Array.from(
      new Set(
        results
          .map((r) => String(r.Subject_Code || "").toUpperCase().trim())
          .filter(Boolean)
      )
    );

    const codeMap = new Map();
    const codeDepartmentMap = new Map(); // NEW: Map subject codes to their departments
    if (codes.length > 0) {
      const cbcsDocs = await db
        .collection("cbcs")
        .find({ "Subject Code": { $in: codes } })
        .project({ _id: 0, "Subject Code": 1, Basket: 1, Branch: 1, Department: 1 })
        .toArray();
      cbcsDocs.forEach((d) => {
        const code = String(d["Subject Code"]).toUpperCase().trim();
        codeMap.set(code, String(d.Basket || "").trim());
        // Store department info from Branch field (or Department if available)
        const dept = String(d.Branch || d.Department || "").trim();
        codeDepartmentMap.set(code, dept);
      });
    }

    // Function to check if a course belongs to a different branch's Basket IV
    // Uses the Branch field from CBCS database
    function checkIfCourseBelongsToDifferentBranch(subjectCode, studentDepartment, regNo) {
      // Get the subject's branch from the database
      const subjectBranch = codeDepartmentMap.get(subjectCode);
      
      console.log(`DEBUG: Checking ${subjectCode} (${regNo}) - Student: ${studentDepartment}, Subject Branch: ${subjectBranch}`);
      
      // If subject branch is not found, don't reassign
      if (!subjectBranch) {
        console.log(`DEBUG: ${subjectCode} has no branch info - keeping in original basket`);
        return false;
      }
      
      // Normalize student department to branch code for comparison
      const studentBranch = getBranchFromDepartment(studentDepartment);
      
      // If we can't determine student branch, don't reassign
      if (!studentBranch) {
        console.log(`DEBUG: Cannot determine branch for ${studentDepartment} - keeping in original basket`);
        return false;
      }
      
      // Normalize both subject branch tokens and student branch to canonical codes
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
      const studentBranchCode = normalizeBranchCode(studentBranch) || normalizeBranchCode(studentDepartment);

      // If subject belongs to student's branch (even if it has multiple branches), keep in Basket IV
      if (studentBranchCode && subjectBranchCodes.includes(studentBranchCode)) {
        console.log(`DEBUG: ${subjectCode} belongs to ${subjectBranch} (includes student's branch ${studentBranch}) - keeping in Basket IV`);
        return false;
      }
      
      // If we couldn't determine codes, don't reassign
      if (!studentBranchCode || subjectBranchCodes.length === 0) {
        console.log(`DEBUG: Unable to normalize branches for ${subjectCode} - keeping in original basket`);
        return false;
      }

      // If subject belongs to a different branch/department, move to Basket V
      console.log(`✅ Cross-branch detection: ${subjectCode} belongs to "${subjectBranch}" but taken by "${studentDepartment}" (${studentBranch}) student ${regNo} - MOVING TO BASKET V`);
      return true;
    }

    // Helper to check if subject's declared branch includes student's branch
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

    // Process each student
    const studentsData = [];
    
    for (const student of students) {
      // Try both string and number matching for Reg_No
      const studentResults = results.filter(r => 
        r.Reg_No === student.Reg_No || 
        r.Reg_No === String(student.Reg_No) || 
        String(r.Reg_No) === student.Reg_No ||
        r.Reg_No === parseInt(student.Reg_No) ||
        parseInt(r.Reg_No) === student.Reg_No
      );
      
      // Debug: Check if we're finding results for this student
      console.log(`Student ${student.Reg_No} (${student.Name}): Found ${studentResults.length} results`);
      if (studentResults.length > 0) {
        console.log(`Sample results for ${student.Reg_No}:`, studentResults.slice(0, 2).map(r => ({
          Reg_No: r.Reg_No,
          Type: r.Type,
          Subject_Code: r.Subject_Code,
          Credits: r.Credits,
          Grade: r.Grade
        })));
      }
      
      if (studentResults.length === 0) continue;

      // Get department from registration number
      let actualDepartment = getDepartmentFromRegNo(student.Reg_No);

      // Override from admin configuration if exists
      try {
        const ov = await db.collection("branch_overrides").findOne({ reg: String(student.Reg_No) });
        if (ov?.branch) {
          actualDepartment = ov.branch;
        }
      } catch {}
      
      // If department is still "Unknown", try to get from student info
      if (actualDepartment === 'Unknown' && student.Branch) {
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
        actualDepartment = branchMap[student.Branch] || student.Branch || "Unknown";
      }
      
      // Skip if department doesn't match the filter (only if department filter is applied and not "all")
      if (department && department !== "All" && department !== "Select Department" && actualDepartment !== department) {
        continue;
      }

      // Initialize baskets with appropriate credit requirements for lateral entry students
      const requiredCredits = getRequiredCreditsForStudent(student.Reg_No);
      const basketNames = Object.keys(requiredCredits);
      const basketProgress = Object.fromEntries(
        basketNames.map((name) => [name, buildBasketState(requiredCredits[name])])
      );
      
      // Add lateral entry indicator
      const isLateralEntry = isLateralEntryStudent(student.Reg_No);

      // Process student results
      studentResults.forEach((r) => {
        const code = String(r.Subject_Code || "").toUpperCase().trim();
        const credits = parseCredits(r.Credits);
        const grade = String(r.Grade || "").toUpperCase().trim();
        
        // For registration data (Type: 'Registration'), treat empty grades as registered subjects
        // For CUTM1 data, use normal grade logic
        const isRegistrationData = r.Type === 'Registration';
        const isFailed = isRegistrationData ? false : FAIL_OR_INCOMPLETE_GRADES.has(grade);
        
        // Special handling for CUTM1057 and CUTM1046 based on department
        let targetBasket = codeMap.get(code) || "Basket V";
        if (code === "CUTM1057") {
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
        
        // NEW FEATURE: Cross-branch course detection (bidirectional correction)
        // 1) If Basket IV but subject belongs to another branch -> move to Basket V
        // 2) If Basket V but subject actually belongs to student's branch -> keep/move to Basket IV
        const courseBelongsToDifferentBranch = checkIfCourseBelongsToDifferentBranch(code, actualDepartment, student.Reg_No);
        const courseMatchesStudentBranch = subjectMatchesStudentBranch(code, actualDepartment);
        if (targetBasket === "Basket IV" && courseBelongsToDifferentBranch) {
          targetBasket = "Basket V";
          console.log(`Cross-branch course detected: ${code} moved from Basket IV to Basket V for ${actualDepartment} student ${student.Reg_No}`);
        } else if (targetBasket === "Basket V" && courseMatchesStudentBranch) {
          targetBasket = "Basket IV";
          console.log(`Branch-aligned subject: ${code} moved from Basket V to Basket IV for ${actualDepartment} student ${student.Reg_No}`);
        }
        
        if (!basketProgress[targetBasket]) {
          basketProgress[targetBasket] = buildBasketState(0);
        }
        
        if (!isFailed) {
          basketProgress[targetBasket].earned_credits += credits;
        } else {
          basketProgress[targetBasket].failed_credits += credits;
        }
      });

      // Recalculate each basket
      Object.values(basketProgress).forEach(recalcBasket);

      // Calculate totals (earned + failed to reflect attempted credits)
      const totalEarned = Object.values(basketProgress).reduce((s, b) => s + (Number(b.earned_credits) || 0), 0);
      const totalFailed = Object.values(basketProgress).reduce((s, b) => s + (Number(b.failed_credits) || 0), 0);
      const totalCredits = totalEarned + totalFailed; // include failed credits as requested
      const totalRequired = Object.values(basketProgress).reduce((s, b) => s + (Number(b.required_credits) || 0), 0) || (isLateralEntry ? 120 : 160);
      const percentage = totalRequired > 0 ? Math.min(100, Math.round((totalEarned / totalRequired) * 100)) : 0;

      // FIXED: Filter to specific basket if requested
      let filteredProgress = basketProgress;
      if (basket && basket !== "All" && basket !== "" && basketProgress[basket]) {
        filteredProgress = { [basket]: basketProgress[basket] };
        console.log(`Applied basket filter: ${basket}`);
      } else {
        console.log("No basket filter applied - showing all baskets");
      }

      // Build student data (basket values show earned + failed)
      // Calculate status based on all baskets being completed, not just percentage
      const basketsCompleted = Object.values(basketProgress).filter((b) => b.is_completed).length;
      const totalBaskets = Object.keys(basketProgress).length || 5;
      const overallStatus = basketsCompleted === totalBaskets && totalBaskets > 0 ? "Completed" : percentage === 0 ? "Not Started" : "In Progress";
      
      const studentData = {
        name: student.Name || `Student ${student.Reg_No.slice(-4)}`,
        registration: student.Reg_No,
        department: actualDepartment,
        is_lateral_entry: isLateralEntry,
        student_type: isLateralEntry ? "Lateral Entry" : "Regular",
        totalCredits: totalCredits,
        totalRequiredCredits: totalRequired,
        percentage: percentage,
        status: overallStatus,
        // Individual basket credits (earned + failed)
        basketI: (basketProgress["Basket I"]?.earned_credits || 0) + (basketProgress["Basket I"]?.failed_credits || 0),
        basketII: (basketProgress["Basket II"]?.earned_credits || 0) + (basketProgress["Basket II"]?.failed_credits || 0),
        basketIII: (basketProgress["Basket III"]?.earned_credits || 0) + (basketProgress["Basket III"]?.failed_credits || 0),
        basketIV: (basketProgress["Basket IV"]?.earned_credits || 0) + (basketProgress["Basket IV"]?.failed_credits || 0),
        basketV: (basketProgress["Basket V"]?.earned_credits || 0) + (basketProgress["Basket V"]?.failed_credits || 0),
        // FIXED: For specific basket view
        basketCredits: basket && basket !== "All" && basket !== "" ? ((basketProgress[basket]?.earned_credits || 0) + (basketProgress[basket]?.failed_credits || 0)) : 0,
        basketStatus: basket && basket !== "All" && basket !== "" ? (basketProgress[basket]?.status || "Not Started") : "N/A"
      };

      studentsData.push(studentData);
    }

    return NextResponse.json({ 
      success: true, 
      students: studentsData,
      totalStudents: studentsData.length,
      department,
      batch: batch || "All",
      basket: basket || "All",
      dataSources: {
        cutm1Records: resultsCUTM1.length,
        registrationDataRecords: resultsRegData.length,
        totalRecords: results.length,
        sources: {
          cutm1: resultsCUTM1.length > 0,
          registrationData: resultsRegData.length > 0
        }
      }
    });

  } catch (err) {
    console.error('Bulk track API error:', err);
    console.error('Error stack:', err.stack);
    return NextResponse.json({ 
      error: "Unable to load bulk data",
      details: err.message,
      stack: err.stack
    }, { status: 500 });
  }
}

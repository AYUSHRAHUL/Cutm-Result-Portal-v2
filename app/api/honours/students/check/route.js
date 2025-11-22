import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { verifyToken } from "@/lib/auth";

// Grade to points mapping
const GRADE_MAP = {
  O: 10, E: 9, A: 8, B: 7, C: 6, D: 5, S: 0, F: 0, I: 0, M: 0, R: 0
};

// Parse credits (handles "3+1" or "3" format)
function parseCredits(creditStr) {
  if (!creditStr) return 0;
  const parts = String(creditStr)
    .split("+")
    .map((p) => parseFloat(p.trim()) || 0);
  return parts.reduce((a, b) => a + b, 0);
}

// Calculate CGPA (considering both CUTM1 and RegistrationData)
async function calculateCGPA(db, registration) {
  const reg = registration.toUpperCase();
  
  // Get results from CUTM1
  const resultsCUTM1 = await db.collection("CUTM1")
    .find({ Reg_No: reg })
    .project({ _id: 0, Subject_Code: 1, Credits: 1, Grade: 1 })
    .toArray();

  // Get results from RegistrationData
  const regAsNumber = parseInt(reg);
  const resultsRegData = await db.collection("RegistrationData")
    .find({
      $or: [
        { Reg_No: reg },
        { Reg_No: regAsNumber }
      ]
    })
    .project({ _id: 0, Subject_Code: 1, Credits: 1, Grade: 1, Type: 1 })
    .toArray();

  // Combine results, prioritizing CUTM1 (more accurate grades)
  const subjectMap = new Map(); // code -> { credits, grade }
  
  // First add RegistrationData (may have subjects not yet graded)
  resultsRegData.forEach(row => {
    const code = (row.Subject_Code || "").toUpperCase().trim();
    if (!code) return;
    
    const credits = parseCredits(row.Credits);
    const grade = (row.Grade || "").toUpperCase().trim();
    
    // For RegistrationData, if no grade or Type is 'Registration', don't count in CGPA
    // Only count if there's an actual grade
    if (grade && !['F', 'S', 'I', 'M', 'R'].includes(grade)) {
      subjectMap.set(code, { credits, grade });
    }
  });
  
  // Then add/override with CUTM1 data (more accurate)
  resultsCUTM1.forEach(row => {
    const code = (row.Subject_Code || "").toUpperCase().trim();
    if (!code) return;
    
    const credits = parseCredits(row.Credits);
    const grade = (row.Grade || "").toUpperCase().trim();
    
    // CUTM1 data takes precedence
    subjectMap.set(code, { credits, grade });
  });

  let totalCredits = 0;
  let weightedSum = 0;

  subjectMap.forEach(({ credits, grade }) => {
    const gradePoint = GRADE_MAP[grade] ?? 0;

    if (!isNaN(credits) && credits > 0) {
      totalCredits += credits;
      weightedSum += credits * gradePoint;
    }
  });

  const cgpa = totalCredits > 0 ? weightedSum / totalCredits : 0;
  return parseFloat(cgpa.toFixed(2));
}

// Get department from registration number
function getDepartmentFromRegNo(regNo) {
  if (!regNo || regNo.length < 8) return "Unknown";
  const deptCode = regNo.charAt(7);
  const deptMap = {
    '1': 'Civil Engineering',
    '2': 'Computer Science Engineering',
    '3': 'Electronics & Communication Engineering',
    '5': 'Electrical & Electronics Engineering',
    '6': 'Mechanical Engineering'
  };
  return deptMap[deptCode] || "Unknown";
}

// Check if subject belongs to same branch
function isSameBranch(subjectCode, studentBranch) {
  if (!subjectCode || !studentBranch) return false;
  
  // Normalize branch names
  const normalizedStudentBranch = String(studentBranch).toUpperCase().trim();
  
  // Map subject code prefixes to branch names
  const prefixToBranch = {
    'CUC': 'CIVIL ENGINEERING',
    'CUCS': 'COMPUTER SCIENCE ENGINEERING',
    'CUES': 'ELECTRONICS & COMMUNICATION ENGINEERING',
    'CUEE': 'ELECTRICAL & ELECTRONICS ENGINEERING',
    'CUMS': 'MECHANICAL ENGINEERING',
    'CUEC': 'ELECTRONICS & COMMUNICATION ENGINEERING',
    'CUEL': 'ELECTRICAL & ELECTRONICS ENGINEERING',
    'CUCE': 'CIVIL ENGINEERING',
    'CUME': 'MECHANICAL ENGINEERING'
  };
  
  // Check each prefix
  for (const [prefix, branch] of Object.entries(prefixToBranch)) {
    if (subjectCode.startsWith(prefix)) {
      // Compare normalized branch names
      return branch === normalizedStudentBranch || 
             normalizedStudentBranch.includes(branch.split(' ')[0]) ||
             branch.includes(normalizedStudentBranch.split(' ')[0]);
    }
  }
  
  // If no prefix match, check if subject code contains branch identifier
  const branchKeywords = {
    'CIVIL': 'CIVIL ENGINEERING',
    'CSE': 'COMPUTER SCIENCE ENGINEERING',
    'CS': 'COMPUTER SCIENCE ENGINEERING',
    'ECE': 'ELECTRONICS & COMMUNICATION ENGINEERING',
    'EC': 'ELECTRONICS & COMMUNICATION ENGINEERING',
    'EEE': 'ELECTRICAL & ELECTRONICS ENGINEERING',
    'EE': 'ELECTRICAL & ELECTRONICS ENGINEERING',
    'ME': 'MECHANICAL ENGINEERING',
    'MECH': 'MECHANICAL ENGINEERING'
  };
  
  for (const [keyword, branch] of Object.entries(branchKeywords)) {
    if (subjectCode.includes(keyword) && 
        (normalizedStudentBranch.includes(branch) || branch.includes(normalizedStudentBranch))) {
      return true;
    }
  }
  
  return false;
}

// Check Basket 4 eligibility (58 same branch + 20 different branch credits)
async function checkBasket4(db, registration, studentBranch) {
  const reg = registration.toUpperCase();
  
  // Get all results for the student from CUTM1
  const resultsCUTM1 = await db.collection("CUTM1")
    .find({ Reg_No: reg })
    .project({ _id: 0, Reg_No: 1, Subject_Code: 1, Subject_Name: 1, Credits: 1, Grade: 1, Sem: 1 })
    .toArray();

  // Also get results from RegistrationData collection
  const regAsNumber = parseInt(reg);
  const resultsRegData = await db.collection("RegistrationData")
    .find({
      $or: [
        { Reg_No: reg },
        { Reg_No: regAsNumber }
      ]
    })
    .project({ _id: 0, Reg_No: 1, Subject_Code: 1, Subject_Name: 1, Credits: 1, Grade: 1, Sem: 1, Type: 1 })
    .toArray();

  // Combine results from both collections
  const results = [...resultsCUTM1, ...resultsRegData];

  console.log(`[Basket4] ${reg}: Found ${resultsCUTM1.length} from CUTM1, ${resultsRegData.length} from RegistrationData`);

  // Get Basket 4 subjects from CBCS table
  // Check multiple possible basket names and variations
  const basket4Subjects = await db.collection("cbcs")
    .find({
      $or: [
        { Basket: "Basket IV" },
        { Basket: "Basket 4" },
        { Basket: "4" },
        { Basket: { $regex: /^basket\s*iv$/i } },
        { Basket: { $regex: /^basket\s*4$/i } }
      ]
    })
    .toArray();

  console.log(`[Basket4] ${reg}: Found ${basket4Subjects.length} Basket 4 subjects in CBCS`);

  // Create a comprehensive map of Basket 4 subject codes
  const basket4Codes = new Set();
  const basket4CodeToBranch = new Map(); // Store branch info from CBCS
  
  basket4Subjects.forEach(s => {
    const code = (s["Subject Code"] || s.SubjectCode || "").toUpperCase().trim();
    if (code) {
      basket4Codes.add(code);
      // Store branch info if available in CBCS
      if (s.Branch) {
        basket4CodeToBranch.set(code, s.Branch);
      }
    }
  });

  let sameBranchCredits = 0;
  let differentBranchCredits = 0;
  const completedSubjects = [];
  const failedSubjects = [];

  // Create a map of student's all subjects (passed and failed)
  const studentAllSubjects = new Map(); // code -> { credits, grade, passed }
  const studentPassedSubjects = new Map(); // code -> credits (only passed)
  
  results.forEach(result => {
    const code = (result.Subject_Code || "").toUpperCase().trim();
    if (!code) return;

    const grade = (result.Grade || "").toUpperCase().trim();
    const isPassed = !['F', 'S', 'I', 'M', 'R'].includes(grade);
    const credits = parseCredits(result.Credits);
    
    // Store all subjects
    if (!studentAllSubjects.has(code)) {
      studentAllSubjects.set(code, {
        credits,
        grade,
        passed: isPassed,
        name: result.Subject_Name || ""
      });
    } else {
      // If already exists, keep the passed version if available
      const existing = studentAllSubjects.get(code);
      if (isPassed && !existing.passed) {
        studentAllSubjects.set(code, { credits, grade, passed: isPassed, name: result.Subject_Name || "" });
      }
    }
    
    // Store only passed subjects for credit calculation
    if (isPassed) {
      if (!studentPassedSubjects.has(code) || studentPassedSubjects.get(code) < credits) {
        studentPassedSubjects.set(code, credits);
      }
    }
  });

  console.log(`[Basket4] ${reg}: Student has ${studentPassedSubjects.size} passed subjects, ${studentAllSubjects.size} total subjects`);

  // Check each Basket 4 subject code
  basket4Codes.forEach(code => {
    if (!studentPassedSubjects.has(code)) {
      // Check if student has this subject but failed
      if (studentAllSubjects.has(code)) {
        const subjectInfo = studentAllSubjects.get(code);
        failedSubjects.push({
          code,
          credits: subjectInfo.credits,
          grade: subjectInfo.grade,
          name: subjectInfo.name
        });
      }
      return;
    }

    const credits = studentPassedSubjects.get(code);
    const subjectInfo = studentAllSubjects.get(code);
    
    // Determine if same branch or different branch
    // First check CBCS branch info, then use subject code analysis
    let sameBranch = false;
    const cbcsBranch = basket4CodeToBranch.get(code);
    
    if (cbcsBranch) {
      // Use CBCS branch information if available
      const normalizedCbcsBranch = String(cbcsBranch).toUpperCase().trim();
      const normalizedStudentBranch = String(studentBranch).toUpperCase().trim();
      sameBranch = normalizedCbcsBranch.includes(normalizedStudentBranch) || 
                   normalizedStudentBranch.includes(normalizedCbcsBranch) ||
                   isSameBranch(code, studentBranch);
    } else {
      // Fallback to subject code analysis
      sameBranch = isSameBranch(code, studentBranch);
    }

    if (sameBranch) {
      sameBranchCredits += credits;
    } else {
      differentBranchCredits += credits;
    }

    completedSubjects.push({
      code,
      name: subjectInfo?.name || "",
      credits,
      sameBranch,
      grade: subjectInfo?.grade || ""
    });
  });

  const totalCredits = sameBranchCredits + differentBranchCredits;
  const sameBranchComplete = sameBranchCredits >= 58;
  const differentBranchComplete = differentBranchCredits >= 20;
  const isComplete = sameBranchComplete && differentBranchComplete;

  console.log(`[Basket4] ${reg}: Same branch: ${sameBranchCredits}/58, Different: ${differentBranchCredits}/20, Total: ${totalCredits}, Complete: ${isComplete}`);

  return {
    sameBranchCredits,
    differentBranchCredits,
    totalCredits,
    sameBranchComplete,
    differentBranchComplete: differentBranchComplete,
    isComplete,
    status: isComplete ? "Complete" : (totalCredits > 0 ? "In Progress" : "Not Started"),
    subjects: completedSubjects,
    failedSubjects: failedSubjects,
    totalBasket4Subjects: basket4Codes.size,
    completedCount: completedSubjects.length
  };
}

// Get batch from registration number
function getBatchFromReg(registration) {
  const match = registration.match(/^(\d{2})/);
  if (match) {
    return parseInt(`20${match[1]}`);
  }
  return null;
}

// Check Basket 5 eligibility
// For batch 2024 onwards: 66 credits (46+20) + 2 complete domains
// For batch before 2024: 2 complete domains only
async function checkBasket5(db, registration) {
  const reg = registration.toUpperCase();
  
  // Get all results for the student from CUTM1
  const resultsCUTM1 = await db.collection("CUTM1")
    .find({ Reg_No: reg })
    .project({ _id: 0, Reg_No: 1, Subject_Code: 1, Subject_Name: 1, Credits: 1, Grade: 1, Sem: 1 })
    .toArray();

  // Also get results from RegistrationData collection
  const regAsNumber = parseInt(reg);
  const resultsRegData = await db.collection("RegistrationData")
    .find({
      $or: [
        { Reg_No: reg },
        { Reg_No: regAsNumber }
      ]
    })
    .project({ _id: 0, Reg_No: 1, Subject_Code: 1, Subject_Name: 1, Credits: 1, Grade: 1, Sem: 1, Type: 1 })
    .toArray();

  // Combine results from both collections
  const results = [...resultsCUTM1, ...resultsRegData];
  
  console.log(`[Basket5] ${reg}: Found ${resultsCUTM1.length} from CUTM1, ${resultsRegData.length} from RegistrationData`);

  // Get batch
  const batch = getBatchFromReg(registration);
  const is2024OrLater = batch && batch >= 2024;

  // Get all domains and their subjects from honours_domain_subjects
  const domainSubjects = await db.collection("honours_domain_subjects")
    .find({})
    .toArray();

  // Group subjects by domain (exclude domain headers)
  // Domain header is identified by: SubjectName matches Domain name
  const domainMap = new Map();
  domainSubjects.forEach(subject => {
    const domain = (subject.Domain || "").trim();
    const subjectName = (subject.Subject_Name || "").trim();
    
    if (!domain) return;
    
    // Skip domain headers (when SubjectName === Domain, it's the domain header itself)
    if (domain && subjectName && domain === subjectName) {
      return;
    }

    if (!domainMap.has(domain)) {
      domainMap.set(domain, []);
    }
    const code = (subject["Subject Code"] || subject.SubjectCode || "").toUpperCase().trim();
    if (code) {
      domainMap.get(domain).push(code);
    }
  });

  // Get student's passed subjects (prioritize CUTM1 over RegistrationData)
  const studentCodes = new Set();
  const studentSubjectCredits = new Map();
  const subjectCodeMap = new Map(); // Track which source has the subject
  
  // First process RegistrationData (may have registered but not graded subjects)
  resultsRegData.forEach(r => {
    const code = (r.Subject_Code || "").toUpperCase().trim();
    if (!code) return;
    
    const grade = (r.Grade || "").toUpperCase().trim();
    const isPassed = !['F', 'S', 'I', 'M', 'R'].includes(grade);
    
    // For RegistrationData, only count if there's a valid grade
    // Type 'Registration' without grade means not yet completed
    if (r.Type === 'Registration' && !grade) {
      return; // Don't count ungraded registration data
    }
    
    if (isPassed) {
      const credits = parseCredits(r.Credits);
      if (!subjectCodeMap.has(code)) {
        studentCodes.add(code);
        studentSubjectCredits.set(code, credits);
        subjectCodeMap.set(code, 'RegistrationData');
      }
    }
  });
  
  // Then process CUTM1 (takes precedence, more accurate)
  resultsCUTM1.forEach(r => {
    const code = (r.Subject_Code || "").toUpperCase().trim();
    if (!code) return;
    
    const grade = (r.Grade || "").toUpperCase().trim();
    const isPassed = !['F', 'S', 'I', 'M', 'R'].includes(grade);
    
    if (isPassed) {
      const credits = parseCredits(r.Credits);
      // CUTM1 data overrides RegistrationData
      studentCodes.add(code);
      studentSubjectCredits.set(code, credits);
      subjectCodeMap.set(code, 'CUTM1');
    }
  });
  
  console.log(`[Basket5] ${reg}: Found ${studentCodes.size} passed subjects (${Array.from(subjectCodeMap.values()).filter(v => v === 'CUTM1').length} from CUTM1, ${Array.from(subjectCodeMap.values()).filter(v => v === 'RegistrationData').length} from RegistrationData)`);

  const completedDomains = [];
  const inProgressDomains = [];

  // Check each domain
  domainMap.forEach((subjects, domain) => {
    if (subjects.length === 0) return;

    const completed = subjects.filter(code => studentCodes.has(code));
    const completionRate = completed.length / subjects.length;
    
    if (completionRate === 1) {
      // Domain is 100% complete
      completedDomains.push({
        domain,
        totalSubjects: subjects.length,
        completedSubjects: completed.length
      });
    } else if (completionRate > 0) {
      // Domain is partially complete
      inProgressDomains.push({
        domain,
        totalSubjects: subjects.length,
        completedSubjects: completed.length,
        completionRate: (completionRate * 100).toFixed(1)
      });
    }
  });

  // For batch 2024 onwards: Check credits requirement (66 credits total from Basket 5)
  let basket5Credits = 0;
  
  if (is2024OrLater) {
    // Get Basket 5 subjects from CBCS table
    const basket5Subjects = await db.collection("cbcs")
      .find({
        $or: [
          { Basket: "Basket V" },
          { Basket: "Basket 5" },
          { Basket: "5" }
        ]
      })
      .toArray();

    const basket5Codes = new Set();
    basket5Subjects.forEach(s => {
      const code = (s["Subject Code"] || s.SubjectCode || "").toUpperCase().trim();
      if (code) basket5Codes.add(code);
    });

    // Calculate total credits from Basket 5 subjects
    studentCodes.forEach(code => {
      if (basket5Codes.has(code)) {
        const credits = studentSubjectCredits.get(code) || 0;
        basket5Credits += credits;
      }
    });
  }

  // Check eligibility
  let isComplete = false;
  if (is2024OrLater) {
    // For 2024+: Need 66 credits from Basket 5 AND 2 complete domains
    const creditsComplete = basket5Credits >= 66;
    const domainsComplete = completedDomains.length >= 2;
    isComplete = creditsComplete && domainsComplete;
  } else {
    // For before 2024: Need 2 complete domains only
    isComplete = completedDomains.length >= 2;
  }

  let status = "Not Started";
  if (isComplete) {
    status = "Complete";
  } else if (is2024OrLater) {
    const hasCredits = basket5Credits > 0;
    const hasDomains = completedDomains.length > 0 || inProgressDomains.length > 0;
    if (hasCredits || hasDomains) {
      status = "In Progress";
    }
  } else {
    if (completedDomains.length > 0 || inProgressDomains.length > 0) {
      status = "In Progress";
    }
  }

  return {
    completedDomains,
    inProgressDomains,
    totalDomains: domainMap.size,
    completedCount: completedDomains.length,
    isComplete,
    status,
    // For 2024+ batches, include credit information
    ...(is2024OrLater && {
      basket5Credits,
      creditsRequired: 66,
      creditsComplete: basket5Credits >= 66
    })
  };
}

export async function POST(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.email || payload.role?.toLowerCase() !== "admin") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { branch, batch } = await req.json();
    const client = await clientPromise;
    const db = client.db("cutm1");

    // Build query for students from both collections
    let queryCUTM1 = {};
    let queryRegData = {};
    
    // Branch mapping for registration number pattern
    const branchCodeMap = {
      'Civil Engineering': ['1', '9'],
      'Computer Science Engineering': ['2', '8'],
      'Electronics & Communication Engineering': ['3', '4'],
      'Electrical & Electronics Engineering': ['5'],
      'Mechanical Engineering': ['6'],
      'AIML': ['7']
    };
    
    if (branch && branch !== "All" && branch !== "") {
      queryCUTM1.Branch = branch;
      
      // For RegistrationData, check multiple ways:
      // 1. Branch field
      // 2. Department field
      // 3. Registration number pattern (8th character)
      // 4. Branch overrides
      const branchCodes = branchCodeMap[branch] || [];
      const orConditions = [
        { Branch: branch },
        { Department: branch }
      ];
      
      // Add registration number pattern matching
      if (branchCodes.length > 0) {
        branchCodes.forEach(code => {
          orConditions.push({ Reg_No: { $regex: `^.{7}${code}` } });
        });
      }
      
      // Get branch overrides
      try {
        const normalizedBranch = branch.toLowerCase();
        const overrideDocs = await db.collection("branch_overrides")
          .find({})
          .toArray();
        
        const matchingRegs = overrideDocs
          .filter(doc => {
            const docBranch = String(doc.branch || "").toLowerCase();
            return docBranch.includes(normalizedBranch) || 
                   normalizedBranch.includes(docBranch) ||
                   docBranch === normalizedBranch;
          })
          .map(doc => String(doc.reg).toUpperCase());
        
        if (matchingRegs.length > 0) {
          orConditions.push({ Reg_No: { $in: matchingRegs } });
        }
      } catch (err) {
        console.error("Error fetching branch overrides:", err);
      }
      
      queryRegData.$or = orConditions;
    }
    
    if (batch && batch !== "" && batch !== "All") {
      const b = String(batch).trim();
      const yy = b.length === 4 && b.startsWith("20") ? b.slice(2) : b.slice(-2);
      const batchPattern = `^(?:${yy}|20${yy})`;
      
      if (queryCUTM1.Reg_No) {
        // Combine with existing regex if any
        const existingPattern = queryCUTM1.Reg_No.$regex;
        queryCUTM1.Reg_No = { $regex: batchPattern };
      } else {
        queryCUTM1.Reg_No = { $regex: batchPattern };
      }
      
      if (queryRegData.$or) {
        // If we have $or conditions, add batch to each or combine
        queryRegData.$and = [
          { $or: queryRegData.$or },
          { Reg_No: { $regex: batchPattern } }
        ];
        delete queryRegData.$or;
      } else {
        queryRegData.Reg_No = { $regex: batchPattern };
      }
    }

    // Get distinct students from CUTM1
    const studentsCUTM1 = await db.collection("CUTM1")
      .aggregate([
        { $match: queryCUTM1 },
        {
          $group: {
            _id: "$Reg_No",
            Name: { $first: "$Name" },
            Branch: { $first: "$Branch" },
            Reg_No: { $first: "$Reg_No" }
          }
        },
        { $project: { _id: 0, Reg_No: 1, Name: 1, Branch: 1 } }
      ])
      .toArray();

    // Get distinct students from RegistrationData
    // Only query if we have filters (branch or batch)
    let studentsRegData = [];
    if (Object.keys(queryRegData).length > 0) {
      studentsRegData = await db.collection("RegistrationData")
        .aggregate([
          { $match: queryRegData },
          {
            $group: {
              _id: "$Reg_No",
              Name: { $first: "$Name" },
              Branch: { $first: "$Branch" },
              Department: { $first: "$Department" },
              Reg_No: { $first: "$Reg_No" }
            }
          },
          { $project: { _id: 0, Reg_No: 1, Name: 1, Branch: 1, Department: 1 } }
        ])
        .toArray();
    }
    // If no filters, skip RegistrationData query (user must provide branch or batch)

    // Combine students from both collections, avoiding duplicates
    const studentMap = new Map();
    
    // Add students from CUTM1
    studentsCUTM1.forEach(student => {
      const reg = String(student.Reg_No).toUpperCase();
      studentMap.set(reg, {
        Reg_No: reg,
        Name: student.Name || "",
        Branch: student.Branch || getDepartmentFromRegNo(reg),
        source: 'CUTM1'
      });
    });
    
    // Add students from RegistrationData (only if not already in CUTM1)
    studentsRegData.forEach(student => {
      const reg = String(student.Reg_No).toUpperCase();
      if (!studentMap.has(reg)) {
        // Use Branch, Department, or extract from Reg_No
        const branch = student.Branch || student.Department || getDepartmentFromRegNo(reg);
        studentMap.set(reg, {
          Reg_No: reg,
          Name: student.Name || "",
          Branch: branch,
          source: 'RegistrationData'
        });
      }
    });

    const students = Array.from(studentMap.values());

    console.log(`Found ${studentsCUTM1.length} students from CUTM1, ${studentsRegData.length} from RegistrationData, ${students.length} unique students to check`);

    const allResults = [];
    const eligible = [];
    let processed = 0;

    // Check each student
    for (const student of students) {
      processed++;
      const reg = student.Reg_No;
      
      // Get student branch
      let studentBranch = student.Branch || getDepartmentFromRegNo(reg);
      
      // Calculate CGPA
      const cgpa = await calculateCGPA(db, reg);

      // Check Basket 5 (Basket 4 is for major/minor, not required for honours)
      const basket5Check = await checkBasket5(db, reg);

      // Get batch for details
      const studentBatch = getBatchFromReg(reg);
      const is2024OrLater = studentBatch && studentBatch >= 2024;

      // Determine eligibility
      // Note: Basket 4 (58+20 credits) is for major/minor, not required for honours
      const cgpaEligible = cgpa >= 8.0;
      const basket5Eligible = basket5Check.isComplete;
      const isEligible = cgpaEligible && basket5Eligible;

      // Build student data
      const studentData = {
        RegistrationNo: reg,
        Registration_No: reg,
        Name: student.Name || "",
        Branch: studentBranch,
        Batch: studentBatch || "",
        CGPA: cgpa,
        Basket5Status: basket5Check.status,
        EligibilityStatus: isEligible ? "Eligible" : "Not Eligible",
        EligibilityReasons: [],
        Basket5Details: {
          completedDomains: basket5Check.completedDomains.map(d => d.domain),
          completedCount: basket5Check.completedCount,
          totalDomains: basket5Check.totalDomains
        }
      };

      // Add reasons for not being eligible
      if (!cgpaEligible) {
        studentData.EligibilityReasons.push(`CGPA ${cgpa.toFixed(2)} is less than required 8.0`);
      }
      // Note: Basket 4 is not required for honours (it's for major/minor)
      if (!basket5Eligible) {
        if (is2024OrLater) {
          const creditsInfo = basket5Check.basket5Credits !== undefined 
            ? `${basket5Check.basket5Credits}/66 credits`
            : "credits not calculated";
          const domainsInfo = `${basket5Check.completedCount}/2 domains`;
          studentData.EligibilityReasons.push(
            `Basket 5 incomplete: ${creditsInfo} and ${domainsInfo}`
          );
        } else {
          studentData.EligibilityReasons.push(
            `Basket 5 incomplete: ${basket5Check.completedCount}/2 domains`
          );
        }
      }

      // Add credit details for 2024+ batches
      if (is2024OrLater && basket5Check.basket5Credits !== undefined) {
        studentData.Basket5Details = {
          ...studentData.Basket5Details,
          basket5Credits: basket5Check.basket5Credits,
          creditsRequired: basket5Check.creditsRequired,
          creditsComplete: basket5Check.creditsComplete
        };
      }

      allResults.push(studentData);
      
      if (isEligible) {
        eligible.push(studentData);
      }
    }

    // Save eligible students to honours_students collection
    const honoursCollection = db.collection("honours_students");
    let added = 0;
    let updated = 0;

    for (const student of eligible) {
      const existing = await honoursCollection.findOne({
        $or: [
          { RegistrationNo: student.RegistrationNo },
          { Registration_No: student.RegistrationNo }
        ]
      });

      if (existing) {
        // Update existing record
        await honoursCollection.updateOne(
          { _id: existing._id },
          {
            $set: {
              ...student,
              updatedAt: new Date()
            }
          }
        );
        updated++;
      } else {
        // Insert new record
        await honoursCollection.insertOne({
          ...student,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        added++;
      }
    }

    return NextResponse.json({
      success: true,
      allResults: allResults,
      eligible: eligible,
      stats: {
        totalChecked: students.length,
        eligible: eligible.length,
        notEligible: allResults.length - eligible.length,
        added,
        updated
      }
    });
  } catch (error) {
    console.error("Error checking honours eligibility:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


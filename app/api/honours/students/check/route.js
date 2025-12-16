import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { verifyToken } from "@/lib/auth";

// Local branch detection to avoid missing route imports during build
const BTECH_BRANCH_MAP = {
  '111': 'Civil',
  '112': 'CSE',
  '113': 'ECE',
  '115': 'EEE',
  '116': 'Mechanical',
  '117': 'CSE AIML',
  '137': 'CSE AIML',
};

const DIPLOMA_BRANCH_MAP = {
  '711': 'Electrical',
  '712': 'Mechanical',
  '713': 'Civil',
  '714': 'CSE',
  '715': 'Automobile',
  '716': 'Mining',
};

// Helper function to get branch from registration without external imports
async function getBranchFromRegistration(registration, department = null) {
  if (!registration) return department || 'Unknown';

  const reg = String(registration).trim().toUpperCase();
  if (reg.length < 8) return department || 'Unknown';

  const programCode = reg.slice(4, 6); // positions 4-5
  const branchCode = reg.slice(5, 8);  // positions 5-7

  // Diploma (SOVET) uses program code 07
  if (programCode === '07' && DIPLOMA_BRANCH_MAP[branchCode]) {
    return DIPLOMA_BRANCH_MAP[branchCode];
  }

  // Otherwise treat as B.Tech (SOET) if code matches map
  if (BTECH_BRANCH_MAP[branchCode]) {
    return BTECH_BRANCH_MAP[branchCode];
  }

  return department || 'Unknown';
}

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

// Calculate CGPA (ONLY from CUTM1, NOT from RegistrationData)
async function calculateCGPA(db, registration) {
  const reg = registration.toUpperCase();
  
  // Get results ONLY from CUTM1
  const resultsCUTM1 = await db.collection("result")
    .find({ Reg_No: reg })
    .project({ _id: 0, Subject_Code: 1, Credits: 1, Grade: 1 })
    .toArray();

  // Use only CUTM1 data for CGPA calculation
  const subjectMap = new Map(); // code -> { credits, grade }
  
  resultsCUTM1.forEach(row => {
    const code = (row.Subject_Code || "").toUpperCase().trim();
    if (!code) return;
    
    const credits = parseCredits(row.Credits);
    const grade = (row.Grade || "").toUpperCase().trim();
    
    // Only count passed subjects
    if (grade && !['F', 'S', 'I', 'M', 'R'].includes(grade)) {
      subjectMap.set(code, { credits, grade });
    }
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

// Get department from registration number (handles both B.Tech and Diploma)
async function getDepartmentFromRegNo(regNo) {
  if (!regNo) return "Unknown";
  const branch = await getBranchFromRegistration(String(regNo));
  return branch !== 'Unknown' ? branch : "Unknown";
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
  const resultsCUTM1 = await db.collection("result")
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

// Check Honours Subjects eligibility
// Student must have passed at least 2 honours subjects from honours_domain_subjects
async function checkHonoursSubjects(db, registration) {
  const reg = registration.toUpperCase();
  
  // Get all results for the student from CUTM1
  const resultsCUTM1 = await db.collection("result")
    .find({ Reg_No: reg })
    .project({ _id: 0, Reg_No: 1, Subject_Code: 1, Subject_Name: 1, Credits: 1, Grade: 1 })
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
    .project({ _id: 0, Reg_No: 1, Subject_Code: 1, Subject_Name: 1, Credits: 1, Grade: 1, Type: 1 })
    .toArray();

  // Get all honours subjects from honours_domain_subjects collection
  const honoursSubjects = await db.collection("honours_domain_subjects")
    .find({})
    .toArray();

  // Create a set of honours subject codes (exclude domain headers)
  const honoursSubjectCodes = new Set();
  honoursSubjects.forEach(subject => {
    const domain = (subject.Domain || "").trim();
    const subjectName = (subject.Subject_Name || "").trim();
    const subjectCode = (subject["Subject Code"] || subject.SubjectCode || "").toUpperCase().trim();
    
    // Skip domain headers (when SubjectName === Domain, it's the domain header itself)
    if (domain && subjectName && domain === subjectName) {
      return;
    }
    
    if (subjectCode) {
      honoursSubjectCodes.add(subjectCode);
    }
  });

  console.log(`[Honours] ${reg}: Found ${honoursSubjectCodes.size} honours subjects in system`);

  // Track student's passed honours subjects
  const studentPassedHonoursSubjects = new Set();
  const studentHonoursSubjectsDetails = [];

  // Process RegistrationData first
  resultsRegData.forEach(r => {
    const code = (r.Subject_Code || "").toUpperCase().trim();
    if (!code) return;
    
    const grade = (r.Grade || "").toUpperCase().trim();
    const isPassed = !['F', 'S', 'I', 'M', 'R'].includes(grade);
    
    // For RegistrationData, only count if there's a valid grade
    if (r.Type === 'Registration' && !grade) {
      return; // Don't count ungraded registration data
    }
    
    if (isPassed && honoursSubjectCodes.has(code)) {
      if (!studentPassedHonoursSubjects.has(code)) {
        studentPassedHonoursSubjects.add(code);
        studentHonoursSubjectsDetails.push({
          code,
          name: r.Subject_Name || "",
          credits: parseCredits(r.Credits),
          grade,
          source: 'RegistrationData'
        });
      }
    }
  });
  
  // Then process CUTM1 (takes precedence, more accurate)
  resultsCUTM1.forEach(r => {
    const code = (r.Subject_Code || "").toUpperCase().trim();
    if (!code) return;
    
    const grade = (r.Grade || "").toUpperCase().trim();
    const isPassed = !['F', 'S', 'I', 'M', 'R'].includes(grade);
    
    if (isPassed && honoursSubjectCodes.has(code)) {
      // Check if already added from RegistrationData
      const existingIndex = studentHonoursSubjectsDetails.findIndex(s => s.code === code);
      if (existingIndex >= 0) {
        // Update with CUTM1 data (more accurate)
        studentHonoursSubjectsDetails[existingIndex] = {
          code,
          name: r.Subject_Name || "",
          credits: parseCredits(r.Credits),
          grade,
          source: 'CUTM1'
        };
      } else {
        studentPassedHonoursSubjects.add(code);
        studentHonoursSubjectsDetails.push({
          code,
          name: r.Subject_Name || "",
          credits: parseCredits(r.Credits),
          grade,
          source: 'CUTM1'
        });
      }
    }
  });

  const honoursSubjectsCount = studentPassedHonoursSubjects.size;
  const isEligible = honoursSubjectsCount >= 2;

  console.log(`[Honours] ${reg}: Found ${honoursSubjectsCount} passed honours subjects, Eligible: ${isEligible}`);

  return {
    honoursSubjectsCount,
    requiredCount: 2,
    isEligible,
    passedHonoursSubjects: studentHonoursSubjectsDetails,
    status: isEligible ? "Eligible" : (honoursSubjectsCount > 0 ? "In Progress" : "Not Started")
  };
}

// Check Basket 5 eligibility
// For batch 2024 onwards: 66 credits (46+20) + 2 complete domains
// For batch before 2024: 2 complete domains only
async function checkBasket5(db, registration) {
  const reg = registration.toUpperCase();
  
  // Get all results for the student from CUTM1
  const resultsCUTM1 = await db.collection("result")
    .find({ Reg_No: reg })
    .project({ _id: 0, Reg_No: 1, Subject_Code: 1, Subject_Name: 1, Credits: 1, Grade: 1, Sem: 1 })
    .toArray();

  // Also get results from RegistrationData collection
  // Try multiple formats to ensure we get all data
  const regAsNumber = parseInt(reg);
  const regAsString = String(reg);
  
  // Query RegistrationData with multiple matching strategies
  const resultsRegData = await db.collection("RegistrationData")
    .find({
      $or: [
        { Reg_No: reg },
        { Reg_No: regAsNumber },
        { Reg_No: regAsString },
        { Reg_No: { $regex: `^${reg}`, $options: "i" } },
        { $expr: { $eq: [{ $toString: "$Reg_No" }, regAsString.toUpperCase()] } },
        { $expr: { $eq: [{ $toString: "$Reg_No" }, regAsString] } }
      ]
    })
    .project({ _id: 0, Reg_No: 1, Subject_Code: 1, Subject_Name: 1, Credits: 1, Grade: 1, Sem: 1, Type: 1 })
    .toArray();

  console.log(`[Basket5] ${reg}: RegistrationData query returned ${resultsRegData.length} records`);
  
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

  // Get student's passed subjects from BOTH CUTM1 and RegistrationData
  // For domain completion, we need to count subjects from BOTH sources
  const studentCodes = new Set();
  const studentSubjectCredits = new Map();
  const subjectCodeMap = new Map(); // Track which source has the subject
  const subjectDetails = new Map(); // Track full subject details
  
  // First process RegistrationData - IMPORTANT: Count all passed subjects for domain check
  // RegistrationData subjects are crucial for domain completion
  resultsRegData.forEach(r => {
    const code = (r.Subject_Code || "").toUpperCase().trim();
    if (!code) return;
    
    const grade = (r.Grade || "").toUpperCase().trim();
    const isPassed = !['F', 'S', 'I', 'M', 'R'].includes(grade);
    
    // For RegistrationData: Count if there's a valid grade
    // Even if Type is 'Registration', if there's a grade, count it for domain completion
    if (grade && grade !== "" && isPassed) {
      const credits = parseCredits(r.Credits);
      // Add to set - RegistrationData subjects MUST count for domain completion
      if (!studentCodes.has(code)) {
        studentCodes.add(code);
        studentSubjectCredits.set(code, credits);
        subjectCodeMap.set(code, 'RegistrationData');
        subjectDetails.set(code, {
          code,
          name: r.Subject_Name || "",
          credits,
          grade,
          source: 'RegistrationData'
        });
        console.log(`[Basket5] ${reg}: Added subject ${code} from RegistrationData (grade: ${grade})`);
      }
    } else if (!grade || grade === "") {
      // Log subjects without grades for debugging
      console.log(`[Basket5] ${reg}: Skipping ${code} from RegistrationData - no grade or failed (Type: ${r.Type || 'N/A'})`);
    }
  });
  
  // Then process CUTM1 (takes precedence for credits/grade, but both count for domains)
  resultsCUTM1.forEach(r => {
    const code = (r.Subject_Code || "").toUpperCase().trim();
    if (!code) return;
    
    const grade = (r.Grade || "").toUpperCase().trim();
    const isPassed = !['F', 'S', 'I', 'M', 'R'].includes(grade);
    
    if (isPassed) {
      const credits = parseCredits(r.Credits);
      // CUTM1 data overrides RegistrationData for credits/grade
      // But domain completion uses subjects from BOTH sources
      const wasFromRegData = subjectCodeMap.get(code) === 'RegistrationData';
      studentCodes.add(code); // Add to set (if not already there from RegistrationData)
      studentSubjectCredits.set(code, credits); // CUTM1 credits take precedence
      subjectCodeMap.set(code, 'CUTM1'); // Mark as CUTM1 (but domain check uses both)
      subjectDetails.set(code, {
        code,
        name: r.Subject_Name || "",
        credits,
        grade,
        source: 'CUTM1',
        alsoInRegData: wasFromRegData
      });
      if (wasFromRegData) {
        console.log(`[Basket5] ${reg}: Subject ${code} also found in CUTM1, using CUTM1 data but both count for domains`);
      }
    }
  });
  
  const regDataCount = Array.from(subjectCodeMap.values()).filter(v => v === 'RegistrationData').length;
  const cutm1Count = Array.from(subjectCodeMap.values()).filter(v => v === 'CUTM1').length;
  console.log(`[Basket5] ${reg}: Found ${studentCodes.size} passed subjects (${cutm1Count} from CUTM1, ${regDataCount} from RegistrationData) for domain completion check`);

  const completedDomains = [];
  const inProgressDomains = [];

  // Check each domain - uses subjects from BOTH CUTM1 and RegistrationData
  domainMap.forEach((subjects, domain) => {
    if (subjects.length === 0) return;

    // Find which subjects from this domain the student has passed (from either source)
    const completed = subjects.filter(code => studentCodes.has(code));
    const missing = subjects.filter(code => !studentCodes.has(code));
    const completionRate = completed.length / subjects.length;
    
    // Log domain check details
    const regDataInDomain = completed.filter(code => subjectCodeMap.get(code) === 'RegistrationData' || (subjectDetails.get(code)?.alsoInRegData)).length;
    const cutm1InDomain = completed.filter(code => subjectCodeMap.get(code) === 'CUTM1').length;
    console.log(`[Basket5] ${reg}: Domain "${domain}": ${completed.length}/${subjects.length} subjects (${cutm1InDomain} from CUTM1, ${regDataInDomain} from RegistrationData), Missing: ${missing.join(', ') || 'none'}`);
    
    if (completionRate === 1) {
      // Domain is 100% complete
      completedDomains.push({
        domain,
        totalSubjects: subjects.length,
        completedSubjects: completed.length,
        fromCUTM1: cutm1InDomain,
        fromRegistrationData: regDataInDomain
      });
      console.log(`[Basket5] ${reg}: Domain "${domain}" is COMPLETE (${completed.length}/${subjects.length} subjects)`);
    } else if (completionRate > 0) {
      // Domain is partially complete
      inProgressDomains.push({
        domain,
        totalSubjects: subjects.length,
        completedSubjects: completed.length,
        completionRate: (completionRate * 100).toFixed(1),
        fromCUTM1: cutm1InDomain,
        fromRegistrationData: regDataInDomain
      });
      console.log(`[Basket5] ${reg}: Domain "${domain}" is IN PROGRESS (${completed.length}/${subjects.length} subjects, ${(completionRate * 100).toFixed(1)}%)`);
    } else {
      console.log(`[Basket5] ${reg}: Domain "${domain}" is NOT STARTED (0/${subjects.length} subjects)`);
    }
  });
  
  console.log(`[Basket5] ${reg}: Domain completion summary - ${completedDomains.length} complete, ${inProgressDomains.length} in progress`);

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
    
    // Validate inputs
    if (!branch && !batch) {
      return NextResponse.json({ 
        error: "Please provide at least Branch or Batch to check eligibility" 
      }, { status: 400 });
    }
    
    const client = await clientPromise;
    const { getDatabaseFromRequest } = await import("@/lib/db-helper");
    const dbName = await getDatabaseFromRequest(req);
    const db = client.db(dbName);

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
    
    const branchValue = branch && branch !== "All" && branch !== "" ? branch.trim() : null;
    const batchValue = batch && batch !== "All" && batch !== "" ? batch.trim() : null;
    
    console.log(`[Query] Branch: ${branchValue}, Batch: ${batchValue}`);
    
    if (branchValue) {
      queryCUTM1.Branch = branchValue;
      
      // For RegistrationData, check multiple ways:
      // 1. Branch field
      // 2. Department field
      // 3. Registration number pattern (8th character)
      // 4. Branch overrides
      const branchCodes = branchCodeMap[branchValue] || [];
      const orConditions = [
        { Branch: branchValue },
        { Department: branchValue }
      ];
      
      // Add registration number pattern matching (handle both string and number Reg_No)
      if (branchCodes.length > 0) {
        branchCodes.forEach(code => {
          // Match 8th character (0-indexed position 7)
          orConditions.push({ Reg_No: { $regex: `^.{7}${code}` } });
          // Also try as number (convert to string first)
          orConditions.push({ 
            $expr: { 
              $eq: [{ $substr: [{ $toString: "$Reg_No" }, 7, 1] }, code] 
            } 
          });
        });
      }
      
      // Get branch overrides
      try {
        const normalizedBranch = branchValue.toLowerCase();
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
    
    if (batchValue) {
      const b = String(batchValue).trim();
      const yy = b.length === 4 && b.startsWith("20") ? b.slice(2) : b.slice(-2);
      // Match both formats: YY (e.g., 22) and 20YY (e.g., 2022)
      // Also handle Reg_No as both string and number
      const batchPattern = `^(${yy}|20${yy})`;
      
      console.log(`[Query] Batch pattern: ${batchPattern} (from ${b}, yy=${yy})`);
      
      // Create batch conditions that work with both string and number Reg_No
      // Use $expr to convert Reg_No to string for regex matching
      const batchConditions = [
        // Try as string field
        { Reg_No: { $regex: batchPattern, $options: "i" } },
        // Try as number field (convert to string first)
        { 
          $expr: { 
            $regexMatch: { 
              input: { $toString: "$Reg_No" }, 
              regex: batchPattern, 
              options: "i" 
            } 
          } 
        }
      ];
      
      // For CUTM1, combine branch and batch
      if (queryCUTM1.Branch) {
        // Both branch and batch - use $and
        queryCUTM1.$and = [
          { Branch: queryCUTM1.Branch },
          { $or: batchConditions }
        ];
        delete queryCUTM1.Branch;
      } else {
        // Only batch
        queryCUTM1.$or = batchConditions;
      }
      
      // For RegistrationData, combine with existing $or conditions
      if (queryRegData.$or) {
        // Both branch and batch - wrap $or in $and with batch
        queryRegData.$and = [
          { $or: queryRegData.$or },
          { $or: batchConditions }
        ];
        delete queryRegData.$or;
      } else {
        // Only batch
        queryRegData.$or = batchConditions;
      }
    }
    
    console.log(`[Query] CUTM1 query:`, JSON.stringify(queryCUTM1, null, 2));
    console.log(`[Query] RegistrationData query:`, JSON.stringify(queryRegData, null, 2));

    // Get distinct students from CUTM1
    // Only query if we have at least one filter
    let studentsCUTM1 = [];
    if (Object.keys(queryCUTM1).length > 0) {
      try {
        // Build aggregation pipeline
        const pipeline = [
          // First, add a string version of Reg_No for regex matching
          {
            $addFields: {
              Reg_No_Str: {
                $cond: {
                  if: { $eq: [{ $type: "$Reg_No" }, "string"] },
                  then: "$Reg_No",
                  else: { $toString: "$Reg_No" }
                }
              }
            }
          }
        ];
        
        // Build match stage - handle both Reg_No and Reg_No_Str
        const matchStage = { $match: {} };
        
        if (queryCUTM1.$and) {
          // Handle $and conditions
          matchStage.$match.$and = queryCUTM1.$and.map(cond => {
            if (cond.$or) {
              // Expand $or to include Reg_No_Str versions
              const expandedOr = [];
              cond.$or.forEach(orCond => {
                if (orCond.Reg_No && orCond.Reg_No.$regex) {
                  // Add both Reg_No and Reg_No_Str versions
                  expandedOr.push({ Reg_No: orCond.Reg_No });
                  expandedOr.push({ Reg_No_Str: orCond.Reg_No });
                } else {
                  expandedOr.push(orCond);
                }
              });
              return { $or: expandedOr };
            }
            return cond;
          });
        } else if (queryCUTM1.$or) {
          // Handle $or conditions
          const expandedOr = [];
          queryCUTM1.$or.forEach(orCond => {
            if (orCond.Reg_No && orCond.Reg_No.$regex) {
              expandedOr.push({ Reg_No: orCond.Reg_No });
              expandedOr.push({ Reg_No_Str: orCond.Reg_No });
            } else {
              expandedOr.push(orCond);
            }
          });
          matchStage.$match.$or = expandedOr;
        } else {
          // Simple conditions
          matchStage.$match = queryCUTM1;
        }
        
        pipeline.push(matchStage);
        pipeline.push({
          $group: {
            _id: "$Reg_No",
            Name: { $first: "$Name" },
            Branch: { $first: "$Branch" },
            Reg_No: { $first: "$Reg_No" }
          }
        });
        pipeline.push({ $project: { _id: 0, Reg_No: 1, Name: 1, Branch: 1 } });
        
        studentsCUTM1 = await db.collection("result")
          .aggregate(pipeline)
      .toArray();
        console.log(`[Query] CUTM1 found ${studentsCUTM1.length} students`);
      } catch (err) {
        console.error("Error querying CUTM1:", err);
        console.error("Query was:", JSON.stringify(queryCUTM1, null, 2));
        // Try simpler query as fallback
        try {
          studentsCUTM1 = await db.collection("result")
            .find(queryCUTM1)
            .limit(1000)
            .toArray();
          // Deduplicate by Reg_No
          const uniqueMap = new Map();
          studentsCUTM1.forEach(s => {
            const reg = String(s.Reg_No).toUpperCase();
            if (!uniqueMap.has(reg)) {
              uniqueMap.set(reg, {
                Reg_No: reg,
                Name: s.Name || "",
                Branch: s.Branch || ""
              });
            }
          });
          studentsCUTM1 = Array.from(uniqueMap.values());
          console.log(`[Query] CUTM1 (fallback) found ${studentsCUTM1.length} students`);
        } catch (fallbackErr) {
          console.error("Error in fallback query CUTM1:", fallbackErr);
          throw fallbackErr;
        }
      }
    }

    // Get distinct students from RegistrationData
    // Only query if we have filters (branch or batch)
    let studentsRegData = [];
    if (Object.keys(queryRegData).length > 0) {
      try {
        // Build aggregation pipeline similar to CUTM1
        const pipeline = [
          {
            $addFields: {
              Reg_No_Str: {
                $cond: {
                  if: { $eq: [{ $type: "$Reg_No" }, "string"] },
                  then: "$Reg_No",
                  else: { $toString: "$Reg_No" }
                }
              }
            }
          }
        ];
        
        // Build match stage
        const matchStage = { $match: {} };
        
        if (queryRegData.$and) {
          matchStage.$match.$and = queryRegData.$and.map(cond => {
            if (cond.$or) {
              const expandedOr = [];
              cond.$or.forEach(orCond => {
                if (orCond.Reg_No && orCond.Reg_No.$regex) {
                  expandedOr.push({ Reg_No: orCond.Reg_No });
                  expandedOr.push({ Reg_No_Str: orCond.Reg_No });
                } else {
                  expandedOr.push(orCond);
                }
              });
              return { $or: expandedOr };
            }
            return cond;
          });
        } else if (queryRegData.$or) {
          const expandedOr = [];
          queryRegData.$or.forEach(orCond => {
            if (orCond.Reg_No && orCond.Reg_No.$regex) {
              expandedOr.push({ Reg_No: orCond.Reg_No });
              expandedOr.push({ Reg_No_Str: orCond.Reg_No });
            } else {
              expandedOr.push(orCond);
            }
          });
          matchStage.$match.$or = expandedOr;
        } else {
          matchStage.$match = queryRegData;
        }
        
        pipeline.push(matchStage);
        pipeline.push({
            $group: {
              _id: "$Reg_No",
              Name: { $first: "$Name" },
              Branch: { $first: "$Branch" },
              Department: { $first: "$Department" },
              Reg_No: { $first: "$Reg_No" }
            }
        });
        pipeline.push({ $project: { _id: 0, Reg_No: 1, Name: 1, Branch: 1, Department: 1 } });
        
        studentsRegData = await db.collection("RegistrationData")
          .aggregate(pipeline)
        .toArray();
        console.log(`[Query] RegistrationData found ${studentsRegData.length} students`);
      } catch (err) {
        console.error("Error querying RegistrationData:", err);
        console.error("Query was:", JSON.stringify(queryRegData, null, 2));
        // Try simpler query as fallback
        try {
          studentsRegData = await db.collection("RegistrationData")
            .find(queryRegData)
            .limit(1000)
            .toArray();
          // Deduplicate
          const uniqueMap = new Map();
          studentsRegData.forEach(s => {
            const reg = String(s.Reg_No).toUpperCase();
            if (!uniqueMap.has(reg)) {
              uniqueMap.set(reg, {
                Reg_No: reg,
                Name: s.Name || "",
                Branch: s.Branch || s.Department || "",
                Department: s.Department || ""
              });
            }
          });
          studentsRegData = Array.from(uniqueMap.values());
          console.log(`[Query] RegistrationData (fallback) found ${studentsRegData.length} students`);
        } catch (fallbackErr) {
          console.error("Error in fallback query RegistrationData:", fallbackErr);
          // Continue even if RegistrationData query fails
        }
      }
    }

    // Combine students from both collections, avoiding duplicates
    // Priority: CUTM1 data, but include all from RegistrationData as well
    const studentMap = new Map();
    
    // Add students from CUTM1 first
    for (const student of studentsCUTM1) {
      const reg = String(student.Reg_No).toUpperCase();
      if (reg) {
        const branch = await getDepartmentFromRegNo(reg);
        studentMap.set(reg, {
          Reg_No: reg,
          Name: student.Name || "",
          Branch: student.Branch || branch,
          source: 'CUTM1'
        });
      }
    }
    
    // Add students from RegistrationData (include all, even if in CUTM1, to ensure we check both)
    for (const student of studentsRegData) {
      const reg = String(student.Reg_No).toUpperCase();
      if (reg) {
        // Use Branch, Department, or extract from Reg_No
        const branch = student.Branch || student.Department || await getDepartmentFromRegNo(reg);
        // If already exists from CUTM1, keep CUTM1 data but mark as having RegistrationData too
        if (studentMap.has(reg)) {
          studentMap.get(reg).hasRegistrationData = true;
        } else {
          // New student from RegistrationData only
          studentMap.set(reg, {
            Reg_No: reg,
            Name: student.Name || "",
            Branch: branch,
            source: 'RegistrationData',
            hasRegistrationData: true
          });
        }
      }
    }

    const students = Array.from(studentMap.values());
    
    console.log(`[Combine] Total unique students: ${students.length} (${students.filter(s => s.source === 'CUTM1').length} from CUTM1, ${students.filter(s => s.source === 'RegistrationData').length} from RegistrationData only, ${students.filter(s => s.hasRegistrationData).length} with RegistrationData)`);

    console.log(`Found ${studentsCUTM1.length} students from CUTM1, ${studentsRegData.length} from RegistrationData, ${students.length} unique students to check`);

    if (students.length === 0) {
      return NextResponse.json({
        success: true,
        allResults: [],
        eligible: [],
        stats: {
          totalChecked: 0,
          eligible: 0,
          notEligible: 0,
          added: 0,
          updated: 0
        },
        message: "No students found matching the selected filters"
      });
    }

    const allResults = [];
    const eligible = [];
    let processed = 0;

    // Check each student
    for (const student of students) {
      try {
      processed++;
      const reg = student.Reg_No;
        
        if (!reg) {
          console.warn(`Skipping student with no registration number:`, student);
          continue;
        }
      
      // Get student branch
      let studentBranch = student.Branch || await getDepartmentFromRegNo(reg);
      
      // Calculate CGPA (ONLY from CUTM1)
      const cgpa = await calculateCGPA(db, reg);

      // Check Basket 5 eligibility (uses both CUTM1 and RegistrationData for domain completion)
      const basket5Check = await checkBasket5(db, reg);

      // Get batch for details
      const studentBatch = getBatchFromReg(reg);
      const is2024OrLater = studentBatch && studentBatch >= 2024;

      // Determine eligibility
      // Requirements: 
      // 1. CGPA >= 8.0 (from CUTM1 only)
      // 2. Basket 5 requirements:
      //    - Before 2024: 2 complete domains (check from both CUTM1 and RegistrationData)
      //    - 2024 onwards: 66 credits from Basket 5 + 2 complete domains
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

      // Add credit details for 2024+ batches
      if (is2024OrLater && basket5Check.basket5Credits !== undefined) {
        studentData.Basket5Details = {
          ...studentData.Basket5Details,
          basket5Credits: basket5Check.basket5Credits,
          creditsRequired: basket5Check.creditsRequired,
          creditsComplete: basket5Check.creditsComplete
        };
      }

      // Add reasons for not being eligible
      if (!cgpaEligible) {
        studentData.EligibilityReasons.push(`CGPA ${cgpa.toFixed(2)} is less than required 8.0 (calculated from CUTM1 only)`);
      }
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
            `Basket 5 incomplete: ${basket5Check.completedCount}/2 domains (checked from CUTM1 and RegistrationData)`
          );
        }
      }

      allResults.push(studentData);
      
      if (isEligible) {
        eligible.push(studentData);
        }
      } catch (studentError) {
        console.error(`Error processing student ${student.Reg_No}:`, studentError);
        // Add error entry to results
        allResults.push({
          RegistrationNo: student.Reg_No || "Unknown",
          Registration_No: student.Reg_No || "Unknown",
          Name: student.Name || "Unknown",
          Branch: student.Branch || "Unknown",
          Batch: getBatchFromReg(student.Reg_No) || "",
          CGPA: 0,
          HonoursStatus: "Error",
          EligibilityStatus: "Error",
          EligibilityReasons: [`Error checking eligibility: ${studentError.message}`],
          HonoursDetails: {
            honoursSubjectsCount: 0,
            requiredCount: 2,
            passedHonoursSubjects: []
          }
        });
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



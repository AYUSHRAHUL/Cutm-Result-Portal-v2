import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { verifyToken } from "@/lib/auth";
// Helper function to get branch from registration
async function getBranchFromRegistration(registration, department = null) {
  if (!registration) return department || 'Unknown';
  
  // Try SOET B.Tech first
  try {
    const { parseBTechRegistration } = await import('../../soet/parse-registration/route');
    const parsed = parseBTechRegistration(registration);
    if (parsed && parsed.isValid && parsed.isBTech) {
      return parsed.branch || department || 'Unknown';
    }
  } catch {}
  
  // Try SOVET Diploma
  try {
    const { parseDiplomaRegistration } = await import('../../sovet/parse-registration/route');
    const parsed = parseDiplomaRegistration(registration);
    if (parsed && parsed.isValid && parsed.isDiploma) {
      return parsed.branch || department || 'Unknown';
    }
  } catch {}
  
  return department || 'Unknown';
}

// Get department from registration number (handles both B.Tech and Diploma)
async function getDepartmentFromRegNo(regNo) {
  if (!regNo) return "Unknown";
  const branch = await getBranchFromRegistration(String(regNo));
  return branch !== 'Unknown' ? branch : "Unknown";
}

// Normalize branch names to full names
function normalizeBranchName(branch) {
  if (!branch) return null;
  const branchStr = String(branch).trim();
  
  // Branch name mapping
  const branchMap = {
    'CSE': 'Computer Science Engineering',
    'ECE': 'Electronics & Communication Engineering',
    'EEE': 'Electrical & Electronics Engineering',
    'Civil': 'Civil Engineering',
    'Mechanical': 'Mechanical Engineering',
    'AIML': 'AIML',
    'Computer Science': 'Computer Science Engineering',
    'Computer Science Engineering': 'Computer Science Engineering',
    'Electronics & Communication': 'Electronics & Communication Engineering',
    'Electronics & Communication Engineering': 'Electronics & Communication Engineering',
    'Electrical & Electronics': 'Electrical & Electronics Engineering',
    'Electrical & Electronics Engineering': 'Electrical & Electronics Engineering',
    'Civil Engineering': 'Civil Engineering',
    'Mechanical Engineering': 'Mechanical Engineering'
  };
  
  // Check exact match first
  if (branchMap[branchStr]) {
    return branchMap[branchStr];
  }
  
  // Check case-insensitive match
  const lowerBranch = branchStr.toLowerCase();
  for (const [key, value] of Object.entries(branchMap)) {
    if (key.toLowerCase() === lowerBranch) {
      return value;
    }
  }
  
  // If contains keywords, map accordingly
  if (lowerBranch.includes('computer') || lowerBranch.includes('cse')) {
    return 'Computer Science Engineering';
  }
  if (lowerBranch.includes('electronics') && lowerBranch.includes('communication') || lowerBranch.includes('ece')) {
    return 'Electronics & Communication Engineering';
  }
  if (lowerBranch.includes('electrical') && lowerBranch.includes('electronics') || lowerBranch.includes('eee')) {
    return 'Electrical & Electronics Engineering';
  }
  if (lowerBranch.includes('civil')) {
    return 'Civil Engineering';
  }
  if (lowerBranch.includes('mechanical')) {
    return 'Mechanical Engineering';
  }
  if (lowerBranch.includes('aiml') || lowerBranch.includes('artificial')) {
    return 'AIML';
  }
  
  // Return as-is if no match
  return branchStr;
}

export async function GET(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.email) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const userRole = payload.role?.toLowerCase();
    if (!['admin', 'teacher'].includes(userRole)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const client = await clientPromise;
    const db = await (async () => { const { getDatabaseFromRequest } = await import("@/lib/db-helper"); const dbName = await getDatabaseFromRequest(req); return client.db(dbName); })();

    // Get distinct branches from CUTM1
    const branchesCUTM1Raw = await db.collection("result")
      .distinct("Branch")
      .then(branches => branches.filter(Boolean));

    // Get distinct branches from RegistrationData (try multiple field names)
    const branchesRegData1Raw = await db.collection("RegistrationData")
      .distinct("Branch")
      .then(branches => branches.filter(Boolean));
    
    const branchesRegData2Raw = await db.collection("RegistrationData")
      .distinct("Department")
      .then(branches => branches.filter(Boolean));

    // Also extract branch from registration numbers in RegistrationData
    const regDataStudents = await db.collection("RegistrationData")
      .find({}, { projection: { Reg_No: 1 } })
      .limit(10000)
      .toArray();
    
    const branchesFromRegNo = new Set();
    for (const student of regDataStudents) {
      if (student.Reg_No) {
        const regNo = String(student.Reg_No);
        const branch = await getDepartmentFromRegNo(regNo);
        if (branch && branch !== "Unknown") {
          branchesFromRegNo.add(branch);
        }
      }
    }

    // Normalize all branch names
    const branchSet = new Set();
    
    // Normalize and add branches from all sources
    [...branchesCUTM1Raw, ...branchesRegData1Raw, ...branchesRegData2Raw].forEach(branch => {
      const normalized = normalizeBranchName(branch);
      if (normalized) {
        branchSet.add(normalized);
      }
    });
    
    // Add branches from registration numbers
    branchesFromRegNo.forEach(branch => {
      if (branch && branch !== "Unknown") {
        branchSet.add(branch);
      }
    });
    
    // If no branches found, add default branches
    if (branchSet.size === 0) {
      branchSet.add('Civil Engineering');
      branchSet.add('Computer Science Engineering');
      branchSet.add('Electronics & Communication Engineering');
      branchSet.add('Electrical & Electronics Engineering');
      branchSet.add('Mechanical Engineering');
      branchSet.add('AIML');
    }
    
    const branches = Array.from(branchSet).filter(Boolean).sort();

    // Get distinct batches from CUTM1 registration numbers
    const studentsCUTM1 = await db.collection("result")
      .find({}, { projection: { Reg_No: 1 } })
      .toArray();

    // Get distinct batches from RegistrationData registration numbers
    const studentsRegData = await db.collection("RegistrationData")
      .find({}, { projection: { Reg_No: 1 } })
      .toArray();

    const batchSet = new Set();
    
    // Process CUTM1 students
    for (const student of studentsCUTM1) {
      if (student.Reg_No) {
        const regNo = String(student.Reg_No);
        const match = regNo.match(/^(\d{2})/);
        if (match) {
          const batch = `20${match[1]}`;
          batchSet.add(batch);
        }
      }
    }

    // Process RegistrationData students
    for (const student of studentsRegData) {
      if (student.Reg_No) {
        const regNo = String(student.Reg_No);
        const match = regNo.match(/^(\d{2})/);
        if (match) {
          const batch = `20${match[1]}`;
          batchSet.add(batch);
        }
      }
    }

    let batches = Array.from(batchSet).sort((a, b) => b.localeCompare(a)); // Sort descending (newest first)
    
    // If no batches found, add default batches
    if (batches.length === 0) {
      batches = ["2025", "2024", "2023", "2022", "2021", "2020"];
    }

    console.log(`Filters API: Found ${branches.length} branches and ${batches.length} batches`);

    return NextResponse.json({
      success: true,
      branches,
      batches
    });
  } catch (error) {
    console.error("Error fetching filters:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}



import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { jwtVerify } from "jose";
import { getCampusSchoolDatabase } from "@/lib/campus";

// SOM SOM (BBA/MBA) branch codes (at index 5-8 in regNo)
const soetBranchCodeMap = {
  '111': 'Civil',
  '112': 'CSE',
  '113': 'ECE',
  '115': 'EEE',
  '116': 'MECH',
  '137': 'CSE AIML'
};

async function verifyToken(token) {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

/**
 * GET /api/som/placement/unplaced-students
 * Returns list of students from 7th semester who have NO placement records
 */
export async function GET(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized - Please login first" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.email) {
      return NextResponse.json({ error: "Unauthorized - Invalid token" }, { status: 401 });
    }

    const userRole = payload.role?.toLowerCase();
    if (!["admin", "teacher"].includes(userRole)) {
      return NextResponse.json({
        error: "Access denied - Only admins and teachers can access this data"
      }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const campus = searchParams.get('campus') || payload.campus || null;
    const batchParam = searchParams.get('batch');
    const school = 'SOM';
    const dbName = getCampusSchoolDatabase(campus, school);

    const client = await clientPromise;
    const db = client.db(dbName);
    const registrationCol = db.collection("RegistrationData");
    const resultCol = db.collection("som_result");
    const placementsCol = db.collection("som_placements");

    // Fetch 7th semester students
    const semVariants = ["Sem 7", "SEM 7", "sem 7", "7"];

    // Get all placed regNos for comparison
    const placedDocs = await placementsCol
      .find({})
      .project({ regNo: 1 })
      .toArray();

    const placedRegNos = new Set();
    placedDocs.forEach(doc => {
      placedRegNos.add(String(doc.regNo || "").trim());
    });

    // Get all Sem 7 students from result collection
    const resultDocs = await resultCol
      .find({
        Sem: { $in: semVariants },
      })
      .toArray();

    // Create map of all students with their info
    const allStudentsMap = new Map();

    resultDocs.forEach(doc => {
      const regNo = String(doc.Reg_No || "").trim();
      if (regNo && !allStudentsMap.has(regNo)) {
        // Get branch from database first
        let branch = doc.Branch || doc.Department || "";

        // Try normalization first
        if (branch) {
          branch = normalizeBranchName(branch);
        }

        // If no branch in DB, extract from regNo using proper branch code mapping
        if (!branch && regNo.length >= 8) {
          const branchCode = regNo.slice(5, 8);
          const rawBranch = soetBranchCodeMap[branchCode] || "";
          branch = rawBranch ? normalizeBranchName(rawBranch) : "";
        }

        // Fallback: try short branch code at positions 2-4
        if (!branch && regNo.length >= 4) {
          const shortCode = regNo.slice(2, 4);
          const shortBranchMap = {
            "01": "CSE",
            "02": "ECE",
            "03": "MECH",
            "04": "Civil",
            "05": "EEE",
            "13": "ECE"
          };
          branch = shortBranchMap[shortCode] || "";
        }

        allStudentsMap.set(regNo, {
          regNo,
          name: doc.Name || "",
          branch: branch || "",
          batch: extractBatchFromRegNo(regNo)
        });
      }
    });

    // Find unplaced students (in result but not in placements)
    let unplacedStudents = Array.from(allStudentsMap.values())
      .filter(student => !placedRegNos.has(student.regNo))
      .sort((a, b) => {
        if (a.batch !== b.batch) return b.batch.localeCompare(a.batch);
        if (a.branch !== b.branch) return a.branch.localeCompare(b.branch);
        return a.regNo.localeCompare(b.regNo);
      });

    if (batchParam && batchParam !== 'all') {
      unplacedStudents = unplacedStudents.filter(s => String(s.batch) === String(batchParam));
    }

    return NextResponse.json({
      success: true,
      unplacedStudents,
      count: unplacedStudents.length,
      totalStudents: allStudentsMap.size,
      placedStudents: placedRegNos.size
    });

  } catch (error) {
    console.error('Error fetching unplaced students:', error);
    return NextResponse.json({
      error: `Failed to fetch unplaced students: ${error.message}`
    }, { status: 500 });
  }
}

// Helper: extract batch year from registration number
function extractBatchFromRegNo(regNo) {
  if (!regNo || regNo.length < 2) return "Unknown";
  const yearCode = String(regNo).slice(0, 2);
  return `20${yearCode}`;
}

// Helper: normalize branch name to short form (must match student-strength API)
function normalizeBranchName(branchName) {
  if (!branchName) return "";

  const normalized = String(branchName).trim().toUpperCase();

  const branchMap = {
    'CIVIL': 'Civil',
    'CIVIL ENGINEERING': 'Civil',
    'CE': 'Civil',
    'CSE': 'CSE',
    'COMPUTER SCIENCE ENGINEERING': 'CSE',
    'COMPUTER SCIENCE AND ENGINEERING': 'CSE',
    'COMPUTER SCIENCE': 'CSE',
    'ECE': 'ECE',
    'EC': 'ECE',
    'E&C': 'ECE',
    'ELECTRONICS & COMMUNICATION ENGINEERING': 'ECE',
    'ELECTRONICS AND COMMUNICATION ENGINEERING': 'ECE',
    'ELECTRONICS & COMMUNICATION': 'ECE',
    'EEE': 'EEE',
    'EE': 'EEE',
    'ELECTRICAL & ELECTRONICS ENGINEERING': 'EEE',
    'ELECTRICAL AND ELECTRONICS ENGINEERING': 'EEE',
    'ELECTRICAL ENGINEERING': 'EEE',
    'MECHANICAL': 'MECH',
    'MECHANICAL ENGINEERING': 'MECH',
    'MECH': 'MECH',
    'ME': 'MECH',
    'AIML': 'CSE AIML',
    'CSE AIML': 'CSE AIML',
    'AI AND ML': 'CSE AIML',
    'ARTIFICIAL INTELLIGENCE': 'CSE AIML'
  };

  // Check exact match first
  if (branchMap[normalized]) {
    return branchMap[normalized];
  }

  // Fallback: partial matching for edge cases
  const b = normalized.toLowerCase();
  if (b.includes('aiml') || b.includes('artificial')) return 'CSE AIML';
  if (b.includes('civil')) return 'Civil';
  if (b.includes('computer') || b.includes('cse')) return 'CSE';
  if (b.includes('electronics') && (b.includes('communication') || b.includes('comm'))) return 'ECE';
  if (b.includes('e&c') || b.includes('e & c')) return 'ECE';
  if (b.includes('electrical') || b.includes('eee')) return 'EEE';
  if (b.includes('mechanical') || b.includes('mech')) return 'MECH';

  return branchName;
}

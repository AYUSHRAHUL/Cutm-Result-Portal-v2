import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { verifyToken } from "@/lib/auth";

// Get department from registration number
function getDepartmentFromRegNo(regNo) {
  if (!regNo || String(regNo).length < 8) return "Unknown";
  const regStr = String(regNo);
  const deptCode = regStr.charAt(7);
  const deptMap = {
    '1': 'Civil Engineering',
    '2': 'Computer Science Engineering',
    '3': 'Electronics & Communication Engineering',
    '5': 'Electrical & Electronics Engineering',
    '6': 'Mechanical Engineering'
  };
  return deptMap[deptCode] || "Unknown";
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
    const db = client.db("cutm1");

    // Get distinct branches from CUTM1
    const branchesCUTM1 = await db.collection("CUTM1")
      .distinct("Branch")
      .then(branches => branches.filter(Boolean));

    // Get distinct branches from RegistrationData (try multiple field names)
    const branchesRegData1 = await db.collection("RegistrationData")
      .distinct("Branch")
      .then(branches => branches.filter(Boolean));
    
    const branchesRegData2 = await db.collection("RegistrationData")
      .distinct("Department")
      .then(branches => branches.filter(Boolean));

    // Also extract branch from registration numbers in RegistrationData
    const regDataStudents = await db.collection("RegistrationData")
      .find({}, { projection: { Reg_No: 1 } })
      .limit(10000)
      .toArray();
    
    const branchesFromRegNo = new Set();
    regDataStudents.forEach(student => {
      if (student.Reg_No) {
        const regNo = String(student.Reg_No);
        const branch = getDepartmentFromRegNo(regNo);
        if (branch && branch !== "Unknown") {
          branchesFromRegNo.add(branch);
        }
      }
    });

    // Combine and deduplicate branches
    const branchSet = new Set([
      ...branchesCUTM1,
      ...branchesRegData1,
      ...branchesRegData2,
      ...Array.from(branchesFromRegNo)
    ]);
    const branches = Array.from(branchSet).filter(Boolean).sort();

    // Get distinct batches from CUTM1 registration numbers
    const studentsCUTM1 = await db.collection("CUTM1")
      .find({}, { projection: { Reg_No: 1 } })
      .toArray();

    // Get distinct batches from RegistrationData registration numbers
    const studentsRegData = await db.collection("RegistrationData")
      .find({}, { projection: { Reg_No: 1 } })
      .toArray();

    const batchSet = new Set();
    
    // Process CUTM1 students
    studentsCUTM1.forEach(student => {
      if (student.Reg_No) {
        const regNo = String(student.Reg_No);
        const match = regNo.match(/^(\d{2})/);
        if (match) {
          const batch = `20${match[1]}`;
          batchSet.add(batch);
        }
      }
    });

    // Process RegistrationData students
    studentsRegData.forEach(student => {
      if (student.Reg_No) {
        const regNo = String(student.Reg_No);
        const match = regNo.match(/^(\d{2})/);
        if (match) {
          const batch = `20${match[1]}`;
          batchSet.add(batch);
        }
      }
    });

    const batches = Array.from(batchSet).sort((a, b) => b.localeCompare(a)); // Sort descending (newest first)

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


import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { jwtVerify } from "jose";
import { getCampusSchoolDatabase } from "@/lib/campus";

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
 * SOM Analytics Route - SOM (BBA/MBA) only
 */
export async function GET(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = payload.role?.toLowerCase();
    if (!["admin", "teacher"].includes(userRole)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const batchFilter = searchParams.getAll('batch');
    const branchFilter = searchParams.getAll('branch');
    const semesterFilter = searchParams.getAll('semester');

    const client = await clientPromise;
    const campusParam = searchParams.get('campus');
    const campus = campusParam || payload.campus || null;

    const school = 'SOM';
    const dbName = getCampusSchoolDatabase(campus, school);
    const db = client.db(dbName);

    const analytics = await getAnalyticsData(db, batchFilter, branchFilter, semesterFilter);

    return NextResponse.json({
      success: true,
      data: analytics,
      school: 'SOM'
    });

  } catch (error) {
    return NextResponse.json({ error: `Analytics failed: ${error.message}` }, { status: 500 });
  }
}

const MAX_ANALYTICS_RECORDS = 50000;

async function getAnalyticsData(db, batchFilter = [], branchFilter = [], semesterFilter = []) {
  const { parseSOMRegistration } = await import('../parse-registration/route');

  const collection = db.collection("som_result");

  // Inactive students
  const statusCollection = db.collection("student_status");
  const inactiveDocs = await statusCollection.find({ isActive: { $in: [false, "false"] } }).project({ Reg_No: 1 }).toArray();
  const inactiveRegs = inactiveDocs.map(d => String(d.Reg_No || "").toUpperCase()).filter(Boolean);

  const match = {
    Reg_No: { $nin: inactiveRegs },
    Grade: { $exists: true },
    $expr: {
      $and: [
        { $in: [{ $substr: [{ $toString: "$Reg_No" }, 5, 3] }, ["912", "214"]] }
      ]
    }
  };

  // Branch filter mapping
  const branchMap = {
    'BBA': '912',
    'MBA': '214'
  };

  if (batchFilter.length > 0 && !batchFilter.includes("all")) {
    const yearCodes = batchFilter.map(b => String(b).trim().slice(-2));
    match.$expr.$and.push({ $in: [{ $substr: [{ $toString: "$Reg_No" }, 0, 2] }, yearCodes] });
  }

  if (branchFilter.length > 0 && !branchFilter.includes("all")) {
    const wantedCodes = branchFilter.map(b => branchMap[b.toUpperCase()]).filter(Boolean);
    if (wantedCodes.length > 0) {
      match.$expr.$and.push({ $in: [{ $substr: [{ $toString: "$Reg_No" }, 5, 3] }, wantedCodes] });
    }
  }

  if (semesterFilter.length > 0 && !semesterFilter.includes("all")) {
    const cleanSems = semesterFilter.map(s => String(s).replace(/^Sem\s*/i, "").trim()).filter(Boolean);
    const numericSems = cleanSems.map(s => parseInt(s, 10)).filter(n => !Number.isNaN(n));
    const inList = [
      ...cleanSems,
      ...cleanSems.map(s => `Sem ${s}`),
      ...cleanSems.map(s => `Sem${s}`),
      ...numericSems,
      ...numericSems.map(n => String(n).padStart(2, "0")),
    ];
    match.$or = [{ Sem: { $in: inList } }];
  }

  const allRecords = await collection.find(match, {
    projection: { Reg_No: 1, Name: 1, Subject_Code: 1, Subject_Name: 1, Grade: 1, Credits: 1, Sem: 1, _id: 0 }
  }).limit(MAX_ANALYTICS_RECORDS).toArray();

  if (allRecords.length === 0) {
    return { totalStudents: 0, totalSubjects: 0, passRate: '0.00', gradeDistribution: {}, departmentStats: [], semesterStats: [], batchStats: [], topPerformingStudents: [] };
  }

  const studentOutcome = new Map();
  const uniqueStudents = new Set();
  const uniqueSubjects = new Set();
  const gradeDistribution = {};

  allRecords.forEach(record => {
    const regNo = String(record.Reg_No).toUpperCase();
    uniqueStudents.add(regNo);
    
    const subjCode = record.Subject_Code || record["Subject Code"] || "";
    if (subjCode) uniqueSubjects.add(String(subjCode).trim());

    const grade = (record.Grade || "").toUpperCase();
    gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1;

    const isFail = ['F', 'S', 'M', 'I', 'R'].includes(grade);
    if (!studentOutcome.has(regNo)) studentOutcome.set(regNo, { hasFail: false, grades: [] });
    if (isFail) studentOutcome.get(regNo).hasFail = true;
    studentOutcome.get(regNo).grades.push({ grade, credits: record.Credits || 0 });
    studentOutcome.get(regNo).name = record.Name || studentOutcome.get(regNo).name || "";
    
    const isBBA = String(regNo).slice(5, 8) === '912';
    const isMBA = String(regNo).slice(5, 8) === '214';
    
    if (isBBA) studentOutcome.get(regNo).branch = 'BBA';
    else if (isMBA) studentOutcome.get(regNo).branch = 'MBA';
    else studentOutcome.get(regNo).branch = 'Unknown';
    
    studentOutcome.get(regNo).totalSubjects = (studentOutcome.get(regNo).totalSubjects || 0) + 1;
  });

  const totalStudents = uniqueStudents.size;
  const passCount = Array.from(studentOutcome.values()).filter(s => !s.hasFail).length;
  const passRate = totalStudents > 0 ? (passCount / totalStudents * 100).toFixed(2) : '0.00';

  // Stats helpers
  const getStats = (groupByKey) => {
    const statsMap = {};
    allRecords.forEach(record => {
      const regNo = String(record.Reg_No).toUpperCase();
      const groupValue = groupByKey(record, regNo);
      if (!statsMap[groupValue]) statsMap[groupValue] = { students: new Set(), passed: new Set() };
      statsMap[groupValue].students.add(regNo);
      if (!studentOutcome.get(regNo).hasFail) statsMap[groupValue].passed.add(regNo);
    });
    return Object.entries(statsMap).map(([name, stats]) => ({
      name,
      total: stats.students.size,
      passed: stats.passed.size,
      failed: stats.students.size - stats.passed.size,
      passRate: (stats.passed.size / stats.students.size * 100).toFixed(2)
    }));
  };

  const isAllBatch = !batchFilter.length || batchFilter.includes("all");
  const isAllBranch = !branchFilter.length || branchFilter.includes("all");

  const departmentStats = getStats((r, reg) => {
    const code = String(reg).slice(5, 8);
    const branch = code === '912' ? 'BBA' : (code === '214' ? 'MBA' : 'Unknown');
    
    // When All Batch is selected, show breakdown by Batch
    if (isAllBatch && branch !== 'Unknown') {
      const batchYear = `20${String(reg).slice(0, 2)}`;
      // If All Branch is also selected, include Branch in label for clarity
      if (isAllBranch) {
        return `${branch} ${batchYear}`;
      }
      // If a specific Branch is selected, just show the Batch Year for that branch
      return batchYear;
    }
    return branch;
  }).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  const batchStatsArr = getStats((r, reg) => `20${String(reg).slice(0, 2)}`);
  const batchStats = batchStatsArr.map(s => ({ batch: s.name, total: s.total, passed: s.passed, failed: s.failed, passRate: s.passRate }));
  
  const semesterStatsArr = getStats((r) => r.Sem || "Unknown");
  const semesterStats = semesterStatsArr.map(s => ({ semester: s.name, total: s.total, passed: s.passed, failed: s.failed, passRate: s.passRate }));

  // CGPA helpers
  const calculateCGPA = (grades) => {
    const gp = { O: 10, E: 9, A: 8, B: 7, C: 6, D: 5, F: 0, S: 0, M: 0, R: 0 };
    let tc = 0, ws = 0;
    grades.forEach(g => {
      const credits = parseFloat(String(g.credits).split('+')[0]) || 0;
      if (credits > 0 && gp[g.grade] !== undefined) {
        tc += credits;
        ws += credits * gp[g.grade];
      }
    });
    return tc > 0 ? (ws / tc).toFixed(2) : '0.00';
  };

  const topPerformingStudents = Array.from(studentOutcome.entries()).map(([regNo, data]) => ({
    regNo,
    name: data.name,
    branch: data.branch,
    totalSubjects: data.totalSubjects || 0,
    cgpa: calculateCGPA(data.grades)
  })).sort((a, b) => b.cgpa - a.cgpa).slice(0, 100);

  let registrationDataCount = 0;
  try {
    registrationDataCount = await db.collection("registrationData").estimatedDocumentCount();
  } catch {
    registrationDataCount = 0;
  }
  const dataSourceTotal = totalStudents + registrationDataCount;
  const resultPct = dataSourceTotal > 0 ? Number(((totalStudents / dataSourceTotal) * 100).toFixed(1)) : 100;
  const regPct = dataSourceTotal > 0 ? Number(((registrationDataCount / dataSourceTotal) * 100).toFixed(1)) : 0;

  return {
    totalStudents,
    totalSubjects: uniqueSubjects.size,
    totalRecords: allRecords.length,
    passRate,
    gradeDistribution,
    passCount,
    failCount: totalStudents - passCount,
    departmentStats,
    semesterStats,
    batchStats,
    topPerformingStudents,
    performanceMetrics: { totalRecords: totalStudents, passedRecords: passCount, failedRecords: totalStudents - passCount, passRate: parseFloat(passRate) },
    performanceMetricsByBatch: batchStats.map(s => ({ batch: s.name, total: s.total, passed: s.passed, failed: s.failed, passRate: parseFloat(s.passRate) })),
    performanceMetricsByBranch: departmentStats.map(s => ({ branch: s.name, total: s.total, passed: s.passed, failed: s.failed, passRate: parseFloat(s.passRate) })),
    performanceMetricsBySemester: semesterStats.map(s => ({ semester: s.name, total: s.total, passed: s.passed, failed: s.failed, passRate: parseFloat(s.passRate) })),
    dataSourceStats: [
      { name: "Result Database", count: totalStudents, percentage: resultPct },
      { name: "Registration Data", count: registrationDataCount, percentage: regPct },
    ],
  };
}
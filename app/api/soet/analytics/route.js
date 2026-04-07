import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { jwtVerify } from "jose";
import { getCampusSchoolDatabase } from "@/lib/campus";
// Branch detection moved to parse-registration API

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
 * SOET Analytics Route - B.Tech only
 * Main analytics endpoint for SOET
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
        error: "Access denied - Only admins or teachers can access analytics data"
      }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const batchFilter = searchParams.getAll('batch');
    const branchFilter = searchParams.getAll('branch');
    const semesterFilter = searchParams.getAll('semester');

    const client = await clientPromise;
    const campusParam = searchParams.get('campus');
    const campus = campusParam || payload.campus || null;

    // Force school to SOET
    const school = 'SOET';
    const dbName = getCampusSchoolDatabase(campus, school);
    const db = client.db(dbName);

    // Get analytics data (B.Tech only)
    const analytics = await getAnalyticsData(db, batchFilter, branchFilter, semesterFilter, school);

    // Removed console.log to reduce overhead

    return NextResponse.json({
      success: true,
      data: analytics,
      school: 'SOET'
    });

  } catch (error) {
    // Only log error message, not full error object to reduce overhead
    return NextResponse.json({
      error: `Analytics failed: ${error.message}`
    }, { status: 500 });
  }
}

// CRITICAL: Maximum records to fetch to prevent MongoDB connection exhaustion
const MAX_ANALYTICS_RECORDS = 50000; // Limit to 50k records max per analytics request

async function getAnalyticsData(db, batchFilter = null, branchFilter = null, semesterFilter = null, school = null) {
  const { parseBTechRegistration } = await import('../parse-registration/route');

  const batchFilters = Array.isArray(batchFilter) ? batchFilter : (batchFilter ? [batchFilter] : []);
  const branchFilters = Array.isArray(branchFilter) ? branchFilter : (branchFilter ? [branchFilter] : []);
  const semesterFilters = Array.isArray(semesterFilter) ? semesterFilter : (semesterFilter ? [semesterFilter] : []);

  // Use MongoDB match to aggressively filter data before JS processing
  const collection = db.collection("result");

  // Fetch inactive students list for exclusion
  const statusCollection = db.collection("student_status");
  const inactiveDocs = await statusCollection.find({ isActive: { $in: [false, "false"] } }).project({ Reg_No: 1 }).toArray();
  const inactiveRegs = [];
  inactiveDocs.forEach(d => {
    if (d.Reg_No) {
      inactiveRegs.push(String(d.Reg_No));
      const num = parseInt(d.Reg_No, 10);
      if (!isNaN(num)) {
        inactiveRegs.push(num);
      }
    }
  });

  // Removed console.log to reduce overhead

  const match = {
    Reg_No: { $type: "string", $nin: inactiveRegs }, // Exclude inactive students
    Grade: { $exists: true },
    $expr: {
      $and: [
        // Exclude Diploma registrations (program code positions 4-5 === '07')
        { $ne: [{ $substr: ["$Reg_No", 4, 2] }, "07"] },
        // Only B.Tech branch codes (including AIML 137)
        { $in: [{ $substr: ["$Reg_No", 5, 3] }, ["111", "112", "113", "115", "116", "137"]] }
      ]
    }
  };

  // Apply batch filter at DB level when possible
  if (batchFilters.length > 0 && !batchFilters.includes("all")) {
    const yearCodes = batchFilters
      .map((b) => String(b).trim())
      .filter((b) => b)
      .map((b) => (b.length === 4 ? b.slice(2, 4) : b)); // 2023 -> 23

    if (yearCodes.length > 0) {
      match.$expr.$and.push({
        $in: [{ $substr: ["$Reg_No", 0, 2] }, yearCodes]
      });
    }
  }

  // Apply branch filter at DB level when possible
  if (branchFilters.length > 0 && !branchFilters.includes("all")) {
    const branchCodeMap = {
      CSE: ["112"],
      "COMPUTER SCIENCE ENGINEERING": ["112"],
      "COMPUTER SCIENCE": ["112"],
      ECE: ["113"],
      "ELECTRONICS & COMMUNICATION ENGINEERING": ["113"],
      "ELECTRONICS AND COMMUNICATION ENGINEERING": ["113"],
      "ELECTRONICS ENGINEERING": ["113", "115"], // Broad match
      EEE: ["115"],
      "ELECTRICAL & ELECTRONICS ENGINEERING": ["115"],
      "ELECTRICAL AND ELECTRONICS ENGINEERING": ["115"],
      "ELECTRICAL ENGINEERING": ["115"],
      ME: ["116"],
      "MECHANICAL ENGINEERING": ["116"],
      CIVIL: ["111"],
      "CIVIL ENGINEERING": ["111"],
      AIML: ["137"],
      "AIML": ["137"],
      "CSE AIML": ["137"],
      "CSE-AIML": ["137"],
    };

    const wantedCodes = [];
    for (const filterBranch of branchFilters) {
      const key = String(filterBranch).toUpperCase().trim();
      if (branchCodeMap[key]) {
        wantedCodes.push(...branchCodeMap[key]);
      } else {
        // Fallback: search for acronyms in full names or vice-versa
        for (const [mapName, mapCodes] of Object.entries(branchCodeMap)) {
          if (key.includes(mapName) || mapName.includes(key)) {
            wantedCodes.push(...mapCodes);
          }
        }
      }
    }

    const uniqueCodes = Array.from(new Set(wantedCodes));
    if (uniqueCodes.length > 0) {
      match.$expr.$and.push({
        $in: [{ $substr: ["$Reg_No", 5, 3] }, uniqueCodes]
      });
    }
  }

  // Apply semester filter at DB level when possible
  if (semesterFilters.length > 0 && !semesterFilters.includes("all")) {
    const cleanSems = semesterFilters
      .map((s) => String(s).trim())
      .filter((s) => s && s.toLowerCase() !== "all")
      .map((s) => s.replace(/^Sem\s*/i, "").trim());

    if (cleanSems.length > 0) {
      match.$or = [
        { Sem: { $in: cleanSems } },
        { Sem: { $in: cleanSems.map((s) => `Sem ${s}`) } },
        { Sem: { $in: cleanSems.map((s) => `Sem${s}`) } },
      ];
    }
  }

  // Removed console.log to reduce overhead

  // CRITICAL: Limit records to prevent MongoDB connection exhaustion and memory issues
  const cursor = collection.find(match, {
    projection: {
      Reg_No: 1,
      Name: 1,
      Subject_Code: 1,
      "Subject Code": 1,
      Subject_Name: 1,
      "Subject Name": 1,
      Subject_name: 1,
      Grade: 1,
      Credits: 1,
      Sem: 1,
      _id: 0
    }
  }).limit(MAX_ANALYTICS_RECORDS); // CRITICAL: Limit to prevent excessive data loading

  // Use toArray() with limit instead of for await loop - more efficient
  const allRecords = await cursor.toArray();

  // Removed console.log to reduce overhead

  // Filter for B.Tech students only - additional safety with parser & cache
  const beforeFilterCount = allRecords.length;

  // Pre-filter: Remove records without Reg_No to reduce parsing calls
  const recordsWithRegNo = allRecords.filter(record => record.Reg_No);

  // Use Map for faster lookups and batch processing
  const validBTechRegNos = new Set();
  const invalidRegNos = new Set();

  // Filter and cache results
  let cutm1Data = recordsWithRegNo.filter(record => {
    const regNo = String(record.Reg_No).trim();

    // Check cache first
    if (validBTechRegNos.has(regNo)) return true;
    if (invalidRegNos.has(regNo)) return false;

    // Parse and cache result
    const parsed = parseBTechRegistration(regNo);
    if (parsed && parsed.isValid && parsed.isBTech) {
      validBTechRegNos.add(regNo);
      return true;
    } else {
      invalidRegNos.add(regNo);
      return false;
    }
  });

  console.log(`[SOET Analytics] Records after B.Tech filter: ${cutm1Data.length} (filtered out ${beforeFilterCount - cutm1Data.length})`);

  // If no data after filtering, return empty stats structure
  if (cutm1Data.length === 0) {
    console.log('[SOET Analytics] No B.Tech records found after filtering');
    return {
      totalStudents: 0,
      totalSubjects: 0,
      totalRecords: 0,
      passRate: '0.00',
      gradeDistribution: {},
      passCount: 0,
      failCount: 0,
      departmentStats: [],
      semesterStats: [],
      batchStats: [],
      dataSourceStats: []
    };
  }

  const filterByBatch = (record) => {
    if (batchFilters.length === 0 || batchFilters.includes("all")) return true;
    if (!record.Reg_No) return false;
    const parsed = parseBTechRegistration(String(record.Reg_No).trim());
    if (!parsed || !parsed.isValid || !parsed.isBTech) return false;

    // Use parsed year from parseBTechRegistration
    const recordYear = parsed.year || ''; // e.g., "2023", "2024"
    const recordYearCode = parsed.yearCode || ''; // e.g., "23", "24"

    return batchFilters.some(batch => {
      const batchStr = String(batch).trim();
      // Match full year (2023, 2024) or year code (23, 24)
      return batchStr === recordYear ||
        batchStr === recordYearCode ||
        (batchStr.length === 4 && batchStr.substring(2, 4) === recordYearCode) ||
        (batchStr.length === 2 && batchStr === recordYearCode);
    });
  };

  const filterByBranch = (record) => {
    if (branchFilters.length === 0 || branchFilters.includes("all")) return true;
    if (!record.Reg_No) return false;
    const parsed = parseBTechRegistration(String(record.Reg_No).trim());
    if (!parsed || !parsed.isValid || !parsed.isBTech) return false;

    // Normalize parsed branch to short code using branchCode
    const branchShortMap = {
      '111': 'CIVIL',
      '112': 'CSE',
      '113': 'ECE',
      '115': 'EEE',
      '116': 'ME',
      // AIML registrations use 137
      '137': 'AIML'
    };
    const parsedShort = branchShortMap[parsed.branchCode] || (parsed.branch || '').toUpperCase().trim();

    return branchFilters.some(filterBranch => {
      const filterUpper = String(filterBranch).toUpperCase().trim();
      // Map filter to short code
      const filterShortMap = {
        'CSE': 'CSE',
        'AIML': 'AIML',
        'ECE': 'ECE',
        'EEE': 'EEE',
        'ME': 'ME',
        'MECHANICAL': 'ME',
        'CIVIL': 'CIVIL'
      };
      const filterShort = filterShortMap[filterUpper] || filterUpper;
      return parsedShort === filterShort;
    });
  };

  const filterBySemester = (record) => {
    if (semesterFilters.length === 0 || semesterFilters.includes("all")) return true;
    if (!record.Sem) return false;
    const sem = String(record.Sem).trim();

    return semesterFilters.some(filter => {
      const filterStr = String(filter).trim();
      const cleanFilter = filterStr.replace(/^Sem\s*/i, "").trim();
      const cleanSem = sem.replace(/^Sem\s*/i, "").trim();

      // Try multiple matching strategies (case-insensitive)
      return sem.toLowerCase() === filterStr.toLowerCase() ||
        sem.toLowerCase() === cleanFilter.toLowerCase() ||
        cleanSem.toLowerCase() === filterStr.toLowerCase() ||
        cleanSem.toLowerCase() === cleanFilter.toLowerCase() ||
        sem.toLowerCase() === `sem ${cleanFilter}`.toLowerCase() ||
        sem.toLowerCase() === `sem${cleanFilter}`.toLowerCase() ||
        `sem ${cleanSem}`.toLowerCase() === filterStr.toLowerCase() ||
        `sem${cleanSem}`.toLowerCase() === filterStr.toLowerCase();
    });
  };

  // Apply filters - optimized single pass
  const filteredData = cutm1Data.filter(record => {
    const batchMatch = filterByBatch(record);
    const branchMatch = filterByBranch(record);
    const semMatch = filterBySemester(record);
    return batchMatch && branchMatch && semMatch;
  });

  console.log(`[SOET Analytics] After filters: ${filteredData.length} records`);

  // OPTIMIZED: Single pass through filteredData to calculate all stats (student-based pass/fail)
  const uniqueStudents = new Set();
  const uniqueSubjects = new Set();
  const gradeDistribution = {};

  // Track per-student pass/fail (fail if any failing/backlog grade)
  const studentOutcome = new Map(); // regNo -> { hasFail: boolean }

  // Cache parsed registration data to avoid re-parsing
  const parsedRegCache = new Map();

  // Single loop for all basic stats
  filteredData.forEach(record => {
    if (!record.Reg_No) return;
    const regNo = String(record.Reg_No).trim();
    uniqueStudents.add(regNo);

    // Unique subjects
    const subjCode = record.Subject_Code || record["Subject Code"];
    if (subjCode) uniqueSubjects.add(String(subjCode).trim());

    // Grade distribution
    const grade = record.Grade || '';
    gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1;

    const isFail = ['F', 'S', 'M', 'I', 'R'].includes(grade.toUpperCase());

    // Cache parsed registration for later use
    if (!parsedRegCache.has(regNo)) {
      const parsed = parseBTechRegistration(regNo);
      if (parsed && parsed.isValid && parsed.isBTech) {
        parsedRegCache.set(regNo, parsed);
      }
    }

    // Track student outcome: fail if any failing grade
    if (!studentOutcome.has(regNo)) {
      studentOutcome.set(regNo, { hasFail: false });
    }
    if (isFail) {
      studentOutcome.get(regNo).hasFail = true;
    }
  });

  const totalStudents = uniqueStudents.size;
  const totalSubjects = uniqueSubjects.size;
  const passCountStudents = Array.from(studentOutcome.values()).filter(s => !s.hasFail).length;
  const failCountStudents = totalStudents - passCountStudents;
  const passRate = totalStudents > 0 ? (passCountStudents / totalStudents) * 100 : 0;

  // OPTIMIZED: Calculate department stats using cached parsed data
  const departmentStatsMap = {};
  const branchDisplayMap = {
    'Civil': 'CIVIL',
    'CSE': 'CSE',
    'ECE': 'ECE',
    'EEE': 'EEE',
    'Mechanical': 'ME',
    'CSE AIML': 'AIML'
  };

  filteredData.forEach(record => {
    if (!record.Reg_No) return;

    const parsed = parsedRegCache.get(record.Reg_No);
    if (!parsed || !parsed.isValid || !parsed.isBTech) return;

    const parsedBranch = parsed.branch || 'Unknown';
    let deptName = branchDisplayMap[parsedBranch] || parsedBranch.toUpperCase();

    // If only one branch is filtered and no specific batch is selected, 
    // show breakdown by Year in the department chart for better insights
    if (branchFilters.length === 1 && !branchFilters.includes("all") && (batchFilters.length === 0 || batchFilters.includes("all"))) {
      deptName = parsed.year || 'Unknown';
    }

    const regNo = String(record.Reg_No).trim();
    const studentHasFail = studentOutcome.get(regNo)?.hasFail || false;

    if (!departmentStatsMap[deptName]) {
      departmentStatsMap[deptName] = {
        students: new Set(),
        passedStudents: new Set(),
        failedStudents: new Set(),
      };
    }

    departmentStatsMap[deptName].students.add(regNo);
    if (studentHasFail) {
      departmentStatsMap[deptName].failedStudents.add(regNo);
    } else {
      departmentStatsMap[deptName].passedStudents.add(regNo);
    }
  });

  const departmentStats = Object.entries(departmentStatsMap).map(([name, stats]) => {
    const totalStudentsDept = stats.students.size;
    const passedStudents = stats.passedStudents.size;
    const failedStudents = stats.failedStudents.size;

    return {
      name,
      total: totalStudentsDept,
      passed: passedStudents,
      failed: failedStudents,
      passRate: totalStudentsDept > 0 ? ((passedStudents / totalStudentsDept) * 100).toFixed(2) : '0.00'
    };
  }).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

  // OPTIMIZED: Calculate semester stats
  const semesterStatsMap = {};
  filteredData.forEach(record => {
    const sem = String(record.Sem || '').trim();
    if (!sem || !record.Reg_No) return;
    const regNo = String(record.Reg_No).trim();
    const studentHasFail = studentOutcome.get(regNo)?.hasFail || false;

    if (!semesterStatsMap[sem]) {
      semesterStatsMap[sem] = {
        students: new Set(),
        passedStudents: new Set(),
        failedStudents: new Set(),
      };
    }

    semesterStatsMap[sem].students.add(regNo);
    if (studentHasFail) {
      semesterStatsMap[sem].failedStudents.add(regNo);
    } else {
      semesterStatsMap[sem].passedStudents.add(regNo);
    }
  });

  const semesterStats = Object.entries(semesterStatsMap).map(([sem, stats]) => {
    const totalStudentsSem = stats.students.size;
    const passedStudents = stats.passedStudents.size;
    const failedStudents = stats.failedStudents.size;

    return {
      semester: sem,
      total: totalStudentsSem,
      passed: passedStudents,
      failed: failedStudents,
      passRate: totalStudentsSem > 0 ? ((passedStudents / totalStudentsSem) * 100).toFixed(2) : '0.00'
    };
  });

  // OPTIMIZED: Calculate batch stats using cached parsed data
  const batchStatsMap = {};
  filteredData.forEach(record => {
    if (!record.Reg_No) return;

    const parsed = parsedRegCache.get(record.Reg_No);
    if (!parsed || !parsed.isValid || !parsed.isBTech) return;

    const batch = parsed.year || 'Unknown';
    const regNo = String(record.Reg_No).trim();
    const studentHasFail = studentOutcome.get(regNo)?.hasFail || false;

    if (!batchStatsMap[batch]) {
      batchStatsMap[batch] = {
        students: new Set(),
        passedStudents: new Set(),
        failedStudents: new Set(),
      };
    }

    batchStatsMap[batch].students.add(regNo);
    if (studentHasFail) {
      batchStatsMap[batch].failedStudents.add(regNo);
    } else {
      batchStatsMap[batch].passedStudents.add(regNo);
    }
  });

  const batchStats = Object.entries(batchStatsMap).map(([batch, stats]) => {
    const totalStudentsBatch = stats.students.size;
    const passedStudents = stats.passedStudents.size;
    const failedStudents = stats.failedStudents.size;

    return {
      batch,
      total: totalStudentsBatch,
      passed: passedStudents,
      failed: failedStudents,
      passRate: totalStudentsBatch > 0 ? ((passedStudents / totalStudentsBatch) * 100).toFixed(2) : '0.00'
    };
  });

  // Data source stats
  const dataSourceStats = [
    {
      name: 'CUTM Result Data',
      count: totalStudents,
      percentage: 100
    }
  ];

  // Calculate performance metrics (student-level for Passing Analysis)
  const performanceMetrics = {
    totalRecords: totalStudents,
    passedRecords: passCountStudents,
    failedRecords: failCountStudents,
    passRate: parseFloat(passRate.toFixed(2))
  };

  // Calculate performance metrics by batch
  const performanceMetricsByBatch = batchStats.map(stat => ({
    batch: stat.batch,
    total: stat.total,
    passed: stat.passed,
    failed: stat.failed,
    passRate: parseFloat(stat.passRate)
  }));

  // Calculate performance metrics by branch
  const performanceMetricsByBranch = departmentStats.map(stat => ({
    branch: stat.name,
    total: stat.total,
    passed: stat.passed,
    failed: stat.failed,
    passRate: parseFloat(stat.passRate)
  }));

  // Calculate performance metrics by semester
  const performanceMetricsBySemester = semesterStats.map(stat => ({
    semester: stat.semester,
    total: stat.total,
    passed: stat.passed,
    failed: stat.failed,
    passRate: parseFloat(stat.passRate)
  }));

  // Helper to safely parse credits like "3+1" or "3"
  function parseCredits(creditStr) {
    if (!creditStr) return 0;
    const parts = creditStr
      .toString()
      .split("+")
      .map((p) => parseFloat(p.trim()) || 0);
    return parts.reduce((a, b) => a + b, 0);
  }

  // Helper function to calculate CGPA from grades with credits (credit-weighted, same as Results API)
  // CGPA = (sum of credits * gradePoints) / totalCredits
  // Valid grades: O, E, A, B, C, D, F, S, M, R
  function calculateCGPA(gradesWithCredits) {
    if (!gradesWithCredits || gradesWithCredits.length === 0) return '0.00';

    const gradePoints = {
      'O': 10, // Outstanding
      'E': 9,  // Excellent
      'A': 8,  // Very Good
      'B': 7,  // Good
      'C': 6,  // Average
      'D': 5,  // Below Average
      'F': 0,  // Fail
      'S': 0,  // Supplementary
      'M': 0,  // Malpractice
      'R': 0   // Reappear
    };

    let totalCredits = 0;
    let weightedSum = 0;

    gradesWithCredits.forEach(item => {
      const grade = (item.grade || '').toUpperCase().trim();
      const credits = parseCredits(item.credits || 0);
      const gradePoint = gradePoints[grade] ?? 0;

      // Only count valid grades and credits > 0 (same logic as Results API)
      if (gradePoints[grade] !== undefined && !isNaN(credits) && credits > 0) {
        totalCredits += credits;
        weightedSum += credits * gradePoint;
      }
    });

    if (totalCredits === 0) return '0.00';
    const cgpa = weightedSum / totalCredits;
    return parseFloat(cgpa.toFixed(2)).toFixed(2);
  }

  // OPTIMIZED: Calculate top performing students (reuse data from previous loops if possible)
  const studentPerformanceMap = {};
  filteredData.forEach(record => {
    if (!record.Reg_No) return;
    const regNo = String(record.Reg_No).trim();
    const grade = (record.Grade || '').toUpperCase();
    const isPass = !['F', 'S', 'M', 'I', 'R'].includes(grade);

    if (!studentPerformanceMap[regNo]) {
      // Parse branch from registration number to a standardized short code used in filters
      let branch = null;
      if (regNo.length === 12) {
        const branchCode = regNo.slice(5, 8); // 3 digits from index 5-7
        const btechBranchMap = {
          '111': 'CIVIL',
          '112': 'CSE',
          '113': 'ECE',
          '115': 'EEE',
          '116': 'ME',
          // AIML registrations use 137
          '137': 'AIML'
        };
        branch = btechBranchMap[branchCode] || null;
      }

      studentPerformanceMap[regNo] = {
        regNo: regNo,
        name: record.Name || record.name || 'Unknown',
        branch: branch,
        totalSubjects: 0,
        passedSubjects: 0,
        failedSubjects: 0,
        grades: [] // Array of {grade, credits} objects for credit-weighted CGPA calculation
      };
    }
    studentPerformanceMap[regNo].totalSubjects++;
    if (isPass) {
      studentPerformanceMap[regNo].passedSubjects++;
    } else {
      studentPerformanceMap[regNo].failedSubjects++;
    }
    // Only push valid grades with credits (O, E, A, B, C, D, F, S, M, R)
    const validGrades = ['O', 'E', 'A', 'B', 'C', 'D', 'F', 'S', 'M', 'R'];
    if (grade && validGrades.includes(grade)) {
      studentPerformanceMap[regNo].grades.push({
        grade: grade,
        credits: record.Credits || 0
      });
    }
  });

  // Calculate CGPA for each student and sort by CGPA
  // Return ALL students sorted by CGPA (no limit)
  const topPerformingStudents = Object.values(studentPerformanceMap)
    .map(student => {
      const cgpa = calculateCGPA(student.grades);
      return {
        regNo: student.regNo,
        name: student.name,
        branch: student.branch,
        totalSubjects: student.totalSubjects,
        passedSubjects: student.passedSubjects,
        failedSubjects: student.failedSubjects,
        passRate: student.totalSubjects > 0
          ? ((student.passedSubjects / student.totalSubjects) * 100).toFixed(2)
          : '0.00',
        cgpa: cgpa
      };
    })
    .sort((a, b) => {
      // Sort by CGPA (descending), then by total subjects (descending)
      const cgpaDiff = parseFloat(b.cgpa || 0) - parseFloat(a.cgpa || 0);
      if (cgpaDiff !== 0) return cgpaDiff;
      return b.totalSubjects - a.totalSubjects;
    });
  // Removed .slice(0, 100) to include ALL students regardless of CGPA

  // Calculate performance metrics by combination (for multiple filters)
  const performanceMetricsByCombination = [];

  return {
    totalStudents,
    totalSubjects,
    totalRecords: totalStudents,
    passRate: passRate.toFixed(2),
    gradeDistribution,
    passCount: passCountStudents,
    failCount: failCountStudents,
    departmentStats,
    semesterStats,
    batchStats,
    dataSourceStats,
    performanceMetrics,
    performanceMetricsByBatch,
    performanceMetricsByBranch,
    performanceMetricsBySemester,
    performanceMetricsByCombination,
    topPerformingStudents
  };
}
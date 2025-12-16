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
 * SOVET Analytics Route - Diploma only
 * Main analytics endpoint for SOVET
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
    
    // Force school to SOVET
    const school = 'SOVET';
    const dbName = getCampusSchoolDatabase(campus, school);
    
    // Removed console.log to reduce overhead
    
    const db = client.db(dbName);

    // Get analytics data (Diploma only)
    const analytics = await getAnalyticsData(db, batchFilter, branchFilter, semesterFilter, school);

    return NextResponse.json({
      success: true,
      data: analytics,
      school: 'SOVET'
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
  // Optimize: Only fetch essential fields. Keep DB match minimal to avoid over-filtering to zero.
  const collection = db.collection("result");

  // Removed console.log to reduce overhead

  // Normalize filters into arrays for downstream JS filtering
  const batchFilters = Array.isArray(batchFilter) ? batchFilter : (batchFilter ? [batchFilter] : []);
  const branchFilters = Array.isArray(branchFilter) ? branchFilter : (branchFilter ? [branchFilter] : []);
  const semesterFilters = Array.isArray(semesterFilter) ? semesterFilter : (semesterFilter ? [semesterFilter] : []);

  // Minimal Mongo match: only ensure Reg_No exists and program code is Diploma (07).
  // Use $toString so numeric Reg_No values also work. All other filters handled in JS to avoid zero results.
  const regStr = { $toString: "$Reg_No" };
  const match = {
    Grade: { $exists: true },
    $expr: {
      $and: [
        { $eq: [{ $substr: [regStr, 4, 2] }, "07"] }
      ]
    }
  };

  // Removed console.log to reduce overhead

  // CRITICAL: Limit records to prevent MongoDB connection exhaustion and memory issues
  const cursor = collection.find(match, {
    projection: {
      Reg_No: 1,
      Name: 1,
      name: 1,
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
  const cutm1Data = await cursor.toArray();

  // Removed console.log to reduce overhead

  // Filter for Diploma students only - Optimized with caching
  const { parseDiplomaRegistration } = await import('../parse-registration/route');
  const beforeFilter = cutm1Data.length;
  
  // Pre-filter: Remove records without Reg_No
  const recordsWithRegNo = cutm1Data.filter(record => record.Reg_No);
  
  // Use Set for faster lookups and cache results
  const validDiplomaRegNos = new Set();
  const invalidRegNos = new Set();
  
  // Filter and cache results
  cutm1Data = recordsWithRegNo.filter(record => {
    const regNo = String(record.Reg_No).trim();
    
    // Check cache first
    if (validDiplomaRegNos.has(regNo)) return true;
    if (invalidRegNos.has(regNo)) return false;
    
    // Parse and cache result
    const parsed = parseDiplomaRegistration(regNo);
    if (parsed && parsed.isValid && parsed.isDiploma) {
      validDiplomaRegNos.add(regNo);
      return true;
    } else {
      invalidRegNos.add(regNo);
      return false;
    }
  });
  
  console.log(`[SOVET Analytics] After Diploma filter: ${cutm1Data.length} records (was ${beforeFilter})`);

  // Diploma branch mapping (8th digit)
  const branchMap = {
    'CSE': ['4'],
    'EE': ['1'],
    'ME': ['2'],
    'CIVIL': ['3'],
    'MINING': ['6'],
    'AUTOMOBILE': ['7']
  };

  const filterByBatch = (record) => {
    if (batchFilters.length === 0 || batchFilters.includes("all")) return true;
    if (!record.Reg_No) return false;
    const parsed = parseDiplomaRegistration(String(record.Reg_No).trim());
    if (!parsed || !parsed.isValid || !parsed.isDiploma) return false;
    
    // Use parsed year from parseDiplomaRegistration
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
    const parsed = parseDiplomaRegistration(String(record.Reg_No).trim());
    if (!parsed || !parsed.isValid || !parsed.isDiploma) return false;
    
    // Use parsed branch name from parseDiplomaRegistration
    const parsedBranch = parsed.branch || '';
    
    // Map parsed branch names to filter values
    const branchNameMap = {
      'Electrical': ['EE', 'ELECTRICAL'],
      'Mechanical': ['ME', 'MECHANICAL'],
      'Civil': ['CIVIL'],
      'CSE': ['CSE'],
      'Automobile': ['AUTOMOBILE'],
      'Mining': ['MINING']
    };
    
    const branchAliases = branchNameMap[parsedBranch] || [parsedBranch.toUpperCase()];
    
    return branchFilters.some(filterBranch => {
      const filterUpper = filterBranch.toUpperCase();
      // Check if filter matches any alias or the parsed branch name
      return branchAliases.some(alias => 
        filterUpper === alias || 
        filterUpper === `DIPLOMA-${alias}` ||
        filterUpper.includes(alias) ||
        alias.includes(filterUpper)
      ) || filterUpper === parsedBranch.toUpperCase();
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

  // Debug: Check sample records before filtering
  if (cutm1Data.length > 0 && (batchFilters.length > 0 || branchFilters.length > 0 || semesterFilters.length > 0)) {
    const sampleRecord = cutm1Data[0];
    const sampleParsed = parseDiplomaRegistration(String(sampleRecord.Reg_No || '').trim());
    console.log(`[SOVET Analytics] Sample record: Reg_No=${sampleRecord.Reg_No}, Sem=${sampleRecord.Sem}, Parsed=${JSON.stringify(sampleParsed)}`);
  }

  const filteredData = cutm1Data.filter(record => {
    const batchMatch = filterByBatch(record);
    const branchMatch = filterByBranch(record);
    const semMatch = filterBySemester(record);
    return batchMatch && branchMatch && semMatch;
  });
  
  console.log(`[SOVET Analytics] After filters: ${filteredData.length} records (batch=${JSON.stringify(batchFilters)}, branch=${JSON.stringify(branchFilters)}, semester=${JSON.stringify(semesterFilters)})`);

  // OPTIMIZED: Single pass through filteredData to calculate all stats
  const uniqueStudents = new Set();
  const uniqueSubjects = new Set();
  const gradeDistribution = {};
  let passCount = 0;
  let failCount = 0;
  
  // Cache parsed registration data to avoid re-parsing
  const parsedRegCache = new Map();
  
  // Single loop for all basic stats
  filteredData.forEach(record => {
    // Unique students
    if (record.Reg_No) uniqueStudents.add(String(record.Reg_No).trim());
    
    // Unique subjects
    const subjCode = record.Subject_Code || record["Subject Code"];
    if (subjCode) uniqueSubjects.add(String(subjCode).trim());
    
    // Grade distribution
    const grade = record.Grade || '';
    gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1;
    
    // Pass/fail count
    if (!['F', 'S', 'M', 'I', 'R'].includes(grade)) {
      passCount++;
    } else {
      failCount++;
    }
    
    // Cache parsed registration for later use
    if (record.Reg_No && !parsedRegCache.has(record.Reg_No)) {
      const parsed = parseDiplomaRegistration(String(record.Reg_No).trim());
      if (parsed && parsed.isValid && parsed.isDiploma) {
        parsedRegCache.set(record.Reg_No, parsed);
      }
    }
  });
  
  const totalStudents = uniqueStudents.size;
  const totalSubjects = uniqueSubjects.size;
  const passRate = filteredData.length > 0 ? (passCount / filteredData.length) * 100 : 0;

  // OPTIMIZED: Calculate department stats using cached parsed data
  const departmentStatsMap = {};
  const branchNameMap = {
    'Electrical': 'EE',
    'Mechanical': 'ME',
    'Civil': 'CIVIL',
    'CSE': 'CSE',
    'Automobile': 'AUTOMOBILE',
    'Mining': 'MINING'
  };
  
  filteredData.forEach(record => {
    if (!record.Reg_No) return;
    
    // Use cached parsed data instead of re-parsing
    const parsed = parsedRegCache.get(record.Reg_No);
    if (!parsed || !parsed.isValid || !parsed.isDiploma) return;
    
    const deptName = branchNameMap[parsed.branch] || parsed.branch || 'Unknown';
    const regNo = String(record.Reg_No).trim();
    const grade = record.Grade || '';
    const isPass = !['F', 'S', 'M', 'I', 'R'].includes(grade);
    
    if (!departmentStatsMap[deptName]) {
      departmentStatsMap[deptName] = { 
        students: new Set(),
        studentRecords: new Map(),
        total: 0, 
        passed: 0, 
        failed: 0 
      };
    }
    
    departmentStatsMap[deptName].students.add(regNo);
    
    if (!departmentStatsMap[deptName].studentRecords.has(regNo)) {
      departmentStatsMap[deptName].studentRecords.set(regNo, { passed: 0, failed: 0 });
    }
    
    if (isPass) {
      departmentStatsMap[deptName].studentRecords.get(regNo).passed++;
    } else {
      departmentStatsMap[deptName].studentRecords.get(regNo).failed++;
    }
  });
  
  // Calculate final stats: count unique students and determine their pass/fail status
  const departmentStats = Object.entries(departmentStatsMap).map(([name, stats]) => {
    // Count unique students
    const totalStudents = stats.students.size;
    
    // Count students who have at least one pass (not all failed)
    let passedStudents = 0;
    let failedStudents = 0;
    
    stats.studentRecords.forEach((recordStats, regNo) => {
      // A student is considered "passed" if they have at least one passing grade
      // A student is considered "failed" if all their records are failed
      if (recordStats.passed > 0) {
        passedStudents++;
      } else if (recordStats.failed > 0 && recordStats.passed === 0) {
        failedStudents++;
      }
    });
    
    return {
      name,
      total: totalStudents, // Number of unique students
      passed: passedStudents,
      failed: failedStudents,
      passRate: totalStudents > 0 ? ((passedStudents / totalStudents) * 100).toFixed(2) : '0.00'
    };
  });

  // OPTIMIZED: Calculate semester stats
  const semesterStatsMap = {};
  filteredData.forEach(record => {
    const sem = String(record.Sem || '').trim();
    if (!sem || !record.Reg_No) return;
    const regNo = String(record.Reg_No).trim();
    const grade = record.Grade || '';
    const isPass = !['F', 'S', 'M', 'I', 'R'].includes(grade);
    
    if (!semesterStatsMap[sem]) {
      semesterStatsMap[sem] = { 
        students: new Set(),
        studentRecords: new Map(),
        total: 0, 
        passed: 0, 
        failed: 0 
      };
    }
    
    semesterStatsMap[sem].students.add(regNo);
    
    if (!semesterStatsMap[sem].studentRecords.has(regNo)) {
      semesterStatsMap[sem].studentRecords.set(regNo, { passed: 0, failed: 0 });
    }
    
    if (isPass) {
      semesterStatsMap[sem].studentRecords.get(regNo).passed++;
    } else {
      semesterStatsMap[sem].studentRecords.get(regNo).failed++;
    }
  });
  
  const semesterStats = Object.entries(semesterStatsMap).map(([sem, stats]) => {
    // Count unique students
    const totalStudents = stats.students.size;
    
    // Count students who have at least one pass
    let passedStudents = 0;
    let failedStudents = 0;
    
    stats.studentRecords.forEach((recordStats) => {
      if (recordStats.passed > 0) {
        passedStudents++;
      } else if (recordStats.failed > 0 && recordStats.passed === 0) {
        failedStudents++;
      }
    });
    
    return {
      semester: sem,
      total: totalStudents, // Number of unique students
      passed: passedStudents,
      failed: failedStudents,
      passRate: totalStudents > 0 ? ((passedStudents / totalStudents) * 100).toFixed(2) : '0.00'
    };
  });

  // OPTIMIZED: Calculate batch stats using cached parsed data
  const batchStatsMap = {};
  filteredData.forEach(record => {
    if (!record.Reg_No) return;
    
    // Use cached parsed data instead of re-parsing
    const parsed = parsedRegCache.get(record.Reg_No);
    if (!parsed || !parsed.isValid || !parsed.isDiploma) return;
    
    const batch = parsed.year || 'Unknown';
    const regNo = String(record.Reg_No).trim();
    const grade = record.Grade || '';
    const isPass = !['F', 'S', 'M', 'I', 'R'].includes(grade);
    
    if (!batchStatsMap[batch]) {
      batchStatsMap[batch] = { 
        students: new Set(),
        studentRecords: new Map(),
        total: 0, 
        passed: 0, 
        failed: 0 
      };
    }
    
    batchStatsMap[batch].students.add(regNo);
    
    if (!batchStatsMap[batch].studentRecords.has(regNo)) {
      batchStatsMap[batch].studentRecords.set(regNo, { passed: 0, failed: 0 });
    }
    
    if (isPass) {
      batchStatsMap[batch].studentRecords.get(regNo).passed++;
    } else {
      batchStatsMap[batch].studentRecords.get(regNo).failed++;
    }
  });
  
  const batchStats = Object.entries(batchStatsMap).map(([batch, stats]) => {
    // Count unique students
    const totalStudents = stats.students.size;
    
    // Count students who have at least one pass
    let passedStudents = 0;
    let failedStudents = 0;
    
    stats.studentRecords.forEach((recordStats) => {
      if (recordStats.passed > 0) {
        passedStudents++;
      } else if (recordStats.failed > 0 && recordStats.passed === 0) {
        failedStudents++;
      }
    });
    
    return {
      batch,
      total: totalStudents, // Number of unique students
      passed: passedStudents,
      failed: failedStudents,
      passRate: totalStudents > 0 ? ((passedStudents / totalStudents) * 100).toFixed(2) : '0.00'
    };
  });

  // Data source stats (CUTM1 vs RegistrationData)
  const dataSourceStats = [
    {
      name: 'CUTM Result Data',
      count: filteredData.length,
      percentage: 100
    }
  ];

  // Calculate performance metrics (for Passing Analysis section)
  const performanceMetrics = {
    totalRecords: filteredData.length,
    passedRecords: passCount,
    failedRecords: failCount,
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

  // OPTIMIZED: Calculate top performing students
  const studentPerformanceMap = {};
  filteredData.forEach(record => {
    if (!record.Reg_No) return;
    const regNo = String(record.Reg_No).trim();
    const grade = (record.Grade || '').toUpperCase();
    const isPass = !['F', 'S', 'M', 'I', 'R'].includes(grade);
    
    if (!studentPerformanceMap[regNo]) {
      // Parse branch from registration number (Diploma) to standardized short code
      let branch = null;
      if (regNo.length === 12) {
        const branchCode = regNo.slice(5, 8); // 3 digits from index 5-7
        const diplomaBranchMap = {
          '711': 'Electrical Engineering',
          '712': 'Mechanical Engineering',
          '713': 'Civil Engineering',
          '714': 'Computer Science Engineering',
          '715': 'Automobile Engineering',
          '716': 'Mining Engineering'
        };
        // Short codes used in filters (align with UI options)
        const diplomaBranchShort = {
          '711': 'EE',
          '712': 'ME',
          '713': 'CIVIL',
          '714': 'CSE',
          '715': 'AUTOMOBILE',
          '716': 'MINING'
        };
        branch = diplomaBranchShort[branchCode] || diplomaBranchMap[branchCode] || null;
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
  // This is calculated on-demand when filters are applied, but we can provide empty array for structure
  const performanceMetricsByCombination = [];

  const result = {
    totalStudents,
    totalSubjects,
    totalRecords: filteredData.length,
    passRate: passRate.toFixed(2),
    gradeDistribution,
    passCount,
    failCount,
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
  
  console.log(`[SOVET Analytics] Returning result:`, {
    totalStudents: result.totalStudents,
    totalSubjects: result.totalSubjects,
    totalRecords: result.totalRecords,
    departmentStatsCount: result.departmentStats.length,
    semesterStatsCount: result.semesterStats.length,
    batchStatsCount: result.batchStats.length
  });
  
  return result;
}

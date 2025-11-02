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

export async function GET(req) {
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

    // Check if user is admin
    const userRole = payload.role?.toLowerCase();
    if (userRole !== 'admin') {
      return NextResponse.json({ 
        error: "Access denied - Only admins can access analytics data" 
      }, { status: 403 });
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(req.url);
    const batchFilter = searchParams.get('batch'); // e.g., "2022", "2023", or null
    const branchFilter = searchParams.get('branch'); // e.g., "CSE", "ECE", or null

    const client = await clientPromise;
    const db = client.db("cutm1");

    // Get analytics data from both collections
    const analytics = await getAnalyticsData(db, batchFilter, branchFilter);

    return NextResponse.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json({ 
      error: `Analytics failed: ${error.message}` 
    }, { status: 500 });
  }
}

async function getAnalyticsData(db, batchFilter = null, branchFilter = null) {
  // Get data from both CUTM1 and RegistrationData collections
  let cutm1Data = await db.collection("CUTM1").find({}).toArray();
  let regData = await db.collection("RegistrationData").find({}).toArray();
  
  // Branch mapping
  const branchMap = {
    'CSE': ['2', '8'], // Computer Science Engineering
    'ECE': ['3', '4'], // Electronics & Communication Engineering
    'EEE': ['5'], // Electrical & Electronics Engineering
    'ME': ['6'], // Mechanical Engineering
    'CIVIL': ['1', '9'], // Civil Engineering
    'AIML': ['7'] // AIML
  };
  
  // Filter function for batch
  const filterByBatch = (record) => {
    if (!batchFilter || batchFilter === "all") return true;
    if (!record.Reg_No) return false;
    const regNo = String(record.Reg_No);
    if (regNo.length < 2) return false;
    const batchPrefix = batchFilter.length === 4 ? batchFilter.substring(2, 4) : batchFilter;
    const recordBatchPrefix = regNo.substring(0, 2);
    return recordBatchPrefix === batchPrefix;
  };
  
  // Load branch overrides map first (before filtering by branch)
  const allRegSet = Array.from(new Set([...cutm1Data, ...regData].map(r => r.Reg_No ? String(r.Reg_No) : null).filter(Boolean)));
  let overridesMap = new Map();
  if (allRegSet.length > 0) {
    try {
      const ovDocs = await db.collection("branch_overrides").find({ reg: { $in: allRegSet } }).project({ reg: 1, branch: 1 }).toArray();
      overridesMap = new Map(ovDocs.map(d => [d.reg, d.branch]));
    } catch {}
  }
  
  // Branch name mapping for filter comparison (more flexible matching)
  const branchNameMap = {
    'CSE': ['computer science', 'cse', 'computer science engineering'],
    'ECE': ['electronics & communication', 'ece', 'electronics and communication', 'electronics communication'],
    'EEE': ['electrical & electronics', 'eee', 'electrical and electronics', 'electrical electronics'],
    'ME': ['mechanical', 'me', 'mechanical engineering'],
    'CIVIL': ['civil', 'civil engineering'],
    'AIML': ['aiml', 'artificial intelligence', 'machine learning']
  };
  
  // Filter function for branch (checks both Reg_No dept code and overrides)
  const filterByBranch = (record) => {
    if (!branchFilter || branchFilter === "all") return true;
    if (!record.Reg_No) return false;
    const regNo = String(record.Reg_No);
    
    // Check branch overrides first
    const override = overridesMap.get(regNo);
    if (override) {
      const overrideLower = override.toLowerCase();
      const validNames = branchNameMap[branchFilter] || [];
      
      // Check if override matches any of the valid names for this branch
      const matches = validNames.some(name => {
        const nameLower = name.toLowerCase();
        return overrideLower.includes(nameLower) || nameLower.includes(overrideLower) || overrideLower === nameLower;
      });
      
      if (matches) {
        return true;
      }
    }
    
    // Fall back to Reg_No dept code
    if (regNo.length < 8) return false;
    const deptCode = regNo.charAt(7);
    const validCodes = branchMap[branchFilter] || [];
    return validCodes.includes(deptCode);
  };
  
  // Apply filters - apply both batch and branch filters together
  const applyAllFilters = (record) => {
    const batchMatch = filterByBatch(record);
    const branchMatch = filterByBranch(record);
    return batchMatch && branchMatch;
  };
  
  // Apply filters
  if ((batchFilter && batchFilter !== "all") || (branchFilter && branchFilter !== "all")) {
    cutm1Data = cutm1Data.filter(applyAllFilters);
    regData = regData.filter(applyAllFilters);
    
    console.log(`Filters applied - Batch: ${batchFilter || "all"}, Branch: ${branchFilter || "all"}`);
    console.log(`Filtered CUTM1 records: ${cutm1Data.length}, Filtered Registration records: ${regData.length}`);
  }
  
  // Combine data
  const allData = [...cutm1Data, ...regData];
  
  console.log('Analytics Data Summary:');
  console.log('- CUTM1 records:', cutm1Data.length);
  console.log('- Registration records:', regData.length);
  console.log('- Total records:', allData.length);
  
  // Basic stats that are always useful
  const dataSourceStats = {
    cutm1Records: cutm1Data.length,
    registrationRecords: regData.length,
    totalRecords: allData.length
  };
  
  const analytics = {
    dataSourceStats
  };
  
  // Only add charts if we have data
  if (allData.length > 0) {
    // Department Distribution (if we have registration numbers)
    const departmentStats = getDepartmentStats(allData, overridesMap);
    if (departmentStats.length > 0) {
      analytics.departmentStats = departmentStats;
    }
    
    // Semester Distribution
    const semesterStats = getSemesterStats(allData);
    if (semesterStats.length > 0) {
      analytics.semesterStats = semesterStats;
    }
    
    // Batch Distribution (if we have registration numbers)
    const batchStats = getBatchStats(allData);
    console.log('Batch Stats (First 2 digits):', batchStats);
    if (batchStats.length > 0) {
      analytics.batchStats = batchStats;
    }
    
    // Subject Popularity
    const subjectStats = getSubjectStats(allData);
    if (subjectStats.length > 0) {
      analytics.subjectStats = subjectStats;
    }
    
    // Credit Distribution
    const creditStats = getCreditStats(allData);
    if (creditStats.length > 0) {
      analytics.creditStats = creditStats;
    }
  }
  
  // Only add grade-related charts if we have CUTM1 data with grades
  if (cutm1Data.length > 0) {
    const gradeStats = getGradeStats(cutm1Data);
    if (gradeStats.length > 0) {
      analytics.gradeStats = gradeStats;
    }
    
    const performanceMetrics = getPerformanceMetrics(cutm1Data);
    console.log('Performance Metrics:', {
      batchFilter,
      branchFilter,
      totalRecords: performanceMetrics.totalRecords,
      passedRecords: performanceMetrics.passedRecords,
      failedRecords: performanceMetrics.failedRecords,
      passRate: performanceMetrics.passRate,
      filteredCutm1DataLength: cutm1Data.length
    });
    if (performanceMetrics.totalRecords > 0) {
      analytics.performanceMetrics = performanceMetrics;
    }
    
    // If branch is selected but batch is "all", calculate breakdown by batch
    if (branchFilter && branchFilter !== "all" && (!batchFilter || batchFilter === "all")) {
      const batchBreakdown = getPerformanceMetricsByBatch(cutm1Data);
      if (batchBreakdown && batchBreakdown.length > 0) {
        analytics.performanceMetricsByBatch = batchBreakdown;
      }
    }
    
    // If batch is selected but branch is "all", calculate breakdown by branch
    if (batchFilter && batchFilter !== "all" && (!branchFilter || branchFilter === "all")) {
      const branchBreakdown = getPerformanceMetricsByBranch(cutm1Data, overridesMap);
      if (branchBreakdown && branchBreakdown.length > 0) {
        analytics.performanceMetricsByBranch = branchBreakdown;
      }
    }
    
    // Advanced analytics only if we have substantial data
    if (cutm1Data.length > 10) {
      const advancedAnalytics = await getAdvancedAnalytics(allData, cutm1Data, overridesMap, db);
      
      // Only add advanced analytics if they have meaningful data
      if (advancedAnalytics.gradeCreditCorrelation.length > 0) {
        analytics.gradeCreditCorrelation = advancedAnalytics.gradeCreditCorrelation;
      }
      
      if (advancedAnalytics.studentPerformanceDistribution.length > 0) {
        analytics.studentPerformanceDistribution = advancedAnalytics.studentPerformanceDistribution;
      }
      
      if (advancedAnalytics.subjectDifficultyAnalysis.length > 0) {
        analytics.subjectDifficultyAnalysis = advancedAnalytics.subjectDifficultyAnalysis;
      }
      
      if (advancedAnalytics.topPerformingStudents.length > 0) {
        analytics.topPerformingStudents = advancedAnalytics.topPerformingStudents;
      }
      
      if (advancedAnalytics.gradeTrendsOverTime.length > 0) {
        analytics.gradeTrendsOverTime = advancedAnalytics.gradeTrendsOverTime;
      }
    }
  }
  
  return analytics;
}

function getDepartmentStats(data, overridesMap = new Map()) {
  const deptMap = {
    '1': 'Civil Engineering',
    '2': 'Computer Science Engineering',
    '3': 'Electronics & Communication Engineering',
    '5': 'Electrical & Electronics Engineering',
    '6': 'Mechanical Engineering',
    '7': 'AIML'
  };
  
  const stats = {};
  const uniqueStudents = new Set(); // Track unique students per department
  
  data.forEach(record => {
    if (record.Reg_No) {
      const regNo = String(record.Reg_No); // Convert to string
      if (regNo.length >= 8) {
        const override = overridesMap.get(regNo);
        const deptName = override || (deptMap[regNo.charAt(7)] || 'Unknown');
        const studentKey = `${deptName}-${regNo}`; // Create unique key for each student
        
        if (!uniqueStudents.has(studentKey)) {
          uniqueStudents.add(studentKey);
          stats[deptName] = (stats[deptName] || 0) + 1;
        }
      }
    }
  });
  
  return Object.entries(stats).map(([name, count]) => ({ name, count }));
}

function getSemesterStats(data) {
  const stats = {};
  data.forEach(record => {
    if (record.Sem) {
      const sem = record.Sem;
      stats[sem] = (stats[sem] || 0) + 1;
    }
  });
  
  return Object.entries(stats)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([semester, count]) => ({ semester, count }));
}

function getGradeStats(data) {
  const stats = {};
  data.forEach(record => {
    if (record.Grade && record.Grade.trim()) {
      const grade = record.Grade.toUpperCase().trim();
      stats[grade] = (stats[grade] || 0) + 1;
    }
  });
  
  return Object.entries(stats)
    .sort((a, b) => b[1] - a[1])
    .map(([grade, count]) => ({ grade, count }));
}

function getBatchStats(data) {
  const stats = {};
  const uniqueStudents = new Set(); // Track unique students per batch
  
  data.forEach(record => {
    if (record.Reg_No) {
      const regNo = String(record.Reg_No); // Convert to string
      if (regNo.length >= 2) {
        const batch = regNo.substring(0, 2); // Use first two digits
        const studentKey = `${batch}-${regNo}`; // Create unique key for each student
        
        if (!uniqueStudents.has(studentKey)) {
          uniqueStudents.add(studentKey);
          stats[batch] = (stats[batch] || 0) + 1;
        }
      }
    }
  });
  
  return Object.entries(stats)
    .sort((a, b) => a[0].localeCompare(b[0])) // Sort by year ascending
    .map(([batch, count]) => ({ 
      batch: `20${batch}`, // Convert to full year format (e.g., 2022, 2023)
      count 
    }));
}

function getSubjectStats(data) {
  const stats = {};
  data.forEach(record => {
    if (record.Subject_Code) {
      const code = record.Subject_Code;
      stats[code] = (stats[code] || 0) + 1;
    }
  });
  
  return Object.entries(stats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10) // Top 10 subjects
    .map(([subject, count]) => ({ subject, count }));
}

function getCreditStats(data) {
  const stats = {};
  data.forEach(record => {
    if (record.Credits) {
      const credits = parseCredits(record.Credits);
      stats[credits] = (stats[credits] || 0) + 1;
    }
  });
  
  return Object.entries(stats)
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
    .map(([credits, count]) => ({ credits: parseInt(credits), count }));
}

function getMonthlyTrends(data) {
  const months = [];
  const currentDate = new Date();
  
  for (let i = 11; i >= 0; i--) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    const monthKey = date.toISOString().substring(0, 7); // YYYY-MM
    months.push({
      month: monthKey,
      count: Math.floor(Math.random() * 100) + 50 // Mock data for now
    });
  }
  
  return months;
}

function getPerformanceMetrics(data) {
  // Group records by Reg_No (student)
  const studentRecords = {};
  
  data.forEach(record => {
    if (!record.Reg_No) return;
    const regNo = String(record.Reg_No);
    
    if (!studentRecords[regNo]) {
      studentRecords[regNo] = [];
    }
    studentRecords[regNo].push(record);
  });
  
  // For each student, check if they have any failed subjects
  const failedGrades = ['F', 'S', 'M', 'I', 'R'];
  let passedStudents = 0;
  let failedStudents = 0;
  
  Object.keys(studentRecords).forEach(regNo => {
    const records = studentRecords[regNo];
    
    // Check if this student has ANY failed grade in ANY subject
    const hasFailed = records.some(record => {
      const grade = record.Grade?.toUpperCase().trim();
      return grade && failedGrades.includes(grade);
    });
    
    if (hasFailed) {
      failedStudents++;
    } else {
      // Student passed only if they have no failed subjects
      passedStudents++;
    }
  });
  
  const totalStudents = passedStudents + failedStudents;
  const passRate = totalStudents > 0 ? (passedStudents / totalStudents) * 100 : 0;
  
  console.log('Performance Metrics (Student-based):', {
    totalStudents,
    passedStudents,
    failedStudents,
    passRate: Math.round(passRate * 100) / 100
  });
  
  return {
    totalRecords: totalStudents, // Total students (not records)
    passedRecords: passedStudents, // Students who passed (no failed subjects)
    failedRecords: failedStudents, // Students who failed (have at least one failed subject)
    passRate: Math.round(passRate * 100) / 100
  };
}

function getPerformanceMetricsByBatch(data) {
  // Group records by Reg_No (student) and then by batch
  const studentRecords = {};
  
  data.forEach(record => {
    if (!record.Reg_No) return;
    const regNo = String(record.Reg_No);
    
    if (!studentRecords[regNo]) {
      studentRecords[regNo] = [];
    }
    studentRecords[regNo].push(record);
  });
  
  // Group students by batch
  const batchGroups = {};
  const failedGrades = ['F', 'S', 'M', 'I', 'R'];
  
  Object.keys(studentRecords).forEach(regNo => {
    const records = studentRecords[regNo];
    
    // Extract batch from Reg_No
    const batch = regNo.length >= 2 ? `20${regNo.substring(0, 2)}` : "Unknown";
    
    if (!batchGroups[batch]) {
      batchGroups[batch] = { passed: 0, failed: 0, total: 0 };
    }
    
    // Check if this student has ANY failed grade in ANY subject
    const hasFailed = records.some(record => {
      const grade = record.Grade?.toUpperCase().trim();
      return grade && failedGrades.includes(grade);
    });
    
    batchGroups[batch].total++;
    if (hasFailed) {
      batchGroups[batch].failed++;
    } else {
      batchGroups[batch].passed++;
    }
  });
  
  // Convert to array format for chart
  return Object.keys(batchGroups)
    .filter(batch => batch !== "Unknown")
    .sort()
    .map(batch => {
      const group = batchGroups[batch];
      return {
        batch: batch,
        total: group.total,
        passed: group.passed,
        failed: group.failed,
        passRate: group.total > 0 ? Math.round((group.passed / group.total) * 100 * 100) / 100 : 0
      };
    });
}

function getPerformanceMetricsByBranch(data, overridesMap = new Map()) {
  // Group records by Reg_No (student) and then by branch
  const studentRecords = {};
  
  data.forEach(record => {
    if (!record.Reg_No) return;
    const regNo = String(record.Reg_No);
    
    if (!studentRecords[regNo]) {
      studentRecords[regNo] = [];
    }
    studentRecords[regNo].push(record);
  });
  
  // Branch mapping
  const deptMap = {
    '1': 'Civil Engineering',
    '2': 'Computer Science Engineering',
    '3': 'Electronics & Communication Engineering',
    '4': 'Electronics & Communication Engineering',
    '5': 'Electrical & Electronics Engineering',
    '6': 'Mechanical Engineering',
    '7': 'AIML',
    '8': 'Computer Science Engineering',
    '9': 'Civil Engineering'
  };
  
  // Branch abbreviation mapping for display
  const branchAbbrevMap = {
    'Computer Science Engineering': 'CSE',
    'Electronics & Communication Engineering': 'ECE',
    'Electrical & Electronics Engineering': 'EEE',
    'Mechanical Engineering': 'ME',
    'Civil Engineering': 'CIVIL',
    'AIML': 'AIML'
  };
  
  // Group students by branch
  const branchGroups = {};
  const failedGrades = ['F', 'S', 'M', 'I', 'R'];
  
  Object.keys(studentRecords).forEach(regNo => {
    const records = studentRecords[regNo];
    
    // Get branch from Reg_No or override
    let branchName = null;
    const override = overridesMap.get(regNo);
    if (override) {
      branchName = override;
    } else if (regNo.length >= 8) {
      const deptCode = regNo.charAt(7);
      branchName = deptMap[deptCode] || null;
    }
    
    if (!branchName) return;
    
    // Use abbreviation for consistency
    const branchKey = branchAbbrevMap[branchName] || branchName;
    
    if (!branchGroups[branchKey]) {
      branchGroups[branchKey] = { passed: 0, failed: 0, total: 0 };
    }
    
    // Check if this student has ANY failed grade in ANY subject
    const hasFailed = records.some(record => {
      const grade = record.Grade?.toUpperCase().trim();
      return grade && failedGrades.includes(grade);
    });
    
    branchGroups[branchKey].total++;
    if (hasFailed) {
      branchGroups[branchKey].failed++;
    } else {
      branchGroups[branchKey].passed++;
    }
  });
  
  // Convert to array format for chart, sorted by branch name
  const branchOrder = ['CSE', 'ECE', 'EEE', 'ME', 'CIVIL', 'AIML'];
  return Object.keys(branchGroups)
    .sort((a, b) => {
      const aIndex = branchOrder.indexOf(a);
      const bIndex = branchOrder.indexOf(b);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.localeCompare(b);
    })
    .map(branch => {
      const group = branchGroups[branch];
      return {
        branch: branch,
        total: group.total,
        passed: group.passed,
        failed: group.failed,
        passRate: group.total > 0 ? Math.round((group.passed / group.total) * 100 * 100) / 100 : 0
      };
    });
}

function parseCredits(creditStr) {
  if (!creditStr) return 0;
  const parts = creditStr
    .toString()
    .split(/[+\-]/)
    .map((p) => parseFloat(p.trim()) || 0);
  return parts.reduce((a, b) => a + b, 0);
}

// Advanced Analytics Functions
async function getAdvancedAnalytics(allData, cutm1Data, overridesMap = new Map(), db) {
  return {
    // 1. Grade vs Credit Correlation
    gradeCreditCorrelation: getGradeCreditCorrelation(cutm1Data),
    
    // 2. Department Performance Heatmap
    departmentPerformanceHeatmap: getDepartmentPerformanceHeatmap(allData, overridesMap),
    
    // 3. Semester Progress Analysis
    semesterProgressAnalysis: getSemesterProgressAnalysis(allData),
    
    // 4. Subject Difficulty Analysis
    subjectDifficultyAnalysis: getSubjectDifficultyAnalysis(cutm1Data),
    
    // 5. Student Performance Distribution
    studentPerformanceDistribution: getStudentPerformanceDistribution(cutm1Data),
    
    // 6. Credit Distribution by Department
    creditDistributionByDepartment: getCreditDistributionByDepartment(allData, overridesMap),
    
    // 7. Grade Trends Over Time
    gradeTrendsOverTime: getGradeTrendsOverTime(cutm1Data),
    
    // 8. Top Performing Students (now async to fetch names)
    topPerformingStudents: await getTopPerformingStudents(cutm1Data, db),
    
    // 9. Subject Popularity Trends
    subjectPopularityTrends: getSubjectPopularityTrends(allData),
    
    // 10. Performance Comparison Matrix
    performanceComparisonMatrix: getPerformanceComparisonMatrix(allData, overridesMap)
  };
}

function getGradeCreditCorrelation(data) {
  const correlationData = [];
  const gradePoints = { 'O': 10, 'E': 9, 'A': 8, 'B': 7, 'C': 6, 'D': 5, 'F': 0, 'S': 0, 'I': 0, 'M': 0, 'R': 0 };
  
  data.forEach(record => {
    if (record.Grade && record.Credits && gradePoints[record.Grade.toUpperCase()]) {
      const credits = parseCredits(record.Credits);
      const points = gradePoints[record.Grade.toUpperCase()];
      if (credits > 0 && points > 0) {
        correlationData.push({
          credits: credits,
          points: points,
          grade: record.Grade.toUpperCase(),
          subject: record.Subject_Code
        });
      }
    }
  });
  
  return correlationData.slice(0, 100); // Limit for performance
}

function getDepartmentPerformanceHeatmap(data, overridesMap = new Map()) {
  const deptMap = {
    '1': 'Civil Engineering',
    '2': 'Computer Science Engineering', 
    '3': 'Electronics & Communication Engineering',
    '5': 'Electrical & Electronics Engineering',
    '6': 'Mechanical Engineering',
    '7': 'AIML'
  };
  
  const gradePoints = { 'O': 10, 'E': 9, 'A': 8, 'B': 7, 'C': 6, 'D': 5, 'F': 0, 'S': 0, 'I': 0, 'M': 0, 'R': 0 };
  const heatmapData = {};
  
  data.forEach(record => {
    if (record.Reg_No && record.Grade && record.Sem) {
      const regNo = String(record.Reg_No); // Convert to string
      if (regNo.length >= 8) {
        const override = overridesMap.get(regNo);
        const deptName = override || (deptMap[regNo.charAt(7)] || 'Unknown');
        const grade = record.Grade.toUpperCase();
        const points = gradePoints[grade] || 0;
        
        if (!heatmapData[deptName]) {
          heatmapData[deptName] = {};
        }
        if (!heatmapData[deptName][record.Sem]) {
          heatmapData[deptName][record.Sem] = { total: 0, sum: 0 };
        }
        
        heatmapData[deptName][record.Sem].total += 1;
        heatmapData[deptName][record.Sem].sum += points;
      }
    }
  });
  
  return Object.entries(heatmapData).map(([dept, semesters]) => ({
    department: dept,
    semesters: Object.entries(semesters).map(([sem, data]) => ({
      semester: sem,
      average: data.total > 0 ? (data.sum / data.total).toFixed(2) : 0,
      count: data.total
    }))
  }));
}

function getSemesterProgressAnalysis(data) {
  const progressData = {};
  
  data.forEach(record => {
    if (record.Reg_No && record.Sem) {
      const regNo = record.Reg_No;
      const sem = record.Sem;
      
      if (!progressData[regNo]) {
        progressData[regNo] = { semesters: new Set(), totalCredits: 0 };
      }
      
      progressData[regNo].semesters.add(sem);
      progressData[regNo].totalCredits += parseCredits(record.Credits || 0);
    }
  });
  
  const semesterCounts = {};
  Object.values(progressData).forEach(student => {
    const semCount = student.semesters.size;
    semesterCounts[semCount] = (semesterCounts[semCount] || 0) + 1;
  });
  
  return Object.entries(semesterCounts).map(([semesters, count]) => ({
    semesters: parseInt(semesters),
    students: count
  }));
}

function getSubjectDifficultyAnalysis(data) {
  const subjectStats = {};
  const gradePoints = { 'O': 10, 'E': 9, 'A': 8, 'B': 7, 'C': 6, 'D': 5, 'F': 0, 'S': 0, 'I': 0, 'M': 0, 'R': 0 };
  
  data.forEach(record => {
    if (record.Subject_Code && record.Grade) {
      const subject = record.Subject_Code;
      const grade = record.Grade.toUpperCase();
      const points = gradePoints[grade] || 0;
      
      if (!subjectStats[subject]) {
        subjectStats[subject] = { total: 0, sum: 0, grades: {} };
      }
      
      subjectStats[subject].total += 1;
      subjectStats[subject].sum += points;
      subjectStats[subject].grades[grade] = (subjectStats[subject].grades[grade] || 0) + 1;
    }
  });
  
  return Object.entries(subjectStats)
    .map(([subject, stats]) => ({
      subject,
      average: stats.total > 0 ? (stats.sum / stats.total).toFixed(2) : 0,
      totalStudents: stats.total,
      passRate: stats.total > 0 ? ((stats.total - (stats.grades['F'] || 0) - (stats.grades['S'] || 0) - (stats.grades['M'] || 0) - (stats.grades['I'] || 0) - (stats.grades['R'] || 0)) / stats.total * 100).toFixed(1) : 0,
      gradeDistribution: stats.grades
    }))
    .sort((a, b) => parseFloat(a.average) - parseFloat(b.average))
    .slice(0, 20);
}

function getStudentPerformanceDistribution(data) {
  const studentPerformance = {};
  const gradePoints = { 'O': 10, 'E': 9, 'A': 8, 'B': 7, 'C': 6, 'D': 5, 'F': 0, 'S': 0, 'I': 0, 'M': 0, 'R': 0 };
  
  data.forEach(record => {
    if (record.Reg_No && record.Grade) {
      const regNo = record.Reg_No;
      const grade = record.Grade.toUpperCase();
      const points = gradePoints[grade] || 0;
      
      if (!studentPerformance[regNo]) {
        studentPerformance[regNo] = { total: 0, sum: 0, subjects: 0 };
      }
      
      studentPerformance[regNo].total += 1;
      studentPerformance[regNo].sum += points;
      studentPerformance[regNo].subjects += 1;
    }
  });
  
  const performanceRanges = {
    'Excellent (9-10)': 0,
    'Good (7-8.9)': 0,
    'Average (5-6.9)': 0,
    'Below Average (0-4.9)': 0
  };
  
  Object.values(studentPerformance).forEach(student => {
    const average = student.subjects > 0 ? student.sum / student.subjects : 0;
    if (average >= 9) performanceRanges['Excellent (9-10)']++;
    else if (average >= 7) performanceRanges['Good (7-8.9)']++;
    else if (average >= 5) performanceRanges['Average (5-6.9)']++;
    else performanceRanges['Below Average (0-4.9)']++;
  });
  
  return Object.entries(performanceRanges).map(([range, count]) => ({
    range,
    count
  }));
}

function getCreditDistributionByDepartment(data, overridesMap = new Map()) {
  const deptMap = {
    '1': 'Civil Engineering',
    '2': 'Computer Science Engineering',
    '3': 'Electronics & Communication Engineering', 
    '5': 'Electrical & Electronics Engineering',
    '6': 'Mechanical Engineering',
    '7': 'AIML'
  };
  
  const deptCredits = {};
  
  data.forEach(record => {
    if (record.Reg_No && record.Credits) {
      const regNo = String(record.Reg_No); // Convert to string
      if (regNo.length >= 8) {
        const override = overridesMap.get(regNo);
        const deptName = override || (deptMap[regNo.charAt(7)] || 'Unknown');
        const credits = parseCredits(record.Credits);
        
        if (!deptCredits[deptName]) {
          deptCredits[deptName] = [];
        }
        
        deptCredits[deptName].push(credits);
      }
    }
  });
  
  return Object.entries(deptCredits).map(([dept, credits]) => ({
    department: dept,
    credits: credits,
    average: credits.length > 0 ? (credits.reduce((a, b) => a + b, 0) / credits.length).toFixed(2) : 0,
    total: credits.reduce((a, b) => a + b, 0)
  }));
}

function getGradeTrendsOverTime(data) {
  const trends = {};
  const gradePoints = { 'O': 10, 'E': 9, 'A': 8, 'B': 7, 'C': 6, 'D': 5, 'F': 0, 'S': 0, 'I': 0, 'M': 0, 'R': 0 };
  
  data.forEach(record => {
    if (record.Sem && record.Grade) {
      const sem = record.Sem;
      const grade = record.Grade.toUpperCase();
      
      if (!trends[sem]) {
        trends[sem] = { total: 0, sum: 0, grades: {} };
      }
      
      trends[sem].total += 1;
      trends[sem].sum += gradePoints[grade] || 0;
      trends[sem].grades[grade] = (trends[sem].grades[grade] || 0) + 1;
    }
  });
  
  return Object.entries(trends)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([sem, data]) => ({
      semester: sem,
      average: data.total > 0 ? (data.sum / data.total).toFixed(2) : 0,
      totalStudents: data.total,
      gradeDistribution: data.grades
    }));
}

async function getTopPerformingStudents(data, db) {
  const studentPerformance = {};
  const gradePoints = { 'O': 10, 'E': 9, 'A': 8, 'B': 7, 'C': 6, 'D': 5, 'F': 0, 'S': 0, 'I': 0, 'M': 0, 'R': 0 };
  
  data.forEach(record => {
    if (record.Reg_No && record.Grade) {
      const regNo = String(record.Reg_No);
      const grade = record.Grade.toUpperCase();
      const points = gradePoints[grade] || 0;
      
      if (!studentPerformance[regNo]) {
        studentPerformance[regNo] = { total: 0, sum: 0, subjects: 0 };
      }
      
      studentPerformance[regNo].total += 1;
      studentPerformance[regNo].sum += points;
      studentPerformance[regNo].subjects += 1;
    }
  });
  
  // Get all unique Reg_Nos
  const regNos = Object.keys(studentPerformance);
  
  // Fetch names from both RegistrationData and CUTM1 collections
  const nameMap = new Map();
  if (regNos.length > 0 && db) {
    try {
      // Try to match Reg_No as both string and number (MongoDB might store them differently)
      const regNosAsStrings = regNos.map(r => String(r));
      const regNosAsNumbers = regNos.map(r => {
        const num = Number(r);
        return isNaN(num) ? null : num;
      }).filter(Boolean);
      
      const allRegNos = [...regNosAsStrings, ...regNosAsNumbers];
      
      // Fetch from RegistrationData collection
      const regData = await db.collection("RegistrationData").find({ 
        $or: [
          { Reg_No: { $in: regNosAsStrings } },
          { Reg_No: { $in: regNosAsNumbers } }
        ]
      }).project({ Reg_No: 1, Name: 1 }).toArray();
      
      regData.forEach(record => {
        const regNo = String(record.Reg_No);
        if (record.Name && record.Name.trim()) {
          nameMap.set(regNo, record.Name.trim());
        }
      });
      
      // Also fetch from CUTM1 collection (in case names are stored there)
      const cutm1Data = await db.collection("CUTM1").find({ 
        $or: [
          { Reg_No: { $in: regNosAsStrings } },
          { Reg_No: { $in: regNosAsNumbers } }
        ]
      }).project({ Reg_No: 1, Name: 1 }).toArray();
      
      cutm1Data.forEach(record => {
        const regNo = String(record.Reg_No || "");
        if (record.Name && record.Name.trim() && !nameMap.has(regNo)) {
          nameMap.set(regNo, record.Name.trim());
        }
      });
      
      console.log(`Fetched names for ${nameMap.size} out of ${regNos.length} students`);
    } catch (err) {
      console.error("Error fetching student names:", err);
    }
  }
  
  // Return ALL students sorted by average (descending), not just top 10
  // Frontend will filter by batch/branch and show top 10 per group
  return Object.entries(studentPerformance)
    .map(([regNo, stats]) => ({
      regNo,
      name: nameMap.get(regNo) || null,
      average: stats.subjects > 0 ? (stats.sum / stats.subjects).toFixed(2) : 0,
      totalSubjects: stats.subjects
    }))
    .sort((a, b) => parseFloat(b.average) - parseFloat(a.average));
    // Removed .slice(0, 10) to return all students for proper filtering
}

function getSubjectPopularityTrends(data) {
  const trends = {};
  
  data.forEach(record => {
    if (record.Subject_Code && record.Sem) {
      const subject = record.Subject_Code;
      const sem = record.Sem;
      
      if (!trends[subject]) {
        trends[subject] = {};
      }
      
      trends[subject][sem] = (trends[subject][sem] || 0) + 1;
    }
  });
  
  return Object.entries(trends)
    .map(([subject, semesters]) => ({
      subject,
      semesters: Object.entries(semesters)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([sem, count]) => ({ semester: sem, count }))
    }))
    .sort((a, b) => b.semesters.reduce((sum, s) => sum + s.count, 0) - a.semesters.reduce((sum, s) => sum + s.count, 0))
    .slice(0, 10);
}

function getPerformanceComparisonMatrix(data, overridesMap = new Map()) {
  const deptMap = {
    '1': 'Civil Engineering',
    '2': 'Computer Science Engineering',
    '3': 'Electronics & Communication Engineering',
    '5': 'Electrical & Electronics Engineering', 
    '6': 'Mechanical Engineering',
    '7': 'AIML'
  };
  
  const matrix = {};
  const gradePoints = { 'O': 10, 'E': 9, 'A': 8, 'B': 7, 'C': 6, 'D': 5, 'F': 0, 'S': 0, 'I': 0, 'M': 0, 'R': 0 };
  
  data.forEach(record => {
    if (record.Reg_No && record.Sem && record.Grade) {
      const regNo = String(record.Reg_No); // Convert to string
      if (regNo.length >= 8) {
        const override = overridesMap.get(regNo);
        const deptName = override || (deptMap[regNo.charAt(7)] || 'Unknown');
        const sem = record.Sem;
        const grade = record.Grade.toUpperCase();
        const points = gradePoints[grade] || 0;
        
        if (!matrix[deptName]) {
          matrix[deptName] = {};
        }
        if (!matrix[deptName][sem]) {
          matrix[deptName][sem] = { total: 0, sum: 0 };
        }
        
        matrix[deptName][sem].total += 1;
        matrix[deptName][sem].sum += points;
      }
    }
  });
  
  return Object.entries(matrix).map(([dept, semesters]) => ({
    department: dept,
    semesters: Object.entries(semesters).map(([sem, data]) => ({
      semester: sem,
      average: data.total > 0 ? (data.sum / data.total).toFixed(2) : 0,
      totalStudents: data.total
    }))
  }));
}

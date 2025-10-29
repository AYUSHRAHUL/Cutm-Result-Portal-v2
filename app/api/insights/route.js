import { NextResponse } from 'next/server';
import { clientPromise } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';

export async function GET(request) {
  try {
    // Verify admin access
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (decoded.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const client = await clientPromise;
    const db = client.db('CUTM1');
    const cutmCollection = db.collection('CUTM1');
    const registrationCollection = db.collection('RegistrationData');

    // Get all data for analysis
    const allRecords = await cutmCollection.find({}).toArray();
    const registrationRecords = await registrationCollection.find({}).toArray();

    // Generate insights
    const insights = await generateInsights(allRecords, registrationRecords);
    const alerts = await generateAlerts(allRecords, registrationRecords);

    return NextResponse.json({
      success: true,
      insights,
      alerts,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error generating insights:', error);
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 });
  }
}

async function generateInsights(allRecords, registrationRecords) {
  const insights = [];

  // 1. Department Performance Analysis
  const deptPerformance = analyzeDepartmentPerformance(allRecords);
  insights.push(...deptPerformance);

  // 2. Failure Pattern Analysis
  const failurePatterns = analyzeFailurePatterns(allRecords);
  insights.push(...failurePatterns);

  // 3. Subject Difficulty Analysis
  const subjectAnalysis = analyzeSubjectDifficulty(allRecords);
  insights.push(...subjectAnalysis);

  // 4. Semester Trends
  const semesterTrends = analyzeSemesterTrends(allRecords);
  insights.push(...semesterTrends);

  // 5. Student Performance Insights
  const studentInsights = analyzeStudentPerformance(allRecords);
  insights.push(...studentInsights);

  return insights;
}

async function generateAlerts(allRecords, registrationRecords) {
  const alerts = [];

  // 1. Performance Drop Alerts
  const performanceAlerts = checkPerformanceDrops(allRecords);
  alerts.push(...performanceAlerts);

  // 2. High Failure Rate Alerts
  const failureAlerts = checkHighFailureRates(allRecords);
  alerts.push(...failureAlerts);

  // 3. Backlog Spike Alerts
  const backlogAlerts = checkBacklogSpikes(allRecords);
  alerts.push(...backlogAlerts);

  // 4. Critical Student Alerts
  const criticalAlerts = checkCriticalStudents(allRecords);
  alerts.push(...criticalAlerts);

  return alerts;
}

function analyzeDepartmentPerformance(records) {
  const insights = [];
  const deptMap = {
    '1': 'Civil Engineering',
    '2': 'Computer Science Engineering',
    '3': 'Electronics & Communication Engineering',
    '5': 'Electrical & Electronics Engineering',
    '6': 'Mechanical Engineering'
  };

  // Group by department
  const deptStats = {};
  records.forEach(record => {
    if (record.Reg_No && record.Reg_No.length >= 8) {
      const deptCode = record.Reg_No.charAt(7);
      const deptName = deptMap[deptCode];
      if (deptName) {
        if (!deptStats[deptName]) {
          deptStats[deptName] = { total: 0, passed: 0, failed: 0, grades: [] };
        }
        deptStats[deptName].total++;
        if (['A+', 'A', 'B+', 'B', 'C+', 'C'].includes(record.Grade)) {
          deptStats[deptName].passed++;
        } else if (['F', 'S', 'M', 'I', 'R'].includes(record.Grade)) {
          deptStats[deptName].failed++;
        }
        deptStats[deptName].grades.push(record.Grade);
      }
    }
  });

  // Calculate pass rates and generate insights
  Object.entries(deptStats).forEach(([dept, stats]) => {
    if (stats.total > 10) { // Only analyze departments with sufficient data
      const passRate = (stats.passed / stats.total) * 100;
      const failRate = (stats.failed / stats.total) * 100;

      if (passRate > 85) {
        insights.push({
          type: 'positive',
          category: 'department_performance',
          message: `${dept} shows excellent performance with ${passRate.toFixed(1)}% pass rate`,
          priority: 'medium',
          data: { department: dept, passRate: passRate.toFixed(1) }
        });
      } else if (passRate < 60) {
        insights.push({
          type: 'warning',
          category: 'department_performance',
          message: `${dept} needs attention with only ${passRate.toFixed(1)}% pass rate`,
          priority: 'high',
          data: { department: dept, passRate: passRate.toFixed(1) }
        });
      }

      // Grade distribution insights
      const gradeCounts = {};
      stats.grades.forEach(grade => {
        gradeCounts[grade] = (gradeCounts[grade] || 0) + 1;
      });

      const topGrade = Object.entries(gradeCounts).reduce((a, b) => gradeCounts[a[0]] > gradeCounts[b[0]] ? a : b);
      if (topGrade[1] > stats.total * 0.3) {
        insights.push({
          type: 'info',
          category: 'grade_distribution',
          message: `${dept} students most commonly receive ${topGrade[0]} grades (${((topGrade[1]/stats.total)*100).toFixed(1)}%)`,
          priority: 'low',
          data: { department: dept, grade: topGrade[0], percentage: ((topGrade[1]/stats.total)*100).toFixed(1) }
        });
      }
    }
  });

  return insights;
}

function analyzeFailurePatterns(records) {
  const insights = [];
  
  // Group by student
  const studentFailures = {};
  records.forEach(record => {
    if (record.Reg_No && ['F', 'S', 'M', 'I', 'R'].includes(record.Grade)) {
      if (!studentFailures[record.Reg_No]) {
        studentFailures[record.Reg_No] = { count: 0, subjects: [], department: '' };
      }
      studentFailures[record.Reg_No].count++;
      studentFailures[record.Reg_No].subjects.push(record.Subject_Code);
      if (record.Reg_No.length >= 8) {
        const deptCode = record.Reg_No.charAt(7);
        const deptMap = {
          '1': 'Civil Engineering',
          '2': 'Computer Science Engineering',
          '3': 'Electronics & Communication Engineering',
          '5': 'Electrical & Electronics Engineering',
          '6': 'Mechanical Engineering'
        };
        studentFailures[record.Reg_No].department = deptMap[deptCode] || 'Unknown';
      }
    }
  });

  // Analyze failure patterns by department
  const deptFailures = {};
  Object.entries(studentFailures).forEach(([regNo, data]) => {
    if (data.count >= 3) { // Students with 3+ failures
      const dept = data.department;
      if (!deptFailures[dept]) {
        deptFailures[dept] = 0;
      }
      deptFailures[dept]++;
    }
  });

  Object.entries(deptFailures).forEach(([dept, count]) => {
    if (count > 0) {
      insights.push({
        type: 'warning',
        category: 'failure_pattern',
        message: `${count} students failed 3+ subjects in ${dept}`,
        priority: 'high',
        data: { department: dept, studentCount: count }
      });
    }
  });

  return insights;
}

function analyzeSubjectDifficulty(records) {
  const insights = [];
  
  // Group by subject
  const subjectStats = {};
  records.forEach(record => {
    if (record.Subject_Code && record.Subject_Name) {
      const key = `${record.Subject_Code} - ${record.Subject_Name}`;
      if (!subjectStats[key]) {
        subjectStats[key] = { total: 0, failed: 0, grades: [] };
      }
      subjectStats[key].total++;
      if (['F', 'S', 'M', 'I', 'R'].includes(record.Grade)) {
        subjectStats[key].failed++;
      }
      subjectStats[key].grades.push(record.Grade);
    }
  });

  // Find toughest subjects
  Object.entries(subjectStats).forEach(([subject, stats]) => {
    if (stats.total >= 20) { // Only analyze subjects with sufficient data
      const failRate = (stats.failed / stats.total) * 100;
      
      if (failRate > 40) {
        insights.push({
          type: 'warning',
          category: 'subject_difficulty',
          message: `${subject} remains the toughest subject with ${failRate.toFixed(1)}% failure rate`,
          priority: 'high',
          data: { subject: subject, failRate: failRate.toFixed(1) }
        });
      } else if (failRate < 10) {
        insights.push({
          type: 'positive',
          category: 'subject_difficulty',
          message: `${subject} shows excellent performance with only ${failRate.toFixed(1)}% failure rate`,
          priority: 'medium',
          data: { subject: subject, failRate: failRate.toFixed(1) }
        });
      }
    }
  });

  return insights;
}

function analyzeSemesterTrends(records) {
  const insights = [];
  
  // Group by semester
  const semesterStats = {};
  records.forEach(record => {
    if (record.Sem) {
      if (!semesterStats[record.Sem]) {
        semesterStats[record.Sem] = { total: 0, passed: 0, failed: 0 };
      }
      semesterStats[record.Sem].total++;
      if (['A+', 'A', 'B+', 'B', 'C+', 'C'].includes(record.Grade)) {
        semesterStats[record.Sem].passed++;
      } else if (['F', 'S', 'M', 'I', 'R'].includes(record.Grade)) {
        semesterStats[record.Sem].failed++;
      }
    }
  });

  // Calculate trends
  const semesters = Object.keys(semesterStats).sort();
  if (semesters.length >= 2) {
    const latestSem = semesters[semesters.length - 1];
    const previousSem = semesters[semesters.length - 2];
    
    const latestPassRate = (semesterStats[latestSem].passed / semesterStats[latestSem].total) * 100;
    const previousPassRate = (semesterStats[previousSem].passed / semesterStats[previousSem].total) * 100;
    
    const improvement = latestPassRate - previousPassRate;
    
    if (Math.abs(improvement) > 5) {
      insights.push({
        type: improvement > 0 ? 'positive' : 'warning',
        category: 'semester_trend',
        message: `Overall performance ${improvement > 0 ? 'improved' : 'declined'} by ${Math.abs(improvement).toFixed(1)}% this semester`,
        priority: improvement > 0 ? 'medium' : 'high',
        data: { improvement: improvement.toFixed(1), latestSem, previousSem }
      });
    }
  }

  return insights;
}

function analyzeStudentPerformance(records) {
  const insights = [];
  
  // Group by student and calculate CGPA
  const studentPerformance = {};
  records.forEach(record => {
    if (record.Reg_No) {
      if (!studentPerformance[record.Reg_No]) {
        studentPerformance[record.Reg_No] = { grades: [], credits: [], subjects: [] };
      }
      studentPerformance[record.Reg_No].grades.push(record.Grade);
      studentPerformance[record.Reg_No].credits.push(parseInt(record.Credits) || 1);
      studentPerformance[record.Reg_No].subjects.push(record.Subject_Code);
    }
  });

  // Calculate CGPA for each student
  const studentCGPA = {};
  Object.entries(studentPerformance).forEach(([regNo, data]) => {
    if (data.grades.length >= 5) { // Only students with sufficient data
      const gradePoints = data.grades.map(grade => {
        const gradeMap = { 'O': 10, 'E': 9, 'A': 8, 'B': 7, 'C': 6, 'D': 5, 'F': 0, 'S': 0, 'I': 0, 'M': 0, 'R': 0 };
        return gradeMap[grade] || 0;
      });
      
      const totalCredits = data.credits.reduce((sum, credit) => sum + credit, 0);
      const weightedSum = gradePoints.reduce((sum, gp, index) => sum + (gp * data.credits[index]), 0);
      const cgpa = totalCredits > 0 ? weightedSum / totalCredits : 0;
      
      studentCGPA[regNo] = cgpa;
    }
  });

  // Find top performers and struggling students
  const sortedStudents = Object.entries(studentCGPA).sort((a, b) => b[1] - a[1]);
  
  if (sortedStudents.length > 0) {
    const topPerformer = sortedStudents[0];
    if (topPerformer[1] > 9.0) {
      insights.push({
        type: 'positive',
        category: 'student_performance',
        message: `Outstanding performance: Student ${topPerformer[0]} achieved CGPA of ${topPerformer[1].toFixed(2)}`,
        priority: 'medium',
        data: { regNo: topPerformer[0], cgpa: topPerformer[1].toFixed(2) }
      });
    }

    const strugglingStudents = sortedStudents.filter(([regNo, cgpa]) => cgpa < 5.0);
    if (strugglingStudents.length > 0) {
      insights.push({
        type: 'warning',
        category: 'student_performance',
        message: `${strugglingStudents.length} students are struggling with CGPA below 5.0`,
        priority: 'high',
        data: { count: strugglingStudents.length }
      });
    }
  }

  return insights;
}

function checkPerformanceDrops(records) {
  const alerts = [];
  
  // This would typically compare current semester with previous semester
  // For now, we'll generate sample alerts based on current data patterns
  
  const deptMap = {
    '1': 'Civil Engineering',
    '2': 'Computer Science Engineering',
    '3': 'Electronics & Communication Engineering',
    '5': 'Electrical & Electronics Engineering',
    '6': 'Mechanical Engineering'
  };

  const deptStats = {};
  records.forEach(record => {
    if (record.Reg_No && record.Reg_No.length >= 8) {
      const deptCode = record.Reg_No.charAt(7);
      const deptName = deptMap[deptCode];
      if (deptName) {
        if (!deptStats[deptName]) {
          deptStats[deptName] = { total: 0, passed: 0 };
        }
        deptStats[deptName].total++;
        if (['A+', 'A', 'B+', 'B', 'C+', 'C'].includes(record.Grade)) {
          deptStats[deptName].passed++;
        }
      }
    }
  });

  Object.entries(deptStats).forEach(([dept, stats]) => {
    if (stats.total > 20) {
      const passRate = (stats.passed / stats.total) * 100;
      if (passRate < 50) {
        alerts.push({
          type: 'critical',
          category: 'performance_drop',
          message: `Critical: ${dept} average dropped to ${passRate.toFixed(1)}%`,
          priority: 'critical',
          timestamp: new Date().toISOString(),
          data: { department: dept, passRate: passRate.toFixed(1) }
        });
      }
    }
  });

  return alerts;
}

function checkHighFailureRates(records) {
  const alerts = [];
  
  // Check for subjects with unusually high failure rates
  const subjectStats = {};
  records.forEach(record => {
    if (record.Subject_Code) {
      if (!subjectStats[record.Subject_Code]) {
        subjectStats[record.Subject_Code] = { total: 0, failed: 0 };
      }
      subjectStats[record.Subject_Code].total++;
      if (['F', 'S', 'M', 'I', 'R'].includes(record.Grade)) {
        subjectStats[record.Subject_Code].failed++;
      }
    }
  });

  Object.entries(subjectStats).forEach(([subject, stats]) => {
    if (stats.total >= 10) {
      const failRate = (stats.failed / stats.total) * 100;
      if (failRate > 60) {
        alerts.push({
          type: 'warning',
          category: 'high_failure_rate',
          message: `High failure rate alert: ${subject} has ${failRate.toFixed(1)}% failure rate`,
          priority: 'high',
          timestamp: new Date().toISOString(),
          data: { subject, failRate: failRate.toFixed(1) }
        });
      }
    }
  });

  return alerts;
}

function checkBacklogSpikes(records) {
  const alerts = [];
  
  // Check for students with multiple backlogs
  const studentBacklogs = {};
  records.forEach(record => {
    if (record.Reg_No && ['F', 'S', 'M', 'I', 'R'].includes(record.Grade)) {
      if (!studentBacklogs[record.Reg_No]) {
        studentBacklogs[record.Reg_No] = 0;
      }
      studentBacklogs[record.Reg_No]++;
    }
  });

  const highBacklogStudents = Object.entries(studentBacklogs).filter(([regNo, count]) => count >= 5);
  
  if (highBacklogStudents.length > 0) {
    alerts.push({
      type: 'warning',
      category: 'backlog_spike',
      message: `Backlog spike detected: ${highBacklogStudents.length} students have 5+ backlogs`,
      priority: 'high',
      timestamp: new Date().toISOString(),
      data: { count: highBacklogStudents.length, students: highBacklogStudents.map(([regNo]) => regNo) }
    });
  }

  return alerts;
}

function checkCriticalStudents(records) {
  const alerts = [];
  
  // Check for students with critical performance issues
  const studentFailures = {};
  records.forEach(record => {
    if (record.Reg_No && ['F', 'S', 'M', 'I', 'R'].includes(record.Grade)) {
      if (!studentFailures[record.Reg_No]) {
        studentFailures[record.Reg_No] = { count: 0, subjects: [] };
      }
      studentFailures[record.Reg_No].count++;
      studentFailures[record.Reg_No].subjects.push(record.Subject_Code);
    }
  });

  const criticalStudents = Object.entries(studentFailures).filter(([regNo, data]) => data.count >= 8);
  
  if (criticalStudents.length > 0) {
    alerts.push({
      type: 'critical',
      category: 'critical_student',
      message: `Critical alert: ${criticalStudents.length} students have 8+ failures and need immediate attention`,
      priority: 'critical',
      timestamp: new Date().toISOString(),
      data: { count: criticalStudents.length, students: criticalStudents.map(([regNo, data]) => ({ regNo, failures: data.count })) }
    });
  }

  return alerts;
}

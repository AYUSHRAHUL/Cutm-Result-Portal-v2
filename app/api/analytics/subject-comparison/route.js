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

    // Allow admin and teacher
    const userRole = payload.role?.toLowerCase();
    if (!["admin", "teacher"].includes(userRole)) {
      return NextResponse.json({ 
        error: "Access denied - Only admins or teachers can access analytics data" 
      }, { status: 403 });
    }

    // Get query parameters
    const { searchParams } = new URL(req.url);
    const batchFilter = searchParams.get('batch');
    const branchFilter = searchParams.get('branch');
    const semesterFilter = searchParams.get('semester');
    const subjectsParam = searchParams.get('subjects');
    
    if (!subjectsParam) {
      return NextResponse.json({ 
        error: "No subjects specified" 
      }, { status: 400 });
    }
    
    const subjectCodes = subjectsParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    
    if (subjectCodes.length === 0) {
      return NextResponse.json({ 
        error: "Invalid subjects specified" 
      }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("cutm1");
    
    // Fetch data with filters
    let cutm1Data = await db.collection("CUTM1").find({}).toArray();
    const uniqueStudentsGlobal = new Set();
    const studentFailedMap = new Map(); // reg -> boolean failed within selected subjects
    
    // Load branch overrides
    const allRegSet = Array.from(new Set(cutm1Data.map(r => r.Reg_No ? String(r.Reg_No) : null).filter(Boolean)));
    let overridesMap = new Map();
    if (allRegSet.length > 0) {
      try {
        const ovDocs = await db.collection("branch_overrides").find({ reg: { $in: allRegSet } }).project({ reg: 1, branch: 1 }).toArray();
        overridesMap = new Map(ovDocs.map(d => [String(d.reg), d.branch]));
      } catch {}
    }
    
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
    
    // Filter function for branch
    const filterByBranch = (record) => {
      if (!branchFilter || branchFilter === "all") return true;
      if (!record.Reg_No) return false;
      const regNo = String(record.Reg_No);
      
      // Check branch code in Reg_No (position 7, 0-indexed)
      const branchMap = {
        'CSE': ['2', '8'],
        'ECE': ['3', '4'],
        'EEE': ['5'],
        'ME': ['6'],
        'CIVIL': ['1', '9'],
        'AIML': ['7']
      };
      
      const branchCodes = branchMap[branchFilter] || [];
      if (regNo.length >= 8) {
        const deptCode = regNo.charAt(7);
        if (branchCodes.includes(deptCode)) return true;
      }
      
      // Check branch overrides
      const regNoStr = String(record.Reg_No).toUpperCase();
      const overrideBranch = overridesMap.get(regNoStr);
      if (overrideBranch) {
        const normalizedBranch = branchFilter.toUpperCase();
        const normalizedOverride = String(overrideBranch).toUpperCase();
        if (normalizedOverride.includes(normalizedBranch) || normalizedBranch.includes(normalizedOverride)) {
          return true;
        }
      }
      
      return false;
    };
    
    // Filter function for semester
    const filterBySemester = (record) => {
      if (!semesterFilter || semesterFilter === "all") return true;
      if (!record.Sem) return false;
      const sem = String(record.Sem).trim();
      return sem === semesterFilter || sem.toLowerCase() === semesterFilter.toLowerCase();
    };
    
    // Apply filters
    if ((batchFilter && batchFilter !== "all") || (branchFilter && branchFilter !== "all") || (semesterFilter && semesterFilter !== "all")) {
      cutm1Data = cutm1Data.filter(record => {
        const batchMatch = filterByBatch(record);
        const branchMatch = filterByBranch(record);
        const semesterMatch = filterBySemester(record);
        return batchMatch && branchMatch && semesterMatch;
      });
    }
    
    // Filter by subject codes (handle both Subject_Code and Subject Code field names)
    cutm1Data = cutm1Data.filter(record => {
      const subjectCode = String(record.Subject_Code || record["Subject Code"] || "").trim().toUpperCase();
      const matches = subjectCodes.some(code => subjectCode === code || subjectCode.includes(code) || code.includes(subjectCode));
      if (matches && record.Reg_No) {
        const reg = String(record.Reg_No).toUpperCase();
        uniqueStudentsGlobal.add(reg);
        const grade = String(record.Grade || "").trim().toUpperCase();
        const failedGrades = ['F', 'S', 'M', 'I', 'R'];
        if (failedGrades.includes(grade)) {
          studentFailedMap.set(reg, true);
        }
      }
      return matches;
    });
    
    console.log(`Filtered to ${cutm1Data.length} records matching subject codes: ${subjectCodes.join(', ')}`);
    
    // Calculate subject statistics with unique students per subject
    const subjectStats = {};
    const gradePoints = { 'O': 10, 'E': 9, 'A': 8, 'B': 7, 'C': 6, 'D': 5, 'F': 0, 'S': 0, 'I': 0, 'M': 0, 'R': 0 };
    const failedGrades = ['F', 'S', 'M', 'I', 'R'];
    
    cutm1Data.forEach(record => {
      // Handle both Subject_Code and Subject Code field names
      const subjectCode = record.Subject_Code || record["Subject Code"];
      if (!subjectCode || !record.Grade) return;
      
      const subject = String(subjectCode).trim().toUpperCase();
      const grade = String(record.Grade).trim().toUpperCase();
      const regNo = String(record.Reg_No || "").toUpperCase();
      if (!regNo) return;
      
      if (!subjectStats[subject]) {
        subjectStats[subject] = { studentGrades: new Map(), grades: {} };
      }
      
      // Track per-student grade (latest wins)
      subjectStats[subject].studentGrades.set(regNo, grade);
      
      // Track grade distribution (per record)
      subjectStats[subject].grades[grade] = (subjectStats[subject].grades[grade] || 0) + 1;
    });
    
    // Format results for requested subjects
    const results = subjectCodes.map(subjectCode => {
      // Try to find exact match first
      let matchedSubject = Object.keys(subjectStats).find(s => s === subjectCode);
      
      // If no exact match, try partial match
      if (!matchedSubject) {
        matchedSubject = Object.keys(subjectStats).find(s => 
          s.includes(subjectCode) || subjectCode.includes(s)
        );
      }
      
      if (!matchedSubject || !subjectStats[matchedSubject]) {
        return {
          subject: subjectCode,
          average: 0,
          totalStudents: 0,
          passed: 0,
          failed: 0,
          passRate: 0,
          failRate: 0,
          gradeDistribution: {}
        };
      }
      
      const stats = subjectStats[matchedSubject];
      const studentGrades = stats.studentGrades;
      
      // Compute totals based on unique students
      let totalStudents = studentGrades.size;
      let passed = 0;
      let failed = 0;
      let sumPoints = 0;
      
      studentGrades.forEach((grade) => {
        const points = gradePoints[grade] || 0;
        sumPoints += points;
        if (failedGrades.includes(grade)) {
          failed += 1;
        } else {
          passed += 1;
        }
      });
      
      const average = totalStudents > 0 ? parseFloat((sumPoints / totalStudents).toFixed(2)) : 0;
      const passRate = totalStudents > 0 ? parseFloat(((passed / totalStudents) * 100).toFixed(1)) : 0;
      const failRate = totalStudents > 0 ? parseFloat(((failed / totalStudents) * 100).toFixed(1)) : 0;
      
      return {
        subject: matchedSubject,
        average: average,
        totalStudents: totalStudents,
        passed: passed,
        failed: failed,
        passRate: passRate,
        failRate: failRate,
        gradeDistribution: stats.grades
      };
    });
    
    // Students who passed ALL selected subjects (unique)
    let passedAllStudents = 0;
    uniqueStudentsGlobal.forEach(reg => {
      if (!studentFailedMap.get(reg)) {
        passedAllStudents += 1;
      }
    });

    return NextResponse.json({
      success: true,
      data: results,
      uniqueStudents: uniqueStudentsGlobal.size,
      passedAllStudents
    });
    
  } catch (error) {
    console.error('Subject Comparison API error:', error);
    return NextResponse.json({ 
      error: `Subject comparison failed: ${error.message}` 
    }, { status: 500 });
  }
}

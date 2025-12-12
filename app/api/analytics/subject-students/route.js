import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import jwt from "jsonwebtoken";

async function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

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
    const subjectCode = searchParams.get('subject');
    const batchFilter = searchParams.get('batch');
    const branchFilter = searchParams.get('branch');
    const semesterFilter = searchParams.get('semester');
    
    if (!subjectCode) {
      return NextResponse.json({ error: "Subject code is required" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("cutm1");
    
    const normalizedSubjectCode = String(subjectCode).trim().toUpperCase();
    
    console.log(`[Subject Students] Fetching students for subject: ${normalizedSubjectCode}`);
    console.log(`[Subject Students] Filters - batch: ${batchFilter}, branch: ${branchFilter}, semester: ${semesterFilter}`);
    
    // Build match conditions array
    const matchConditions = [];
    
    // Subject code condition - try multiple field names and formats
    matchConditions.push({
      $or: [
        { Subject_Code: normalizedSubjectCode },
        { "Subject Code": normalizedSubjectCode },
        { Subject_Code: { $regex: new RegExp(`^${normalizedSubjectCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i') } },
        { "Subject Code": { $regex: new RegExp(`^${normalizedSubjectCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i') } },
        { Subject_Code: normalizedSubjectCode.replace(/\s+/g, '') },
        { "Subject Code": normalizedSubjectCode.replace(/\s+/g, '') }
      ]
    });
    
    // Add batch filter
    if (batchFilter && batchFilter !== "all") {
      const batchStr = String(batchFilter).trim();
      const yy = batchStr.length === 4 && batchStr.startsWith("20") ? batchStr.slice(2) : batchStr.slice(-2);
      const batchPattern = `^(?:${yy}|20${yy})`;
      matchConditions.push({
        $or: [
          { Reg_No: { $regex: batchPattern } },
          { $expr: { $regexMatch: { input: { $toString: "$Reg_No" }, regex: batchPattern } } }
        ]
      });
    }
    
    // Add branch filter
    if (branchFilter && branchFilter !== "all") {
      const normalizedBranch = String(branchFilter).trim();
      matchConditions.push({
        $or: [
          { Branch: normalizedBranch },
          { Branch: { $regex: new RegExp(`^${normalizedBranch}`, 'i') } }
        ]
      });
    }
    
    // Add semester filter
    if (semesterFilter && semesterFilter !== "all") {
      const semValue = String(semesterFilter).trim();
      // Normalize semester: handle "Sem 1", "Sem1", "1", etc.
      const semNormalized = semValue.replace(/^Sem\s*/i, "").trim();
      const semNum = parseInt(semNormalized);
      
      matchConditions.push({
        $or: [
          { Sem: semValue },
          { Sem: semNormalized },
          { Sem: semNum },
          { Sem: `Sem ${semNormalized}` },
          { Sem: `Sem${semNormalized}` },
          { Sem: { $regex: new RegExp(`^${semNormalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i') } },
          { Sem: { $regex: new RegExp(`Sem\\s*${semNormalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i') } }
        ]
      });
    }
    
    // Build final match stage
    const matchStage = matchConditions.length > 1 
      ? { $and: matchConditions }
      : matchConditions.length === 1
      ? matchConditions[0]
      : {};
    
    console.log(`[Subject Students] Match stage:`, JSON.stringify(matchStage, null, 2));
    
    let students = [];
    
    // First, try a simple find query (more reliable)
    try {
      // Build simple query with flexible subject code matching
      const subjectCodeVariations = [
        normalizedSubjectCode,
        normalizedSubjectCode.replace(/\s+/g, ''),
        normalizedSubjectCode.replace(/\s+/g, ' '),
        normalizedSubjectCode.replace(/([A-Z]+)(\d+)/, '$1 $2'), // Add space: CUCS1001 -> CUCS 1001
        normalizedSubjectCode.replace(/([A-Z]+)\s*(\d+)/, '$1$2'), // Remove space: CUCS 1001 -> CUCS1001
      ];
      
      const subjectCodeConditions = [];
      subjectCodeVariations.forEach(variation => {
        subjectCodeConditions.push(
          { Subject_Code: variation },
          { "Subject Code": variation },
          { Subject_Code: { $regex: new RegExp(`^${variation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i') } },
          { "Subject Code": { $regex: new RegExp(`^${variation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i') } }
        );
      });
      
      // Remove duplicates
      const uniqueConditions = [];
      const seen = new Set();
      subjectCodeConditions.forEach(cond => {
        const key = JSON.stringify(cond);
        if (!seen.has(key)) {
          seen.add(key);
          uniqueConditions.push(cond);
        }
      });
      
      const simpleQuery = {
        $or: uniqueConditions
      };
      
      // Add filters to simple query
      if (batchFilter && batchFilter !== "all") {
        const batchStr = String(batchFilter).trim();
        const yy = batchStr.length === 4 && batchStr.startsWith("20") ? batchStr.slice(2) : batchStr.slice(-2);
        const batchPattern = `^(?:${yy}|20${yy})`;
        simpleQuery.$and = simpleQuery.$and || [];
        simpleQuery.$and.push({
          $or: [
            { Reg_No: { $regex: batchPattern } },
            { $expr: { $regexMatch: { input: { $toString: "$Reg_No" }, regex: batchPattern } } }
          ]
        });
      }
      
      // Note: Branch filter is applied in post-processing to support branch overrides
      // Don't add branch filter to query here - it will be filtered after fetching
      
      if (semesterFilter && semesterFilter !== "all") {
        const semValue = String(semesterFilter).trim();
        // Normalize semester: handle "Sem 1", "Sem1", "1", etc.
        const semNormalized = semValue.replace(/^Sem\s*/i, "").trim();
        const semNum = parseInt(semNormalized);
        
        simpleQuery.$and = simpleQuery.$and || [];
        simpleQuery.$and.push({
          $or: [
            { Sem: semValue },
            { Sem: semNormalized },
            { Sem: semNum },
            { Sem: `Sem ${semNormalized}` },
            { Sem: `Sem${semNormalized}` },
            { Sem: { $regex: new RegExp(`^${semNormalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i') } },
            { Sem: { $regex: new RegExp(`Sem\\s*${semNormalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i') } }
          ]
        });
      }
      
      // If we have $and conditions, restructure query
      let finalQuery = simpleQuery;
      if (simpleQuery.$and && simpleQuery.$and.length > 0) {
        finalQuery = {
          $and: [
            { $or: simpleQuery.$or },
            ...simpleQuery.$and
          ]
        };
      } else if (simpleQuery.$or) {
        // If no $and conditions, just use the $or for subject code
        finalQuery = { $or: simpleQuery.$or };
      }
      
      console.log(`[Subject Students] Trying simple find query:`, JSON.stringify(finalQuery, null, 2));
      const allRecords = await db.collection("CUTM1").find(finalQuery).toArray();
      console.log(`[Subject Students] Found ${allRecords.length} records from simple query`);
      
      // Load branch overrides for the fetched records if branch filter is active
      let overridesMap = new Map();
      if (branchFilter && branchFilter !== "all" && allRecords.length > 0) {
        try {
          const regSet = Array.from(new Set(allRecords.map(r => String(r.Reg_No || "").toUpperCase()).filter(Boolean)));
          if (regSet.length > 0) {
            const ovDocs = await db.collection("branch_overrides").find({ reg: { $in: regSet } }).project({ reg: 1, branch: 1 }).toArray();
            overridesMap = new Map(ovDocs.map(d => [String(d.reg).toUpperCase(), d.branch]));
            console.log(`[Subject Students] Loaded ${overridesMap.size} branch overrides for ${regSet.length} unique students`);
          }
        } catch (err) {
          console.warn(`[Subject Students] Error loading branch overrides:`, err);
        }
      }
      
      // Deduplicate by Reg_No and get first occurrence of each student
      // Also apply branch filter with overrides if needed
      const uniqueMap = new Map();
      allRecords.forEach(record => {
        const regNo = String(record.Reg_No || "").toUpperCase();
        if (regNo && !uniqueMap.has(regNo)) {
          // Apply branch filter with overrides if branch filter is active
          if (branchFilter && branchFilter !== "all") {
            const normalizedBranch = String(branchFilter).trim().toUpperCase();
            let matchesBranch = false;
            
            // Check branch overrides first
            const overrideBranch = overridesMap.get(regNo);
            if (overrideBranch) {
              const overrideUpper = String(overrideBranch).toUpperCase();
              const branchNameMap = {
                'CSE': ['COMPUTER SCIENCE', 'CSE', 'COMPUTER SCIENCE ENGINEERING'],
                'ECE': ['ELECTRONICS & COMMUNICATION', 'ECE', 'ELECTRONICS AND COMMUNICATION', 'ELECTRONICS COMMUNICATION'],
                'EEE': ['ELECTRICAL & ELECTRONICS', 'EEE', 'ELECTRICAL AND ELECTRONICS', 'ELECTRICAL ELECTRONICS'],
                'ME': ['MECHANICAL', 'ME', 'MECHANICAL ENGINEERING'],
                'CIVIL': ['CIVIL', 'CIVIL ENGINEERING'],
                'AIML': ['AIML', 'ARTIFICIAL INTELLIGENCE', 'MACHINE LEARNING']
              };
              const validNames = branchNameMap[normalizedBranch] || [];
              matchesBranch = validNames.some(name => 
                overrideUpper.includes(name) || name.includes(overrideUpper) || overrideUpper === name
              );
            }
            
            // Check Reg_No department code if override didn't match
            if (!matchesBranch && regNo.length >= 8) {
              const branchMap = {
                'CSE': ['2', '8'],
                'ECE': ['3', '4'],
                'EEE': ['5'],
                'ME': ['6'],
                'CIVIL': ['1', '9'],
                'AIML': ['7']
              };
              const deptCode = regNo.charAt(7);
              const branchCodes = branchMap[normalizedBranch] || [];
              matchesBranch = branchCodes.includes(deptCode);
            }
            
            // Check Branch field as fallback
            if (!matchesBranch && record.Branch) {
              const recordBranch = String(record.Branch).toUpperCase();
              matchesBranch = recordBranch === normalizedBranch || 
                            recordBranch.includes(normalizedBranch) || 
                            normalizedBranch.includes(recordBranch);
            }
            
            if (!matchesBranch) {
              return; // Skip this record if it doesn't match branch filter
            }
          }
          
          uniqueMap.set(regNo, {
            Reg_No: record.Reg_No,
            Name: record.Name || "",
            Branch: record.Branch || "",
            Grade: record.Grade || "",
            Sem: record.Sem || ""
          });
        }
      });
      students = Array.from(uniqueMap.values()).sort((a, b) => {
        const regA = String(a.Reg_No || "").toUpperCase();
        const regB = String(b.Reg_No || "").toUpperCase();
        return regA.localeCompare(regB);
      });
      console.log(`[Subject Students] Deduplicated to ${students.length} unique students`);
      
    } catch (queryError) {
      console.error(`[Subject Students] Simple query error:`, queryError);
      
      // Fallback: Try aggregation
      try {
        console.log(`[Subject Students] Trying aggregation as fallback...`);
        students = await db.collection("CUTM1").aggregate([
          { $match: matchStage },
          {
            $group: {
              _id: "$Reg_No",
              Name: { $first: "$Name" },
              Branch: { $first: "$Branch" },
              Reg_No: { $first: "$Reg_No" },
              Grade: { $first: "$Grade" },
              Sem: { $first: "$Sem" }
            }
          },
          {
            $project: {
              _id: 0,
              Reg_No: 1,
              Name: 1,
              Branch: 1,
              Grade: 1,
              Sem: 1
            }
          },
          { $sort: { Reg_No: 1 } }
        ]).toArray();
        
        console.log(`[Subject Students] Aggregation found ${students.length} students`);
      } catch (aggError) {
        console.error(`[Subject Students] Aggregation error:`, aggError);
        students = [];
      }
    }
    
    // If still no results, try without filters to check if subject exists
    if (students.length === 0) {
      console.log(`[Subject Students] No results found, checking if subject exists at all...`);
      try {
        const subjectCheckQuery = {
          $or: [
            { Subject_Code: normalizedSubjectCode },
            { "Subject Code": normalizedSubjectCode },
            { Subject_Code: { $regex: new RegExp(`^${normalizedSubjectCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i') } },
            { "Subject Code": { $regex: new RegExp(`^${normalizedSubjectCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i') } }
          ]
        };
        
        const sampleRecords = await db.collection("CUTM1").find(subjectCheckQuery).limit(10).toArray();
        console.log(`[Subject Students] Found ${sampleRecords.length} sample records without any filters`);
        
        if (sampleRecords.length > 0) {
          console.log(`[Subject Students] Sample records found - Subject exists in database`);
          console.log(`[Subject Students] Sample record structure:`, JSON.stringify({
            Subject_Code: sampleRecords[0].Subject_Code,
            "Subject Code": sampleRecords[0]["Subject Code"],
            Reg_No: sampleRecords[0].Reg_No,
            Branch: sampleRecords[0].Branch,
            Sem: sampleRecords[0].Sem,
            Name: sampleRecords[0].Name,
            Grade: sampleRecords[0].Grade
          }, null, 2));
          
          // If we have filters but no results, the filters might be too strict
          if (batchFilter !== "all" || branchFilter !== "all" || semesterFilter !== "all") {
            console.log(`[Subject Students] Warning: Subject exists but filters may be too restrictive`);
            console.log(`[Subject Students] Applied filters: batch=${batchFilter}, branch=${branchFilter}, semester=${semesterFilter}`);
            
            // Show what branches/batches/semesters are available for this subject
            const availableBranches = [...new Set(sampleRecords.map(r => r.Branch).filter(Boolean))];
            const availableBatches = [...new Set(sampleRecords.map(r => {
              const regNo = String(r.Reg_No || "");
              const match = regNo.match(/^(?:20)?(\d{2})/);
              return match ? `20${match[1]}` : null;
            }).filter(Boolean))];
            const availableSemesters = [...new Set(sampleRecords.map(r => r.Sem).filter(Boolean))];
            
            console.log(`[Subject Students] Available for this subject:`, {
              branches: availableBranches,
              batches: availableBatches,
              semesters: availableSemesters
            });
          }
        } else {
          console.log(`[Subject Students] Subject code '${normalizedSubjectCode}' not found in database at all`);
        }
      } catch (checkError) {
        console.error(`[Subject Students] Subject check error:`, checkError);
      }
    }
    
    console.log(`[Subject Students] Returning ${students.length} students`);
    
    return NextResponse.json({
      success: true,
      students: students,
      total: students.length
    });
  } catch (err) {
    console.error("/api/analytics/subject-students error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}


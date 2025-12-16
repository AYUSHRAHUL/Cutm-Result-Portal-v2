import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { verifyToken } from "@/lib/auth";
import { getCampusSchoolDatabase } from "@/lib/campus";

/**
 * SOET (School of Engineering & Technology) Batch Route
 * Handles B.Tech students only
 */
export async function POST(req) {
  try {
    // Check authentication to get campus
    const token = req.cookies.get("token")?.value;
    let campus = null;
    let payload = null;
    if (token) {
      payload = await verifyToken(token);
      campus = payload?.campus || null;
    }

    const { branch, batch } = await req.json();
    const client = await clientPromise;
    
    // Get campus from query params (priority) or payload
    const { searchParams } = new URL(req.url);
    const campusParam = searchParams.get('campus');
    const mode = searchParams.get('mode'); // e.g., ?mode=list for fast dropdowns
    campus = campusParam || campus || null;
    
    // Force school to SOET for this route
    const school = 'SOET';
    const dbName = getCampusSchoolDatabase(campus, school);

    const db = client.db(dbName);
    const cutm = db.collection("result");

    // Build query based on branch and batch
    const query = {};

    // Optimize: If batch is provided, filter by Reg_No prefix at database level
    if (batch && batch !== 'All') {
      const batchYear = batch.length === 4 ? batch : `20${batch}`;
      const shortYear = batchYear.slice(-2);

      // Filter for both numeric (starts with YY) and alphanumeric (starts with YYYY) formats
      query.Reg_No = {
        $regex: `^(?:${shortYear}|${batchYear})`
      };
    }

    // Branch filter (both full and short forms)
    const branchCodeMap = {
      Civil: ['111'],
      'Civil Engineering': ['111'],
      CSE: ['112', '137'],
      'Computer Science Engineering': ['112', '137'],
      'Computer Science and Engineering': ['112', '137'],
      ECE: ['113'],
      'Electronics & Communication Engineering': ['113'],
      'Electronics and Communication Engineering': ['113'],
      EEE: ['115'],
      'Electrical & Electronics Engineering': ['115'],
      'Electrical and Electronics Engineering': ['115'],
      Mechanical: ['116'],
      'Mechanical Engineering': ['116'],
      AIML: ['137'],
      'CSE AIML': ['137'],
    };

    if (branch && branch !== 'All') {
      const normalizedBranch = branch.trim();
      const branchCodes = branchCodeMap[normalizedBranch] || branchCodeMap[normalizedBranch.toUpperCase()] || [];
      const branchNames = [
        normalizedBranch,
        normalizedBranch === 'Civil' ? 'Civil Engineering' : null,
        normalizedBranch === 'CSE' ? 'Computer Science Engineering' : null,
        normalizedBranch === 'CSE' ? 'Computer Science and Engineering' : null,
        normalizedBranch === 'ECE' ? 'Electronics & Communication Engineering' : null,
        normalizedBranch === 'ECE' ? 'Electronics and Communication Engineering' : null,
        normalizedBranch === 'EEE' ? 'Electrical & Electronics Engineering' : null,
        normalizedBranch === 'EEE' ? 'Electrical and Electronics Engineering' : null,
        normalizedBranch === 'Mechanical' ? 'Mechanical Engineering' : null,
        normalizedBranch === 'AIML' ? 'CSE AIML' : null,
      ].filter(Boolean);

      // Match either by Branch field or by branch code embedded in Reg_No (index 5-7)
      query.$or = [
        { Branch: { $in: branchNames } },
      ];

      if (branchCodes.length > 0) {
        query.$or.push({
          $expr: { $in: [{ $substrBytes: ["$Reg_No", 5, 3] }, branchCodes] }
        });
      }
    }

    // Use projection to fetch only necessary fields
    const projection = {
      Reg_No: 1,
      Name: 1,
      Branch: 1,
      Subject_Code: 1,
      Subject_Name: 1,
      Credits: 1,
      Grade: 1,
      Sem: 1
    };

    // Fast path for dropdown lists: return distinct students only
    if (mode === 'list') {
      const pipeline = [
        { $match: query },
        {
          $group: {
            _id: "$Reg_No",
            Name: { $first: "$Name" },
            Branch: { $first: "$Branch" },
          }
        },
        {
          $project: {
            _id: 0,
            Reg_No: { $toUpper: "$_id" },
            Name: { $ifNull: ["$Name", ""] },
            Branch: { $ifNull: ["$Branch", ""] },
          }
        },
        { $sort: { Reg_No: 1 } } // Sort by registration number ascending
      ];

      const students = await cutm.aggregate(pipeline).toArray();
      // Sort by last 4 digits of registration number (ascending)
      students.sort((a, b) => {
        const regA = String(a.Reg_No || "").trim();
        const regB = String(b.Reg_No || "").trim();
        const last4A = regA.length >= 4 ? regA.slice(-4) : regA;
        const last4B = regB.length >= 4 ? regB.slice(-4) : regB;
        return last4A.localeCompare(last4B, undefined, { numeric: true });
      });
      return NextResponse.json({
        records: students,
        count: students.length,
        mode: "list",
        school: 'SOET'
      });
    }

    // Summary mode: grouped by student with subjects sorted
    if (mode === 'summary') {
      const pipeline = [
        { $match: query },
        { $project: projection },
        { $sort: { Reg_No: 1, Sem: 1, Subject_Code: 1 } }, // Sort by Reg_No, then Sem, then Subject_Code
        {
          $group: {
            _id: "$Reg_No",
            Name: { $first: "$Name" },
            Branch: { $first: "$Branch" },
            subjects: {
              $push: {
                Reg_No: "$Reg_No",
                Name: "$Name",
                Branch: "$Branch",
                Subject_Code: "$Subject_Code",
                Subject_Name: "$Subject_Name",
                Credits: "$Credits",
                Grade: "$Grade",
                Sem: "$Sem"
              }
            }
          }
        },
        {
          $project: {
            _id: 0,
            Reg_No: { $toUpper: "$_id" },
            Name: { $ifNull: ["$Name", ""] },
            Branch: { $ifNull: ["$Branch", ""] },
            subjects: 1
          }
        },
        { $sort: { Reg_No: 1 } } // Sort by Reg_No ascending
      ];

      const students = await cutm.aggregate(pipeline).toArray();

      const parseCredits = (creditStr) => {
        if (!creditStr) return 0;
        return creditStr
          .toString()
          .split("+")
          .map(p => parseFloat(p.trim()) || 0)
          .reduce((a, b) => a + b, 0);
      };

      const enriched = students.map(student => {
        let totalCredits = 0;
        const subjects = (student.subjects || []).map(sub => {
          const credits = parseCredits(sub.Credits);
          totalCredits += credits;
          return { ...sub, Credits: sub.Credits, creditsParsed: credits };
        });
        return {
          ...student,
          subjects,
          totalSubjects: subjects.length,
          totalCredits: totalCredits
        };
      });

      // Flatten for compatibility if needed
      const flatRecords = enriched.flatMap(s => s.subjects);

      return NextResponse.json({
        students: enriched,
        records: flatRecords,
        count: flatRecords.length,
        school: 'SOET',
        mode: 'summary'
      });
    }

    const allRecords = await cutm.find(query).sort({ Reg_No: 1, Sem: 1, Subject_Code: 1 }).project(projection).toArray();

    // Import unified CUTM parser
    const { parseBTechRegistration } = await import('../parse-registration/route');

    // Load branch-change overrides to respect branch changes in basket track
    const overridesCol = db.collection("branch_overrides");
    const overridesArr = await overridesCol.find({}, { projection: { _id: 0, reg: 1, branch: 1, batch: 1 } }).toArray();
    const overrideMap = new Map(overridesArr.map(o => [String(o.reg || "").toUpperCase(), o]));

    // Helper to get effective branch/batch (override > parsed > record)
    const getEffectiveBranch = (regNo, parsedBranch, recordBranch) => {
      const ov = overrideMap.get(String(regNo || "").toUpperCase());
      if (ov?.branch) return ov.branch;
      return parsedBranch || recordBranch || "";
    };
    const getEffectiveBatch = (regNo, parsedYear, recordBatch) => {
      const ov = overrideMap.get(String(regNo || "").toUpperCase());
      if (ov?.batch) return ov.batch;
      return parsedYear || recordBatch || "";
    };

    // Helper to normalize branch for comparison
    const normalizeBranchForCompare = (br) => {
      if (!br) return "";
      const brStr = String(br).trim().toUpperCase();
      const branchMap = {
        'CIVIL ENGINEERING': 'CIVIL',
        'COMPUTER SCIENCE AND ENGINEERING': 'CSE',
        'COMPUTER SCIENCE ENGINEERING': 'CSE',
        'ELECTRONICS AND COMMUNICATION ENGINEERING': 'ECE',
        'ELECTRICAL AND ELECTRONICS ENGINEERING': 'EEE',
        'MECHANICAL ENGINEERING': 'MECHANICAL',
        'ME': 'MECHANICAL'
      };
      return branchMap[brStr] || brStr;
    };

    // Filter records based on branch and batch (B.Tech only) with override support
    const filteredRecords = allRecords.filter(record => {
      const regNo = String(record.Reg_No || '').trim();
      if (!regNo) return false;

      // Parse using unified CUTM parser
      const parsed = parseBTechRegistration(regNo);

      if (!parsed || !parsed.isValid) return false;

      // Filter by school type (SOET = B.Tech only)
      if (!parsed.isBTech) return false;

      // Get effective branch/batch (respects overrides)
      const effectiveBranch = getEffectiveBranch(regNo, parsed.branch, record.Branch);
      const effectiveBatch = getEffectiveBatch(regNo, parsed.year, record.Batch);

      // Check batch match (using effective batch)
      if (batch && batch !== 'All') {
        const batchYear = batch.length === 4 ? batch : `20${batch}`;
        if (effectiveBatch !== batchYear) {
          // Also check 2-digit year match
          const effectiveShort = effectiveBatch.slice(-2);
          const filterShort = batchYear.slice(-2);
          if (effectiveShort !== filterShort) return false;
        }
      }

      // Check branch match (using effective branch)
      if (branch && branch !== 'All') {
        const normalizedFilter = normalizeBranchForCompare(branch);
        const normalizedEffective = normalizeBranchForCompare(effectiveBranch);
        
        if (normalizedFilter !== normalizedEffective && 
            !normalizedEffective.includes(normalizedFilter) && 
            !normalizedFilter.includes(normalizedEffective)) {
          return false;
        }
      }

      return true;
    });

    // Normalize Reg_No to strings and sort by last 4 digits of registration number
    const uniqueRecords = filteredRecords.map(record => ({
      ...record,
      Reg_No: String(record.Reg_No || "").toUpperCase(),
    })).sort((a, b) => {
      // Sort by last 4 digits of registration number (ascending)
      const regA = String(a.Reg_No || "").trim();
      const regB = String(b.Reg_No || "").trim();
      const last4A = regA.length >= 4 ? regA.slice(-4) : regA;
      const last4B = regB.length >= 4 ? regB.slice(-4) : regB;
      return last4A.localeCompare(last4B, undefined, { numeric: true });
    });

    return NextResponse.json({
      records: uniqueRecords,
      message: `${uniqueRecords.length} SOET (B.Tech) result records found`,
      school: 'SOET'
    });

  } catch (err) {
    console.error("/api/soet/batch error", err);
    return NextResponse.json({ error: "Server error: " + err.message }, { status: 500 });
  }
}

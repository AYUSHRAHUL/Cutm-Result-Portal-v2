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
    const overridesCol = db.collection("branch_overrides");

    // Fetch inactive students list
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

    // Gather Reg_Nos from overrides that match the criteria
    let overrideRegs = [];

    // 1. Check Batch Overrides
    if (batch && batch !== 'All') {
      const batchYear = batch.length === 4 ? batch : `20${batch}`;
      const batchOverrides = await overridesCol.find({ batch: batchYear }).project({ reg: 1 }).toArray();
      batchOverrides.forEach(o => overrideRegs.push(o.reg));
    }

    // 2. Check Branch Overrides
    if (branch && branch !== 'All') {
      // Map search term to stored branch names in overrides collection
      const searchKey = branch.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      let targetBranch = null;

      if (searchKey.includes('civil')) targetBranch = "Civil Engineering";
      else if (searchKey === 'cse' || searchKey.includes('computer')) targetBranch = "Computer Science Engineering";
      else if (searchKey === 'ece' || searchKey.includes('electronics')) targetBranch = "Electronics & Communication Engineering";
      else if (searchKey === 'eee' || searchKey.includes('electrical')) targetBranch = "Electrical & Electronics Engineering";
      else if (searchKey === 'me' || searchKey.includes('mech')) targetBranch = "Mechanical Engineering";
      else if (searchKey === 'aiml') targetBranch = "AIML";

      if (targetBranch) {
        const branchOverrides = await overridesCol.find({ branch: targetBranch }).project({ reg: 1 }).toArray();
        branchOverrides.forEach(o => overrideRegs.push(o.reg));
      }
    }

    overrideRegs = [...new Set(overrideRegs)]; // dedupe

    // Build base query for standard matches
    const baseQuery = {};

    // Optimize: If batch is provided, filter by Reg_No prefix at database level
    if (batch && batch !== 'All') {
      const batchYear = batch.length === 4 ? batch : `20${batch}`;
      const shortYear = batchYear.slice(-2);

      // Filter for both numeric (starts with YY) and alphanumeric (starts with YYYY) formats
      baseQuery.Reg_No = {
        $regex: `^(?:${shortYear}|${batchYear})`
      };
    }

    // Branch filter (both full and short forms)
    const branchCodeMap = {
      Civil: ['111'],
      'Civil Engineering': ['111'],
      CSE: ['112'],  // Only 112 for CSE
      'Computer Science Engineering': ['112'],
      'Computer Science and Engineering': ['112'],
      ECE: ['113'],
      'Electronics & Communication Engineering': ['113'],
      'Electronics and Communication Engineering': ['113'],
      EEE: ['115'],
      'Electrical & Electronics Engineering': ['115'],
      'Electrical and Electronics Engineering': ['115'],
      Mechanical: ['116'],
      'Mechanical Engineering': ['116'],
      AIML: ['137', '370'],     // 137 (old batch), 370 (2026+ batch)
      'CSE AIML': ['137', '370'], // 137 (old batch), 370 (2026+ batch)
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
      baseQuery.$or = [
        { Branch: { $in: branchNames } },
      ];

      if (branchCodes.length > 0) {
        baseQuery.$or.push({
          $expr: { $in: [{ $substrBytes: ["$Reg_No", 5, 3] }, branchCodes] }
        });
      }
    }

    // Final Query: Matches Branch/Batch logic OR is in Override List
    let query = baseQuery;
    if (overrideRegs.length > 0) {
      if (Object.keys(baseQuery).length > 0) {
        query = {
          $or: [
            baseQuery,
            { Reg_No: { $in: overrideRegs } }
          ]
        };
      } else {
        query = { Reg_No: { $in: overrideRegs } };
      }
    }

    // APPLY INACTIVE FILTER AT DB LEVEL
    if (inactiveRegs.length > 0) {
      if (Object.keys(query).length === 0) {
        query = { Reg_No: { $nin: inactiveRegs } };
      } else {
        query = { $and: [query, { Reg_No: { $nin: inactiveRegs } }] };
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
      // For dropdown, build a clean query that filters by batch AND branch code only (no Branch field)
      const listQuery = {};

      // Apply batch filter
      if (batch && batch !== 'All') {
        const batchYear = batch.length === 4 ? batch : `20${batch}`;
        const shortYear = batchYear.slice(-2);
        listQuery.Reg_No = {
          $regex: `^(?:${shortYear}|${batchYear})`
        };
      }

      // Apply branch filter ONLY by code (not by Branch field to avoid $or ambiguity)
      if (branch && branch !== 'All') {
        const normalizedBranch = branch.trim();
        const branchCodes = branchCodeMap[normalizedBranch] || branchCodeMap[normalizedBranch.toUpperCase()] || [];

        if (branchCodes.length > 0) {
          // Filter ONLY by registration code, not by Branch field
          listQuery.$expr = { $in: [{ $substrBytes: ["$Reg_No", 5, 3] }, branchCodes] };
        }
      }

      const pipeline = [
        { $match: listQuery },
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

      // Get students from result collection
      const rawStudents = await cutm.aggregate(pipeline).toArray();

      // Also get students from RegistrationData collection (for newly uploaded registrations like 2026)
      let regDataStudents = [];
      try {
        const regDataPipeline = [
          { $match: listQuery },
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
          { $sort: { Reg_No: 1 } }
        ];
        regDataStudents = await db.collection("RegistrationData").aggregate(regDataPipeline).toArray();
      } catch (e) {
        console.warn('RegistrationData collection not available in list mode');
      }

      // Combine and deduplicate by Reg_No
      const allStudents = [...rawStudents, ...regDataStudents];
      const uniqueStudentMap = new Map();
      allStudents.forEach(s => {
        const key = String(s.Reg_No || "").toUpperCase();
        if (!uniqueStudentMap.has(key)) {
          uniqueStudentMap.set(key, s);
        }
      });
      const combinedStudents = Array.from(uniqueStudentMap.values());

      // Filter out inactive students
      const students = combinedStudents.filter(s => !inactiveRegs.includes(s.Reg_No));
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

      const rawStudents = await cutm.aggregate(pipeline).toArray();
      // Filter out inactive students
      const students = rawStudents.filter(s => !inactiveRegs.includes(s._id));

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

    // Add safety limit to prevent excessive data loading
    const MAX_BATCH_RECORDS = 100000; // Safety limit for batch queries
    const allRecords = await cutm.find(query).sort({ Reg_No: 1, Sem: 1, Subject_Code: 1 }).project(projection).limit(MAX_BATCH_RECORDS).toArray();

    // Import unified CUTM parser
    const { parseBTechRegistration } = await import('../parse-registration/route');

    // Load branch-change overrides to respect branch changes in basket track
    // overridesCol is already defined above
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

    // Helper to normalize branch for comparison (UI sends ECE/CSE/…; DB/parser use full names with & or AND)
    const normalizeBranchForCompare = (br) => {
      if (!br) return "";
      const raw = String(br).trim().toUpperCase();
      const asAnd = raw.replace(/\s*&\s*/g, " AND ");
      const branchMap = {
        "CIVIL ENGINEERING": "CIVIL",
        "COMPUTER SCIENCE AND ENGINEERING": "CSE",
        "COMPUTER SCIENCE ENGINEERING": "CSE",
        "ELECTRONICS AND COMMUNICATION ENGINEERING": "ECE",
        "ELECTRICAL AND ELECTRONICS ENGINEERING": "EEE",
        "MECHANICAL ENGINEERING": "MECHANICAL",
        "CSE AIML": "AIML",
        ME: "MECHANICAL",
      };
      const shortToToken = {
        ECE: "ECE",
        CSE: "CSE",
        EEE: "EEE",
        CIVIL: "CIVIL",
        MECHANICAL: "MECHANICAL",
        ME: "MECHANICAL",
        AIML: "AIML",
      };
      if (shortToToken[raw]) return shortToToken[raw];
      return branchMap[asAnd] || branchMap[raw] || raw;
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

      // Filter out inactive students
      if (inactiveRegs.includes(regNo)) return false;

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

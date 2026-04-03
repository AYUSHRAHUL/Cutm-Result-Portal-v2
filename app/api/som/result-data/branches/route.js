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
 * GET /api/som/result-data/branches
 * Get all unique branches for a specific batch
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
    if (!["admin"].includes(userRole)) {
      return NextResponse.json({
        error: "Access denied - Only admins can access this data"
      }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const batchFilter = searchParams.get('batch');

    if (!batchFilter) {
      return NextResponse.json({ error: "Batch is required" }, { status: 400 });
    }

    const client = await clientPromise;
    const campusParam = searchParams.get('campus');
    const campus = campusParam || payload.campus || null;

    const school = 'SOM';
    const dbName = getCampusSchoolDatabase(campus, school);
    const db = client.db(dbName);
    const cutm = db.collection("som_result");

    // Parse registration to get branch
    const { parseSOMRegistration } = await import('../../parse-registration/route');

    // Load Overrides
    const overridesCol = db.collection("branch_overrides");
    const overridesArr = await overridesCol.find({}, { projection: { _id: 0, reg: 1, branch: 1, batch: 1 } }).toArray();
    const overrideMap = new Map(overridesArr.map(o => [String(o.reg || "").toUpperCase(), o]));

    // Identify overrides for this batch
    const targetBatch = batchFilter.length === 4 ? batchFilter : `20${batchFilter}`;
    const batchOverrideRegs = [];
    overridesArr.forEach(ov => {
      if (ov.batch === targetBatch) batchOverrideRegs.push(ov.reg.toUpperCase());
    });

    // Build query for batch
    const batchPrefix = batchFilter.length === 4 ? batchFilter.substring(2, 4) : batchFilter;
    const baseQuery = {
      $or: [
        { Reg_No: { $type: "string", $regex: `^${batchPrefix}` } }
      ],
      Grade: { $exists: true }
    };

    if (batchOverrideRegs.length > 0) {
      baseQuery.$or.push({ Reg_No: { $in: batchOverrideRegs } });
    }

    // Get sample of records for this batch (limit to prevent large memory usage)
    const sampleRecords = await cutm.find(baseQuery).limit(10000).toArray();

    // Extract unique Reg_Nos
    const regNos = [...new Set(sampleRecords.map(r => String(r.Reg_No || '').trim()).filter(Boolean))];

    // Extract branches from Reg_Nos for SOM
    const branchShortMap = {
      '912': 'BBA',
      '214': 'MBA'
    };

    // Helper functions
    const getEffectiveBranch = (regNo, parsedBranch) => {
      const ov = overrideMap.get(String(regNo || "").toUpperCase());
      if (ov?.branch) return ov.branch;
      return parsedBranch || "";
    };

    const branchSet = new Set();
    regNos.forEach(regNo => {
      if (!regNo) return;
      const parsed = parseSOMRegistration(String(regNo).trim());
      // Even if invalid parser result, check overrides
      const ov = overrideMap.get(regNo.toUpperCase());

      let parsedBranch = '';
      if (parsed && parsed.isValid && parsed.isSOM && parsed.branchCode) {
        parsedBranch = branchShortMap[parsed.branchCode] || (parsed.branch || '').toUpperCase().trim();
      }

      const effectiveBranch = getEffectiveBranch(regNo, parsedBranch);

      if (effectiveBranch) {
        // Normalize
        const normalized = branchShortMap[effectiveBranch] || effectiveBranch.toUpperCase().trim();
        // Additional normalization
        const manualMap = {
          'BACHELOR OF BUSINESS ADMINISTRATION': 'BBA',
          'BACHELOR OF BUSINESS ADMINISTRATION (BBA)': 'BBA',
          'BBA': 'BBA',
          'MASTER OF BUSINESS ADMINISTRATION': 'MBA',
          'MASTER OF BUSINESS ADMINISTRATION (MBA)': 'MBA',
          'MBA': 'MBA'
        };
        const finalBranch = manualMap[normalized] || normalized;
        if (finalBranch) branchSet.add(finalBranch);
      }
    });

    const branches = Array.from(branchSet).sort();

    return NextResponse.json({
      success: true,
      branches: branches
    });

  } catch (error) {
    console.error('Error fetching branches:', error);
    return NextResponse.json({
      error: `Failed to fetch branches: ${error.message}`
    }, { status: 500 });
  }
}


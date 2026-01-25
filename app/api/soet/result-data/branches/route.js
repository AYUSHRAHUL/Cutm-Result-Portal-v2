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
 * GET /api/soet/result-data/branches
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
    
    const school = 'SOET';
    const dbName = getCampusSchoolDatabase(campus, school);
    const db = client.db(dbName);
    const cutm = db.collection("result");

    // Parse registration to get branch
    const { parseBTechRegistration } = await import('../../parse-registration/route');

    // Build query for batch
    const batchPrefix = batchFilter.length === 4 ? batchFilter.substring(2, 4) : batchFilter;
    const baseQuery = {
      Reg_No: { $type: "string", $regex: `^${batchPrefix}` },
      Grade: { $exists: true }
    };

    // Get sample of records for this batch (limit to prevent large memory usage)
    const sampleRecords = await cutm.find(baseQuery).limit(10000).toArray();
    
    // Extract unique Reg_Nos
    const regNos = [...new Set(sampleRecords.map(r => String(r.Reg_No || '').trim()).filter(Boolean))];

    // Extract branches from Reg_Nos
    const branchShortMap = {
      '111': 'CIVIL',
      '112': 'CSE',
      '113': 'ECE',
      '115': 'EEE',
      '116': 'ME',
      '137': 'AIML'
    };

    const branchSet = new Set();
    regNos.forEach(regNo => {
      if (!regNo) return;
      const parsed = parseBTechRegistration(String(regNo).trim());
      if (parsed && parsed.isValid && parsed.isBTech && parsed.branchCode) {
        const branch = branchShortMap[parsed.branchCode] || (parsed.branch || '').toUpperCase().trim();
        if (branch) {
          branchSet.add(branch);
        }
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


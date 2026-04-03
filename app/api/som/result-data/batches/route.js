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
 * GET /api/som/result-data/batches
 * Get all unique batches from result data
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

    const client = await clientPromise;
    const campusParam = req.nextUrl.searchParams.get('campus');
    const campus = campusParam || payload.campus || null;

    const school = 'SOM';
    const dbName = getCampusSchoolDatabase(campus, school);
    const db = client.db(dbName);
    const cutm = db.collection("som_result");

    // Parse registration to get batch
    const { parseSOMRegistration } = await import('../../parse-registration/route');

    // Use aggregation pipeline to get unique Reg_Nos efficiently
    // This avoids loading all records into memory
    const uniqueRegNos = await cutm.aggregate([
      {
        $match: {
          Reg_No: { $type: "string", $exists: true },
          Grade: { $exists: true }
        }
      },
      {
        $group: {
          _id: "$Reg_No"
        }
      },
      {
        $project: {
          _id: 1,
          Reg_No: "$_id"
        }
      }
    ]).toArray();

    // Extract batches from Reg_Nos
    const batchSet = new Set();

    uniqueRegNos.forEach(item => {
      const regNo = String(item.Reg_No || item._id || '').trim();
      if (!regNo || regNo.length < 12) return;

      const parsed = parseSOMRegistration(regNo);
      if (parsed && parsed.isValid && parsed.isSOM && parsed.year) {
        batchSet.add(parsed.year);
      }
    });

    // Also check overrides for unique batches
    const overridesCol = db.collection("branch_overrides");
    const overrideBatches = await overridesCol.distinct("batch");
    overrideBatches.forEach(b => {
      if (b) batchSet.add(b);
    });

    const batches = Array.from(batchSet).sort();

    return NextResponse.json({
      success: true,
      batches: batches
    });

  } catch (error) {
    console.error('Error fetching batches:', error);
    return NextResponse.json({
      error: `Failed to fetch batches: ${error.message}`
    }, { status: 500 });
  }
}


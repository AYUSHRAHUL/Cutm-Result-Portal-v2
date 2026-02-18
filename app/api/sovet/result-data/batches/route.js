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
 * GET /api/sovet/result-data/batches
 * Get all unique batches from diploma result data
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
    
    const school = 'SOVET';
    const dbName = getCampusSchoolDatabase(campus, school);
    const db = client.db(dbName);
    const cutm = db.collection("result");

    // Get unique batches from diploma result data
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

    // Extract batches from Reg_Nos (diploma format)
    const batchSet = new Set();
    
    uniqueRegNos.forEach(item => {
      const regNo = String(item.Reg_No || item._id || '').trim();
      if (!regNo || regNo.length < 10) return;
      
      // Parse diploma registration format (typically YYXXXXX)
      const match = regNo.match(/^(\d{2})/);
      if (match) {
        const yearCode = match[1];
        const fullYear = parseInt(yearCode) < 50 ? `20${yearCode}` : `19${yearCode}`;
        batchSet.add(fullYear);
      }
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

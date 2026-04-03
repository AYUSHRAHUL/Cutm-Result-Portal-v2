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
 * GET /api/som/placement/joined-companies
 * Get joined companies for students
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
    if (!["admin", "teacher"].includes(userRole)) {
      return NextResponse.json({
        error: "Access denied - Only admins and teachers can access this data"
      }, { status: 403 });
    }

    const client = await clientPromise;
    const campusParam = req.nextUrl.searchParams.get('campus');
    const batchParam = req.nextUrl.searchParams.get('batch');
    const campus = campusParam || payload.campus || null;

    const school = 'SOM';
    const dbName = getCampusSchoolDatabase(campus, school);
    const db = client.db(dbName);
    const joinedCompaniesCollection = db.collection("joined_companies");

    // Build query
    const query = {};
    if (batchParam && batchParam !== 'all') {
      query.batch = batchParam;
    }

    // Get all joined company records
    const joinedCompaniesDocs = await joinedCompaniesCollection.find(query).toArray();

    // Convert to map: regNo -> joinedCompany
    const joinedCompaniesMap = {};
    joinedCompaniesDocs.forEach(doc => {
      if (doc.regNo) {
        joinedCompaniesMap[doc.regNo.trim()] = doc.joinedCompany || 'Not yet joined';
      }
    });

    return NextResponse.json({
      success: true,
      joinedCompanies: joinedCompaniesMap
    });

  } catch (error) {
    console.error('Error fetching joined companies:', error);
    return NextResponse.json({
      error: `Failed to fetch joined companies: ${error.message}`
    }, { status: 500 });
  }
}

/**
 * POST /api/som/placement/joined-companies
 * Update joined company for a student
 */
export async function POST(req) {
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
        error: "Access denied - Only admins can update this data"
      }, { status: 403 });
    }

    const { regNo, joinedCompany } = await req.json();

    if (!regNo) {
      return NextResponse.json({ error: "Registration number is required" }, { status: 400 });
    }

    const client = await clientPromise;
    const campus = payload.campus || null;
    const school = 'SOM';
    const dbName = getCampusSchoolDatabase(campus, school);
    const db = client.db(dbName);
    const joinedCompaniesCollection = db.collection("joined_companies");

    // Get student batch from placements to store with joined company
    const placementsCollection = db.collection("som_placements");
    const placement = await placementsCollection.findOne({ regNo: String(regNo).trim() });
    const batch = placement?.batch || null;

    // Upsert joined company record
    await joinedCompaniesCollection.updateOne(
      { regNo: String(regNo).trim() },
      {
        $set: {
          regNo: String(regNo).trim(),
          joinedCompany: joinedCompany || 'Not yet joined',
          batch: batch,
          updatedAt: new Date(),
          updatedBy: payload.email
        }
      },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      message: "Joined company updated successfully"
    });

  } catch (error) {
    console.error('Error updating joined company:', error);
    return NextResponse.json({
      error: `Failed to update joined company: ${error.message}`
    }, { status: 500 });
  }
}


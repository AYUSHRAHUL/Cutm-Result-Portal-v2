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
 * GET /api/som/placement
 * Get all placement records with optional filters
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

    const { searchParams } = new URL(req.url);
    const batchFilter = searchParams.get("batch");
    const branchFilter = searchParams.get("branch");
    const searchTerm = searchParams.get("search");
    const minPackage = searchParams.get("minPackage");
    const maxPackage = searchParams.get("maxPackage");

    const client = await clientPromise;
    const campusParam = searchParams.get('campus');
    const campus = campusParam || payload.campus || null;

    const school = 'SOM';
    const dbName = getCampusSchoolDatabase(campus, school);
    const db = client.db(dbName);
    const placementsCollection = db.collection("som_placements");

    // Build query (DB-side filters)
    const query = {};
    if (batchFilter && batchFilter.toLowerCase() !== 'all' && batchFilter.trim() !== '') {
      query.batch = batchFilter;
    }
    if (branchFilter && branchFilter.toLowerCase() !== 'all' && branchFilter.trim() !== '') {
      query.branch = { $regex: branchFilter, $options: 'i' };
    }
    if (searchTerm) {
      query.$or = [
        { regNo: { $regex: searchTerm, $options: 'i' } },
        { name: { $regex: searchTerm, $options: 'i' } },
        { companyName: { $regex: searchTerm, $options: 'i' } }
      ];
    }
    // NOTE: we store package in both `package` (string) and `packageLpa` (number).
    // For backward compatibility (older docs may not have packageLpa), we do numeric filtering in-memory.
    const placementsRaw = await placementsCollection.find(query).sort({ batch: -1, regNo: 1 }).toArray();

    let placements = placementsRaw;
    const minNum = minPackage != null && String(minPackage).trim() !== "" ? Number(minPackage) : null;
    const maxNum = maxPackage != null && String(maxPackage).trim() !== "" ? Number(maxPackage) : null;
    if (minNum != null || maxNum != null) {
      placements = placementsRaw.filter((p) => {
        const val = typeof p.packageLpa === "number" ? p.packageLpa : Number.parseFloat(p.package);
        if (!Number.isFinite(val)) return false;
        if (minNum != null && val < minNum) return false;
        if (maxNum != null && val > maxNum) return false;
        return true;
      });
    }

    return NextResponse.json({
      success: true,
      placements: placements,
      count: placements.length
    });

  } catch (error) {
    console.error('Error fetching placements:', error);
    return NextResponse.json({
      error: `Failed to fetch placements: ${error.message}`
    }, { status: 500 });
  }
}

/**
 * POST /api/som/placement
 * Create a new placement record
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
        error: "Access denied - Only admins can create placements"
      }, { status: 403 });
    }

    const { batch, branch, regNo, name, companyName, package: packageAmount } = await req.json();

    if (!batch || !branch || !regNo || !name || !companyName || !packageAmount) {
      return NextResponse.json({
        error: "All fields are required: batch, branch, regNo, name, companyName, package"
      }, { status: 400 });
    }

    const client = await clientPromise;
    const { searchParams } = new URL(req.url);
    const campusParam = searchParams.get('campus');
    const campus = campusParam || payload.campus || null;
    const school = 'SOM';
    const dbName = getCampusSchoolDatabase(campus, school);
    const db = client.db(dbName);
    const placementsCollection = db.collection("som_placements");
    // Index is managed at the database level to prevent locks during CRUD
    // (Ensure regNo + companyName unique index exists once)
    // Check if placement already exists for this student
    const existing = await placementsCollection.findOne({
      regNo: String(regNo).trim(),
      companyName: String(companyName).trim()
    });
    if (existing) {
      return NextResponse.json({
        error: "Placement record already exists for this student with this company"
      }, { status: 400 });
    }

    const pkgNum = Number.parseFloat(String(packageAmount).trim());
    if (!Number.isFinite(pkgNum) || pkgNum <= 0) {
      return NextResponse.json({ error: "Invalid package value" }, { status: 400 });
    }

    const placementData = {
      batch: String(batch).trim(),
      branch: String(branch).trim(),
      regNo: String(regNo).trim(),
      name: String(name).trim(),
      companyName: String(companyName).trim(),
      package: String(pkgNum), // keep as string for UI/back-compat
      packageLpa: pkgNum, // numeric for correct filtering/analytics
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await placementsCollection.insertOne(placementData);

    return NextResponse.json({
      success: true,
      message: "Placement record created successfully",
      id: result.insertedId
    });

  } catch (error) {
    console.error('Error creating placement:', error);
    return NextResponse.json({
      error: `Failed to create placement: ${error.message}`
    }, { status: 500 });
  }
}


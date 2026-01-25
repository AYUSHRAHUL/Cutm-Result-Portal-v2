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
 * PUT /api/soet/placement/update
 * Update a placement record
 */
export async function PUT(req) {
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
        error: "Access denied - Only admins can update placements"
      }, { status: 403 });
    }

    const { id, batch, branch, regNo, name, companyName, package: packageAmount } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Placement ID is required" }, { status: 400 });
    }

    if (!batch || !branch || !regNo || !name || !companyName || !packageAmount) {
      return NextResponse.json({ 
        error: "All fields are required: batch, branch, regNo, name, companyName, package" 
      }, { status: 400 });
    }

    const client = await clientPromise;
    const campus = payload.campus || null;
    const school = 'SOET';
    const dbName = getCampusSchoolDatabase(campus, school);
    const db = client.db(dbName);
    const placementsCollection = db.collection("placements");

    const pkgNum = Number.parseFloat(String(packageAmount).trim());
    if (!Number.isFinite(pkgNum) || pkgNum <= 0) {
      return NextResponse.json({ error: "Invalid package value" }, { status: 400 });
    }

    const updateData = {
      batch: String(batch).trim(),
      branch: String(branch).trim(),
      regNo: String(regNo).trim(),
      name: String(name).trim(),
      companyName: String(companyName).trim(),
      package: String(pkgNum), // keep string for back-compat
      packageLpa: pkgNum, // numeric for correct filtering/analytics
      updatedAt: new Date()
    };

    const { ObjectId } = await import('mongodb');
    const result = await placementsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Placement record not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Placement record updated successfully",
      modifiedCount: result.modifiedCount
    });

  } catch (error) {
    console.error('Error updating placement:', error);
    return NextResponse.json({
      error: `Failed to update placement: ${error.message}`
    }, { status: 500 });
  }
}


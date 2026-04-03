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
 * GET /api/som/placement/meta
 * Returns distinct batches and branches from placements collection (for dropdowns)
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
      return NextResponse.json({ error: "Access denied - Only admins and teachers can access this data" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const campusParam = searchParams.get("campus");
    const campus = campusParam || payload.campus || null;

    const school = "SOM";
    const dbName = getCampusSchoolDatabase(campus, school);
    const client = await clientPromise;
    const db = client.db(dbName);
    const placementsCollection = db.collection("som_placements");

    const [batchesRaw, branchesRaw] = await Promise.all([
      placementsCollection.distinct("batch"),
      placementsCollection.distinct("branch"),
    ]);

    const batches = (batchesRaw || [])
      .map((b) => String(b || "").trim())
      .filter(Boolean)
      .sort((a, b) => b.localeCompare(a)); // newest first

    const branches = (branchesRaw || [])
      .map((b) => String(b || "").trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    return NextResponse.json({ success: true, batches, branches });
  } catch (error) {
    console.error("Error fetching placement meta:", error);
    return NextResponse.json({ error: `Failed to fetch placement meta: ${error.message}` }, { status: 500 });
  }
}



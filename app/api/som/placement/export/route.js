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
 * GET /api/som/placement/export
 * Export placements data in various formats
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
        error: "Access denied - Only admins and teachers can export data"
      }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'csv';
    const batchFilter = searchParams.get('batch');
    const branchFilter = searchParams.get('branch');

    const client = await clientPromise;
    const campusParam = searchParams.get('campus');
    const campus = campusParam || payload.campus || null;

    const school = 'SOM';
    const dbName = getCampusSchoolDatabase(campus, school);
    const db = client.db(dbName);
    const placementsCollection = db.collection("som_placements");

    // Build query
    const query = {};
    if (batchFilter && batchFilter.toLowerCase() !== 'all' && batchFilter.trim() !== '') {
      query.batch = batchFilter;
    }
    if (branchFilter && branchFilter.toLowerCase() !== 'all' && branchFilter.trim() !== '') {
      query.branch = { $regex: branchFilter, $options: 'i' };
    }

    const placements = await placementsCollection.find(query).sort({ batch: -1, regNo: 1 }).toArray();

    if (format === 'csv') {
      const headers = ['Batch', 'Branch', 'Registration Number', 'Name', 'Company Name', 'Package (LPA)'];
      const csv = [
        headers.join(','),
        ...placements.map(p => [
          p.batch || '',
          p.branch || '',
          p.regNo || '',
          `"${(p.name || '').replace(/"/g, '""')}"`,
          `"${(p.companyName || '').replace(/"/g, '""')}"`,
          p.package || ''
        ].join(','))
      ].join('\n');

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="placements_${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    } else if (format === 'json') {
      return NextResponse.json({
        success: true,
        placements: placements
      });
    }

    return NextResponse.json({ error: "Invalid format" }, { status: 400 });
  } catch (error) {
    console.error('Error exporting placements:', error);
    return NextResponse.json({
      error: `Failed to export placements: ${error.message}`
    }, { status: 500 });
  }
}


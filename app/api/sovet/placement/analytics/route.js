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

// Normalize branch names to match student-strength API
function normalizeBranchName(branch) {
  if (!branch) return "Unknown";
  const b = String(branch).trim().toLowerCase();

  // Check AIML first (before CSE check)
  if (b.includes("aiml") || b.includes("artificial")) return "CSE AIML";

  // Civil
  if (b.includes("civil")) return "Civil";

  // CSE
  if (b.includes("computer") || b === "cse") return "CSE";

  // ECE variations
  if (b.includes("electronics") && (b.includes("communication") || b.includes("comm"))) return "ECE";
  if (b === "ece" || b === "ec" || b === "e&c" || b === "e & c") return "ECE";
  if (b.includes("e&c") || b.includes("e & c")) return "ECE";

  // EEE variations
  if (b.includes("electrical") || b === "eee" || b === "ee") return "EEE";

  // Mechanical variations
  if (b.includes("mechanical") || b.includes("mech") || b === "me") return "MECH";

  return branch;
}

/**
 * GET /api/soet/placement/analytics
 * Get placement analytics and statistics
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
        error: "Access denied - Only admins and teachers can access analytics"
      }, { status: 403 });
    }

    const client = await clientPromise;
    const campusParam = req.nextUrl.searchParams.get('campus');
    const batchParam = req.nextUrl.searchParams.get('batch');
    const campus = campusParam || payload.campus || null;

    const school = 'SOVET';
    const dbName = getCampusSchoolDatabase(campus, school);
    const db = client.db(dbName);
    const placementsCollection = db.collection("placements");

    // Build query
    const query = {};
    if (batchParam && batchParam !== 'all') {
      query.batch = batchParam;
    }

    // Get all placements
    const placements = await placementsCollection.find(query).toArray();

    // Calculate statistics - count unique students (not total offer records)
    const uniquePlacedStudents = new Set(placements.map(p => p.regNo?.trim()).filter(Boolean));
    const totalPlacements = uniquePlacedStudents.size;

    // Calculate package statistics
    const packages = placements
      .map(p => (typeof p.packageLpa === "number" ? p.packageLpa : (parseFloat(p.package) || 0)))
      .filter(p => p > 0);

    const avgPackage = packages.length > 0
      ? packages.reduce((sum, p) => sum + p, 0) / packages.length
      : 0;

    const maxPackage = packages.length > 0 ? Math.max(...packages) : 0;
    const minPackage = packages.length > 0 ? Math.min(...packages) : 0;

    // Count unique companies
    const uniqueCompanies = new Set(placements.map(p => p.companyName?.trim()).filter(Boolean));
    const totalCompanies = uniqueCompanies.size;

    // Branch-wise statistics - count unique students (not total placements)
    const branchStats = {};
    placements.forEach(p => {
      const branch = normalizeBranchName(p.branch);
      const regNo = p.regNo?.trim() || '';

      if (!branchStats[branch]) {
        branchStats[branch] = {
          count: 0,
          totalPackage: 0,
          packages: [],
          uniqueStudents: new Set()
        };
      }

      // Only count unique students (if student has 2 offers, count as 1)
      if (regNo && !branchStats[branch].uniqueStudents.has(regNo)) {
        branchStats[branch].uniqueStudents.add(regNo);
        branchStats[branch].count++;
      }

      const pkg = typeof p.packageLpa === "number" ? p.packageLpa : (parseFloat(p.package) || 0);
      if (pkg > 0) {
        branchStats[branch].totalPackage += pkg;
        branchStats[branch].packages.push(pkg);
      }
    });

    // Calculate average package per branch
    Object.keys(branchStats).forEach(branch => {
      const stats = branchStats[branch];
      stats.avgPackage = stats.packages.length > 0
        ? stats.totalPackage / stats.packages.length
        : 0;
      stats.maxPackage = stats.packages.length > 0 ? Math.max(...stats.packages) : 0;
      // Remove Set before sending response (Sets can't be JSON serialized)
      delete stats.uniqueStudents;
    });

    // Batch-wise statistics - count unique students (not total placements)
    const batchStats = {};
    placements.forEach(p => {
      const batch = p.batch || 'Unknown';
      const regNo = p.regNo?.trim() || '';

      if (!batchStats[batch]) {
        batchStats[batch] = {
          count: 0,
          totalPackage: 0,
          packages: [],
          uniqueStudents: new Set()
        };
      }

      // Only count unique students (if student has 2 offers, count as 1)
      if (regNo && !batchStats[batch].uniqueStudents.has(regNo)) {
        batchStats[batch].uniqueStudents.add(regNo);
        batchStats[batch].count++;
      }

      const pkg = typeof p.packageLpa === "number" ? p.packageLpa : (parseFloat(p.package) || 0);
      if (pkg > 0) {
        batchStats[batch].totalPackage += pkg;
        batchStats[batch].packages.push(pkg);
      }
    });

    // Calculate average package per batch
    Object.keys(batchStats).forEach(batch => {
      const stats = batchStats[batch];
      stats.avgPackage = stats.packages.length > 0
        ? stats.totalPackage / stats.packages.length
        : 0;
      stats.maxPackage = stats.packages.length > 0 ? Math.max(...stats.packages) : 0;
      // Remove Set before sending response
      delete stats.uniqueStudents;
    });

    // Company-wise statistics (including branch breakdown)
    const companyStats = {};
    placements.forEach(p => {
      const company = p.companyName?.trim() || 'Unknown';
      const branch = normalizeBranchName(p.branch);
      if (!companyStats[company]) {
        companyStats[company] = { count: 0, totalPackage: 0, packages: [], branchCounts: {} };
      }
      companyStats[company].count++;
      companyStats[company].branchCounts[branch] = (companyStats[company].branchCounts[branch] || 0) + 1;
      const pkg = typeof p.packageLpa === "number" ? p.packageLpa : (parseFloat(p.package) || 0);
      if (pkg > 0) {
        companyStats[company].totalPackage += pkg;
        companyStats[company].packages.push(pkg);
      }
    });

    // Calculate average package per company
    Object.keys(companyStats).forEach(company => {
      const stats = companyStats[company];
      stats.avgPackage = stats.packages.length > 0
        ? stats.totalPackage / stats.packages.length
        : 0;
      stats.maxPackage = stats.packages.length > 0 ? Math.max(...stats.packages) : 0;
    });

    return NextResponse.json({
      success: true,
      data: {
        totalPlacements,
        avgPackage,
        maxPackage,
        minPackage,
        totalCompanies,
        branchStats,
        batchStats,
        companyStats
      }
    });

  } catch (error) {
    console.error('Error fetching placement analytics:', error);
    return NextResponse.json({
      error: `Failed to fetch analytics: ${error.message}`
    }, { status: 500 });
  }
}


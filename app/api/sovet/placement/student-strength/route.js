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

// Map long Diploma branch names to short codes
function toShortBranch(branch) {
  if (!branch) return null;
  const b = String(branch).trim().toUpperCase();

  const branchMap = {
    'CIVIL': 'Civil',
    'CIVIL ENGINEERING': 'Civil',
    'DIPLOMA IN CIVIL ENGINEERING': 'Civil',
    'CSE': 'CSE',
    'COMPUTER SCIENCE': 'CSE',
    'COMPUTER SCIENCE & ENGINEERING': 'CSE',
    'DIPLOMA IN COMPUTER SCIENCE & ENGINEERING': 'CSE',
    'ELECTRICAL': 'Electrical',
    'ELECTRICAL ENGINEERING': 'Electrical',
    'DIPLOMA IN ELECTRICAL ENGINEERING': 'Electrical',
    'MECHANICAL': 'Mechanical',
    'MECHANICAL ENGINEERING': 'Mechanical',
    'DIPLOMA IN MECHANICAL ENGINEERING': 'Mechanical',
    'MINING': 'Mining',
    'MINING ENGINEERING': 'Mining',
    'DIPLOMA IN MINING ENGINEERING': 'Mining',
    'AUTOMOBILE': 'Automobile',
    'AUTOMOBILE ENGINEERING': 'Automobile',
    'DIPLOMA IN AUTOMOBILE ENGINEERING': 'Automobile'
  };

  // Direct map check
  if (branchMap[b]) return branchMap[b];

  // Fuzzy check
  if (b.includes("CIVIL")) return "Civil";
  if (b.includes("COMPUTER") || b.includes("CSE")) return "CSE";
  if (b.includes("ELECTRICAL")) return "Electrical";
  if (b.includes("MECHANICAL") || b.includes("MECH")) return "Mechanical";
  if (b.includes("MINING")) return "Mining";
  if (b.includes("AUTOMOBILE")) return "Automobile";

  return branch;
}

/**
 * GET /api/sovet/placement/student-strength
 * Returns unique student counts by branch & batch using Sem 5/6 registration data (Diploma).
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

    const role = String(payload.role || "").toLowerCase();
    if (!["admin", "teacher"].includes(role)) {
      return NextResponse.json(
        { error: "Access denied - Only admins and teachers can access student strength" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const campusParam = searchParams.get("campus");
    const batchParam = searchParams.get("batch");
    const campus = campusParam || payload.campus || null;

    const client = await clientPromise;
    const school = "SOVET";
    const dbName = getCampusSchoolDatabase(campus, school);
    const db = client.db(dbName);

    const registrationCol = db.collection("RegistrationData");
    const resultCol = db.collection("result");
    const placementsCol = db.collection("placements");

    // Build placement match query
    const placementMatch = {};
    if (batchParam && batchParam !== 'all') {
      placementMatch.batch = batchParam;
    }

    // Fetch final year/sem students (Diploma is 3 years, so Sem 5/6)
    // Adjust sem variants for Diploma
    const semVariants = ["Sem 5", "SEM 5", "sem 5", "5", "Sem 6", "SEM 6", "sem 6", "6"];

    const [regDocs, resultDocs, placementAgg] = await Promise.all([
      registrationCol
        .find({
          Type: "Registration",
          Sem: { $in: semVariants },
        })
        .project({ Reg_No: 1, Rollno: 1, Department: 1 })
        .toArray(),
      resultCol
        .find({
          Sem: { $in: semVariants },
        })
        .project({ Reg_No: 1, Branch: 1, Department: 1 })
        .toArray(),
      placementsCol
        .aggregate([
          { $match: placementMatch },
          {
            $group: {
              _id: "$regNo",
              count: { $sum: 1 },
            },
          },
        ])
        .toArray(),
    ]);

    if (!regDocs.length && !resultDocs.length) {
      return NextResponse.json({
        success: true,
        totalStudents: 0,
        byBranch: {},
        byBatch: {},
      });
    }

    // Import Diploma parser
    const { parseDiplomaRegistration, getBranchFromRegistration } = await import(
      "@/app/api/sovet/parse-registration/route"
    );

    const unique = new Map(); // reg -> { branchShort, batch }

    // First preference: registration data
    for (const doc of regDocs) {
      const regRaw = doc.Reg_No || doc.Rollno;
      if (!regRaw) continue;
      const reg = String(regRaw).trim();
      if (!reg) continue;

      // Parse using Diploma parser
      const parsed = parseDiplomaRegistration(reg);
      if (!parsed || !parsed.isValid) continue;

      const longBranch =
        getBranchFromRegistration(reg, doc.Department) || parsed.branch || doc.Department;
      const branchShort = toShortBranch(longBranch);

      const batchYear = parsed.year || `20${reg.slice(0, 2)}`;

      if (!branchShort || !batchYear) continue;

      if (batchParam && batchParam !== 'all' && batchYear !== batchParam) continue;

      if (!unique.has(reg)) {
        unique.set(reg, {
          branch: branchShort,
          batch: batchYear,
        });
      }
    }

    // Also include result data
    for (const doc of resultDocs) {
      const regRaw = doc.Reg_No;
      if (!regRaw) continue;
      const reg = String(regRaw).trim();
      if (!reg) continue;

      if (unique.has(reg)) continue; // already counted via registration

      const parsed = parseDiplomaRegistration(reg);
      if (!parsed || !parsed.isValid) continue;

      const longBranch =
        getBranchFromRegistration(reg, doc.Branch || doc.Department) ||
        doc.Branch ||
        doc.Department;
      const branchShort = toShortBranch(longBranch);
      const batchYear = parsed.year || `20${reg.slice(0, 2)}`;

      if (!branchShort || !batchYear) continue;

      if (batchParam && batchParam !== 'all' && batchYear !== batchParam) continue;

      unique.set(reg, {
        branch: branchShort,
        batch: batchYear,
      });
    }

    const byBranch = {};
    const byBatch = {};

    // Map of regNo -> placement count
    const placementCountMap = new Map(
      (placementAgg || []).map((p) => [String(p._id).trim(), p.count || 0])
    );

    // Buckets by offer count
    let zeroOffers = 0;
    let oneOffer = 0;
    let twoOffers = 0;
    let moreThanTwo = 0;

    for (const [reg, { branch, batch }] of unique.entries()) {
      byBranch[branch] = (byBranch[branch] || 0) + 1;
      byBatch[batch] = (byBatch[batch] || 0) + 1;

      const offers = placementCountMap.get(reg) || 0;
      if (offers === 0) zeroOffers += 1;
      else if (offers === 1) oneOffer += 1;
      else if (offers === 2) twoOffers += 1;
      else if (offers > 2) moreThanTwo += 1;
    }

    return NextResponse.json({
      success: true,
      totalStudents: unique.size,
      byBranch,
      byBatch,
      offerBuckets: {
        zeroOffers,
        oneOffer,
        twoOffers,
        moreThanTwo,
      },
    });
  } catch (error) {
    console.error("Error computing student strength:", error);
    return NextResponse.json(
      { error: `Failed to compute student strength: ${error.message}` },
      { status: 500 }
    );
  }
}



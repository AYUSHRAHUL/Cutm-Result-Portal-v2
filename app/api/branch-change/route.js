import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
// Helper function to get branch from registration (async)
async function getBranchFromRegistration(registration, department = null) {
  if (!registration) return department || 'Unknown';
  
  // Try SOET B.Tech first
  try {
    const { parseBTechRegistration } = await import('../soet/parse-registration/route');
    const parsed = parseBTechRegistration(registration);
    if (parsed && parsed.isValid && parsed.isBTech) {
      // Use parsed branch name directly (already mapped correctly)
      return parsed.branch || department || 'Unknown';
    }
  } catch {}
  
  // Try SOVET Diploma
  try {
    const { parseDiplomaRegistration } = await import('../sovet/parse-registration/route');
    const parsed = parseDiplomaRegistration(registration);
    if (parsed && parsed.isValid && parsed.isDiploma) {
      // Map parsed branch names to full department names
      const branchNameMap = {
        'Electrical': 'Electrical Engineering (Diploma)',
        'Mechanical': 'Mechanical Engineering (Diploma)',
        'Civil': 'Civil Engineering (Diploma)',
        'CSE': 'Computer Science Engineering (Diploma)',
        'Automobile': 'Automobile Engineering (Diploma)',
        'Mining': 'Mining Engineering (Diploma)'
      };
      return branchNameMap[parsed.branch] || parsed.branch || department || 'Unknown';
    }
  } catch {}
  
  return department || 'Unknown';
}
import { getCampusSchoolDatabase } from "@/lib/campus";

const BRANCH_NORMAL = {
  "CIVIL": "Civil Engineering",
  "CIVIL ENGINEERING": "Civil Engineering",
  "CSE": "Computer Science Engineering",
  "COMPUTER SCIENCE ENGINEERING": "Computer Science Engineering",
  "ECE": "Electronics & Communication Engineering",
  "ELECTRONICS & COMMUNICATION ENGINEERING": "Electronics & Communication Engineering",
  "EEE": "Electrical & Electronics Engineering",
  "ELECTRICAL & ELECTRONICS ENGINEERING": "Electrical & Electronics Engineering",
  "ME": "Mechanical Engineering",
  "MECHANICAL": "Mechanical Engineering",
  "MECHANICAL ENGINEERING": "Mechanical Engineering",
  "AIML": "AIML",
};

function normalizeBranch(x) {
  const key = String(x || "").trim().toUpperCase();
  return BRANCH_NORMAL[key] || null;
}

function normalizeBatch(x) {
  const val = String(x || "").trim();
  if (!/^\d{4}$/.test(val)) return null;
  if (!val.startsWith("20")) return null;
  return val;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const listAll = searchParams.get("all");

    if (listAll === "1") {
      const client = await clientPromise;
      // Get campus and school from request
      const token = req.cookies.get("token")?.value;
      let campus = null;
      let school = null;
      let payload = null;
      if (token) {
        try {
          const { jwtVerify } = await import("jose");
          const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");
          const result = await jwtVerify(token, secret);
          payload = result.payload;
          campus = payload?.campus || null;
          school = payload?.school || null;
        } catch { }
      }
      const { searchParams } = new URL(req.url);
      const campusParam = searchParams.get('campus');
      const schoolParam = searchParams.get('school');
      campus = campusParam || campus || null;
      school = schoolParam || school || null;
      const { getCampusSchoolDatabase } = await import("@/lib/campus");
      const dbName = getCampusSchoolDatabase(campus, school);
      const db = client.db(dbName);
      const overrides = db.collection("branch_overrides");
      const regData = db.collection("registrationData");

      const items = await overrides
        .find({}, { projection: { _id: 0, reg: 1, branch: 1, batch: 1, updatedAt: 1 } })
        .sort({ updatedAt: -1 })
        .limit(200)
        .toArray();

      // Fetch original branch and batch for each registration
      const itemsWithOriginal = await Promise.all(
        items.map(async (item) => {
          const regDoc = await regData.findOne(
            { Reg_No: item.reg.toUpperCase() },
            { projection: { Branch: 1, Department: 1, Batch: 1 } }
          ).catch(() => null);

          // Use diploma helper to detect branch (handles both B.Tech and Diploma)
          const detectedFromReg = await getBranchFromRegistration(item.reg);
          const detectedFromIdx = detectedFromReg !== 'Unknown' ? detectedFromReg : "";
          const originalBranch = normalizeBranch(regDoc?.Branch || regDoc?.Department) || detectedFromIdx || "";
          const originalBatch = normalizeBatch(regDoc?.Batch) || (item.reg.length >= 2 ? `20${item.reg.substring(0, 2)}` : "");

          return {
            ...item,
            originalBranch: originalBranch || null,
            originalBatch: originalBatch || null
          };
        })
      );

      return NextResponse.json({ overrides: itemsWithOriginal });
    }

    const reg = searchParams.get("reg");
    if (!reg) return NextResponse.json({ error: "Missing reg" }, { status: 400 });

    const client = await clientPromise;
    // FIXED: Use context-aware database
    const campus = searchParams.get('campus');
    const school = searchParams.get('school');
    const dbName = getCampusSchoolDatabase(campus, school);
    const db = client.db(dbName);

    const overrides = db.collection("branch_overrides");
    const regData = db.collection("registrationData");

    const overrideDoc = await overrides.findOne({ reg: reg.toUpperCase() });
    const regDoc = await regData.findOne({ Reg_No: reg.toUpperCase() }, { projection: { Branch: 1, Department: 1, Batch: 1 } }).catch(() => null);

    // Use diploma helper to detect branch (handles both B.Tech and Diploma)
    const detectedFromReg = await getBranchFromRegistration(reg);
    const detectedFromIdx = detectedFromReg !== 'Unknown' ? detectedFromReg : "";
    const detected = normalizeBranch(regDoc?.Branch || regDoc?.Department) || detectedFromIdx || "";

    const detectedBatch = normalizeBatch(regDoc?.Batch) || (reg.length >= 2 ? `20${reg.substring(0, 2)}` : "");

    return NextResponse.json({
      reg,
      detected,
      originalBranch: detected, // Original branch from registration data
      override: overrideDoc?.branch || null,
      detectedBatch,
      originalBatch: detectedBatch, // Original batch from registration data
      overrideBatch: overrideDoc?.batch || null
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { reg, newBranch, newBatch } = body;
    if (!reg) return NextResponse.json({ error: "reg is required" }, { status: 400 });
    if (newBranch === undefined && newBatch === undefined) return NextResponse.json({ error: "Provide newBranch or newBatch" }, { status: 400 });

    // Handle "-" as explicit null (remove override)
    const normalizedBranch = newBranch === null ? null : (newBranch ? normalizeBranch(newBranch) : null);
    const normalizedBatch = newBatch === null ? null : (newBatch ? normalizeBatch(newBatch) : null);

    // Validate only if a non-null value was provided
    if (newBranch !== null && newBranch !== undefined && newBranch !== "" && !normalizedBranch) {
      return NextResponse.json({ error: "Invalid branch" }, { status: 400 });
    }
    if (newBatch !== null && newBatch !== undefined && newBatch !== "" && !normalizedBatch) {
      return NextResponse.json({ error: "Invalid batch. Use YYYY (e.g., 2022)" }, { status: 400 });
    }

    const client = await clientPromise;

    // FIXED: Use context-aware database from URL params (appended by frontend)
    const { searchParams } = new URL(req.url);
    const campus = searchParams.get('campus');
    const school = searchParams.get('school');
    const dbName = getCampusSchoolDatabase(campus, school);
    const db = client.db(dbName);

    const overrides = db.collection("branch_overrides");

    // Get existing override to preserve batch if only branch is being updated
    const existing = await overrides.findOne({ reg: reg.toUpperCase() });

    // Build update object - only include fields that should be updated
    const updateFields = { reg: reg.toUpperCase(), updatedAt: new Date() };

    // Update branch if explicitly provided in request body
    if ('newBranch' in body) {
      // newBranch was provided in request (could be null to remove override)
      updateFields.branch = normalizedBranch;
    } else {
      // newBranch was NOT provided - preserve existing branch
      if (existing?.branch !== undefined) {
        updateFields.branch = existing.branch;
      }
    }

    // Update batch if explicitly provided in request body
    if ('newBatch' in body) {
      // newBatch was provided in request (could be null to remove override)
      updateFields.batch = normalizedBatch;
    } else {
      // newBatch was NOT provided - preserve existing batch
      if (existing?.batch !== undefined) {
        updateFields.batch = existing.batch;
      }
    }

    await overrides.updateOne(
      { reg: reg.toUpperCase() },
      { $set: updateFields },
      { upsert: true }
    );

    // Optional: sync registrationData if present
    try {
      const regData = db.collection("registrationData");
      const syncFields = {};
      if (normalizedBranch) {
        syncFields.Branch = normalizedBranch;
        syncFields.Department = normalizedBranch;
      }
      if (normalizedBatch) {
        syncFields.Batch = normalizedBatch;
      }
      if (Object.keys(syncFields).length > 0) {
        await regData.updateMany({ Reg_No: reg.toUpperCase() }, { $set: syncFields });
      }
    } catch { }

    return NextResponse.json({ ok: true, branch: normalizedBranch || null, batch: normalizedBatch || null });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}



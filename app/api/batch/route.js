import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";

export async function POST(req) {
  try {
    const { branch, batch } = await req.json();
    const client = await clientPromise;
    const db = client.db("cutm1");
    const cutm = db.collection("CUTM1");

    const query = {};
    const andConds = [];

    // Batch condition
    if (batch) {
      const yy = batch.length === 4 ? batch.slice(-2) : batch;
      andConds.push({ Reg_No: { $regex: `^${yy}` } });
    }

    // Branch condition: support both Reg_No pattern and branch_overrides
    if (branch) {
      const code = branchCode(branch);
      const orConds = [];
      if (code) orConds.push({ Reg_No: { $regex: `^.{7}${code}` } });

      // Include overrides where admin has changed branch without changing Reg_No
      try {
        const normalized = normalizeBranchFullName(branch);
        if (normalized) {
          const ovDocs = await db.collection("branch_overrides").find({ branch: normalized }).project({ reg: 1 }).toArray();
          const regs = ovDocs.map(d => d.reg).filter(Boolean);
          if (regs.length > 0) {
            orConds.push({ Reg_No: { $in: regs } });
          }
        }
      } catch {}

      if (orConds.length > 0) {
        andConds.push({ $or: orConds });
      }
    }

    if (andConds.length > 0) query.$and = andConds;

    // Get from CUTM1
    const cursor = cutm.find(query).project({ _id: 0, Reg_No: 1, Name: 1 });
    const recordsCutm = await cursor.toArray();

    // Also include RegistrationData so overrides without CUTM1 results still appear
    const regData = db.collection("RegistrationData");
    let regDataQuery = {};
    if (query.$and || query.$or || query.Reg_No) {
      // Mirror same conditions but allow number Reg_No too
      regDataQuery = JSON.parse(JSON.stringify(query));
      if (regDataQuery.Reg_No && regDataQuery.Reg_No.$regex) {
        // leave as-is for regex
      }
    }
    const recordsRegData = await regData.find(regDataQuery).project({ _id: 0, Reg_No: 1, Name: 1 }).toArray().catch(() => []);

    // Merge unique by Reg_No
    const map = new Map();
    for (const r of [...recordsCutm, ...recordsRegData]) {
      if (!r || !r.Reg_No) continue;
      map.set(String(r.Reg_No), r);
    }
    const records = Array.from(map.values());
    return NextResponse.json({ records });
  } catch (err) {
    console.error("/api/batch error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

function branchCode(name) {
  const map = { Civil: '1', CSE: '2', ECE: '3', EEE: '5', Mechanical: '6', AIML: '7' };
  return map[name] || null;
}

function normalizeBranchFullName(input) {
  const up = String(input || "").trim().toUpperCase();
  if (!up) return null;
  if (up === 'AIML' || up.includes('ARTIFICIAL')) return 'AIML';
  if (up === 'CIVIL' || up.includes('CIVIL')) return 'Civil Engineering';
  if (up === 'CSE' || up.includes('COMPUTER')) return 'Computer Science Engineering';
  if (up === 'ECE' || up.includes('ELECTRONICS & COMMUNICATION')) return 'Electronics & Communication Engineering';
  if (up === 'EEE' || (up.includes('ELECTRICAL') && !up.includes('COMMUNICATION'))) return 'Electrical & Electronics Engineering';
  if (up === 'MECHANICAL' || up === 'ME' || up.includes('MECHANICAL')) return 'Mechanical Engineering';
  return null;
}



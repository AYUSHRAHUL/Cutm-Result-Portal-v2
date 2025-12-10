import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";

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
      const db = client.db("cutm1");
      const overrides = db.collection("branch_overrides");
      const items = await overrides
        .find({}, { projection: { _id: 0, reg: 1, branch: 1, batch: 1, updatedAt: 1 } })
        .sort({ updatedAt: -1 })
        .limit(200)
        .toArray();
      return NextResponse.json({ overrides: items });
    }

    const reg = searchParams.get("reg");
    if (!reg) return NextResponse.json({ error: "Missing reg" }, { status: 400 });

    const client = await clientPromise;
    const db = client.db("cutm1");

    const overrides = db.collection("branch_overrides");
    const regData = db.collection("registrationData");

    const overrideDoc = await overrides.findOne({ reg: reg.toUpperCase() });
    const regDoc = await regData.findOne({ Reg_No: reg.toUpperCase() }, { projection: { Branch: 1, Department: 1, Batch: 1 } }).catch(() => null);

    const idx8 = reg.length >= 8 ? reg.charAt(7) : "";
    const idx8Map = {
      "1": "Civil Engineering",
      "2": "Computer Science Engineering",
      "3": "Electronics & Communication Engineering",
      "4": "Electronics & Communication Engineering",
      "5": "Electrical & Electronics Engineering",
      "6": "Mechanical Engineering",
      "7": "AIML",
      "8": "Computer Science Engineering",
      "9": "Civil Engineering",
    };
    const detectedFromIdx = idx8Map[idx8] || "";
    const detected = normalizeBranch(regDoc?.Branch || regDoc?.Department) || detectedFromIdx || "";

    const detectedBatch = normalizeBatch(regDoc?.Batch) || (reg.length >= 2 ? `20${reg.substring(0,2)}` : "");

    return NextResponse.json({ 
      reg, 
      detected, 
      override: overrideDoc?.branch || null,
      detectedBatch,
      overrideBatch: overrideDoc?.batch || null
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { reg, newBranch, newBatch } = await req.json();
    if (!reg) return NextResponse.json({ error: "reg is required" }, { status: 400 });
    if (!newBranch && !newBatch) return NextResponse.json({ error: "Provide newBranch or newBatch" }, { status: 400 });

    const normalizedBranch = newBranch ? normalizeBranch(newBranch) : null;
    const normalizedBatch = newBatch ? normalizeBatch(newBatch) : null;
    if (newBranch && !normalizedBranch) return NextResponse.json({ error: "Invalid branch" }, { status: 400 });
    if (newBatch && !normalizedBatch) return NextResponse.json({ error: "Invalid batch. Use YYYY (e.g., 2022)" }, { status: 400 });

    const client = await clientPromise;
    const db = client.db("cutm1");

    const overrides = db.collection("branch_overrides");
    const update = { reg: reg.toUpperCase(), updatedAt: new Date() };
    if (normalizedBranch) update.branch = normalizedBranch;
    if (normalizedBatch) update.batch = normalizedBatch;

    await overrides.updateOne(
      { reg: reg.toUpperCase() },
      { $set: update },
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
    } catch {}

    return NextResponse.json({ ok: true, branch: normalizedBranch || null, batch: normalizedBatch || null });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}



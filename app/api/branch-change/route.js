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

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const reg = searchParams.get("reg");
    if (!reg) return NextResponse.json({ error: "Missing reg" }, { status: 400 });

    const client = await clientPromise;
    const db = client.db("cutm1");

    const overrides = db.collection("branch_overrides");
    const regData = db.collection("registrationData");

    const overrideDoc = await overrides.findOne({ reg: reg.toUpperCase() });
    const regDoc = await regData.findOne({ Reg_No: reg.toUpperCase() }, { projection: { Branch: 1, Department: 1 } }).catch(() => null);

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

    return NextResponse.json({ reg, detected, override: overrideDoc?.branch || null });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { reg, newBranch } = await req.json();
    if (!reg || !newBranch) return NextResponse.json({ error: "reg and newBranch required" }, { status: 400 });

    const normalized = normalizeBranch(newBranch);
    if (!normalized) return NextResponse.json({ error: "Invalid branch" }, { status: 400 });

    const client = await clientPromise;
    const db = client.db("cutm1");

    const overrides = db.collection("branch_overrides");
    await overrides.updateOne(
      { reg: reg.toUpperCase() },
      { $set: { reg: reg.toUpperCase(), branch: normalized, updatedAt: new Date() } },
      { upsert: true }
    );

    // Optional: sync registrationData if present
    try {
      const regData = db.collection("registrationData");
      await regData.updateMany({ Reg_No: reg.toUpperCase() }, { $set: { Branch: normalized, Department: normalized } });
    } catch {}

    return NextResponse.json({ ok: true, branch: normalized });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}



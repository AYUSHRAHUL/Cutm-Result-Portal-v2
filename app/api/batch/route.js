import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";

export async function POST(req) {
  try {
    const { branch, batch } = await req.json();
    const client = await clientPromise;
    const db = client.db("cutm1");
    const cutm = db.collection("CUTM1");

    const query = {};
    const and = [];
    if (branch) {
      const code = branchCode(branch);
      if (code) and.push({ Reg_No: { $regex: `^.{7}${code}` } });
    }
    if (batch) {
      const yy = batch.length === 4 ? batch.slice(-2) : batch;
      and.push({ Reg_No: { $regex: `^${yy}` } });
    }
    if (and.length) query.$and = and;

    const cursor = cutm.find(query).project({ _id: 0 });
    const records = await cursor.toArray();
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



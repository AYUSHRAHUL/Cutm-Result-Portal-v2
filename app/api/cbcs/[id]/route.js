import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function PUT(req, { params }) {
  try {
    const id = params.id;
    const updates = await req.json();
    const client = await clientPromise;
    const db = client.db("cutm1");

    const set = {};
    if (typeof updates.Branch === "string") set["Branch"] = updates.Branch.trim();
    if (typeof updates.Basket === "string") set["Basket"] = updates.Basket.trim();
    if (typeof updates.SubjectCode === "string") set["Subject Code"] = updates.SubjectCode.trim().toUpperCase();
    if (typeof updates.SubjectName === "string") set["Subject_name"] = updates.SubjectName.trim();
    if (updates.Credits !== undefined) set["Credits"] = String(updates.Credits).trim();

    const col = db.collection("cbcs");

    // Try update by ObjectId first, then fallback to string _id
    let matched = 0;
    let filterUsed = null;
    if (ObjectId.isValid(id)) {
      const res1 = await col.updateOne({ _id: new ObjectId(id) }, { $set: set });
      matched = res1.matchedCount;
      if (matched) filterUsed = { _id: new ObjectId(id) };
    }
    if (!matched) {
      const res2 = await col.updateOne({ _id: id }, { $set: set });
      matched = res2.matchedCount;
      if (matched) filterUsed = { _id: id };
    }

    if (!matched) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const item = await col.findOne(filterUsed, { projection: {} });
    return NextResponse.json({ success: true, item: item || null });
  } catch (err) {
    console.error("CBCS PUT error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const id = params.id;
    const client = await clientPromise;
    const db = client.db("cutm1");
    const res = await db.collection("cbcs").deleteOne({ _id: new ObjectId(id) });
    if (res.deletedCount === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("CBCS DELETE error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}



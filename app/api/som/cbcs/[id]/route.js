import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { getCampusSchoolDatabase } from "@/lib/campus";

/**
 * SOM CBCS [id] Route - SOM (BBA/MBA) only
 */
export async function PUT(req, { params }) {
  try {
    const id = params.id;
    const updates = await req.json();
    const client = await clientPromise;

    // Get campus from params or token
    const { searchParams } = new URL(req.url);
    const token = req.cookies.get("token")?.value;
    let payload = {};
    if (token) {
      const { jwtVerify } = await import("jose");
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");
      try { payload = (await jwtVerify(token, secret)).payload; } catch { }
    }

    const campusParam = searchParams.get('campus');
    const campus = campusParam || payload.campus || null;
    
    // Force school to SOM
    const school = 'SOM';
    const dbName = getCampusSchoolDatabase(campus, school);
    const db = client.db(dbName);

    const set = {};
    if (typeof updates.Branch === "string") set["Branch"] = updates.Branch.trim();
    if (typeof updates.Basket === "string") set["Basket"] = updates.Basket.trim();
    if (typeof updates.SubjectCode === "string") set["Subject Code"] = updates.SubjectCode.trim().toUpperCase();
    if (typeof updates.SubjectName === "string") set["Subject_name"] = updates.SubjectName.trim();
    if (updates.Credits !== undefined) set["Credits"] = String(updates.Credits).trim();
    if (updates.AlternativeCode !== undefined) {
      const alt = typeof updates.AlternativeCode === "string" ? updates.AlternativeCode.trim().toUpperCase() : "";
      set["Alternative Code"] = alt;
    }

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
    console.error("SOM CBCS PUT error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const id = params.id;
    const client = await clientPromise;

    // Get campus from params or token
    const { searchParams } = new URL(req.url);
    const token = req.cookies.get("token")?.value;
    let payload = {};
    if (token) {
      const { jwtVerify } = await import("jose");
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");
      try { payload = (await jwtVerify(token, secret)).payload; } catch { }
    }

    const campusParam = searchParams.get('campus');
    const campus = campusParam || payload.campus || null;
    
    // Force school to SOM
    const school = 'SOM';
    const dbName = getCampusSchoolDatabase(campus, school);
    const db = client.db(dbName);
    
    const res = await db.collection("cbcs").deleteOne({ _id: new ObjectId(id) });
    if (res.deletedCount === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("SOM CBCS DELETE error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

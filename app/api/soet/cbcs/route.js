import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { getCampusSchoolDatabase } from "@/lib/campus";
import { requireRole } from "@/lib/api-auth";

/**
 * SOET CBCS Route - B.Tech subjects only
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const branch = searchParams.get("branch") || "";
    const basket = searchParams.get("basket") || "";
    const search = searchParams.get("search") || "";
    const limitParam = searchParams.get("limit");
    const limit = limitParam === null ? 200 : Number(limitParam);

    // Reading the subject catalog: admin dashboards and the teacher basket/backlog pages
    const { payload, error } = await requireRole(req, ["admin", "teacher"]);
    if (error) return error;

    const client = await clientPromise;

    const campusParam = searchParams.get('campus');
    const campus = campusParam || payload.campus || null;
    
    // Force school to SOET
    const school = 'SOET';
    const dbName = getCampusSchoolDatabase(campus, school);
    const db = client.db(dbName);
    
    const query = {};
    const andConditions = [];

    if (branch) {
      // Handle B.Tech branches only
      andConditions.push({
        "$or": [
          { "Branch": branch },
          { "Branch": { $regex: `^${branch}/`, $options: "i" } },
          { "Branch": { $regex: `/${branch}/`, $options: "i" } },
          { "Branch": { $regex: `/${branch}$`, $options: "i" } },
          { "Branch": { $regex: `^${branch},`, $options: "i" } },
          { "Branch": { $regex: `,${branch},`, $options: "i" } },
          { "Branch": { $regex: `,${branch}$`, $options: "i" } }
        ]
      });
    }

    if (basket) {
      andConditions.push({ "Basket": basket });
    }

    if (search) {
      andConditions.push({
        "$or": [
          { "Subject_name": { $regex: search, $options: "i" } },
          { "Subject Code": { $regex: search, $options: "i" } },
          { "Alternative Code": { $regex: search, $options: "i" } },
        ]
      });
    }

    if (andConditions.length > 0) {
      query["$and"] = andConditions;
    }
    
    const cursor = db.collection("cbcs").find(query);
    const items = Number.isFinite(limit) && limit > 0 ? await cursor.limit(limit).toArray() : await cursor.toArray();
    
    return NextResponse.json({ 
      success: true, 
      items,
      school: 'SOET'
    });
  } catch (err) {
    console.error("SOET CBCS GET error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    // Creating catalog entries is an admin-only action
    const { payload, error } = await requireRole(req, ["admin"]);
    if (error) return error;

    const body = await req.json();
    const Branch = typeof body.Branch === 'string' ? body.Branch.trim() : '';
    const Basket = typeof body.Basket === 'string' ? body.Basket.trim() : '';
    const SubjectCode = typeof body.SubjectCode === 'string' ? body.SubjectCode.trim().toUpperCase() : '';
    const SubjectName = typeof body.SubjectName === 'string' ? body.SubjectName.trim() : '';
    const AlternativeCode = typeof body.AlternativeCode === 'string' ? body.AlternativeCode.trim().toUpperCase() : '';
    const CreditsRaw = body.Credits;
    
    if (!Branch || !SubjectCode || !SubjectName) {
      return NextResponse.json({ error: "Branch, SubjectCode, SubjectName required" }, { status: 400 });
    }
    
    const Credits = CreditsRaw === undefined || CreditsRaw === null || CreditsRaw === ''
      ? ''
      : String(CreditsRaw).trim();
    
    const doc = { Branch, Basket, "Subject Code": SubjectCode, Subject_name: SubjectName, Credits };
    if (AlternativeCode) doc["Alternative Code"] = AlternativeCode;
    const client = await clientPromise;

    const { searchParams } = new URL(req.url);
    const campusParam = searchParams.get('campus');
    const campus = campusParam || payload.campus || null;
    
    // Force school to SOET
    const school = 'SOET';
    const dbName = getCampusSchoolDatabase(campus, school);
    const db = client.db(dbName);
    
    const res = await db.collection("cbcs").insertOne(doc);
    const item = await db.collection("cbcs").findOne({ _id: res.insertedId });
    
    return NextResponse.json({ 
      success: true, 
      item,
      school: 'SOET'
    });
  } catch (err) {
    console.error("SOET CBCS POST error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

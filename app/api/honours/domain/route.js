import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { verifyToken } from "@/lib/auth";

export async function GET(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.email) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const userRole = payload.role?.toLowerCase();
    if (!['admin', 'teacher'].includes(userRole)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const domain = searchParams.get("domain") || "";
    const search = searchParams.get("search") || "";
    const limit = parseInt(searchParams.get("limit") || "1000");

    const client = await clientPromise;
    const db = await (async () => { const { getDatabaseFromRequest } = await import("@/lib/db-helper"); const dbName = await getDatabaseFromRequest(req); return client.db(dbName); })();

    let query = {};
    if (domain) query.Domain = domain;
    if (search) {
      query.$or = [
        { "Subject Code": { $regex: search, $options: "i" } },
        { SubjectCode: { $regex: search, $options: "i" } },
        { Subject_Name: { $regex: search, $options: "i" } }
      ];
    }

    const items = await db.collection("honours_domain_subjects")
      .find(query)
      .limit(limit)
      .toArray();

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Error fetching domain subjects:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.email || payload.role?.toLowerCase() !== "admin") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await req.json();
    const { Domain, SubjectCode, SubjectName, Credits } = body;

    if (!Domain || !SubjectCode || !SubjectName || !Credits) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = await (async () => { const { getDatabaseFromRequest } = await import("@/lib/db-helper"); const dbName = await getDatabaseFromRequest(req); return client.db(dbName); })();

    // Check for duplicate subject code in the same domain
    const existing = await db.collection("honours_domain_subjects").findOne({
      Domain: Domain,
      $or: [
        { "Subject Code": SubjectCode },
        { SubjectCode: SubjectCode }
      ]
    });

    if (existing) {
      return NextResponse.json({ 
        error: `Subject with code "${SubjectCode}" already exists in domain "${Domain}"` 
      }, { status: 400 });
    }

    const newSubject = {
      Domain,
      "Subject Code": SubjectCode,
      SubjectCode,
      Subject_Name: SubjectName,
      Credits: String(Credits),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection("honours_domain_subjects").insertOne(newSubject);

    return NextResponse.json({ 
      success: true, 
      message: "Domain subject added successfully",
      id: result.insertedId 
    });
  } catch (error) {
    console.error("Error adding domain subject:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}




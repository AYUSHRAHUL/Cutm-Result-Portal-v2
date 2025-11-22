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
    const branch = searchParams.get("branch") || "";
    const domain = searchParams.get("domain") || "";
    const search = searchParams.get("search") || "";
    const limit = parseInt(searchParams.get("limit") || "1000");

    const client = await clientPromise;
    const db = client.db("cutm1");

    let query = {};
    if (branch) query.Branch = branch;
    if (domain) query.Domain = domain;
    if (search) {
      query.$or = [
        { RegistrationNo: { $regex: search, $options: "i" } },
        { Registration_No: { $regex: search, $options: "i" } },
        { Name: { $regex: search, $options: "i" } }
      ];
    }

    const items = await db.collection("honours_students")
      .find(query)
      .limit(limit)
      .toArray();

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Error fetching honours students:", error);
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
    const { RegistrationNo, Name, Branch, Domain } = body;

    if (!RegistrationNo || !Name || !Branch || !Domain) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("cutm1");

    // Check if student already exists
    const existing = await db.collection("honours_students")
      .findOne({ 
        $or: [
          { RegistrationNo },
          { Registration_No: RegistrationNo }
        ]
      });

    if (existing) {
      return NextResponse.json({ error: "Student already in honours list" }, { status: 400 });
    }

    const newStudent = {
      RegistrationNo,
      Registration_No: RegistrationNo,
      Name,
      Branch,
      Domain,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection("honours_students").insertOne(newStudent);

    return NextResponse.json({ 
      success: true, 
      message: "Student added to honours list successfully",
      id: result.insertedId 
    });
  } catch (error) {
    console.error("Error adding honours student:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}




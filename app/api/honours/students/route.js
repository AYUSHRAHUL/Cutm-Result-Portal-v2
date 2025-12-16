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
    const batch = searchParams.get("batch") || "";
    const domain = searchParams.get("domain") || "";
    const search = searchParams.get("search") || "";
    const limit = parseInt(searchParams.get("limit") || "1000");

    const client = await clientPromise;
    // Get database based on campus and school
    const campusParam = searchParams.get('campus');
    const schoolParam = searchParams.get('school');
    const campus = campusParam || payload.campus || null;
    const school = schoolParam || payload.school || null;
    const { getCampusSchoolDatabase } = await import("@/lib/campus");
    const dbName = getCampusSchoolDatabase(campus, school);
    const db = client.db(dbName);

    let query = {};
    
    // Branch filter
    if (branch && branch !== "" && branch !== "All") {
      query.Branch = branch;
    }
    
    // Domain filter
    if (domain && domain !== "" && domain !== "All") {
      query.Domain = domain;
    }
    
    // Batch filter - extract from registration number
    if (batch && batch !== "" && batch !== "All") {
      const batchStr = String(batch).trim();
      const yy = batchStr.length === 4 && batchStr.startsWith("20") ? batchStr.slice(2) : batchStr.slice(-2);
      const batchPattern = `^${yy}`;
      query.$or = [
        { RegistrationNo: { $regex: batchPattern } },
        { Registration_No: { $regex: batchPattern } }
      ];
    }
    
    // Search filter
    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: "i" };
      if (query.$or) {
        // If batch filter exists, combine with search
        query.$and = [
          { $or: query.$or },
          {
            $or: [
              { RegistrationNo: searchRegex },
              { Registration_No: searchRegex },
              { Name: searchRegex }
            ]
          }
        ];
        delete query.$or;
      } else {
        query.$or = [
          { RegistrationNo: searchRegex },
          { Registration_No: searchRegex },
          { Name: searchRegex }
        ];
      }
    }

    const items = await db.collection("honours_students")
      .find(query)
      .limit(limit)
      .sort({ createdAt: -1 })
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
    // Get database based on campus and school
    const campusParam = searchParams.get('campus');
    const schoolParam = searchParams.get('school');
    const campus = campusParam || payload.campus || null;
    const school = schoolParam || payload.school || null;
    const { getCampusSchoolDatabase } = await import("@/lib/campus");
    const dbName = getCampusSchoolDatabase(campus, school);
    const db = client.db(dbName);

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




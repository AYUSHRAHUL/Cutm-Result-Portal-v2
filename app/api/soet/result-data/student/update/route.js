import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { jwtVerify } from "jose";
import { getCampusSchoolDatabase } from "@/lib/campus";

async function verifyToken(token) {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

/**
 * PUT /api/soet/result-data/student/update
 * Update a specific student's data for a subject (no OTP required)
 */
export async function PUT(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized - Please login first" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.email) {
      return NextResponse.json({ error: "Unauthorized - Invalid token" }, { status: 401 });
    }

    const userRole = payload.role?.toLowerCase();
    if (!["admin"].includes(userRole)) {
      return NextResponse.json({
        error: "Access denied - Only admins can update data"
      }, { status: 403 });
    }

    const { regNo, subjectCode, batch, branch, semester, updates } = await req.json();

    if (!regNo || !subjectCode || !batch || !branch || !semester || !updates) {
      return NextResponse.json({ 
        error: "Registration number, subject code, batch, branch, semester, and updates are required" 
      }, { status: 400 });
    }

    const client = await clientPromise;
    const campus = payload.campus || null;
    const school = 'SOET';
    const dbName = getCampusSchoolDatabase(campus, school);
    const db = client.db(dbName);
    const cutm = db.collection("result");

    // Build update query
    const normalizedSubjectCode = subjectCode.toUpperCase().trim();
    const cleanSem = String(semester).replace(/^Sem\s*/i, "").trim();
    
    const updateQuery = {
      Reg_No: String(regNo).trim(),
      $or: [
        { Subject_Code: normalizedSubjectCode },
        { "Subject Code": normalizedSubjectCode }
      ],
      Sem: {
        $in: [
          semester,
          cleanSem,
          `Sem ${cleanSem}`,
          `Sem${cleanSem}`,
          parseInt(cleanSem),
          String(parseInt(cleanSem))
        ].filter(Boolean)
      }
    };

    // Prepare update object
    const updateFields = {};
    if (updates.grade !== undefined) updateFields.Grade = String(updates.grade).trim();
    if (updates.credits !== undefined) {
      updateFields.Credits = String(updates.credits).trim();
      updateFields.Credit = String(updates.credits).trim();
    }
    if (updates.subjectName !== undefined) {
      updateFields.Subject_Name = String(updates.subjectName).trim();
      updateFields["Subject Name"] = String(updates.subjectName).trim();
    }
    if (updates.name !== undefined) {
      updateFields.Name = String(updates.name).trim();
      updateFields.name = String(updates.name).trim();
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ 
        error: "No valid fields to update" 
      }, { status: 400 });
    }

    const result = await cutm.updateMany(
      updateQuery,
      { $set: updateFields }
    );

    return NextResponse.json({
      success: true,
      message: `Updated ${result.modifiedCount} record(s) for student ${regNo}`,
      modifiedCount: result.modifiedCount
    });

  } catch (error) {
    console.error('Error updating student data:', error);
    return NextResponse.json({
      error: `Failed to update student data: ${error.message}`
    }, { status: 500 });
  }
}


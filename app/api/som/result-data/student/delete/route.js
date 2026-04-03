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
 * DELETE /api/som/result-data/student/delete
 * Delete a specific student's data for a subject (no OTP required)
 */
export async function DELETE(req) {
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
        error: "Access denied - Only admins can delete data"
      }, { status: 403 });
    }

    const { regNo, subjectCode, batch, branch, semester } = await req.json();

    if (!regNo || !subjectCode || !batch || !branch || !semester) {
      return NextResponse.json({ 
        error: "Registration number, subject code, batch, branch, and semester are required" 
      }, { status: 400 });
    }

    const client = await clientPromise;
    const campus = payload.campus || null;
    const school = 'SOM';
    const dbName = getCampusSchoolDatabase(campus, school);
    const db = client.db(dbName);
    const cutm = db.collection("som_result");

    // Build delete query
    const normalizedSubjectCode = subjectCode.toUpperCase().trim();
    const cleanSem = String(semester).replace(/^Sem\s*/i, "").trim();
    
    const deleteQuery = {
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

    const result = await cutm.deleteMany(deleteQuery);

    return NextResponse.json({
      success: true,
      message: `Deleted ${result.deletedCount} record(s) for student ${regNo}`,
      deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error('Error deleting student data:', error);
    return NextResponse.json({
      error: `Failed to delete student data: ${error.message}`
    }, { status: 500 });
  }
}


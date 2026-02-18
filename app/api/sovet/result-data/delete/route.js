import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { jwtVerify } from "jose";
import { getCampusSchoolDatabase } from "@/lib/campus";
import { verifyOTP, removeOTP } from "@/lib/otpStore";

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
 * POST /api/sovet/result-data/delete
 * Delete subject data after OTP verification (diploma)
 */
export async function POST(req) {
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
        error: "Access denied - Only admins can perform this action"
      }, { status: 403 });
    }

    const body = await req.json();
    const { subject, batch, branch, semester, otp } = body;

    if (!subject || !batch || !branch || !semester || !otp) {
      return NextResponse.json({ error: "Subject, batch, branch, semester, and OTP are required" }, { status: 400 });
    }

    const adminEmail = payload.email;

    // Verify OTP
    const otpResult = verifyOTP(adminEmail, otp.trim());
    if (!otpResult.success) {
      return NextResponse.json({ error: otpResult.error || "Invalid or expired OTP" }, { status: 400 });
    }

    // Verify deletion context matches
    const otpData = otpResult.data;
    if (otpData.type !== 'delete-subject-data' ||
        otpData.subject !== subject ||
        otpData.batch !== batch ||
        otpData.branch !== branch ||
        otpData.semester !== semester) {
      return NextResponse.json({ error: "OTP context mismatch" }, { status: 400 });
    }

    const client = await clientPromise;
    const campusParam = body.campus || payload.campus || null;
    
    const school = 'SOVET';
    const dbName = getCampusSchoolDatabase(campusParam, school);
    const db = client.db(dbName);
    const cutm = db.collection("result");

    // Build proper MongoDB query with $and/$or nesting
    const andConditions = [
      {
        $or: [
          { Subject_Code: subject.toUpperCase() },
          { "Subject Code": subject.toUpperCase() }
        ]
      },
      { Reg_No: { $type: "string" } },
      { Grade: { $exists: true } }
    ];

    // Add batch filter
    if (batch && batch !== "all") {
      const batchPrefix = batch.length === 4 ? batch.substring(2, 4) : batch;
      andConditions.push({
        Reg_No: { $regex: `^${batchPrefix}` }
      });
    }

    // Add branch filter
    if (branch && branch !== "all") {
      andConditions.push({
        $or: [
          { Branch: branch },
          { Program: branch }
        ]
      });
    }

    // Add semester filter
    if (semester && semester !== "all") {
      const cleanSem = String(semester).replace(/^Sem\s*/i, "").trim();
      const semNum = parseInt(cleanSem);
      andConditions.push({
        Sem: {
          $in: [
            semester,
            cleanSem,
            `Sem ${cleanSem}`,
            `Sem${cleanSem}`,
            ...(isNaN(semNum) ? [] : [semNum, String(semNum)])
          ].filter(Boolean)
        }
      });
    }

    // Build final query
    const query = { $and: andConditions };

    // Delete records
    const result = await cutm.deleteMany(query);

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "No records found to delete" }, { status: 404 });
    }

    // Remove OTP after successful deletion
    removeOTP(adminEmail, otp.trim());

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} records`,
      deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error('Error deleting subject data:', error);
    return NextResponse.json({
      error: `Failed to delete subject data: ${error.message}`
    }, { status: 500 });
  }
}

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
 * POST /api/soet/result-data/delete
 * Delete subject data after OTP verification
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
    
    const school = 'SOET';
    const dbName = getCampusSchoolDatabase(campusParam, school);
    const db = client.db(dbName);
    const cutm = db.collection("result");

    // Parse registration to get branch code
    const { parseBTechRegistration } = await import('../../parse-registration/route');

    // Build query using $and pattern for proper MongoDB query construction
    const andConditions = [
      {
        $or: [
          { Subject_Code: subject.toUpperCase() },
          { "Subject Code": subject.toUpperCase() }
        ],
        Reg_No: { $type: "string" },
        Grade: { $exists: true }
      }
    ];

    // Add batch filter
    if (batch && batch !== "all") {
      const batchPrefix = batch.length === 4 ? batch.substring(2, 4) : batch;
      andConditions.push({
        Reg_No: { $regex: `^${batchPrefix}` }
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
    const query = andConditions.length > 1 ? { $and: andConditions } : andConditions[0];

    // First, get records to verify branch filtering (with limit to prevent excessive MongoDB connections)
    const MAX_DELETE_RECORDS = 50000; // Limit to 50k records
    let records = await cutm.find(query).limit(MAX_DELETE_RECORDS).toArray();

    // Filter for B.Tech students and specific branch
    const branchShortMap = {
      '111': 'CIVIL',
      '112': 'CSE',
      '113': 'ECE',
      '115': 'EEE',
      '116': 'ME',
      '137': 'AIML'
    };
    const filterShortMap = {
      'CSE': 'CSE',
      'AIML': 'AIML',
      'ECE': 'ECE',
      'EEE': 'EEE',
      'ME': 'ME',
      'MECHANICAL': 'ME',
      'CIVIL': 'CIVIL'
    };
    const filterShort = filterShortMap[branch.toUpperCase()] || branch.toUpperCase();

    const recordsToDelete = records.filter(record => {
      if (!record.Reg_No) return false;
      const parsed = parseBTechRegistration(String(record.Reg_No).trim());
      if (!parsed || !parsed.isValid || !parsed.isBTech) return false;

      const parsedShort = branchShortMap[parsed.branchCode] || (parsed.branch || '').toUpperCase().trim();
      return parsedShort === filterShort;
    });

    if (recordsToDelete.length === 0) {
      return NextResponse.json({ error: "No records found to delete" }, { status: 404 });
    }

    // Delete records
    const deleteQuery = {
      _id: { $in: recordsToDelete.map(r => r._id) }
    };

    const deleteResult = await cutm.deleteMany(deleteQuery);

    // Remove OTP after successful deletion
    removeOTP(adminEmail);

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${deleteResult.deletedCount} record(s)`,
      deletedCount: deleteResult.deletedCount
    });

  } catch (error) {
    console.error('Error deleting data:', error);
    return NextResponse.json({
      error: `Failed to delete data: ${error.message}`
    }, { status: 500 });
  }
}


import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { jwtVerify } from "jose";
import { ObjectId } from "mongodb";
import { generateOTP, storeOTP, verifyOTP, removeOTP } from "@/lib/otpStore";
import { sendOTPToMultipleEmails, COORDINATOR_EMAIL } from "@/lib/email";
import { loadBranchOverrides } from "@/lib/branch-overrides";
// Helper function to get branch from registration
async function getBranchFromRegistration(registration, department = null) {
  if (!registration) return department || 'Unknown';
  
  // Try SOET B.Tech first
  try {
    const { parseBTechRegistration } = await import('../soet/parse-registration/route');
    const parsed = parseBTechRegistration(registration);
    if (parsed && parsed.isValid && parsed.isBTech) {
      return parsed.branch || department || 'Unknown';
    }
  } catch {}
  
  // Try SOVET Diploma
  try {
    const { parseDiplomaRegistration } = await import('../sovet/parse-registration/route');
    const parsed = parseDiplomaRegistration(registration);
    if (parsed && parsed.isValid && parsed.isDiploma) {
      return parsed.branch || department || 'Unknown';
    }
  } catch {}
  
  // Try SOM BBA/MBA
  try {
    const { parseSOMRegistration } = await import('../som/parse-registration/route');
    const parsed = parseSOMRegistration(registration);
    if (parsed && parsed.isValid && parsed.isSOM) {
      return parsed.branch || department || 'Unknown';
    }
  } catch {}
  
  return department || 'Unknown';
}

// JWT verification helper
async function verifyToken(token) {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

export async function GET(req) {
  try {
    // Check authentication
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized - Please login first" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.email) {
      return NextResponse.json({ error: "Unauthorized - Invalid token" }, { status: 401 });
    }

    // Check if user is admin
    const userRole = payload.role?.toLowerCase();
    if (userRole !== 'admin') {
      return NextResponse.json({ 
        error: "Access denied - Only admins can view registration data" 
      }, { status: 403 });
    }

    const client = await clientPromise;
    // Get campus and school from query params (priority) or payload
    const { searchParams } = new URL(req.url);
    const campusParam = searchParams.get('campus');
    const schoolParam = searchParams.get('school');
    const campus = campusParam || payload.campus || null;
    const school = schoolParam || payload.school || null;
    const { getCampusSchoolDatabase } = await import("@/lib/campus");
    const dbName = getCampusSchoolDatabase(campus, school);
    const db = client.db(dbName);
    const collection = db.collection("RegistrationData");

    // Get all registration data
    const data = await collection.find({ Type: 'Registration' }).toArray();
    
    // An admin-assigned branch wins, so a student whose branch code the parser
    // cannot read is listed under the branch they were assigned rather than Unknown.
    const branchOverrides = await loadBranchOverrides(db);

    // Calculate statistics
    const stats = {
      totalRecords: data.length,
      uniqueStudents: new Set(data.map(item => item.Reg_No)).size,
      semesters: [...new Set(data.map(item => item.Sem))].sort(),
      departments: [...new Set(await Promise.all(data.map(async (item) => {
        if (item.Reg_No) {
          const ov = branchOverrides.get(String(item.Reg_No).trim().toUpperCase());
          if (ov?.branch) return ov.branch;
          const branch = await getBranchFromRegistration(item.Reg_No);
          return branch !== 'Unknown' ? branch : 'Unknown';
        }
        return 'Unknown';
      })))].sort()
    };

    return NextResponse.json({
      success: true,
      data,
      stats
    });

  } catch (error) {
    console.error('Registration data fetch error:', error);
    return NextResponse.json({ 
      error: `Failed to fetch registration data: ${error.message}` 
    }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    // Check authentication
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized - Please login first" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.email) {
      return NextResponse.json({ error: "Unauthorized - Invalid token" }, { status: 401 });
    }

    // Check if user is admin
    const userRole = payload.role?.toLowerCase();
    if (userRole !== 'admin') {
      return NextResponse.json({ 
        error: "Access denied - Only admins can edit registration data" 
      }, { status: 403 });
    }

    const body = await req.json();
    const { recordId, updates } = body;

    if (!recordId || !updates) {
      return NextResponse.json({ error: "Missing recordId or updates" }, { status: 400 });
    }

    const client = await clientPromise;
    // Get campus and school from query params (priority) or payload
    const { searchParams } = new URL(req.url);
    const campusParam = searchParams.get('campus');
    const schoolParam = searchParams.get('school');
    const campus = campusParam || payload.campus || null;
    const school = schoolParam || payload.school || null;
    const { getCampusSchoolDatabase } = await import("@/lib/campus");
    const dbName = getCampusSchoolDatabase(campus, school);
    const db = client.db(dbName);
    const collection = db.collection("RegistrationData");

    // Convert recordId to ObjectId
    let recordObjectId;
    try {
      recordObjectId = new ObjectId(recordId);
    } catch (error) {
      return NextResponse.json({ error: "Invalid record ID format" }, { status: 400 });
    }

    // Update the record
    const result = await collection.findOneAndUpdate(
      { _id: recordObjectId, Type: 'Registration' },
      { $set: updates },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Record updated successfully",
      data: result.value
    });

  } catch (error) {
    console.error('Registration data update error:', error);
    return NextResponse.json({ 
      error: `Failed to update registration data: ${error.message}` 
    }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    // Check authentication
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized - Please login first" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.email) {
      return NextResponse.json({ error: "Unauthorized - Invalid token" }, { status: 401 });
    }

    // Check if user is admin
    const userRole = payload.role?.toLowerCase();
    if (userRole !== 'admin') {
      return NextResponse.json({ 
        error: "Access denied - Only admins can delete registration data" 
      }, { status: 403 });
    }

    const client = await clientPromise;
    // Get campus and school from query params (priority) or payload
    const { searchParams } = new URL(req.url);
    const campusParam = searchParams.get('campus');
    const schoolParam = searchParams.get('school');
    const campus = campusParam || payload.campus || null;
    const school = schoolParam || payload.school || null;
    const { getCampusSchoolDatabase } = await import("@/lib/campus");
    const dbName = getCampusSchoolDatabase(campus, school);
    const db = client.db(dbName);
    const collection = db.collection("RegistrationData");

    // Check if specific record IDs are provided
    const url = new URL(req.url);
    const recordIds = url.searchParams.get('ids');
    
    if (recordIds) {
      // Delete specific records
      const ids = recordIds.split(',').map(id => {
        try {
          return new ObjectId(id);
        } catch {
          return null;
        }
      }).filter(id => id !== null);

      if (ids.length === 0) {
        return NextResponse.json({ error: "Invalid record IDs" }, { status: 400 });
      }

      const result = await collection.deleteMany({ 
        _id: { $in: ids },
        Type: 'Registration' 
      });

      return NextResponse.json({
        success: true,
        message: `Successfully deleted ${result.deletedCount} registration record(s)`,
        deletedCount: result.deletedCount
      });
    } else {
      // Delete all registration data (existing behavior)
      const result = await collection.deleteMany({ Type: 'Registration' });

      return NextResponse.json({
        success: true,
        message: `Successfully deleted ${result.deletedCount} registration records`,
        deletedCount: result.deletedCount
      });
    }

  } catch (error) {
    console.error('Registration data delete error:', error);
    return NextResponse.json({ 
      error: `Failed to delete registration data: ${error.message}` 
    }, { status: 500 });
  }
}

// POST - OTP request / verification for destructive actions
export async function POST(req) {
  try {
    // Check authentication
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized - Please login first" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.email) {
      return NextResponse.json({ error: "Unauthorized - Invalid token" }, { status: 401 });
    }

    // Only admins can request/verify OTP for deletion
    const userRole = payload.role?.toLowerCase();
    if (userRole !== 'admin') {
      return NextResponse.json({ 
        error: "Access denied - Only admins can request OTP" 
      }, { status: 403 });
    }

    const body = await req.json();
    const { action, email, otp } = body || {};
    const adminEmail = (payload.email || "").toLowerCase().trim();

    if (action === 'request-otp') {
      // Always send to logged-in admin email; ignore provided email to prevent misuse
      if (!adminEmail) {
        return NextResponse.json({ error: "Admin email not found" }, { status: 400 });
      }
      const code = generateOTP();
      storeOTP(adminEmail, code, { type: 'clear-registration-data', requestedBy: payload.email });

      // Copy the coordinator as well as the requesting admin, de-duplicated so an
      // admin who is also the coordinator gets one mail rather than two. The OTP is
      // still only valid against the requesting admin's own address.
      const recipients = [...new Set(
        [adminEmail, COORDINATOR_EMAIL]
          .filter(Boolean)
          .map(e => String(e).toLowerCase().trim())
          .filter(Boolean)
      )];

      const results = await sendOTPToMultipleEmails(recipients, code, 'registration');
      const sent = results.filter(r => r.success).map(r => r.email);
      const failed = results.filter(r => !r.success);

      if (sent.length === 0) {
        return NextResponse.json({
          error: `Failed to send OTP: ${failed.map(f => `${f.email} (${f.error})`).join(', ')}`
        }, { status: 500 });
      }

      // sendOTPEmail reports success after only logging when the server has no
      // EMAIL_USER / EMAIL_PASS, so say plainly that nothing was actually sent.
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        return NextResponse.json({
          success: true,
          emailConfigured: false,
          message: "Email is not configured on the server (EMAIL_USER / EMAIL_PASS missing), so the OTP was NOT sent."
        });
      }

      return NextResponse.json({
        success: true,
        emailConfigured: true,
        message: `OTP sent to ${sent.join(' and ')}`,
        ...(failed.length > 0 && { warning: `Could not reach ${failed.map(f => f.email).join(', ')}` })
      });
    }

    if (action === 'verify-otp') {
      if (!otp) {
        return NextResponse.json({ error: "OTP is required" }, { status: 400 });
      }
      const result = verifyOTP(adminEmail, otp.trim());
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      const meta = result.data;
      if (meta.type !== 'clear-registration-data') {
        return NextResponse.json({ error: "OTP type mismatch" }, { status: 400 });
      }

      const client = await clientPromise;
      // Get campus and school from request
      const token = req.cookies.get("token")?.value;
      let campus = null;
      let school = null;
      if (token) {
        try {
          const { jwtVerify } = await import("jose");
          const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");
          const { payload } = await jwtVerify(token, secret);
          campus = payload?.campus || null;
          school = payload?.school || null;
        } catch {}
      }
      const { searchParams } = new URL(req.url);
      const campusParam = searchParams.get('campus');
      const schoolParam = searchParams.get('school');
      campus = campusParam || campus || null;
      school = schoolParam || school || null;
      const { getCampusSchoolDatabase } = await import("@/lib/campus");
      const dbName = getCampusSchoolDatabase(campus, school);
      const db = client.db(dbName);
      const collection = db.collection("RegistrationData");
      const deleteResult = await collection.deleteMany({ Type: 'Registration' });

      removeOTP(adminEmail);

      return NextResponse.json({
        success: true,
        message: `Successfully deleted ${deleteResult.deletedCount} registration records`,
        deletedCount: deleteResult.deletedCount
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error('Registration data OTP error:', error);
    return NextResponse.json({ 
      error: `Failed to process request: ${error.message}` 
    }, { status: 500 });
  }
}

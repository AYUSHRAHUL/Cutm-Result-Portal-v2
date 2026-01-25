import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { generateOTP, storeOTP } from "@/lib/otpStore";
import { sendEmail } from "@/lib/email";

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
 * POST /api/soet/result-data/otp
 * Generate and send OTP for deletion authentication
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
    const { subject, batch, branch, semester } = body;

    if (!subject || !batch || !branch || !semester) {
      return NextResponse.json({ error: "Subject, batch, branch, and semester are required" }, { status: 400 });
    }

    // Get admin email from token
    const adminEmail = payload.email;

    // Generate OTP
    const otp = generateOTP();
    
    // Store OTP with deletion context
    storeOTP(adminEmail, otp, {
      type: 'delete-subject-data',
      subject: subject,
      batch: batch,
      branch: branch,
      semester: semester,
      requestedBy: adminEmail
    });

    // Send OTP email
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 20px;">
          <h1 style="color: white; margin: 0; font-size: 28px;">CUTM Result Portal</h1>
          <p style="color: white; margin: 10px 0 0 0; opacity: 0.9;">Subject Data Deletion - OTP Verification</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: #dc2626; margin-top: 0;">Deletion OTP Verification</h2>
          <p style="color: #6c757d; font-size: 16px; line-height: 1.5;">
            You have requested to delete all student data for the following subject:
          </p>
          
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Subject:</strong> ${subject}</p>
            <p style="margin: 5px 0;"><strong>Batch:</strong> ${batch}</p>
            <p style="margin: 5px 0;"><strong>Branch:</strong> ${branch}</p>
            <p style="margin: 5px 0;"><strong>Semester:</strong> ${semester}</p>
          </div>
          
          <div style="background: #fef2f2; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; border: 2px solid #dc2626;">
            <p style="color: #991b1b; margin: 0 0 10px 0; font-weight: bold;">Your OTP Code:</p>
            <div style="font-size: 32px; font-weight: bold; color: #dc2626; letter-spacing: 5px; font-family: 'Courier New', monospace;">
              ${otp}
            </div>
          </div>
          
          <p style="color: #6c757d; font-size: 14px;">
            <strong>⚠️ Warning:</strong> This action will permanently delete all student records for this subject. This cannot be undone.
          </p>
          
          <p style="color: #6c757d; font-size: 14px; margin-top: 20px;">
            <strong>Important:</strong> This OTP is valid for 10 minutes only. Do not share this code with anyone.
          </p>
          
          <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; color: #991b1b; font-size: 14px;">
              <strong>Security Note:</strong> If you did not request this deletion, please contact the administrator immediately.
            </p>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #6c757d; font-size: 12px;">
          <p>© 2025 CUTM Result Portal. All rights reserved.</p>
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    `;

    await sendEmail({
      to: adminEmail,
      subject: 'CUTM Portal - Subject Data Deletion OTP',
      html: emailHtml
    });

    return NextResponse.json({
      success: true,
      message: "OTP sent to your email"
    });

  } catch (error) {
    console.error('Error sending OTP:', error);
    return NextResponse.json({
      error: `Failed to send OTP: ${error.message}`
    }, { status: 500 });
  }
}






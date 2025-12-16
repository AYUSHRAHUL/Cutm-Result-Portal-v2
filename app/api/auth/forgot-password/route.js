import { clientPromise } from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { sendOTPToMultipleEmails } from "@/lib/email";
import { generateOTP, storeOTP, verifyOTP, removeOTP } from "@/lib/otpStore";

export async function POST(req) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      );
    }

    // Email domain validation
    const allowedDomains = ['@cutm.ac.in', '@centurionuniv.edu.in'];
    const emailDomain = email.substring(email.lastIndexOf('@'));
    
    if (!allowedDomains.includes(emailDomain)) {
      return NextResponse.json(
        { success: false, error: "Only @cutm.ac.in or @centurionuniv.edu.in email addresses are allowed." },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db("USER");
    
    // Check if user exists
    const user = await db.collection("users").findOne({ email });
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: "No account found with this email address" },
        { status: 404 }
      );
    }

    // Generate OTP
    const otp = generateOTP();

    // Store OTP
    storeOTP(email, otp, {
      type: 'password-reset'
    });

    // Generate institutional email ONLY if a valid numeric registration exists
    let institutionalEmail = null;
    if (user && user.registration && /^\d{6,}$/.test(String(user.registration))) {
      institutionalEmail = `${user.registration}@cutm.ac.in`;
    }

    // Send OTP to provided email and institutional (if valid)
    const emailsToSend = [email, institutionalEmail].filter(Boolean);
    const emailResults = await sendOTPToMultipleEmails(emailsToSend, otp, 'password-reset');

    // Check if any emails were sent successfully
    const successfulEmails = emailResults.filter(result => result.success);
    
    if (successfulEmails.length === 0) {
      return NextResponse.json(
        { success: false, error: "Failed to send OTP emails. Please try again." },
        { status: 500 }
      );
    }

    console.log(`Password reset OTP sent to ${successfulEmails.length} email(s):`, successfulEmails.map(r => r.email));

    return NextResponse.json({
      success: true,
      message: `OTP sent to ${successfulEmails.length} email address(es)`,
      institutionalEmail,
      emailsSent: successfulEmails.length
    });

  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Verify OTP
export async function PUT(req) {
  try {
    const { email, otp, newPassword } = await req.json();

    if (!email || !otp || !newPassword) {
      return NextResponse.json(
        { success: false, error: "Email, OTP, and new password are required" },
        { status: 400 }
      );
    }

    // Verify OTP using shared store
    const otpResult = verifyOTP(email, otp);
    
    if (!otpResult.success) {
      return NextResponse.json(
        { success: false, error: otpResult.error },
        { status: 400 }
      );
    }

    // Update password
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const client = await clientPromise;
    const db = client.db("USER");
    
    await db.collection("users").updateOne(
      { email },
      { $set: { password: hashedPassword } }
    );

    // Remove OTP from store
    removeOTP(email);

    return NextResponse.json({
      success: true,
      message: "Password updated successfully"
    });

  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

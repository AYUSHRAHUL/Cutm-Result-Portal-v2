import { clientPromise } from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { sendOTPToMultipleEmails } from "@/lib/email";
import { generateOTP, storeOTP } from "@/lib/otpStore";

export async function POST(req) {
  try {
    const { email, name, role, employeeId } = await req.json();

    if (!email || !name) {
      return NextResponse.json(
        { success: false, error: "Email and name are required" },
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

    // Local-part validation based on role
    const local = email.split('@')[0];
    if (role === 'teacher') {
      // Teachers: local-part must be alphabetic (allow dots and hyphens), no pure numbers
      const teacherOk = /^[a-zA-Z][a-zA-Z.-]*$/.test(local);
      if (!teacherOk) {
        return NextResponse.json(
          { success: false, error: "For teachers, use a name-based email like john.smith@cutm.ac.in (letters, dots, hyphens). Numbers-only are not allowed." },
          { status: 400 }
        );
      }
    } else {
      // Students: local-part must be numeric only
      const studentOk = /^\d+$/.test(local);
      if (!studentOk) {
        return NextResponse.json(
          { success: false, error: "For students, use registration-number email like 220101130056@cutm.ac.in (digits only before @)." },
          { status: 400 }
        );
      }
    }

    const client = await clientPromise;
    const db = client.db("USER");
    
    // Check if user already exists
    const existingUser = await db.collection("users").findOne({ email });
    
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "An account with this email already exists" },
        { status: 400 }
      );
    }

    // Generate OTP
    const otp = generateOTP();

    // Store registration data and OTP
    storeOTP(email, otp, {
      name,
      email,
      role,
      employeeId,
      type: 'registration'
    });

    // Send OTP only to the entered email address
    const emailsToSend = [email];
    const emailResults = await sendOTPToMultipleEmails(emailsToSend, otp, 'registration');

    // Check if any emails were sent successfully
    const successfulEmails = emailResults.filter(result => result.success);
    
    if (successfulEmails.length === 0) {
      return NextResponse.json(
        { success: false, error: "Failed to send OTP emails. Please try again." },
        { status: 500 }
      );
    }

    console.log(`OTP sent to ${successfulEmails.length} email(s):`, successfulEmails.map(r => r.email));

    return NextResponse.json({
      success: true,
      message: `OTP sent to ${successfulEmails.length} email address(es)`,
      emailsSent: successfulEmails.length
    });

  } catch (error) {
    console.error("Send registration OTP error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

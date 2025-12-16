import nodemailer from 'nodemailer';

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail', // You can use other services like 'outlook', 'yahoo', etc.
  auth: {
    user: process.env.EMAIL_USER, // Your email address
    pass: process.env.EMAIL_PASS, // Your email password or app password
  },
  tls: {
    rejectUnauthorized: false // Allow self-signed certificates
  },
  secure: true, // Use SSL
  port: 465, // Gmail SSL port
});

// Generic sendEmail helper for alert notifications and other use cases
export async function sendEmail({ to, subject, html, text }) {
  if (!to) throw new Error('Recipient email (to) is required');

  // Development mode without creds: log instead of sending
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log(`🔧 DEVELOPMENT MODE - Email to ${to}`);
    console.log(`Subject: ${subject}`);
    if (text) console.log(`Text: ${text}`);
    return { success: true, messageId: 'dev-mode' };
  }

  const mailOptions = {
    from: `"CUTM Result Portal" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
    text,
  };

  const result = await transporter.sendMail(mailOptions);
  console.log('Email sent successfully:', result.messageId);
  return { success: true, messageId: result.messageId };
}

// Send OTP email
export async function sendOTPEmail(email, otp, type = 'registration') {
  // Development mode - show OTP in console if email credentials not configured
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log(`🔧 DEVELOPMENT MODE - OTP for ${email}: ${otp}`);
    console.log(`📧 Email would be sent to: ${email}`);
    return { success: true, messageId: 'dev-mode' };
  }

  try {
    const subject = type === 'registration' 
      ? 'CUTM Portal - Registration OTP' 
      : 'CUTM Portal - Password Reset OTP';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 20px;">
          <h1 style="color: white; margin: 0; font-size: 28px;">CUTM Acadmic Tracker</h1>
          <p style="color: white; margin: 10px 0 0 0; opacity: 0.9;">${type === 'registration' ? 'Complete Your Registration' : 'Reset Your Password'}</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: #2c3e50; margin-top: 0;">Your Verification Code</h2>
          <p style="color: #6c757d; font-size: 16px; line-height: 1.5;">
            ${type === 'registration' 
              ? 'Thank you for registering with CUTM Acadmic Tracker. To complete your registration, please use the OTP below:' 
              : 'You requested a password reset for your CUTM Portal account. Use the OTP below to reset your password:'}
          </p>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <div style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; font-family: 'Courier New', monospace;">
              ${otp}
            </div>
          </div>
          
          <p style="color: #6c757d; font-size: 14px;">
            <strong>Important:</strong> This OTP is valid for 10 minutes only. Do not share this code with anyone.
          </p>
          
          <div style="background: #e7f3ff; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; color: #1565c0; font-size: 14px;">
              <strong>Security Note:</strong> CUTM Portal will never ask for your OTP via phone or email. If you didn't request this, please ignore this email.
            </p>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #6c757d; font-size: 12px;">
          <p>© 2025 CUTM Acadmic Tracker. All rights reserved.</p>
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: `"CUTM Result Portal" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: subject,
      html: html,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
}

// Send OTP to multiple emails
export async function sendOTPToMultipleEmails(emails, otp, type = 'registration') {
  const results = [];
  
  for (const email of emails) {
    if (email && email.trim()) {
      const result = await sendOTPEmail(email.trim(), otp, type);
      results.push({ email, ...result });
    }
  }
  
  return results;
}

// Test email configuration
export async function testEmailConnection() {
  try {
    await transporter.verify();
    console.log('Email server is ready to send messages');
    return { success: true };
  } catch (error) {
    console.error('Email server connection failed:', error);
    return { success: false, error: error.message };
  }
}

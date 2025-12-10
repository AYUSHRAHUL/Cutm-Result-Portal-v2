import { NextResponse } from "next/server";

export async function GET() {
  // This endpoint helps debug Google OAuth configuration
  // DO NOT expose this in production or it will leak your client secret!
  
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  const config = {
    hasClientId: !!clientId,
    clientIdLength: clientId?.length || 0,
    clientIdPrefix: clientId?.substring(0, 20) + "..." || "NOT SET",
    hasClientSecret: !!clientSecret,
    clientSecretLength: clientSecret?.length || 0,
    redirectUri: redirectUri || "NOT SET (will use default)",
    baseUrl: baseUrl || "NOT SET (will use request origin)",
    computedRedirectUri: redirectUri || "http://localhost:3000/api/auth/google/callback",
  };

  return NextResponse.json({
    message: "Google OAuth Configuration Check",
    config,
    issues: [
      !clientId && "❌ GOOGLE_CLIENT_ID is not set",
      !clientSecret && "❌ GOOGLE_CLIENT_SECRET is not set",
      clientId && !clientId.includes(".apps.googleusercontent.com") && "⚠️ GOOGLE_CLIENT_ID format looks incorrect",
      clientSecret && clientSecret.length < 20 && "⚠️ GOOGLE_CLIENT_SECRET seems too short",
    ].filter(Boolean),
    instructions: [
      "1. Make sure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are in your .env file",
      "2. Restart your Next.js server after updating .env",
      "3. Verify credentials match Google Cloud Console",
      "4. Check redirect URI matches exactly in Google Cloud Console",
    ],
  });
}



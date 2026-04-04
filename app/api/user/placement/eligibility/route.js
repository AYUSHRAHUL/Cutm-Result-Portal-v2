import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getPlacementEligibilityContext } from "@/lib/user-placement-eligibility";

async function verifyToken(token) {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

/** For Navbar / UI: show Placement only when eligible. */
export async function GET(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ eligible: false });
    }

    const payload = await verifyToken(token);
    if (!payload?.email) {
      return NextResponse.json({ eligible: false });
    }

    const regNo = payload.email.split("@")[0].toUpperCase();
    if (!regNo) {
      return NextResponse.json({ eligible: false });
    }

    const ctx = await getPlacementEligibilityContext(regNo);
    return NextResponse.json({ eligible: ctx.eligible });
  } catch (error) {
    console.error("placement eligibility:", error);
    return NextResponse.json({ eligible: false });
  }
}

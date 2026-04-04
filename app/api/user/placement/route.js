import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
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

function regNoFromEmail(email) {
  return email.split("@")[0].toUpperCase();
}

export async function GET(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized - Please login first" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.email) {
      return NextResponse.json({ error: "Unauthorized - Invalid token" }, { status: 401 });
    }

    const regNo = regNoFromEmail(payload.email);

    if (!regNo) {
      return NextResponse.json({ error: "Could not determine registration number" }, { status: 400 });
    }

    const ctx = await getPlacementEligibilityContext(regNo);

    if (!ctx.eligible) {
      return NextResponse.json({
        eligible: false,
        message: ctx.message,
      });
    }

    const client = await clientPromise;
    const fetchOrder = [ctx.eligibleDbName, ...ctx.dbList.filter((n) => n !== ctx.eligibleDbName)];

    let offers = [];
    let joinedCompany = null;
    for (const dbName of fetchOrder) {
      const db = client.db(dbName);
      offers = await db.collection("placements").find({ regNo: regNo }).toArray();
      const joinedData = await db.collection("joined_companies").findOne({ regNo: regNo });
      joinedCompany = joinedData?.joinedCompany || null;
      if (offers.length > 0 || joinedCompany) break;
    }

    return NextResponse.json({
      eligible: true,
      regNo,
      offers: offers.map((o) => ({
        companyName: o.companyName,
        jobRole: o.jobRole,
        package: o.package,
        driveDate: o.driveDate,
        status: o.status,
      })),
      joinedCompany,
    });
  } catch (error) {
    console.error("Error in user placement API:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

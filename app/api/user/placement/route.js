import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { jwtVerify } from "jose";
import { getDatabaseFromRegistration } from "@/lib/campus";

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
        const token = req.cookies.get("token")?.value;
        if (!token) {
            return NextResponse.json({ error: "Unauthorized - Please login first" }, { status: 401 });
        }

        const payload = await verifyToken(token);
        if (!payload?.email) {
            return NextResponse.json({ error: "Unauthorized - Invalid token" }, { status: 401 });
        }

        // Extract Registration Number from Email
        let regNo = "";
        if (payload.email.includes("@cutm.ac.in") || payload.email.includes("@centurionuniv.edu.in")) {
            regNo = payload.email.split("@")[0].toUpperCase();
        } else {
            // Fallback: try to find it in payload if stored elsewhere, or return error
            // For now, assume email username is regNo
            regNo = payload.email.split("@")[0].toUpperCase();
        }

        if (!regNo) {
            return NextResponse.json({ error: "Could not determine registration number" }, { status: 400 });
        }

        // Determine Database
        // We use getDatabaseFromRegistration to dynamically point to the right DB (SOET/SOVET, PKD/BBSR)
        const dbName = getDatabaseFromRegistration(regNo);

        const client = await clientPromise;
        const db = client.db(dbName);

        // 1. Check Eligibility (Sem 7 Registration or Result)
        const semVariants = ["Sem 7", "SEM 7", "sem 7", "7"];

        const [regCheck, resultCheck] = await Promise.all([
            db.collection("RegistrationData").findOne({
                $or: [{ Reg_No: regNo }, { Rollno: regNo }],
                Sem: { $in: semVariants }
            }),
            db.collection("result").findOne({
                Reg_No: regNo,
                Sem: { $in: semVariants }
            })
        ]);

        const isEligible = !!(regCheck || resultCheck);

        if (!isEligible) {
            return NextResponse.json({
                eligible: false,
                message: "Placement portal is only available for 7th Semester students."
            });
        }

        // 2. Fetch Placement Data
        // Offers
        const offers = await db.collection("placements").find({ regNo: regNo }).toArray();

        // Joined Status
        const joinedData = await db.collection("joined_companies").findOne({ regNo: regNo });
        const joinedCompany = joinedData ? joinedData.joinedCompany : null;

        return NextResponse.json({
            eligible: true,
            regNo,
            offers: offers.map(o => ({
                companyName: o.companyName,
                jobRole: o.jobRole,
                package: o.package,
                driveDate: o.driveDate,
                status: o.status // selected, shortlisted, etc.
            })),
            joinedCompany
        });

    } catch (error) {
        console.error("Error in user placement API:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}

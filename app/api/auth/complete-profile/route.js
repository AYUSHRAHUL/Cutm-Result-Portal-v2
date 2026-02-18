import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { jwtVerify } from "jose";
import jwt from "jsonwebtoken";
import { detectCampus, getTeacherDashboardPath } from "@/lib/campus";

async function verifyToken(token) {
    try {
        const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");
        const { payload } = await jwtVerify(token, secret);
        return payload;
    } catch {
        return null;
    }
}

export async function POST(req) {
    try {
        const token = req.cookies.get("token")?.value;
        if (!token) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const payload = await verifyToken(token);
        if (!payload?.email) {
            return NextResponse.json({ error: "Invalid session" }, { status: 401 });
        }

        // Only allow @cutm.ac.in users
        if (!payload.email.endsWith('@cutm.ac.in') && !payload.email.endsWith('@centurionuniv.edu.in')) {
            return NextResponse.json({
                error: "This feature is only for university staff/faculty emails."
            }, { status: 403 });
        }

        const { employeeId } = await req.json();

        if (!employeeId || employeeId.trim().length < 4) {
            return NextResponse.json({ error: "Invalid Employee ID" }, { status: 400 });
        }

        const empId = String(employeeId).trim().toUpperCase();
        const campus = detectCampus(empId);

        // Connect to DB
        const client = await clientPromise;
        const db = client.db("USER");

        // Update user
        await db.collection("users").updateOne(
            { email: payload.email },
            {
                $set: {
                    role: "teacher",
                    employeeId: empId,
                    campus: campus,
                    updatedAt: new Date()
                }
            }
        );

        // Generate NEW token with updated role and campus
        const newToken = jwt.sign(
            {
                id: payload.id,
                role: "teacher",
                email: payload.email,
                campus: campus,
                employeeId: empId
            },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        // Determines redirect path based on campus
        const redirectPath = campus ? `/dashboard/teacher/${campus}` : getTeacherDashboardPath(campus);

        const response = NextResponse.json({
            success: true,
            message: "Profile updated successfully",
            redirectUrl: redirectPath
        });

        // Set new cookie
        response.cookies.set("token", newToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/",
            maxAge: 7 * 24 * 60 * 60,
        });

        return response;

    } catch (error) {
        console.error("Complete Profile Error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

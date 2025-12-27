import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { getCampusSchoolDatabase } from "@/lib/campus";
import { verifyToken } from "@/lib/auth";

/**
 * GET /api/sovet/student-status
 * Fetch active/inactive status for students
 * Query Params:
 * - reg: comma separated list of registration numbers (optional)
 * - status: 'active' | 'inactive' | 'all' (default: 'all')
 */
export async function GET(req) {
    try {
        const token = req.cookies.get("token")?.value;
        const payload = await verifyToken(token);
        if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const regs = searchParams.get('reg');

        // Determine database
        const campus = searchParams.get('campus') || payload.campus;
        const school = searchParams.get('school') || "SOVET";
        const dbName = getCampusSchoolDatabase(campus, school);

        const client = await clientPromise;
        const db = client.db(dbName);
        const statusCollection = db.collection("student_status");

        let query = {};
        if (regs) {
            const regList = regs.split(',').map(r => r.trim().toUpperCase());
            query.Reg_No = { $in: regList };
        }

        const statuses = await statusCollection.find(query).toArray();

        // Map array to object for easier active lookup
        // Default is ACTIVE if not found in table
        // But here we store exclusions? Or explicitly store state?
        // Let's explicitly store "isActive: false" for inactive students. Active is default.

        return NextResponse.json({ success: true, data: statuses });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * POST /api/sovet/student-status
 * Update student status
 * Body: { regNo: string, isActive: boolean }
 */
export async function POST(req) {
    try {
        const token = req.cookies.get("token")?.value;
        const payload = await verifyToken(token);
        if (!payload || !['admin', 'superadmin', 'teacher'].includes(payload.role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const body = await req.json();
        const { regNo, isActive } = body;

        if (!regNo) return NextResponse.json({ error: "Registration number required" }, { status: 400 });

        const campus = searchParams.get('campus') || payload.campus;
        const school = searchParams.get('school') || "SOVET";
        const dbName = getCampusSchoolDatabase(campus, school);

        const client = await clientPromise;
        const db = client.db(dbName);
        const statusCollection = db.collection("student_status");

        await statusCollection.updateOne(
            { Reg_No: regNo.toUpperCase().trim() },
            {
                $set: {
                    isActive: isActive,
                    updatedAt: new Date(),
                    updatedBy: payload.email
                }
            },
            { upsert: true }
        );

        return NextResponse.json({ success: true, regNo, isActive });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { verifyToken } from "@/lib/auth";

export async function GET(req) {
    try {
        const token = req.cookies.get("token")?.value;
        if (!token) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const payload = await verifyToken(token);
        if (!payload?.email) {
            return NextResponse.json({ error: "Invalid token" }, { status: 401 });
        }

        const userRole = payload.role?.toLowerCase();
        if (!['admin', 'teacher'].includes(userRole)) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search") || "";
        const limit = parseInt(searchParams.get("limit") || "1000");

        const client = await clientPromise;
        const db = await (async () => { const { getDatabaseFromRequest } = await import("@/lib/db-helper"); const dbName = await getDatabaseFromRequest(req); return client.db(dbName); })();

        let query = {};
        if (search) {
            query.$or = [
                { SubjectCode: { $regex: search, $options: "i" } },
                { SubjectName: { $regex: search, $options: "i" } }
            ];
        }

        const items = await db.collection("skill_courses")
            .find(query)
            .limit(limit)
            .sort({ createdAt: -1 })
            .toArray();

        return NextResponse.json({ items });
    } catch (error) {
        console.error("Error fetching skill courses:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const token = req.cookies.get("token")?.value;
        if (!token) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const payload = await verifyToken(token);
        if (!payload?.email || payload.role?.toLowerCase() !== "admin") {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }

        const body = await req.json();
        const { SubjectCode, SubjectName, Credits, Type, Category } = body;

        if (!SubjectCode || !SubjectName || !Credits) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const client = await clientPromise;
        const db = await (async () => { const { getDatabaseFromRequest } = await import("@/lib/db-helper"); const dbName = await getDatabaseFromRequest(req); return client.db(dbName); })();

        // Check for duplicate subject code
        const existing = await db.collection("skill_courses").findOne({ SubjectCode });

        if (existing) {
            return NextResponse.json({
                error: `Skill course with code "${SubjectCode}" already exists`
            }, { status: 400 });
        }

        const newCourse = {
            SubjectCode,
            SubjectName,
            Credits: String(Credits),
            Type: Type || "Skill",
            Category: Category || "",
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await db.collection("skill_courses").insertOne(newCourse);

        return NextResponse.json({
            success: true,
            message: "Skill course added successfully",
            id: result.insertedId
        });
    } catch (error) {
        console.error("Error adding skill course:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

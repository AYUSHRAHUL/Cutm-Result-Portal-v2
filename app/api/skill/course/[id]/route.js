import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { verifyToken } from "@/lib/auth";
import { ObjectId } from "mongodb";

export async function PUT(req, { params }) {
    try {
        const { id } = params;
        if (!ObjectId.isValid(id)) {
            return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
        }

        const token = req.cookies.get("token")?.value;
        if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

        // Check duplicate code if changed
        const existing = await db.collection("skill_courses").findOne({
            SubjectCode,
            _id: { $ne: new ObjectId(id) }
        });

        if (existing) {
            return NextResponse.json({ error: `Code ${SubjectCode} already in use` }, { status: 400 });
        }

        const result = await db.collection("skill_courses").updateOne(
            { _id: new ObjectId(id) },
            {
                $set: {
                    SubjectCode,
                    SubjectName,
                    Credits: String(Credits),
                    Type: Type || "Skill",
                    Category: Category || "",
                    updatedAt: new Date()
                }
            }
        );

        if (result.matchedCount === 0) {
            return NextResponse.json({ error: "Course not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: "Updated successfully" });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    try {
        const { id } = params;
        if (!ObjectId.isValid(id)) {
            return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
        }

        const token = req.cookies.get("token")?.value;
        if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const payload = await verifyToken(token);
        if (!payload?.email || payload.role?.toLowerCase() !== "admin") {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }

        const client = await clientPromise;
        const db = await (async () => { const { getDatabaseFromRequest } = await import("@/lib/db-helper"); const dbName = await getDatabaseFromRequest(req); return client.db(dbName); })();

        const result = await db.collection("skill_courses").deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
            return NextResponse.json({ error: "Course not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: "Deleted successfully" });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

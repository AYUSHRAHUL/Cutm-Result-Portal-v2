import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { verifyToken } from "@/lib/auth";
import * as XLSX from "xlsx";

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

        const formData = await req.formData();
        const file = formData.get("file");

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet);

        if (!data || data.length === 0) {
            return NextResponse.json({ error: "Excel sheet is empty" }, { status: 400 });
        }

        const client = await clientPromise;
        const db = await (async () => { const { getDatabaseFromRequest } = await import("@/lib/db-helper"); const dbName = await getDatabaseFromRequest(req); return client.db(dbName); })();

        // Create unique index on SubjectCode to prevent duplicates and speed lookups
        const skillCol = db.collection("skill_courses");
        await skillCol.createIndex({ SubjectCode: 1 }, { unique: true, background: true });

        let successCount = 0;
        let failedCount = 0;
        let duplicates = 0;

        const ops = [];
        for (const row of data) {
            // Normalize keys (trim spaces, handle variations)
            const normalizedRow = {};
            Object.keys(row).forEach(key => {
                const cleanKey = key.trim().toLowerCase();
                if (cleanKey === 'code' || cleanKey === 'subject code') normalizedRow.SubjectCode = String(row[key]).trim(); // Removed Type Casting
                else if (cleanKey === 'corse title' || cleanKey === 'course title' || cleanKey === 'subject name') normalizedRow.SubjectName = String(row[key]).trim();
                else if (cleanKey === 'credit' || cleanKey === 'credits') normalizedRow.Credits = String(row[key]).trim();
                else if (cleanKey === 'categor' || cleanKey === 'category') normalizedRow.Category = String(row[key]).trim();
            });

            if (normalizedRow.SubjectCode && normalizedRow.SubjectName) {
                ops.push({
                    updateOne: {
                        filter: { SubjectCode: normalizedRow.SubjectCode },
                        update: {
                            $setOnInsert: {
                                SubjectCode: normalizedRow.SubjectCode,
                                SubjectName: normalizedRow.SubjectName,
                                Credits: normalizedRow.Credits || "0",
                                Type: "Skill",
                                Category: normalizedRow.Category || "",
                                createdAt: new Date(),
                                updatedAt: new Date()
                            }
                        },
                        upsert: true
                    }
                });
            } else {
                failedCount++;
            }
        }

        if (ops.length > 0) {
            const res = await skillCol.bulkWrite(ops, { ordered: false });
            successCount = res.upsertedCount || 0;
            duplicates = ops.length - successCount - failedCount;
        }

        return NextResponse.json({
            success: true,
            message: `Processed: ${successCount} added, ${duplicates} duplicates skipped, ${failedCount} invalid rows`
        });

    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

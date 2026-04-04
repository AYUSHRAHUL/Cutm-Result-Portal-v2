import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { jwtVerify } from "jose";
import * as XLSX from 'xlsx';
import { getCampusSchoolDatabase } from "@/lib/campus";

// JWT verification helper
async function verifyToken(token) {
    try {
        const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");
        const { payload } = await jwtVerify(token, secret);
        return payload;
    } catch {
        return null;
    }
}

// Helper function to check if file is allowed
function allowedFile(filename) {
    const allowedExtensions = ['.csv', '.xls', '.xlsx'];
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return allowedExtensions.includes(ext);
}

// Helper function to parse CSV content
function parseCSV(content) {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) return { headers: [], data: [] };

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        if (values.length >= headers.length) {
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            data.push(row);
        }
    }

    return { headers, data };
}

// Helper function to parse Excel content
function parseExcel(buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    if (jsonData.length === 0) return { headers: [], data: [] };

    const headers = Object.keys(jsonData[0]);
    return { headers, data: jsonData };
}

// Helper function to find column by name (case-insensitive)
function findColumn(headers, ...names) {
    for (const name of names) {
        const found = headers.find(h => h.toLowerCase().trim() === name.toLowerCase());
        if (found) return found;
    }
    return null;
}

/**
 * SOVET CBCS Upload Route - Diploma only
 */
export async function POST(req) {
    try {
        // Check authentication
        const token = req.cookies.get("token")?.value;
        if (!token) {
            return NextResponse.json({ error: "Unauthorized - Please login first" }, { status: 401 });
        }

        const payload = await verifyToken(token);
        if (!payload?.email) {
            return NextResponse.json({ error: "Unauthorized - Invalid token" }, { status: 401 });
        }

        // Get campus from params or token
        const { searchParams } = new URL(req.url);
        const campusParam = searchParams.get('campus');
        const campus = campusParam || payload.campus || null;
        
        // Force school to SOVET
        const school = 'SOVET';

        const formData = await req.formData();
        const file = formData.get("file");

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        if (!allowedFile(file.name)) {
            return NextResponse.json({ error: `Invalid file type: ${file.name}` }, { status: 400 });
        }

        const client = await clientPromise;
        const dbName = getCampusSchoolDatabase(campus, school);
        const db = client.db(dbName);
        const collection = db.collection("cbcs");

        let totalUpdated = 0;
        let totalInserted = 0;
        const errors = [];

        try {
            const buffer = await file.arrayBuffer();
            let headers, data;

            // Parse file based on extension
            if (file.name.toLowerCase().endsWith('.csv')) {
                const content = Buffer.from(buffer).toString('utf-8');
                const parsed = parseCSV(content);
                headers = parsed.headers;
                data = parsed.data;
            } else {
                // Excel file
                const parsed = parseExcel(buffer);
                headers = parsed.headers;
                data = parsed.data;
            }

            if (data.length === 0) {
                return NextResponse.json({ error: `No data found in file` }, { status: 400 });
            }

            // Find required columns
            const branchCol = findColumn(headers, 'Branch', 'Department');
            const basketCol = findColumn(headers, 'Basket');
            const codeCol = findColumn(headers, 'Subject Code', 'Subject_Code', 'Code');
            const nameCol = findColumn(headers, 'Subject Name', 'Subject_Name', 'Name', 'Subject');
            const creditsCol = findColumn(headers, 'Credits', 'Credit');
            const altCodeCol = findColumn(headers, 'Alternative Code', 'Alternative_Code', 'Alt Code', 'Alt_Code');

            if (!branchCol || !basketCol || !codeCol || !nameCol) {
                return NextResponse.json({
                    error: `Missing required columns. Need: Branch, Basket, Subject Code, Subject Name`
                }, { status: 400 });
            }

            // Process each row
            for (const row of data) {
                const branch = String(row[branchCol] || "").trim();
                const basket = String(row[basketCol] || "").trim();
                const subjectCode = String(row[codeCol] || "").trim().toUpperCase();
                const subjectName = String(row[nameCol] || "").trim();
                const credits = row[creditsCol] !== undefined ? String(row[creditsCol]).trim() : "";
                const altCodeRaw = altCodeCol ? String(row[altCodeCol] || "").trim() : "";
                const alternativeCode = altCodeRaw ? altCodeRaw.toUpperCase() : "";

                if (!branch || !basket || !subjectCode || !subjectName) continue;

                // Check if record exists
                const existingRecord = await collection.findOne(
                    { "Subject Code": subjectCode, Branch: branch }
                );

                if (existingRecord) {
                    const setDoc = {
                        Basket: basket,
                        Subject_name: subjectName,
                        Credits: credits,
                    };
                    if (altCodeCol) {
                        setDoc["Alternative Code"] = alternativeCode;
                    }
                    await collection.updateOne(
                        { _id: existingRecord._id },
                        { $set: setDoc }
                    );
                    totalUpdated++;
                } else {
                    const doc = {
                        Branch: branch,
                        Basket: basket,
                        "Subject Code": subjectCode,
                        Subject_name: subjectName,
                        Credits: credits,
                    };
                    if (altCodeCol) {
                        doc["Alternative Code"] = alternativeCode;
                    }
                    await collection.insertOne(doc);
                    totalInserted++;
                }
            }

        } catch (fileError) {
            console.error(`Error processing file ${file.name}:`, fileError);
            return NextResponse.json({ error: `Error processing file: ${fileError.message}` }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            count: totalUpdated + totalInserted,
            updated: totalUpdated,
            inserted: totalInserted,
            message: `Successfully processed ${totalUpdated + totalInserted} subjects`,
            school: 'SOVET'
        });

    } catch (err) {
        console.error("SOVET CBCS Upload error", err);
        return NextResponse.json({ error: `Upload failed: ${err.message}` }, { status: 500 });
    }
}


import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { jwtVerify } from "jose";
import * as XLSX from 'xlsx';

async function verifyToken(token) {
    try {
        const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");
        const { payload } = await jwtVerify(token, secret);
        return payload;
    } catch {
        return null;
    }
}

function allowedFile(filename) {
    const allowedExtensions = ['.csv', '.xls', '.xlsx'];
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return allowedExtensions.includes(ext);
}

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

function parseExcel(buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    if (jsonData.length === 0) return { headers: [], data: [] };

    const headers = Object.keys(jsonData[0]);
    return { headers, data: jsonData };
}

function findColumn(headers, ...names) {
    for (const name of names) {
        const found = headers.find(h => h.toLowerCase().trim() === name.toLowerCase());
        if (found) return found;
    }
    return null;
}

/**
 * SOET Registration Upload Route
 */
export async function POST(req) {
    try {
        const token = req.cookies.get("token")?.value;
        if (!token) {
            return NextResponse.json({ error: "Unauthorized - Please login first" }, { status: 401 });
        }

        const payload = await verifyToken(token);
        if (!payload?.email) {
            return NextResponse.json({ error: "Unauthorized - Invalid token" }, { status: 401 });
        }

        const userRole = payload.role?.toLowerCase();
        if (userRole !== 'admin') {
            return NextResponse.json({
                error: "Access denied - Only admins can upload data"
            }, { status: 403 });
        }

        const formData = await req.formData();
        // Frontend sends 'file' (singular)
        const file = formData.get("file");
        const semester = formData.get("semester");

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        if (!allowedFile(file.name)) {
            return NextResponse.json({ error: "Invalid file format. Allowed: .csv, .xls, .xlsx" }, { status: 400 });
        }

        if (!semester) {
            return NextResponse.json({ error: "Semester is required" }, { status: 400 });
        }

        const client = await clientPromise;
        const { searchParams } = new URL(req.url);
        const campusParam = searchParams.get('campus');
        const campus = campusParam || payload.campus || null;

        // Force school to SOET
        const school = 'SOET';
        const { getCampusSchoolDatabase } = await import("@/lib/campus");
        const dbName = getCampusSchoolDatabase(campus, school);
        const db = client.db(dbName);
        const registrationCollection = db.collection("RegistrationData");

        // Import parser to verify B.Tech students
        const { parseBTechRegistration } = await import('../../parse-registration/route');

        let processedCount = 0;
        let insertedCount = 0;
        let skippedCount = 0;
        const errors = [];

        try {
            const buffer = await file.arrayBuffer();
            let headers, data;

            if (file.name.toLowerCase().endsWith('.csv')) {
                const content = Buffer.from(buffer).toString('utf-8');
                const parsed = parseCSV(content);
                headers = parsed.headers;
                data = parsed.data;
            } else {
                const parsed = parseExcel(buffer);
                headers = parsed.headers;
                data = parsed.data;
            }

            if (data.length === 0) {
                return NextResponse.json({ error: "No data found in file" }, { status: 400 });
            }

            const regNoCol = findColumn(headers, 'Reg_No', 'Registration No.', 'Registration Number', 'Rollno');
            const subjectCodeCol = findColumn(headers, 'Subject_Code', 'Subject Code', 'Code');
            const subjectNameCol = findColumn(headers, 'Subject_Name', 'Subject Name', 'Subject');
            const nameCol = findColumn(headers, 'Name', 'Student Name');
            const creditsCol = findColumn(headers, 'Credits', 'Credit');
            const semCol = findColumn(headers, 'Sem', 'Semester'); // Optional if passed in body
            const subjectTypeCol = findColumn(headers, 'Subject_Type', 'Type');

            if (!regNoCol || !subjectCodeCol) {
                return NextResponse.json({
                    error: "Missing required columns in file",
                    debugInfo: {
                        availableColumns: headers,
                        sampleRow: data[0]
                    }
                }, { status: 400 });
            }

            // We will do a batch insert/update if possible, but let's do row-by-row for now with Promise.all
            // to handle validation and stats.

            for (const row of data) {
                const regNo = String(row[regNoCol] || "").trim().toUpperCase();
                const subjectCode = String(row[subjectCodeCol] || "").trim().toUpperCase();

                if (!regNo || !subjectCode) continue;

                // Verify this is a B.Tech student
                const parsed = parseBTechRegistration(regNo);
                if (!parsed || !parsed.isValid || !parsed.isBTech) {
                    skippedCount++;
                    continue; // Skip non-B.Tech students
                }

                const name = nameCol ? String(row[nameCol] || "").trim() : "";
                const subjectName = subjectNameCol ? String(row[subjectNameCol] || "").trim() : "";
                const credits = creditsCol ? String(row[creditsCol] || "").trim() : "";
                const subjectType = subjectTypeCol ? String(row[subjectTypeCol] || "").trim() : "";

                // Use semester from row if available, otherwise use selected semester
                let semValue = semester;
                if (semCol && row[semCol]) {
                    const rowSem = String(row[semCol]).trim();
                    if (rowSem) semValue = rowSem;
                }

                // Create document
                const doc = {
                    Reg_No: regNo,
                    Subject_Code: subjectCode,
                    Name: name,
                    Subject_Name: subjectName,
                    Credits: credits,
                    Sem: semValue,
                    Subject_Type: subjectType,
                    Branch: parsed.branch || "Unknown",
                    Type: "Registration", // Marker for Registration Data
                    UpdatedAt: new Date()
                };

                // Update or Insert
                // We use Reg_No + Subject_Code + Type as unique key
                await registrationCollection.updateOne(
                    { Reg_No: regNo, Subject_Code: subjectCode, Type: "Registration" },
                    { $set: doc },
                    { upsert: true }
                );

                insertedCount++;
            }

            processedCount = data.length;

        } catch (fileError) {
            console.error(`Error processing registration file:`, fileError);
            return NextResponse.json({ error: `Error processing file: ${fileError.message}` }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: `Registration data processed successfully. Uploaded/Updated: ${insertedCount}. Skipped (Non-B.Tech): ${skippedCount}.`,
            count: insertedCount,
            skipped: skippedCount,
            total: processedCount
        });

    } catch (err) {
        console.error("SOET Registration Upload error:", err);
        return NextResponse.json({
            error: `Upload failed: ${err.message}`
        }, { status: 500 });
    }
}

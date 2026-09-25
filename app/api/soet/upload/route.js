// Spreadsheet uploads process thousands of rows in batched round trips to Atlas,
// which overruns Vercel's default function limit and surfaces as a dropped
// connection (the client sees only "Upload failed") rather than an error response.
export const maxDuration = 60;

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
 * SOET Upload Route - B.Tech students only
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
    const files = formData.getAll("files");
    
    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    let totalUpdated = 0;
    let totalInserted = 0;
    const errors = [];
    const results = [];

    const client = await clientPromise;
    const { searchParams } = new URL(req.url);
    const campusParam = searchParams.get('campus');
    const campus = campusParam || payload.campus || null;
    
    // Force school to SOET
    const school = 'SOET';
    const { getCampusSchoolDatabase } = await import("@/lib/campus");
    const dbName = getCampusSchoolDatabase(campus, school);
    const db = client.db(dbName);
    const cutmCollection = db.collection("result");
    // Ensure index for result lookups
    await cutmCollection.createIndex({ Reg_No: 1, Subject_Code: 1 }, { background: true });

    // Import parser to verify B.Tech students
    const { parseBTechRegistration } = await import('../parse-registration/route');

    // Registrations an admin has explicitly assigned a branch to. parseBTechRegistration
    // only recognises branch codes 111/112/113/115/116/137, so a genuine B.Tech student
    // on any other code was dropped here and ended up with no results at all. An
    // override is treated as the admin declaring the row valid.
    const overrideRegs = new Set();
    try {
      const overrideDocs = await db.collection("branch_overrides")
        .find({ branch: { $nin: [null, ""] } }, { projection: { _id: 0, reg: 1 } })
        .toArray();
      for (const o of overrideDocs) {
        const oReg = String(o.reg || "").trim().toUpperCase();
        if (oReg) overrideRegs.add(oReg);
      }
    } catch (e) {
      console.warn('SOET result upload: could not read branch_overrides', e?.message);
    }

    const skippedRegs = new Set();

    for (const file of files) {
      if (!file || !allowedFile(file.name)) {
        errors.push(`Invalid file: ${file.name}`);
        continue;
      }

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
          errors.push(`No data found in file: ${file.name}`);
          continue;
        }

        const regNoCol = findColumn(headers, 'Reg_No', 'Registration No.', 'Registration Number');
        const subjectCodeCol = findColumn(headers, 'Subject_Code', 'Subject Code');
        const subjectNameCol = findColumn(headers, 'Subject_Name', 'Subject Name');
        const nameCol = findColumn(headers, 'Name', 'Student Name');
        const semCol = findColumn(headers, 'Sem', 'Semester');
        const creditsCol = findColumn(headers, 'Credits', 'Credit');
        const gradeCol = findColumn(headers, 'Grade', 'Grade Point');
        const subjectTypeCol = findColumn(headers, 'Subject_Type', 'Subject Type');

        if (!regNoCol || !subjectCodeCol) {
          errors.push(`Missing required columns in ${file.name}. Need: Reg_No, Subject_Code`);
          continue;
        }

        let fileUpdated = 0;
        let fileInserted = 0;
        let skippedNonBTech = 0;

        // Parse rows first and prepare for batched DB operations
        const rowsToProcess = [];
        for (const row of data) {
          const regNo = String(row[regNoCol] || "").trim().toUpperCase();
          const subjectCode = String(row[subjectCodeCol] || "").trim().toUpperCase();
          if (!regNo || !subjectCode) continue;

          const parsed = parseBTechRegistration(regNo);
          if ((!parsed || !parsed.isValid || !parsed.isBTech) && !overrideRegs.has(regNo)) {
            skippedNonBTech++;
            skippedRegs.add(regNo);
            continue;
          }

          const subjectName = String(row[subjectNameCol] || "").trim();
          const name = String(row[nameCol] || "").trim();
          const sem = String(row[semCol] || "").trim();
          const credits = String(row[creditsCol] || "").trim();
          const grade = String(row[gradeCol] || "").trim().toUpperCase();
          const subjectType = String(row[subjectTypeCol] || "").trim();
          const semValue = sem && sem.match(/^\d+$/) ? `Sem ${sem}` : sem;

          rowsToProcess.push({ regNo, subjectCode, subjectName, name, semValue, credits, grade, subjectType });
        }

        // Process in batches to avoid N+1 DB operations
        const BATCH_SIZE = 500;
        for (let i = 0; i < rowsToProcess.length; i += BATCH_SIZE) {
          const batch = rowsToProcess.slice(i, i + BATCH_SIZE);

          // Find existing records for this batch in a single query
          const filters = batch.map(r => ({ Reg_No: r.regNo, Subject_Code: r.subjectCode }));
          const existingDocs = await cutmCollection.find({ $or: filters }, { projection: { Reg_No: 1, Subject_Code: 1, Grade: 1 } }).toArray();
          const existingMap = new Map(existingDocs.map(d => [`${d.Reg_No}::${d.Subject_Code}`, d]));

          const ops = [];
          for (const r of batch) {
            const key = `${r.regNo}::${r.subjectCode}`;
            const existing = existingMap.get(key);

            if (existing) {
              const currentGrade = (existing.Grade || '').toUpperCase();
              if (['F', 'S', 'M', 'I', 'R', ''].includes(currentGrade)) {
                ops.push({
                  updateOne: {
                    filter: { Reg_No: r.regNo, Subject_Code: r.subjectCode },
                    update: { $set: { Grade: r.grade } }
                  }
                });
                fileUpdated++;
              }
            } else {
              ops.push({
                insertOne: { document: {
                  Reg_No: r.regNo,
                  Subject_Code: r.subjectCode,
                  Grade: r.grade,
                  Name: r.name,
                  Sem: r.semValue,
                  Subject_Name: r.subjectName,
                  Subject_Type: r.subjectType,
                  Credits: r.credits
                } }
              });
              fileInserted++;
            }
          }

          if (ops.length > 0) {
            await cutmCollection.bulkWrite(ops, { ordered: false });
          }
        }

        totalUpdated += fileUpdated;
        totalInserted += fileInserted;
        
        results.push({
          filename: file.name,
          updated: fileUpdated,
          inserted: fileInserted,
          skipped: skippedNonBTech,
          total: fileUpdated + fileInserted
        });

      } catch (fileError) {
        console.error(`Error processing file ${file.name}:`, fileError);
        errors.push(`Error processing ${file.name}: ${fileError.message}`);
      }
    }

    // Name the skipped registrations rather than only counting them, so it is clear
    // which students were dropped and what to do about it.
    const skippedList = Array.from(skippedRegs);
    const skippedDetail = skippedList.length > 0
      ? ` Skipped (unrecognised B.Tech registration, no branch override): ${skippedList.slice(0, 10).join(', ')}${skippedList.length > 10 ? `, +${skippedList.length - 10} more` : ''}. Set a branch for these in Branch Change, then upload again.`
      : '';

    const message = `SOET (B.Tech) files processed! Updated: ${totalUpdated}, Inserted: ${totalInserted}.${skippedDetail}`;

    return NextResponse.json({
      success: true,
      message,
      updated: totalUpdated,
      inserted: totalInserted,
      skippedRegistrations: skippedList,
      total: totalUpdated + totalInserted,
      results,
      errors: errors.length > 0 ? errors : undefined,
      school: 'SOET'
    });

  } catch (err) {
    console.error("SOET Upload error:", err);
    return NextResponse.json({ 
      error: `Upload failed: ${err.message}` 
    }, { status: 500 });
  }
}

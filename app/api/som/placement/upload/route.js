import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { jwtVerify } from "jose";
import { getCampusSchoolDatabase } from "@/lib/campus";

async function verifyToken(token) {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

// Advanced CSV parsing - handles quoted fields
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Normalize header names
function normalizeHeader(header) {
  return String(header || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * POST /api/som/placement/upload
 * Upload placements via CSV or XLSX
 * Expected headers: batch, branch, regNo, name, companyName, package
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
    if (!["admin"].includes(userRole)) {
      return NextResponse.json({
        error: "Access denied - Only admins can upload placements"
      }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const filename = String(file.name || "").toLowerCase();
    const isExcel = filename.endsWith(".xlsx") || filename.endsWith(".xls");

    let records = [];
    const errors = [];

    if (isExcel) {
      // Handle Excel files
      try {
        const xlsxModule = await import("xlsx");
        const XLSX = xlsxModule.default || xlsxModule;
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const sheetName = workbook.SheetNames?.[0];

        if (!sheetName) {
          return NextResponse.json({ error: "No sheet found in Excel file" }, { status: 400 });
        }

        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });

        if (rows.length === 0) {
          return NextResponse.json({ error: "No data rows found in Excel file" }, { status: 400 });
        }

        // Normalize headers from first row
        const firstRow = rows[0];
        const headerMap = {};
        Object.keys(firstRow).forEach(key => {
          const normalized = normalizeHeader(key);
          headerMap[normalized] = key;
        });

        const requiredFields = {
          batch: ['batch'],
          branch: ['branch'],
          regno: ['regno', 'reg', 'registrationnumber', 'registration'],
          name: ['name', 'studentname', 'student'],
          companyname: ['companyname', 'company', 'employer'],
          package: ['package', 'pkg', 'ctc', 'salary', 'lpa', 'packagelpa']
        };

        // Find actual column names
        const fieldMap = {};
        Object.keys(requiredFields).forEach(field => {
          const possibleNames = requiredFields[field];
          for (const name of possibleNames) {
            if (headerMap[name]) {
              fieldMap[field] = headerMap[name];
              break;
            }
          }
        });

        // Check if all required fields are found
        const missing = Object.keys(requiredFields).filter(f => !fieldMap[f]);
        if (missing.length > 0) {
          return NextResponse.json({
            error: `Missing required columns: ${missing.join(", ")}. Found columns: ${Object.keys(firstRow).join(", ")}`
          }, { status: 400 });
        }

        // Process rows
        rows.forEach((row, index) => {
          const batch = String(row[fieldMap.batch] || "").trim();
          const branch = String(row[fieldMap.branch] || "").trim();
          const regNo = String(row[fieldMap.regno] || "").trim();
          const name = String(row[fieldMap.name] || "").trim();
          const companyName = String(row[fieldMap.companyname] || "").trim();
          const pkgRaw = row[fieldMap.package] || "";
          const pkg = String(pkgRaw).trim().replace(/[^0-9.]/g, '');

          if (!batch || !branch || !regNo || !name || !companyName || !pkg) {
            errors.push({
              row: index + 2,
              error: "Missing required fields",
              data: { batch, branch, regNo, name, companyName, package: pkgRaw }
            });
            return;
          }

          const pkgNum = parseFloat(pkg);
          if (isNaN(pkgNum) || pkgNum <= 0) {
            errors.push({
              row: index + 2,
              error: "Invalid package amount",
              data: { package: pkgRaw }
            });
            return;
          }

          records.push({
            batch,
            branch,
            regNo,
            name,
            companyName,
            package: String(pkgNum),
            packageLpa: pkgNum,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        });
      } catch (excelError) {
        return NextResponse.json({
          error: `Error reading Excel file: ${excelError.message}`
        }, { status: 400 });
      }
    } else {
      // Handle CSV files
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);

      if (lines.length === 0) {
        return NextResponse.json({ error: "Empty file" }, { status: 400 });
      }

      // Parse headers
      const headerLine = parseCSVLine(lines[0]);
      const headers = headerLine.map(normalizeHeader);

      const requiredFields = {
        batch: ['batch'],
        branch: ['branch'],
        regno: ['regno', 'reg', 'registrationnumber', 'registration'],
        name: ['name', 'studentname', 'student'],
        companyname: ['companyname', 'company', 'employer'],
        package: ['package', 'pkg', 'ctc', 'salary', 'lpa', 'packagelpa']
      };

      // Find column indices
      const fieldIndices = {};
      Object.keys(requiredFields).forEach(field => {
        const possibleNames = requiredFields[field];
        for (const name of possibleNames) {
          const idx = headers.indexOf(name);
          if (idx !== -1) {
            fieldIndices[field] = idx;
            break;
          }
        }
      });

      // Check if all required fields are found
      const missing = Object.keys(requiredFields).filter(f => !fieldIndices.hasOwnProperty(f));
      if (missing.length > 0) {
        return NextResponse.json({
          error: `Missing required columns: ${missing.join(", ")}. Found columns: ${headerLine.join(", ")}`
        }, { status: 400 });
      }

      // Process data rows
      lines.slice(1).forEach((line, index) => {
        const cols = parseCSVLine(line);

        if (cols.every(c => !c)) return; // Skip empty rows

        const batch = (cols[fieldIndices.batch] || "").trim();
        const branch = (cols[fieldIndices.branch] || "").trim();
        const regNo = (cols[fieldIndices.regno] || "").trim();
        const name = (cols[fieldIndices.name] || "").trim();
        const companyName = (cols[fieldIndices.companyname] || "").trim();
        const pkgRaw = (cols[fieldIndices.package] || "").trim();
        const pkg = pkgRaw.replace(/[^0-9.]/g, '');

        if (!batch || !branch || !regNo || !name || !companyName || !pkg) {
          errors.push({
            row: index + 2,
            error: "Missing required fields",
            data: { batch, branch, regNo, name, companyName, package: pkgRaw }
          });
          return;
        }

        const pkgNum = parseFloat(pkg);
        if (isNaN(pkgNum) || pkgNum <= 0) {
          errors.push({
            row: index + 2,
            error: "Invalid package amount",
            data: { package: pkgRaw }
          });
          return;
        }

        records.push({
          batch,
          branch,
          regNo,
          name,
          companyName,
          package: String(pkgNum),
          packageLpa: pkgNum,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      });
    }

    if (records.length === 0) {
      return NextResponse.json({
        error: "No valid records found",
        errors: errors.slice(0, 50)
      }, { status: 400 });
    }

    const client = await clientPromise;
    const { searchParams } = new URL(req.url);
    const campusParam = searchParams.get("campus");
    const campus = campusParam || payload.campus || null;
    const school = "SOM";
    const dbName = getCampusSchoolDatabase(campus, school);
    const db = client.db(dbName);
    const placementsCollection = db.collection("som_placements");

    // Index managed externally for performance during bulk writes

    // Bulk upsert operations - allow same student with different companies
    const operations = records.map(rec => ({
      updateOne: {
        filter: { regNo: rec.regNo, companyName: rec.companyName },
        update: {
          $set: {
            batch: rec.batch,
            branch: rec.branch,
            regNo: rec.regNo,
            name: rec.name,
            companyName: rec.companyName,
            package: rec.package,
            packageLpa: typeof rec.packageLpa === "number" ? rec.packageLpa : Number.parseFloat(rec.package),
            updatedAt: rec.updatedAt
          },
          $setOnInsert: { createdAt: rec.createdAt }
        },
        upsert: true
      }
    }));

    const result = await placementsCollection.bulkWrite(operations, { ordered: false });

    const inserted = result.upsertedCount || 0;
    const updated = result.modifiedCount || 0;
    const skipped = records.length - inserted - updated;

    return NextResponse.json({
      success: true,
      message: "Upload processed successfully",
      stats: {
        inserted,
        updated,
        skipped: Math.max(0, skipped),
        total: records.length,
        errors: errors.length
      },
      errors: errors.slice(0, 100) // Limit errors returned
    });
  } catch (error) {
    console.error("Error uploading placements:", error);
    return NextResponse.json({
      error: `Failed to upload placements: ${error.message}`
    }, { status: 500 });
  }
}

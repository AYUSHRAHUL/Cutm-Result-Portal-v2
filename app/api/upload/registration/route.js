import { clientPromise } from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import * as XLSX from 'xlsx';

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

// Helper to parse credits like "3+1" or "3"
function parseCredits(creditStr) {
  if (!creditStr) return 0;
  const parts = creditStr
    .toString()
    .split("+")
    .map((p) => parseFloat(p.trim()) || 0);
  return parts.reduce((a, b) => a + b, 0);
}

// Process registration data and aggregate credits
function processRegistrationData(data, semester) {
  console.log('Processing registration data:', data.slice(0, 3)); // Debug log
  
  const processedData = [];
  const creditMap = new Map(); // Map to store aggregated credits by rollno + code

  // First pass: aggregate credits for same rollno + code
  data.forEach(row => {
    // More flexible column name matching
    const rollno = row.Rollno || row.Roll_No || row.rollno || row.roll_no || row['Roll No'] || row['Roll No:'] || row['Rollno:'] || row['Rollno'];
    const code = row.Code || row.Subject_Code || row.code || row.subject_code || row['Subject Code'] || row['Subject Code:'] || row['Code:'] || row['Code'];
    const credit = parseCredits(row.Credit || row.Credits || row.credit || row.credits || row['Credit'] || row['Credit:'] || row['Credits:'] || row['Credits']);
    
    console.log('Row data:', { rollno, code, credit, originalRow: row }); // Debug log
    
    if (rollno && code) {
      const key = `${rollno}_${code}`;
      if (creditMap.has(key)) {
        creditMap.set(key, creditMap.get(key) + credit);
      } else {
        creditMap.set(key, credit);
      }
    }
  });

  console.log('Credit map:', creditMap); // Debug log

  // Second pass: create processed records with aggregated credits
  const processedRows = new Map();
  
  data.forEach(row => {
    // More flexible column name matching
    const rollno = row.Rollno || row.Roll_No || row.rollno || row.roll_no || row['Roll No'] || row['Roll No:'] || row['Rollno:'] || row['Rollno'];
    const code = row.Code || row.Subject_Code || row.code || row.subject_code || row['Subject Code'] || row['Subject Code:'] || row['Code:'] || row['Code'];
    const name = row.Name || row.name || row['Name:'] || row['Name'] || row['Student Name'] || row['Student Name:'];
    const subject = row.Subject || row.Subject_Name || row.subject || row.subject_name || row['Subject'] || row['Subject:'] || row['Subject Name'] || row['Subject Name:'];
    
    if (rollno && code) {
      const key = `${rollno}_${code}`;
      if (!processedRows.has(key)) {
        processedRows.set(key, {
          Reg_No: rollno,
          Name: name,
          Subject_Code: code,
          Subject_Name: subject,
          Credits: creditMap.get(key),
          Sem: semester, // Use the selected semester in "Sem 1" format
          Grade: '', // No grade for registration data
          Type: 'Registration'
        });
      }
    }
  });

  console.log('Processed rows:', Array.from(processedRows.values())); // Debug log
  return Array.from(processedRows.values());
}

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

    // Check if user is admin
    const userRole = payload.role?.toLowerCase();
    if (userRole !== 'admin') {
      return NextResponse.json({ 
        error: "Access denied - Only admins can upload registration data" 
      }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    const semester = formData.get('semester');
    
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    
    if (!semester) {
      return NextResponse.json({ error: "No semester selected" }, { status: 400 });
    }
    
    // Convert "Semester 1" to "Sem 1" format
    const dbSemester = semester.replace('Semester ', 'Sem ');

    // Validate file type
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: "Invalid file type. Please upload CSV or Excel files only." 
      }, { status: 400 });
    }

    // Read file content
    const buffer = await file.arrayBuffer();
    let data = [];

    if (file.type === 'text/csv') {
      // Handle CSV files
      const text = new TextDecoder().decode(buffer);
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        return NextResponse.json({ 
          error: "CSV file must contain at least a header row and one data row" 
        }, { status: 400 });
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        data.push(row);
      }
    } else {
      // Handle Excel files
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      data = XLSX.utils.sheet_to_json(worksheet);
    }

    if (data.length === 0) {
      return NextResponse.json({ 
        error: "No data found in the uploaded file" 
      }, { status: 400 });
    }

    console.log(`Processing ${data.length} rows from uploaded file`);
    console.log('Sample data:', data.slice(0, 2));
    console.log('Available columns:', Object.keys(data[0] || {}));

    // Process the data
    const processedData = processRegistrationData(data, dbSemester);
    
    if (processedData.length === 0) {
      return NextResponse.json({ 
        error: "No valid registration data found. Please check your file format. Make sure your file has columns like 'Rollno', 'Code', 'Credit', etc.",
        debugInfo: {
          totalRows: data.length,
          availableColumns: Object.keys(data[0] || {}),
          sampleRow: data[0] || {}
        }
      }, { status: 400 });
    }

    // Connect to database - using separate cluster for registration data
    const client = await clientPromise;
    const db = client.db("cutm1");
    const collection = db.collection("RegistrationData");

    // Clear existing registration data (optional - you might want to keep historical data)
    await collection.deleteMany({ Type: 'Registration' });

    // Insert processed data
    const result = await collection.insertMany(processedData);

    console.log(`Inserted ${result.insertedCount} registration records into RegistrationData collection`);

    return NextResponse.json({
      message: `Successfully uploaded ${processedData.length} registration records for ${dbSemester}. ${result.insertedCount} records inserted.`,
      recordsProcessed: processedData.length,
      recordsInserted: result.insertedCount,
      semester: dbSemester,
      sampleData: processedData.slice(0, 3) // Return first 3 records as sample
    });

  } catch (error) {
    console.error('Registration upload error:', error);
    return NextResponse.json({ 
      error: `Upload failed: ${error.message}` 
    }, { status: 500 });
  }
}

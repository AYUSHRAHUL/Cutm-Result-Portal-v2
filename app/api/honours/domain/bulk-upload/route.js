import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { verifyToken } from "@/lib/auth";
import * as XLSX from 'xlsx';

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
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

    if (data.length === 0) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }

    // Debug: Log first row to see what columns we're getting
    console.log("First row keys:", Object.keys(data[0] || {}));
    console.log("First row data:", data[0]);

    // Process data according to the format:
    // Format: Basket, Course Code, Course Title, Credit, Type
    // - Domain headers: Rows with Credit >= 15 (e.g., 20, 24)
    //   - Course Title of domain header = Domain name
    //   - Basket can be empty or have value
    // - Course rows: All rows after domain header with Credit < 15
    //   - Basket can be empty or "V (Domain)"
    //   - Belong to the domain until next domain header
    const processedSubjects = [];
    let currentDomain = "";

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      // Normalize column names - try all possible variations
      // Excel might read column names with different spacing or case
      const basket = String(
        row.Basket || row.basket || row["Basket"] || row["BASKET"] || 
        row["Basket "] || row["Basket\t"] || ""
      ).trim();
      
      const courseCode = String(
        row["Course Code"] || row["course code"] || row["COURSE CODE"] ||
        row.CourseCode || row.courseCode || row.COURSECODE ||
        row["Course Code "] || row["Course  Code"] || ""
      ).trim();
      
      const courseTitle = String(
        row["Course Title"] || row["course title"] || row["COURSE TITLE"] ||
        row.CourseTitle || row.courseTitle || row.COURSETITLE ||
        row["Course Title "] || row["Course  Title"] || ""
      ).trim();
      
      const credit = String(
        row.Credit || row.credit || row.Credits || row.credits || 
        row["Credit"] || row["Credits"] || row["CREDIT"] || row["CREDITS"] ||
        row["Credit "] || row["Credits "] || ""
      ).trim();
      
      const type = String(
        row.Type || row.type || row["Type"] || row["TYPE"] ||
        row["Type "] || ""
      ).trim();

      // Skip header row (if first row contains "Basket", "Course Code", etc.)
      if (i === 0 && (courseCode.toLowerCase() === "course code" || basket.toLowerCase() === "basket")) {
        continue;
      }

      // Skip completely empty rows
      if (!courseCode && !courseTitle && !credit) {
        continue;
      }

      // Parse credit value (handle formats like "20", "4+10+6", etc.)
      let creditNum = 0;
      if (credit) {
        if (credit.includes("+")) {
          const parts = credit.split("+").map(p => parseFloat(p.trim()) || 0);
          creditNum = parts.reduce((a, b) => a + b, 0);
        } else {
          creditNum = parseFloat(credit) || 0;
        }
      }

      // Check if this is a domain header row
      // Domain headers have:
      // - Course Code (e.g., ESCU2050)
      // - Course Title (e.g., "Embedded System Design") - this becomes domain name
      // - High credit value (>= 15, like 20, 24)
      // - Basket can be empty or have any value
      if (courseCode && courseTitle && creditNum >= 15) {
        // This is a domain header - use Course Title as domain name
        currentDomain = courseTitle;
        console.log(`Domain detected: ${currentDomain} (Credit: ${creditNum})`);
        // Skip this row - don't add it as a subject
        continue;
      }

      // Process regular course rows (not domain headers)
      // Course rows have:
      // - Course Code and Course Title
      // - Credit value (usually < 15)
      // - Basket can be empty or "V (Domain)"
      if (courseCode && courseTitle && credit) {
        // If we don't have a domain yet, use a default
        if (!currentDomain) {
          currentDomain = "General Domain";
          console.log("No domain found, using default: General Domain");
        }

        // Parse credits (sum if in X+Y+Z format)
        let creditsValue = credit;
        if (creditsValue.includes("+")) {
          const parts = creditsValue.split("+").map(p => parseFloat(p.trim()) || 0);
          creditsValue = parts.reduce((a, b) => a + b, 0).toString();
        }

        processedSubjects.push({
          Domain: currentDomain,
          "Subject Code": courseCode,
          SubjectCode: courseCode,
          Subject_name: courseTitle,
          Subject_Name: courseTitle,
          SubjectName: courseTitle,
          Credits: creditsValue,
          Type: type || "",
          Basket: basket || "",
          createdAt: new Date(),
          updatedAt: new Date()
        });
      } else {
        // Debug: Log rows that are being skipped
        if (i < 5) {
          console.log(`Row ${i} skipped:`, { courseCode, courseTitle, credit, basket });
        }
      }
    }

    if (processedSubjects.length === 0) {
      // Try to find what columns we actually have
      const firstRow = data[0] || {};
      const availableColumns = Object.keys(firstRow);
      
      return NextResponse.json({ 
        error: "No valid subjects found in file. Please check the format.",
        debug: {
          sampleRow: firstRow,
          availableColumns: availableColumns,
          totalRows: data.length,
          firstFewRows: data.slice(0, 3),
          expectedFormat: "Columns: Basket, Course Code, Course Title, Credit, Type. Domain headers should have credits >= 15.",
          note: "Make sure column names match exactly: 'Basket', 'Course Code', 'Course Title', 'Credit', 'Type'"
        }
      }, { status: 400 });
    }

    // Insert into database
    const client = await clientPromise;
    const db = await (async () => { const { getDatabaseFromRequest } = await import("@/lib/db-helper"); const dbName = await getDatabaseFromRequest(req); return client.db(dbName); })();

    const result = await db.collection("honours_domain_subjects").insertMany(processedSubjects, { ordered: false });

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${processedSubjects.length} domain subjects`,
      inserted: result.insertedCount,
      total: processedSubjects.length,
      domains: [...new Set(processedSubjects.map(s => s.Domain))]
    });

  } catch (error) {
    console.error("Error uploading domain subjects:", error);
    
    // Handle duplicate key errors gracefully
    if (error.code === 11000 || error.message?.includes("duplicate")) {
      return NextResponse.json({
        error: "Some subjects already exist. Please check for duplicates.",
        details: error.message
      }, { status: 400 });
    }

    return NextResponse.json({
      error: error.message || "Failed to process file",
      details: error.stack
    }, { status: 500 });
  }
}


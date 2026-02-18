import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { getCampusSchoolDatabase } from "@/lib/campus";
import { jwtVerify } from "jose";

async function verifyToken(token) {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

/**
 * SOVET Students Route - Diploma students only
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

    const { registration, department, batch, includeInactive } = await req.json();
    const userRole = payload.role?.toLowerCase();

    if (userRole === 'user' || userRole === 'student') {
      const userEmail = payload.email;
      if (userEmail && userEmail.includes('@cutm.ac.in')) {
        const userRegNumber = userEmail.split('@')[0];
        if (registration && registration !== userRegNumber) {
          return NextResponse.json({
            error: "Access denied - Students can only view their own records"
          }, { status: 403 });
        }
      }
    } else if (userRole === 'teacher' || userRole === 'admin') {
      // console.log(`Access granted to ${userRole}: ${payload.email} accessing SOVET student data`);
    } else {
      return NextResponse.json({
        error: "Access denied - Invalid user role"
      }, { status: 403 });
    }

    const client = await clientPromise;
    const { searchParams } = new URL(req.url);
    const campusParam = searchParams.get('campus');
    const campus = campusParam || payload.campus || null;

    // Force school to SOVET
    const school = 'SOVET';
    const dbName = getCampusSchoolDatabase(campus, school);
    const db = client.db(dbName);
    const cutm = db.collection("result");

    // Check inactive status unless explicitly including them
    let inactiveRegs = [];
    if (!includeInactive) {
      const statusCollection = db.collection("student_status");
      const inactiveDocs = await statusCollection.find({ isActive: false }).project({ Reg_No: 1 }).toArray();
      inactiveRegs = inactiveDocs.map(d => d.Reg_No);
    }

    // If registration is provided, return individual student records
    if (registration) {
      if (!includeInactive && inactiveRegs.includes(registration.toUpperCase())) {
        return NextResponse.json({ error: "Student is inactive" }, { status: 404 });
      }

      // Parse registration using SOVET parser
      // Parse registration using SOVET parser
      const { parseDiplomaRegistration } = await import('@/app/api/sovet/parse-registration/route');
      const parsed = parseDiplomaRegistration(registration);

      // Verify Diploma student
      if (!parsed || !parsed.isValid || !parsed.isDiploma) {
        return NextResponse.json({
          error: "This route is for Diploma (SOVET) students only"
        }, { status: 400 });
      }

      const records = await cutm.find({ Reg_No: registration.toUpperCase() })
        .project({ _id: 0 })
        .sort({ Sem: 1, Subject_Code: 1 })
        .toArray();

      if (!records.length) return NextResponse.json({ error: "No records found" }, { status: 404 });
      return NextResponse.json({ records, school: 'SOVET' });
    }

    // If department is provided, return list of students in that department
    if (department || batch) {
      const matchConditions = [];

      // 1. Batch Filter
      if (batch && batch !== "All") {
        const b = String(batch).trim();
        const yy = b.length === 4 && b.startsWith("20") ? b.slice(2) : b.slice(-2);
        // Matches start of string: YY...
        matchConditions.push({ Reg_No: { $regex: `^${yy}|20${yy}` } });
      }

      // 2. Department Match Logic
      if (department && department !== "All") {
        const branchQueries = [];

        // A. Direct Branch Field Match
        branchQueries.push({ Branch: department });

        // B. Regex Match on Reg_No (fallback for missing Branch field)
        // Map department name to code based on slice(5,8) logic: '714' -> 07 (prog) + 14 (branch)
        const diplomaBranchCodes = {
          'Civil Engineering': '13',
          'Civil': '13',
          'Computer Science Engineering': '14',
          'CSE': '14',
          'Electrical Engineering': '11',
          'Electrical': '11',
          'Mechanical Engineering': '12',
          'Mechanical': '12',
          'Automobile Engineering': '15',
          'Automobile': '15',
          'Mining Engineering': '16',
          'Mining': '16'
        };

        // Handle variations for CSE
        // Some old logic might use 40, so let's check both just in case, or stick to 14 if it's the standard
        if (department === 'Computer Science Engineering' || department === 'CSE') {
          // Match 14 (Standard) OR 40/41/43 (Legacy/Variations)
          // Regexp: ....0714... OR ....0740...
          branchQueries.push({ Reg_No: { $regex: '^.{4}07(14|40|41|43)' } });
        } else {
          const code = diplomaBranchCodes[department];
          if (code) {
            // Format: Year(2) + Campus(2) + '07' + Code(2)
            // matches ....0713 for Civil. Relaxed to just contain 07+Code
            branchQueries.push({ Reg_No: { $regex: `07${code}` } });
          } else {
            // Fallback: Try identifying by name text if code not found?
            // Maybe unsafe for broad queries.
          }
        }

        // Combine Branch OR Regex
        matchConditions.push({ $or: branchQueries });
      }

      // Build Final Query
      let query = {};
      if (matchConditions.length > 0) {
        query = { $and: matchConditions };
      }

      const students = await db.collection("result").find(query).project({
        _id: 0,
        Reg_No: 1,
        Name: 1,
        Branch: 1
      }).toArray();

      // Filter out inactive students
      let filteredStudents = students;
      if (!includeInactive && inactiveRegs.length > 0) {
        filteredStudents = students.filter(s => !inactiveRegs.includes(s.Reg_No));
      }

      // Filter for Diploma students only (strict check)
      const { parseDiplomaRegistration } = await import('../parse-registration/route');
      const diplomaStudents = filteredStudents.filter(student => {
        const parsed = parseDiplomaRegistration(student.Reg_No);
        // Double check branch if provided
        if (department && department !== "All" && parsed && parsed.branch) {
          const deptUpper = department.toUpperCase();
          const parsedUpper = parsed.branch.toUpperCase();
          return (parsed.isValid && parsed.isDiploma) && (
            deptUpper === parsedUpper ||
            deptUpper.includes(parsedUpper) ||
            parsedUpper.includes(deptUpper)
          );
        }
        return parsed && parsed.isValid && parsed.isDiploma;
      });

      // Remove duplicates
      const uniqueStudents = diplomaStudents.reduce((acc, student) => {
        if (!acc.find(s => s.Reg_No === student.Reg_No)) {
          acc.push(student);
        }
        return acc;
      }, []);

      return NextResponse.json({ students: uniqueStudents, school: 'SOVET' });
    }

    return NextResponse.json({ error: "registration or department required" }, { status: 400 });
  } catch (err) {
    console.error("/api/sovet/students POST error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * Update a student's grade (admin/teacher only)
 */
export async function PUT(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized - Please login first" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.email) {
      return NextResponse.json({ error: "Unauthorized - Invalid token" }, { status: 401 });
    }

    const role = String(payload.role || "").toLowerCase();
    if (!["admin", "teacher", "superadmin"].includes(role)) {
      return NextResponse.json({ error: "Access denied - Only admin or teacher can update grades" }, { status: 403 });
    }

    const body = await req.json();
    const { Reg_No, Subject_Code, Sem, Grade } = body || {};

    // Basic validations
    if (!Reg_No || !Subject_Code || !Sem || !Grade) {
      return NextResponse.json({ error: "Reg_No, Subject_Code, Sem and Grade are required" }, { status: 400 });
    }

    const grade = String(Grade).trim().toUpperCase();
    const validGrades = ["O", "E", "A", "B", "C", "D", "F", "S", "M", "I", "R"];
    if (!validGrades.includes(grade)) {
      return NextResponse.json({ error: "Invalid grade value" }, { status: 400 });
    }

    const client = await clientPromise;
    const { searchParams } = new URL(req.url);
    const campusParam = searchParams.get("campus");
    const campus = campusParam || payload.campus || null;

    // Force school to SOVET
    const school = "SOVET";
    const dbName = getCampusSchoolDatabase(campus, school);
    const db = client.db(dbName);
    const cutm = db.collection("result");

    const filter = {
      Reg_No: String(Reg_No).toUpperCase(),
      Subject_Code: String(Subject_Code).toUpperCase(),
      Sem: String(Sem).trim(),
    };

    const update = {
      $set: {
        Grade: grade,
        Updated_By: payload.email,
        Updated_At: new Date(),
      },
    };

    const updateResult = await cutm.updateOne(filter, update);

    if (updateResult.matchedCount === 0) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    const updated = await cutm.findOne(filter, { projection: { _id: 0 } });

    return NextResponse.json({
      success: true,
      message: "Grade updated successfully",
      record: updated,
    });
  } catch (err) {
    console.error("/api/sovet/students PUT error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
export async function DELETE(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized - Please login first" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.email) {
      return NextResponse.json({ error: "Unauthorized - Invalid token" }, { status: 401 });
    }

    const role = String(payload.role || "").toLowerCase();
    if (!["admin", "teacher", "superadmin"].includes(role)) {
      return NextResponse.json({ error: "Access denied - Only admin or teacher can delete records" }, { status: 403 });
    }

    const body = await req.json();
    const { Reg_No, Subject_Code, Sem } = body || {};

    if (!Reg_No) {
      return NextResponse.json({ error: "Reg_No is required" }, { status: 400 });
    }

    const client = await clientPromise;
    const { searchParams } = new URL(req.url);
    const campusParam = searchParams.get("campus");
    const campus = campusParam || payload.campus || null;

    // Force school to SOVET
    const school = "SOVET";
    const dbName = getCampusSchoolDatabase(campus, school);
    const db = client.db(dbName);
    const cutm = db.collection("result");

    const filter = {
      Reg_No: String(Reg_No).toUpperCase(),
    };

    let delResult;
    if (Subject_Code) {
      filter.Subject_Code = String(Subject_Code).toUpperCase();
      if (Sem) {
        filter.Sem = String(Sem).trim();
      }
      delResult = await cutm.deleteOne(filter);
    } else {
      // No Subject_Code provided -> delete all records for this student (optional semester scope)
      if (Sem) {
        filter.Sem = String(Sem).trim();
      }
      delResult = await cutm.deleteMany(filter);
    }

    if (delResult.deletedCount === 0) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      deletedCount: delResult.deletedCount,
      message: "Record deleted successfully",
    });
  } catch (err) {
    console.error("/api/sovet/students DELETE error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

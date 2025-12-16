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
 * SOET Students Route - B.Tech students only
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

    const { registration, department, batch } = await req.json();
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
      console.log(`Access granted to ${userRole}: ${payload.email} accessing SOET student data`);
    } else {
      return NextResponse.json({ 
        error: "Access denied - Invalid user role" 
      }, { status: 403 });
    }

    const client = await clientPromise;
    const { searchParams } = new URL(req.url);
    const campusParam = searchParams.get('campus');
    const campus = campusParam || payload.campus || null;
    
    // Force school to SOET
    const school = 'SOET';
    const dbName = getCampusSchoolDatabase(campus, school);
    const db = client.db(dbName);
    const cutm = db.collection("result");

    // If registration is provided, return individual student records
    if (registration) {
      // Parse registration using SOET parser
      const { parseBTechRegistration } = await import('@/app/api/soet/parse-registration/route');
      const parsed = parseBTechRegistration(registration);
      
      // Verify B.Tech student
      if (!parsed || !parsed.isValid || !parsed.isBTech) {
        return NextResponse.json({ 
          error: "This route is for B.Tech (SOET) students only" 
        }, { status: 400 });
      }

      const records = await cutm.find({ Reg_No: registration.toUpperCase() })
        .project({ _id: 0 })
        .sort({ Sem: 1, Subject_Code: 1 })
        .toArray();

      // Apply branch override if present
      try {
        const overrides = db.collection("branch_overrides");
        const ov = await overrides.findOne({ reg: registration.toUpperCase() }, { projection: { branch: 1 } });
        if (ov?.branch) {
          records.forEach(r => { r.Branch = ov.branch; });
        }
      } catch { /* ignore override failures */ }
      
      if (!records.length) return NextResponse.json({ error: "No records found" }, { status: 404 });
      return NextResponse.json({ records, school: 'SOET' });
    }

    // If department is provided, return list of students in that department
    if (department || batch) {
      let query = {};

      if (department && department !== "All") {
        query.Branch = department;
      }

      if (batch && batch !== "All") {
        const b = String(batch).trim();
        const yy = b.length === 4 && b.startsWith("20") ? b.slice(2) : b.slice(-2);
        const pattern = `^(?:${yy}|20${yy})`;
        query.Reg_No = { ...query.Reg_No, $regex: pattern };
      }

      const students = await db.collection("result").find(query).project({ 
        _id: 0, 
        Reg_No: 1, 
        Name: 1, 
        Branch: 1 
      }).toArray();

      // Filter for B.Tech students only
      const { parseBTechRegistration } = await import('../parse-registration/route');
      const btechStudents = students.filter(student => {
        const parsed = parseBTechRegistration(student.Reg_No);
        return parsed && parsed.isValid && parsed.isBTech;
      });

      // Remove duplicates
      const uniqueStudents = btechStudents.reduce((acc, student) => {
        if (!acc.find(s => s.Reg_No === student.Reg_No)) {
          acc.push(student);
        }
        return acc;
      }, []);

      return NextResponse.json({ students: uniqueStudents, school: 'SOET' });
    }

    return NextResponse.json({ error: "registration or department required" }, { status: 400 });
  } catch (err) {
    console.error("/api/soet/students POST error", err);
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

    // Force school to SOET
    const school = "SOET";
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
    console.error("/api/soet/students PUT error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * Delete a student's subject record (admin/teacher only)
 */
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

    if (!Reg_No || !Subject_Code || !Sem) {
      return NextResponse.json({ error: "Reg_No, Subject_Code and Sem are required" }, { status: 400 });
    }

    const client = await clientPromise;
    const { searchParams } = new URL(req.url);
    const campusParam = searchParams.get("campus");
    const campus = campusParam || payload.campus || null;

    const school = "SOET";
    const dbName = getCampusSchoolDatabase(campus, school);
    const db = client.db(dbName);
    const cutm = db.collection("result");

    const filter = {
      Reg_No: String(Reg_No).toUpperCase(),
      Subject_Code: String(Subject_Code).toUpperCase(),
      Sem: String(Sem).trim(),
    };

    const delResult = await cutm.deleteOne(filter);

    if (delResult.deletedCount === 0) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      deletedCount: delResult.deletedCount,
      message: "Record deleted successfully",
    });
  } catch (err) {
    console.error("/api/soet/students DELETE error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

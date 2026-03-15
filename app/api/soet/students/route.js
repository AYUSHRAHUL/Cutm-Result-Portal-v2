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

    // Check inactive status unless explicitly including them
    let inactiveRegs = [];
    if (!includeInactive) {
      const statusCollection = db.collection("student_status");
      const inactiveDocs = await statusCollection.find({ isActive: { $in: [false, "false"] } }).project({ Reg_No: 1 }).toArray();
      inactiveDocs.forEach(d => {
        if (d.Reg_No) {
          inactiveRegs.push(String(d.Reg_No));
          const num = parseInt(d.Reg_No, 10);
          if (!isNaN(num)) {
            inactiveRegs.push(num);
          }
        }
      });
    }

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
      // 0. Load Overrides for Accurate Filtering
      const overridesCol = db.collection("branch_overrides");
      const overridesArr = await overridesCol.find({}, { projection: { _id: 0, reg: 1, branch: 1, batch: 1 } }).toArray();
      const overrideMap = new Map(overridesArr.map(o => [String(o.reg || "").toUpperCase(), o]));

      // Helper functions for effective data
      const getEffectiveBranch = (regNo, parsedBranch, recordBranch) => {
        const ov = overrideMap.get(String(regNo || "").toUpperCase());
        if (ov?.branch) return ov.branch;
        return parsedBranch || recordBranch || "";
      };
      const getEffectiveBatch = (regNo, parsedYear, recordBatch) => {
        const ov = overrideMap.get(String(regNo || "").toUpperCase());
        if (ov?.batch) return ov.batch;
        return parsedYear || recordBatch || "";
      };

      const normalizeBranchForCompare = (br) => {
        if (!br) return "";
        const brStr = String(br).trim().toUpperCase();
        const branchMap = {
          'CIVIL ENGINEERING': 'CIVIL',
          'COMPUTER SCIENCE AND ENGINEERING': 'CSE',
          'COMPUTER SCIENCE ENGINEERING': 'CSE',
          'ELECTRONICS AND COMMUNICATION ENGINEERING': 'ECE',
          'ELECTRICAL AND ELECTRONICS ENGINEERING': 'EEE',
          'MECHANICAL ENGINEERING': 'MECHANICAL',
          'ME': 'MECHANICAL'
        };
        return branchMap[brStr] || brStr;
      };

      // Identify extra Reg_Nos that match criteria via overrides
      let extraRegs = [];

      if (batch && batch !== "All") {
        const targetBatch = batch.length === 4 ? batch : `20${batch}`;
        overridesArr.forEach(ov => {
          if (ov.batch === targetBatch) extraRegs.push(ov.reg);
        });
      }

      if (department && department !== "All") {
        const searchKey = department.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        let targetBranch = null;
        if (searchKey.includes('civil')) targetBranch = "Civil Engineering";
        else if (searchKey === 'cse' || searchKey.includes('computer')) targetBranch = "Computer Science Engineering";
        else if (searchKey === 'ece' || searchKey.includes('electronics')) targetBranch = "Electronics & Communication Engineering";
        else if (searchKey === 'eee' || searchKey.includes('electrical')) targetBranch = "Electrical & Electronics Engineering";
        else if (searchKey === 'me' || searchKey.includes('mech')) targetBranch = "Mechanical Engineering";
        else if (searchKey === 'aiml') targetBranch = "AIML";

        if (targetBranch) {
          overridesArr.forEach(ov => {
            if (ov.branch === targetBranch) extraRegs.push(ov.reg);
          });
        }
      }
      extraRegs = [...new Set(extraRegs)];

      const matchConditions = [];

      // 1. Batch Filter (Standard)
      if (batch && batch !== "All") {
        const b = String(batch).trim();
        const yy = b.length === 4 && b.startsWith("20") ? b.slice(2) : b.slice(-2);
        matchConditions.push({ Reg_No: { $regex: `^${yy}|20${yy}` } });
      }

      // 2. Department Match Logic (Standard)
      if (department && department !== "All") {
        const branchQueries = [];

        // A. Direct Branch Field Match
        branchQueries.push({ Branch: department });

        // B. Regex Match on Reg_No (fallback for missing Branch field)
        const btechBranchCodes = {
          'Civil Engineering': '111',
          'Civil': '111',
          'Computer Science & Engineering (CSE)': '112',
          'Computer Science Engineering': '112',
          'CSE': '112',
          'Electronics & Communication Engineering (ECE)': '113',
          'Electronics & Communication Engineering': '113',
          'ECE': '113',
          'Electrical & Electronics Engineering (EEE)': '115',
          'Electrical & Electronics Engineering': '115',
          'EEE': '115',
          'Mechanical Engineering': '116',
          'Mechanical': '116',
          'CSE (AI & ML)': '137',
          'AIML': '137'
        };

        // Normalize department name to handle UI variations
        const deptUpper = department.toUpperCase();
        let code = null;

        // Try exact match in map
        if (btechBranchCodes[department]) {
          code = btechBranchCodes[department];
        }
        else if (deptUpper.includes('CSE') || deptUpper.includes('COMPUTER SCIENCE')) {
          code = '112';
          if (deptUpper.includes('AI') || deptUpper.includes('ML')) code = '137';
        }
        else if (deptUpper.includes('CIVIL')) code = '111';
        else if (deptUpper.includes('ECE')) code = '113';
        else if (deptUpper.includes('EEE')) code = '115';
        else if (deptUpper.includes('MECHANICAL')) code = '116';

        if (code) {
          // B.Tech branch code is at index 5-7. preceded by 5 chars (YY, II, P).
          // Regex: ^.{5}112...
          branchQueries.push({ Reg_No: { $regex: `^.{5}${code}` } });
        } else {
          if (deptUpper === 'CSE') branchQueries.push({ Reg_No: { $regex: `^.{5}112` } });
        }

        matchConditions.push({ $or: branchQueries });
      }

      let query = {};
      if (matchConditions.length > 0) {
        const originalQuery = { $and: matchConditions };
        if (extraRegs.length > 0) {
          query = { $or: [originalQuery, { Reg_No: { $in: extraRegs } }] };
        } else {
          query = originalQuery;
        }
      } else if (extraRegs.length > 0) {
        query = { Reg_No: { $in: extraRegs } };
      }

      if (inactiveRegs.length > 0) {
        if (!query.$and) query.$and = [];
        query.$and.push({ Reg_No: { $nin: inactiveRegs } });
      }

      const students = await db.collection("result").find(query).project({
        _id: 0,
        Reg_No: 1,
        Name: 1,
        Branch: 1
      }).toArray();

      // Filter for B.Tech students AND apply efficient filtering
      const { parseBTechRegistration } = await import('../parse-registration/route');
      const btechStudents = [];
      students.forEach(student => {
        const parsed = parseBTechRegistration(student.Reg_No);
        if (!parsed || !parsed.isValid || !parsed.isBTech) return;

        // Apply rigorous filtering using effective branch/batch
        const effectiveBranch = getEffectiveBranch(student.Reg_No, parsed.branch, student.Branch);
        const effectiveBatch = getEffectiveBatch(student.Reg_No, parsed.year, null);

        // Check Batch
        if (batch && batch !== "All") {
          const batchYear = batch.length === 4 ? batch : `20${batch}`;
          if (effectiveBatch !== batchYear) {
            const shortEff = effectiveBatch.slice(-2);
            const shortBat = batchYear.slice(-2);
            if (shortEff !== shortBat) return;
          }
        }

        // Check Department
        if (department && department !== "All") {
          const normalizedFilter = normalizeBranchForCompare(department);
          const normalizedEffective = normalizeBranchForCompare(effectiveBranch);
          if (normalizedFilter !== normalizedEffective &&
            !normalizedEffective.includes(normalizedFilter) &&
            !normalizedFilter.includes(normalizedEffective)) {
            return;
          }
        }

        // Update student object with effective values for display
        // We clone to avoid mutating the original if that matters, though here it's fine
        const displayStudent = {
          ...student,
          Branch: effectiveBranch,
          Batch: effectiveBatch // Add Batch field which might be useful for frontend
        };

        btechStudents.push(displayStudent);
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

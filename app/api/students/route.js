import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { jwtVerify } from "jose";

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

    const { registration, department, batch } = await req.json();
    
    // Get user role for access control
    const userRole = payload.role?.toLowerCase();
    
    // Security check: Role-based access control
    if (userRole === 'user' || userRole === 'student') {
      // Students can only view their own records
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
      // Teachers and admins can view any student's records
      console.log(`Access granted to ${userRole}: ${payload.email} accessing student data`);
    } else {
      return NextResponse.json({ 
        error: "Access denied - Invalid user role" 
      }, { status: 403 });
    }
    
    // If registration is provided, return individual student records
    if (registration) {
      const client = await clientPromise;
      const db = client.db("cutm1");
      const cutm = db.collection("CUTM1");
      const records = await cutm.find({ Reg_No: registration.toUpperCase() }).project({ _id: 0 }).sort({ Sem: 1, Subject_Code: 1 }).toArray();
      if (!records.length) return NextResponse.json({ error: "No records found" }, { status: 404 });
      return NextResponse.json({ records });
    }
    
    // If department is provided, return list of students in that department
    if (department || batch) {
      console.log("Fetching students for department:", department, "batch:", batch);
      
      const client = await clientPromise;
      const db = client.db("cutm1");
      
      // Build query for students
      let query = {};
      
      if (department && department !== "All") {
        // First try to find by Branch field
        query.Branch = department;
        console.log("Query with Branch:", query);
      }
      
      if (batch && batch !== "All") {
        // Support both two-digit and four-digit year prefixes in Reg_No
        const b = String(batch).trim();
        const yy = b.length === 4 && b.startsWith("20") ? b.slice(2) : b.slice(-2);
        const pattern = `^(?:${yy}|20${yy})`;
        query.Reg_No = { ...query.Reg_No, $regex: pattern };
        console.log("Query with batch filter (pattern):", pattern, query);
      }
      
      // Get distinct students with their basic info
      const students = await db.collection("CUTM1").find(query).project({ 
        _id: 0, 
        Reg_No: 1, 
        Name: 1, 
        Branch: 1 
      }).toArray();
      
      console.log("Found students:", students.length);
      console.log("Sample students:", students.slice(0, 3));
      
      // Remove duplicates based on Reg_No
      const uniqueStudents = students.reduce((acc, student) => {
        if (!acc.find(s => s.Reg_No === student.Reg_No)) {
          acc.push(student);
        }
        return acc;
      }, []);
      
      console.log("Unique students:", uniqueStudents.length);
      
      return NextResponse.json({ students: uniqueStudents });
    }
    
    return NextResponse.json({ error: "registration or department required" }, { status: 400 });
  } catch (err) {
    console.error("/api/students POST error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(req) {
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

    // Check if user is admin or teacher
    const userRole = payload.role?.toLowerCase();
    if (userRole !== 'admin' && userRole !== 'teacher') {
      return NextResponse.json({ 
        error: "Access denied - Only admins and teachers can update records" 
      }, { status: 403 });
    }

    const update = await req.json();
    const { Reg_No, Subject_Code, Grade } = update;
    if (!Reg_No || !Subject_Code || !Grade) return NextResponse.json({ error: "Reg_No, Subject_Code, Grade required" }, { status: 400 });
    const client = await clientPromise;
    const db = client.db("cutm1");
    const cutm = db.collection("CUTM1");
    const res = await cutm.updateOne({ Reg_No, Subject_Code }, { $set: { Grade } });
    if (res.matchedCount === 0) return NextResponse.json({ error: "Record not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("/api/students PUT error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req) {
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
        error: "Access denied - Only admins can delete records" 
      }, { status: 403 });
    }

    const body = await req.json();
    const { Reg_No, Subject_Code, Sem } = body;
    
    if (!Reg_No || !Subject_Code) {
      return NextResponse.json({ error: "Reg_No and Subject_Code required" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("cutm1");
    const cutm = db.collection("CUTM1");
    
    // Build query
    const query = { Reg_No, Subject_Code };
    if (Sem) {
      query.Sem = Sem;
    }
    
    const res = await cutm.deleteOne(query);
    if (res.deletedCount === 0) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: "Record deleted successfully" 
    });
  } catch (err) {
    console.error("/api/students DELETE error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}



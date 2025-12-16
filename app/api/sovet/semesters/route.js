import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { verifyToken } from "@/lib/auth";
import { getCampusSchoolDatabase, getDatabaseFromRegistration } from "@/lib/campus";

/**
 * SOVET Semesters Route - Diploma students only
 */
export async function POST(req) {
  try {
    const { registration } = await req.json();
    if (!registration) {
      return NextResponse.json({ error: "registration required" }, { status: 400 });
    }
    
    const token = req.cookies.get("token")?.value;
    let isUserRole = false;
    
    // For user role, skip validation (they can access via registration-based routing)
    // For admin/teacher, validate student type
    if (token) {
      const payload = await verifyToken(token);
      const userRole = payload?.role?.toLowerCase();
      isUserRole = (userRole === 'user' || userRole === 'student');
      
      if (!isUserRole) {
        // Verify this is a Diploma student (only for admin/teacher)
        const { parseDiplomaRegistration } = await import('../parse-registration/route');
        const parsed = parseDiplomaRegistration(registration);
        if (!parsed || !parsed.isValid || !parsed.isDiploma) {
          return NextResponse.json({ 
            error: "This route is for Diploma (SOVET) students only" 
          }, { status: 400 });
        }
      }
    }
    const client = await clientPromise;
    
    // For user role, determine database from registration number (indices 2-5)
    // For admin/teacher, use campus/school from params or JWT
    let dbName;
    if (isUserRole) {
      dbName = getDatabaseFromRegistration(registration);
    } else if (token) {
      const payload = await verifyToken(token);
      const { searchParams } = new URL(req.url);
      const campusParam = searchParams.get('campus');
      const campus = campusParam || payload?.campus || null;
      const school = 'SOVET';
      dbName = getCampusSchoolDatabase(campus, school);
    } else {
      // No token - use default
      const { searchParams } = new URL(req.url);
      const campusParam = searchParams.get('campus');
      const campus = campusParam || null;
      const school = 'SOVET';
      dbName = getCampusSchoolDatabase(campus, school);
    }
    
    const db = client.db(dbName);
    const cutm = db.collection("result");
    
    const semesters = await cutm.distinct("Sem", { Reg_No: registration.toUpperCase() });
    return NextResponse.json({ 
      semesters: (semesters || []).filter(Boolean).sort(),
      school: 'SOVET'
    });
  } catch (err) {
    console.error("/api/sovet/semesters error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

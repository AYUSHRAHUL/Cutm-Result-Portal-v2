import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { verifyToken } from "@/lib/auth";
import { getCampusSchoolDatabase, getDatabaseFromRegistration } from "@/lib/campus";

/**
 * SOM Semesters Route - SOM (BBA/MBA) students only
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
        // Verify this is a SOM (BBA/MBA) student (only for admin/teacher)
        // Check overrides first to bypass strict validation
        const client = await clientPromise;
        const dbName = getCampusSchoolDatabase(payload?.campus || null, 'SOM');
        const db = client.db(dbName);
        const overridesCol = db.collection("branch_overrides");
        const override = await overridesCol.findOne({ reg: registration.toUpperCase() });

        if (!override) {
          const { parseSOMRegistration } = await import('../parse-registration/route');
          const parsed = parseSOMRegistration(registration);
          if (!parsed || !parsed.isValid || !parsed.isSOM) {
            return NextResponse.json({
              error: "This route is for SOM (BBA/MBA) (SOM) students only"
            }, { status: 400 });
          }
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
      const school = 'SOM';
      dbName = getCampusSchoolDatabase(campus, school);
    } else {
      // No token - use default
      const { searchParams } = new URL(req.url);
      const campusParam = searchParams.get('campus');
      const campus = campusParam || null;
      const school = 'SOM';
      dbName = getCampusSchoolDatabase(campus, school);
    }

    const db = client.db(dbName);
    const cutm = db.collection("som_result");

    const semesters = await cutm.distinct("Sem", { Reg_No: registration.toUpperCase() });
    return NextResponse.json({
      semesters: (semesters || []).filter(Boolean).sort(),
      school: 'SOM'
    });
  } catch (err) {
    console.error("/api/som/semesters error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

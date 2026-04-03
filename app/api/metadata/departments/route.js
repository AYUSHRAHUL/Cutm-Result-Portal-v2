import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { verifyToken } from "@/lib/auth";
import { getCampusSchoolDatabase } from "@/lib/campus";

/**
 * GET /api/metadata/departments?school=SOVET&campus=pkd
 * Returns list of available departments/branches for the given school and campus
 */
export async function GET(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const schoolParam = searchParams.get('school');
    const campusParam = searchParams.get('campus');
    const campus = campusParam || payload.campus || null;
    const school = schoolParam || payload.school || 'SOET';

    const client = await clientPromise;
    const dbName = getCampusSchoolDatabase(campus, school);
    const db = client.db(dbName);
    
    // Choose collection based on school
    const collectionName = (school && school.toUpperCase() === 'SOM') ? "som_result" : "result";
    const collection = db.collection(collectionName);

    // Get all registration numbers
    const records = await collection.find({ Reg_No: { $exists: true } })
      .project({ Reg_No: 1 })
      .toArray();

    // Parse registration numbers to extract branches
    const branchSet = new Set();
    
    if (school.toUpperCase() === 'SOVET') {
      // For SOVET (Diploma), use parseDiplomaRegistration
      const { parseDiplomaRegistration } = await import('../../sovet/parse-registration/route');
      
      // Map short branch names to full department names for Diploma
      const diplomaBranchMap = {
        'Civil': 'Civil Engineering',
        'CSE': 'Computer Science Engineering',
        'Electrical': 'Electrical Engineering',
        'Mechanical': 'Mechanical Engineering',
        'Automobile': 'Automobile Engineering',
        'Mining': 'Mining Engineering'
      };
      
      records.forEach(record => {
        if (record.Reg_No) {
          const parsed = parseDiplomaRegistration(String(record.Reg_No).trim());
          if (parsed && parsed.isValid && parsed.isDiploma && parsed.branch) {
            // Map short branch name to full department name
            const fullDeptName = diplomaBranchMap[parsed.branch] || parsed.branch;
            branchSet.add(fullDeptName);
          }
        }
      });
    } else if (school.toUpperCase() === 'SOM') {
      // For SOM (Management), use parseSOMRegistration
      const { parseSOMRegistration } = await import('../../som/parse-registration/route');
      records.forEach(record => {
        if (record.Reg_No) {
          const parsed = parseSOMRegistration(String(record.Reg_No).trim());
          if (parsed && parsed.isValid && parsed.isSOM && parsed.branch) {
            branchSet.add(parsed.branch);
          }
        }
      });
    } else {
      // For SOET (B.Tech), use parseBTechRegistration
      const { parseBTechRegistration } = await import('../../soet/parse-registration/route');
      records.forEach(record => {
        if (record.Reg_No) {
          const parsed = parseBTechRegistration(String(record.Reg_No).trim());
          if (parsed && parsed.isValid && parsed.isBTech && parsed.branch) {
            branchSet.add(parsed.branch);
          }
        }
      });
    }

    // Convert to sorted array
    const departments = Array.from(branchSet).sort();

    return NextResponse.json({
      success: true,
      departments: departments,
      school: school
    });

  } catch (error) {
    console.error('Metadata departments API error:', error);
    return NextResponse.json({
      error: `Failed to fetch departments: ${error.message}`
    }, { status: 500 });
  }
}

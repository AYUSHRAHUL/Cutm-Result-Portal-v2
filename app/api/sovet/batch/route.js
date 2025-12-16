import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { verifyToken } from "@/lib/auth";
import { getCampusSchoolDatabase } from "@/lib/campus";

/**
 * SOVET (School of Vocational Education & Training) Batch Route
 * Handles Diploma students only
 */
export async function POST(req) {
  try {
    // Check authentication to get campus
    const token = req.cookies.get("token")?.value;
    let campus = null;
    let payload = null;
    if (token) {
      payload = await verifyToken(token);
      campus = payload?.campus || null;
    }

    const { branch, batch } = await req.json();
    const client = await clientPromise;
    
    // Get campus from query params (priority) or payload
    const { searchParams } = new URL(req.url);
    const campusParam = searchParams.get('campus');
    campus = campusParam || campus || null;
    
    // Force school to SOVET for this route
    const school = 'SOVET';
    const dbName = getCampusSchoolDatabase(campus, school);
    
    console.log(`[SOVET Batch] Database selection: campus=${campus}, school=${school}, dbName=${dbName}`);

    const db = client.db(dbName);
    const cutm = db.collection("result");

    // Build query based on branch and batch
    const query = {};

    // Optimize: If batch is provided, filter by Reg_No prefix at database level
    if (batch && batch !== 'All') {
      const batchYear = batch.length === 4 ? batch : `20${batch}`;
      const shortYear = batchYear.slice(-2);

      // Filter for both numeric (starts with YY) and alphanumeric (starts with YYYY) formats
      query.Reg_No = {
        $regex: `^${shortYear}|^${batchYear}`
      };
    }

    // Use projection to fetch only necessary fields
    const allRecords = await cutm.find(query).project({
      Reg_No: 1,
      Name: 1,
      Subject_Code: 1,
      Subject_Name: 1,
      Credits: 1,
      Grade: 1,
      Sem: 1
    }).toArray();

    // Import unified CUTM parser
    const { parseDiplomaRegistration } = await import('../parse-registration/route');

    // SOVET = Diploma only
    const expectDiploma = true;

    // Filter records based on branch and batch (Diploma only)
    const filteredRecords = allRecords.filter(record => {
      const regNo = String(record.Reg_No || '').trim();
      if (!regNo) return false;

      // Parse using unified CUTM parser
      const parsed = parseDiplomaRegistration(regNo);

      if (!parsed || !parsed.isValid) return false;

      // Filter by school type (SOVET = Diploma only)
      if (!parsed.isDiploma) return false;

      // Check batch match
      if (batch && batch !== 'All') {
        const batchYear = batch.length === 4 ? batch : `20${batch}`;
        if (parsed.year !== batchYear) return false;
      }

      // Check branch match (Diploma branches only)
      // Use branch codes from index 5-7: 711=Electrical, 712=Mechanical, 713=Civil, 714=CSE, 715=Automobile, 716=Mining
      if (branch && branch !== 'All') {
        // Map branch names to branch codes (index 5-7)
        const branchCodeMap = {
          'Electrical': '711',
          'Mechanical': '712',
          'Civil': '713',
          'CSE': '714',
          'Automobile': '715',
          'Mining': '716',
          // Also handle old format for backward compatibility
          'Diploma-EE': '711',
          'Diploma-ME': '712',
          'Diploma-CE': '713',
          'Diploma-CSE': '714',
          'Diploma-AE': '715',
          'Diploma-MiE': '716'
        };

        // Handle "Diploma-" prefix
        const branchKey = branch.startsWith('Diploma-') ? branch : branch;
        const expectedBranchCode = branchCodeMap[branchKey] || branchCodeMap[branch];
        
        if (expectedBranchCode) {
          return parsed.branchCode === expectedBranchCode;
        }

        // Fallback: match by branch name from parsed data
        const parsedBranchName = parsed.branch || '';
        const branchLower = branch.toLowerCase().replace('diploma-', '').replace('diploma in ', '');
        return parsedBranchName.toLowerCase().includes(branchLower);
      }

      return true;
    });

    // Normalize Reg_No to strings
    const uniqueRecords = filteredRecords.map(record => ({
      ...record,
      Reg_No: String(record.Reg_No || "").toUpperCase(),
    }));

    return NextResponse.json({
      records: uniqueRecords,
      message: `${uniqueRecords.length} SOVET (Diploma) result records found`,
      school: 'SOVET'
    });

  } catch (err) {
    console.error("/api/sovet/batch error", err);
    return NextResponse.json({ error: "Server error: " + err.message }, { status: 500 });
  }
}

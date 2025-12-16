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
    
    // Removed console.log to reduce overhead

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

    // Use projection to fetch only necessary fields with safety limit
    const MAX_BATCH_RECORDS = 100000; // Safety limit for batch queries
    const allRecords = await cutm.find(query).project({
      Reg_No: 1,
      Name: 1,
      Subject_Code: 1,
      Subject_Name: 1,
      Credits: 1,
      Grade: 1,
      Sem: 1
    }).limit(MAX_BATCH_RECORDS).toArray();

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
        // Normalize branch input: remove "(Diploma)" suffix and "Engineering" variations
        const normalizedBranch = branch
          .replace(/\s*\(Diploma\)/gi, '')
          .replace(/\s*Engineering\s*/gi, ' ')
          .trim();
        
        // Map branch names to branch codes (index 5-7)
        // Handle various formats: "Electrical", "Electrical Engineering", "Electrical Engineering (Diploma)", etc.
        const branchCodeMap = {
          // Electrical variations
          'Electrical': '711',
          'Electrical Engineering': '711',
          'Electrical Engineering (Diploma)': '711',
          'EE': '711',
          'Diploma-EE': '711',
          // Mechanical variations
          'Mechanical': '712',
          'Mechanical Engineering': '712',
          'Mechanical Engineering (Diploma)': '712',
          'Diploma-ME': '712',
          // Civil variations
          'Civil': '713',
          'Civil Engineering': '713',
          'Civil Engineering (Diploma)': '713',
          'Diploma-CE': '713',
          // CSE variations
          'CSE': '714',
          'Computer Science Engineering': '714',
          'Computer Science Engineering (Diploma)': '714',
          'Diploma-CSE': '714',
          // Automobile variations
          'Automobile': '715',
          'Automobile Engineering': '715',
          'Automobile Engineering (Diploma)': '715',
          'Diploma-AE': '715',
          // Mining variations
          'Mining': '716',
          'Mining Engineering': '716',
          'Mining Engineering (Diploma)': '716',
          'ME': '716', // Note: ME is also used for Mining in some places
          'Diploma-MiE': '716'
        };

        // Try exact match first
        let expectedBranchCode = branchCodeMap[branch] || branchCodeMap[normalizedBranch];
        
        // Try case-insensitive match if exact match failed
        if (!expectedBranchCode) {
          const branchLower = branch.toLowerCase();
          const normalizedLower = normalizedBranch.toLowerCase();
          for (const [key, code] of Object.entries(branchCodeMap)) {
            if (key.toLowerCase() === branchLower || key.toLowerCase() === normalizedLower) {
              expectedBranchCode = code;
              break;
            }
          }
        }
        
        if (expectedBranchCode) {
          return parsed.branchCode === expectedBranchCode;
        }

        // Fallback: match by branch name from parsed data
        const parsedBranchName = parsed.branch || '';
        const branchLower = branch.toLowerCase()
          .replace(/\s*\(diploma\)/g, '')
          .replace(/\s*engineering\s*/g, ' ')
          .trim();
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
    // Removed console.error to reduce overhead
    return NextResponse.json({ error: "Server error: " + err.message }, { status: 500 });
  }
}

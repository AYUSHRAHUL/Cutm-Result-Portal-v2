import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { verifyToken } from "@/lib/auth";
import { getCampusSchoolDatabase } from "@/lib/campus";

/**
 * GET /api/metadata/batches?school=SOVET&campus=pkd
 * Returns list of available batches for the given school and campus
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

    // Batch comes from the leading digits of the registration number, so group by the
    // first 8 characters in MongoDB and parse one representative per group rather than
    // pulling every row out of the collection and parsing it in JS.
    async function distinctRegistrationSamples(col) {
      const groups = await col.aggregate([
        { $match: { Reg_No: { $exists: true, $ne: null } } },
        { $project: { reg: { $trim: { input: { $toString: "$Reg_No" } } } } },
        // Every parser requires exactly 12 characters, so drop the rest here rather
        // than letting a malformed row become the sample for its prefix group.
        { $match: { $expr: { $eq: [{ $strLenCP: "$reg" }, 12] } } },
        {
          $group: {
            _id: { $substrCP: ["$reg", 0, 8] },
            sample: { $first: "$reg" }
          }
        }
      ], { allowDiskUse: true }).toArray();
      return groups.map(g => ({ Reg_No: g.sample }));
    }

    // Get registration numbers from primary collection
    const records = await distinctRegistrationSamples(collection);

    // Also get registration numbers from RegistrationData collection (for newly uploaded registrations)
    let registrationDataRecords = [];
    try {
      registrationDataRecords = await distinctRegistrationSamples(db.collection("RegistrationData"));
    } catch (e) {
      console.warn('RegistrationData collection not available or query failed');
    }

    // Combine both sets of records
    const allRecords = [...records, ...registrationDataRecords];

    // Parse registration numbers to extract batches
    const batchSet = new Set();
    const schoolUpper = String(school || '').toUpperCase();

    if (schoolUpper === 'SOVET') {
      // For SOVET (Diploma), use parseDiplomaRegistration
      const { parseDiplomaRegistration } = await import('../../sovet/parse-registration/route');
      allRecords.forEach(record => {
        if (record.Reg_No) {
          const parsed = parseDiplomaRegistration(String(record.Reg_No).trim());
          if (parsed && parsed.isValid && parsed.isDiploma && parsed.year) {
            batchSet.add(parsed.year);
          }
        }
      });
    } else if (schoolUpper === 'SOM') {
      // For SOM (Management), use parseSOMRegistration
      const { parseSOMRegistration } = await import('../../som/parse-registration/route');
      allRecords.forEach(record => {
        if (record.Reg_No) {
          const parsed = parseSOMRegistration(String(record.Reg_No).trim());
          if (parsed && parsed.isValid && parsed.isSOM && parsed.year) {
            batchSet.add(parsed.year);
          }
        }
      });
    } else {
      // For SOET (B.Tech), use parseBTechRegistration
      const { parseBTechRegistration } = await import('../../soet/parse-registration/route');
      allRecords.forEach(record => {
        if (record.Reg_No) {
          const parsed = parseBTechRegistration(String(record.Reg_No).trim());
          if (parsed && parsed.isValid && parsed.isBTech && parsed.year) {
            batchSet.add(parsed.year);
          }
        }
      });
    }

    // Convert to sorted array
    const batches = Array.from(batchSet).sort().reverse();

    return NextResponse.json({
      success: true,
      batches: batches,
      school: school
    });

  } catch (error) {
    console.error('Metadata batches API error:', error);
    return NextResponse.json({
      error: `Failed to fetch batches: ${error.message}`
    }, { status: 500 });
  }
}

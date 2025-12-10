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

export async function GET(req) {
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
        error: "Access denied - Only admins can access analytics data" 
      }, { status: 403 });
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(req.url);
    const batchFilter = searchParams.get('batch');
    const branchFilter = searchParams.get('branch');
    const semesterFilter = searchParams.get('semester');

    const client = await clientPromise;
    const db = client.db("cutm1");
    const cutm = db.collection("CUTM1");
    
    console.log("Fetching subjects from CUTM1 collection (NOT from CBCS)", {
      batch: batchFilter,
      branch: branchFilter,
      semester: semesterFilter
    });

    // Build match conditions for filters
    const matchConditions = [
      {
        $or: [
          { Subject_Code: { $exists: true, $ne: null, $ne: "" } },
          { "Subject Code": { $exists: true, $ne: null, $ne: "" } }
        ]
      }
    ];

    // Add batch filter
    if (batchFilter && batchFilter !== "all") {
      const batchPrefix = batchFilter.length === 4 ? batchFilter.substring(2, 4) : batchFilter;
      matchConditions.push({
        Reg_No: { $regex: `^${batchPrefix}` }
      });
    }

    // Add branch filter (with branch overrides support)
    if (branchFilter && branchFilter !== "all") {
      const branchMap = {
        'CSE': ['2', '8'],
        'ECE': ['3', '4'],
        'EEE': ['5'],
        'ME': ['6'],
        'CIVIL': ['1', '9'],
        'AIML': ['7']
      };
      
      const branchCodes = branchMap[branchFilter] || [];
      const orConditions = [];
      
      // Add Reg_No pattern matching
      if (branchCodes.length > 0) {
        orConditions.push({
          Reg_No: { $regex: `^.{7}[${branchCodes.join('')}]` }
        });
      }
      
      // Add branch overrides support
      try {
        // Get all registration numbers that have branch overrides matching this branch
        const branchNameMap = {
          'CSE': ['computer science', 'cse', 'computer science engineering'],
          'ECE': ['electronics & communication', 'ece', 'electronics and communication'],
          'EEE': ['electrical & electronics', 'eee', 'electrical and electronics'],
          'ME': ['mechanical', 'me', 'mechanical engineering'],
          'CIVIL': ['civil', 'civil engineering'],
          'AIML': ['aiml', 'artificial intelligence', 'machine learning']
        };
        
        const validNames = branchNameMap[branchFilter] || [];
        const overrideDocs = await db.collection("branch_overrides").find({}).toArray();
        const matchingRegs = overrideDocs
          .filter(doc => {
            const branchName = String(doc.branch || "").toLowerCase();
            return validNames.some(name => branchName.includes(name.toLowerCase()) || name.toLowerCase().includes(branchName));
          })
          .map(doc => String(doc.reg).toUpperCase());
        
        if (matchingRegs.length > 0) {
          orConditions.push({ Reg_No: { $in: matchingRegs } });
        }
      } catch (err) {
        console.error("Error fetching branch overrides:", err);
      }
      
      if (orConditions.length > 0) {
        matchConditions.push({ $or: orConditions });
      }
    }

    // Add semester filter
    if (semesterFilter && semesterFilter !== "all") {
      matchConditions.push({
        $or: [
          { Sem: semesterFilter },
          { Sem: { $regex: new RegExp(`^${semesterFilter}`, 'i') } }
        ]
      });
    }

    // Get unique subjects from CUTM1 using aggregation for better performance
    // IMPORTANT: This ONLY queries CUTM1, NOT the CBCS collection
    // Also calculate totalStudents count for each subject
    const subjects = await cutm.aggregate([
      {
        $match: {
          $and: matchConditions
        }
      },
      {
        $group: {
          _id: {
            $toUpper: {
              $trim: {
                input: {
                  $ifNull: ["$Subject_Code", "$Subject Code"]
                }
              }
            }
          },
          name: {
            $first: {
              $ifNull: [
                { $trim: { input: { $ifNull: ["$Subject_Name", "$Subject Name"] } } },
                ""
              ]
            }
          },
          totalStudents: { $sum: 1 } // Count records for this subject
        }
      },
      {
        $project: {
          _id: 0,
          code: "$_id",
          name: {
            $cond: {
              if: { $eq: ["$name", ""] },
              then: "$_id",
              else: "$name"
            }
          },
          totalStudents: 1
        }
      },
      {
        $match: {
          code: { $ne: "" },
          totalStudents: { $gt: 0 } // Only include subjects with data
        }
      },
      {
        $sort: { code: 1 }
      }
    ]).toArray();

    // Fallback: if aggregation returns empty, try simple find
    let formattedSubjects = subjects;
    if (formattedSubjects.length === 0) {
      console.log("Aggregation returned empty, trying simple find...");
      const findQuery = {
        $and: matchConditions
      };
      const allRecords = await cutm.find(findQuery).project({
        Subject_Code: 1,
        Subject_Name: 1,
        "Subject Code": 1,
        "Subject Name": 1,
        Reg_No: 1,
        Sem: 1
      }).limit(10000).toArray();

      // Create a map to get unique subjects with their names
      const subjectMap = new Map();
      
      allRecords.forEach(record => {
        const code = String(record.Subject_Code || record["Subject Code"] || "").trim().toUpperCase();
        const name = String(record.Subject_Name || record["Subject Name"] || "").trim();
        
        if (code && code !== "") {
          if (!subjectMap.has(code)) {
            subjectMap.set(code, {
              code: code,
              name: name || code,
              totalStudents: 1
            });
          } else {
            // If name is missing but we have a new record with a name, update it
            const existing = subjectMap.get(code);
            existing.totalStudents = (existing.totalStudents || 0) + 1;
            if (!existing.name || existing.name === existing.code) {
              if (name && name !== "") {
                existing.name = name;
              }
            }
          }
        }
      });

      // Convert map to array, filter out zero students, and sort
      formattedSubjects = Array.from(subjectMap.values())
        .filter(sub => (sub.totalStudents || 0) > 0) // Only include subjects with data
        .sort((a, b) => a.code.localeCompare(b.code));
    }

    console.log(`Found ${formattedSubjects.length} unique subjects from CUTM1 collection`);
    
    // Verify we're not accidentally using CBCS
    if (formattedSubjects.length === 0) {
      console.warn("WARNING: No subjects found in CUTM1. Make sure grade records are uploaded to CUTM1 collection.");
    }

    return NextResponse.json({
      success: true,
      source: "CUTM1", // Explicitly mark the source
      subjects: formattedSubjects,
      count: formattedSubjects.length
    });

  } catch (error) {
    console.error('Subjects API error:', error);
    return NextResponse.json({ 
      error: `Failed to fetch subjects: ${error.message}` 
    }, { status: 500 });
  }
}


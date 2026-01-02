import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { verifyToken } from "@/lib/auth";

export async function GET(req) {
    try {
        const token = req.cookies.get("token")?.value;
        if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const payload = await verifyToken(token);
        if (!payload?.email) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const branch = searchParams.get("branch");
        const batch = searchParams.get("batch");
        const sem = searchParams.get("sem");

        const client = await clientPromise;
        const { getDatabaseFromRequest } = await import("@/lib/db-helper");
        // Ensure we are hitting the correct DB for "RegistrationData"
        // Since we are likely in PKD/SOET context:
        const dbName = await getDatabaseFromRequest(req);
        const db = client.db(dbName);

        // 1. Get all Skill Courses
        const courses = await db.collection("skill_courses").find({}).toArray();
        const subjectToSkill = {};
        const allSkillSubjects = [];

        courses.forEach(c => {
            const code = (c.SubjectCode || "").trim();
            const name = c.SubjectName;
            if (code) {
                subjectToSkill[code] = name; // Map Code -> Course Name
                allSkillSubjects.push(code);
            }
        });

        if (allSkillSubjects.length === 0) {
            return NextResponse.json({ counts: {}, students: [], totalStudents: 0 });
        }

        // 3. Data Fetching Strategy:
        // Fetch ALL records matching the Skill Subject Codes.
        // We will perform Batch, Branch, and Semester filtering in MEMORY.
        // This avoids issues where Reg_No is stored as a Number in MongoDB (regex query fails)
        // or Branch/Semester naming is inconsistent.

        // Base query: Only filter by relevant subjects
        const baseQuery = {
            Subject_Code: { $in: allSkillSubjects }
            // We don't filter by Sem/Branch/RegNo here to ensure we get raw data first
        };

        // Parallel Fetch
        const [resultDataRaw, regDataRaw] = await Promise.all([
            db.collection("result").find(baseQuery).project({
                Reg_No: 1, Name: 1, Branch: 1, Subject_Code: 1, Subject_Name: 1, Semester: 1, Sem: 1
            }).toArray().catch(err => { console.warn("Result query failed", err); return []; }),

            db.collection("RegistrationData").find({
                ...baseQuery,
                Type: "Registration"
            }).project({
                Reg_No: 1, Name: 1, Branch: 1, Subject_Code: 1, Subject_Name: 1, Sem: 1
            }).toArray().catch(err => { console.warn("Registration query failed", err); return []; })
        ]);

        // 4. In-Memory Filtering & Aggregation
        const studentMap = new Map();
        const skillCounts = {};

        // Helper to derive branch from Reg No
        const getBranchFromRegNo = (regNo) => {
            if (!regNo) return "Unknown";
            const str = String(regNo).trim();
            // Expected format: YYCCSS BB NNNN (Batch, Campus, School, Branch, Number)
            // Branch code is usually at index 5-7 (3 digits)
            // Example: 210101 112 0001 -> 112 is CSE
            // Or simplified mapping:

            // Mapping for SOET B.Tech
            const codeMap = {
                '111': 'Civil',
                '112': 'CSE',
                '113': 'ECE',
                '114': 'EE', // Sometimes Electrical
                '115': 'EEE',
                '116': 'Mechanical',
                '117': 'AIML',
                '118': 'CSEA',
                '119': 'Mining', // Diploma but sometime shows up
                '246': 'Pharma'
            };

            // Try 3-digit code first
            if (str.length >= 8) {
                const code3 = str.slice(5, 8);
                if (codeMap[code3]) return codeMap[code3];

                // Fallback: Check 8th digit (index 7) if standard logic fails
                // 1 -> Civil, 2 -> CSE, 3/4 -> ECE, 5 -> EEE, 6 -> Mech, 7 -> AIML
                const char = str.charAt(7);
                const charMap = {
                    '1': 'Civil',
                    '2': 'CSE',
                    '3': 'ECE',
                    '4': 'ECE',
                    '5': 'EEE',
                    '6': 'Mechanical',
                    '7': 'AIML'
                };
                if (charMap[char]) return charMap[char];
            }
            return "Unknown";
        };

        const processRecords = (records) => {
            records.forEach(row => {
                // Safe string conversions
                const regNoRaw = row.Reg_No;
                if (!regNoRaw) return;
                const regNo = String(regNoRaw).trim();

                const subjectCode = (row.Subject_Code || "").trim();
                const skillName = subjectToSkill[subjectCode];
                if (!skillName) return;

                // Derive Branch if missing or Unknown
                let studentBranch = row.Branch || "Unknown";
                if (!studentBranch || studentBranch === "Unknown") {
                    studentBranch = getBranchFromRegNo(regNo);
                }

                // --- FILTERS ---

                // 1. Batch Filter (derived from Reg No)
                if (batch && batch !== "All") {
                    const batchStr = String(batch).trim();
                    const yy = batchStr.length === 4 && batchStr.startsWith("20") ? batchStr.slice(2) : batchStr.slice(-2);
                    if (!regNo.startsWith(yy)) return;
                }

                // 2. Semester Filter
                if (sem && sem !== "All") {
                    const rowSem = String(row.Sem || row.Semester || "").toLowerCase().replace(/sem\s*/, "").trim();
                    const targetSem = String(sem).toLowerCase().trim();
                    if (rowSem !== targetSem) return;
                }

                // 3. Branch Filter
                if (branch && branch !== "All") {
                    const bUpper = branch.toUpperCase();
                    const rUpper = String(studentBranch).toUpperCase() || "";

                    if (rUpper !== bUpper && !rUpper.includes(bUpper)) {
                        // Check aliases
                        const aliases = {
                            "CSE": ["COMPUTER SCIENCE", "CS"],
                            "ECE": ["ELECTRONICS", "EC"],
                            "EEE": ["ELECTRICAL", "EE"],
                            "MECHANICAL": ["MECH"],
                            "CIVIL": ["CIVIL"]
                        };
                        const validAliases = aliases[bUpper] || [];
                        let match = false;
                        if (validAliases.some(a => rUpper.includes(a))) match = true;
                        if (!match) return;
                    }
                }

                // --- AGGREGATION ---

                if (!studentMap.has(regNo)) {
                    studentMap.set(regNo, {
                        Reg_No: regNo, // Store as string
                        Name: row.Name || "",
                        Branch: studentBranch,
                        Skills: new Set(),
                        Subjects: []
                    });
                }

                const student = studentMap.get(regNo);
                student.Skills.add(skillName);
                if (!student.Subjects.includes(subjectCode)) {
                    student.Subjects.push(subjectCode);
                }

                // Prioritize explicit DB branch over derived if DB had one (but we handled this above)
                // If we have a derived branch and the stored one is Unknown, we keep derived.
            });
        };

        // Process both datasets
        processRecords(resultDataRaw);
        processRecords(regDataRaw);

        // 5. Aggregate by Skill Subject

        // Initialize map with all skills (even those with 0 count)
        const skillAggregation = {};
        for (const code of allSkillSubjects) {
            skillAggregation[code] = {
                SubjectCode: code,
                SubjectName: subjectToSkill[code],
                TotalStudents: 0,
                ByBranch: {},
                ByBatch: {},
                Students: []
            };
        }

        studentMap.forEach(student => {
            // Iterate over the student's registered subjects (Codes)
            student.Subjects.forEach(subCode => {
                // If this subject is a tracked skill
                if (skillAggregation[subCode]) {
                    const agg = skillAggregation[subCode];

                    // Check if we already added this student to this specific skill (to avoid double counting if duplicate codes exist in raw data)
                    // Using a Set for Students is better, but array search is okay for small scale.
                    // Actually, studentMap ensures unique Student per ID. 
                    // student.Subjects has unique codes (we did checks in processRecords).
                    // So we can just push.

                    agg.TotalStudents++;

                    // Branch Breakdown
                    const branch = student.Branch || "Unknown";
                    agg.ByBranch[branch] = (agg.ByBranch[branch] || 0) + 1;

                    // Batch Breakdown
                    const batchCode = student.Reg_No.length >= 2 ? student.Reg_No.substring(0, 2) : "Unknown";
                    const batchYear = batchCode.match(/^\d+$/) ? "20" + batchCode : "Unknown";
                    agg.ByBatch[batchYear] = (agg.ByBatch[batchYear] || 0) + 1;

                    // Add student to list
                    agg.Students.push({
                        Reg_No: student.Reg_No,
                        Name: student.Name,
                        Branch: branch,
                        Batch: batchYear
                    });
                }
            });
        });

        const skillList = Object.values(skillAggregation).sort((a, b) => b.TotalStudents - a.TotalStudents);

        // Filter empties if needed, or keeping all
        const activeSkills = skillList.filter(s => s.TotalStudents > 0);

        return NextResponse.json({
            skills: activeSkills,
            totalStudents: studentMap.size
        });


    } catch (error) {
        console.error("Skill Analytics Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

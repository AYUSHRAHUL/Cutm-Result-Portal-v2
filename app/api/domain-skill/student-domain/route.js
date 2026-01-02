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
        // Ensure we are hitting the correct DB
        const dbName = await getDatabaseFromRequest(req);
        const db = client.db(dbName);

        // 1. Get all Domains and their Subjects
        const domainItems = await db.collection("honours_domain_subjects").find({}).toArray();

        // Map Subject Code -> Domain Name(s)
        // A subject usually belongs to one domain, but just in case, we map code to Domain Name.
        const subjectToDomain = {};
        const allDomainSubjects = [];
        const domainNames = new Set();

        // Also keep track of Domain Metadata (like credits) if needed, but for now just validation
        const domainMetadata = {};

        domainItems.forEach(item => {
            const domain = item.Domain;
            const code = (item["Subject Code"] || item.SubjectCode || "").trim();

            if (domain && code) {
                subjectToDomain[code] = domain;
                allDomainSubjects.push(code);
                domainNames.add(domain);

                if (!domainMetadata[domain]) {
                    domainMetadata[domain] = {
                        itemCount: 0,
                        codes: []
                    };
                }
                domainMetadata[domain].itemCount++;
                domainMetadata[domain].codes.push(code);
            }
        });

        if (allDomainSubjects.length === 0) {
            return NextResponse.json({ domains: [], totalStudents: 0 });
        }

        // 3. Data Fetching Strategy:
        // Fetch ALL records matching the Domain Subject Codes.
        // We will perform Batch, Branch, and Semester filtering in MEMORY.

        // Base query: Only filter by relevant subjects
        const baseQuery = {
            Subject_Code: { $in: allDomainSubjects }
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

        // Helper to derive branch from Reg No (Same as Student Skill)
        const getBranchFromRegNo = (regNo) => {
            if (!regNo) return "Unknown";
            const str = String(regNo).trim();

            // Mapping for SOET B.Tech
            const codeMap = {
                '111': 'Civil',
                '112': 'CSE',
                '113': 'ECE',
                '114': 'EE',
                '115': 'EEE',
                '116': 'Mechanical',
                '117': 'AIML',
                '118': 'CSEA',
                '119': 'Mining',
                '246': 'Pharma'
            };

            // Try 3-digit code first
            if (str.length >= 8) {
                const code3 = str.slice(5, 8);
                if (codeMap[code3]) return codeMap[code3];

                // Fallback: Check 8th digit
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
                const domainName = subjectToDomain[subjectCode];
                if (!domainName) return;

                // Derive Branch if missing or Unknown
                let studentBranch = row.Branch || "Unknown";
                if (!studentBranch || studentBranch === "Unknown") {
                    studentBranch = getBranchFromRegNo(regNo);
                }

                // --- FILTERS ---

                // 1. Batch Filter
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
                        Reg_No: regNo,
                        Name: row.Name || "",
                        Branch: studentBranch,
                        Domains: new Set(),
                        Subjects: []
                    });
                }

                const student = studentMap.get(regNo);
                student.Domains.add(domainName);
                if (!student.Subjects.includes(subjectCode)) {
                    student.Subjects.push(subjectCode);
                }
            });
        };

        // Process both datasets
        processRecords(resultDataRaw);
        processRecords(regDataRaw);

        // 5. Aggregate by Domain

        // Initialize map with all domains (even those with 0 count)
        const domainAggregation = {};
        for (const dom of domainNames) {
            domainAggregation[dom] = {
                DomainName: dom,
                TotalStudents: 0,
                ByBranch: {},
                ByBatch: {},
                Students: []
            };
        }

        studentMap.forEach(student => {
            // A student counts once for each Domain they have registered subjects in
            student.Domains.forEach(domName => {
                if (domainAggregation[domName]) {
                    const agg = domainAggregation[domName];

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

        const domainList = Object.values(domainAggregation).sort((a, b) => b.TotalStudents - a.TotalStudents);

        // Filter empties if needed, or keeping all
        const activeDomains = domainList.filter(d => d.TotalStudents > 0);

        return NextResponse.json({
            domains: activeDomains,
            totalStudents: studentMap.size
        });

    } catch (error) {
        console.error("Domain Analytics Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

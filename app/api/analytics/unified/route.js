
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
        const category = searchParams.get("category"); // "Basket I", "Basket II", "Skill", "Domain", etc.
        const branch = searchParams.get("branch");
        const batch = searchParams.get("batch");
        const sem = searchParams.get("sem");

        if (!category) return NextResponse.json({ error: "Category is required" }, { status: 400 });

        const client = await clientPromise;
        const { getDatabaseFromRequest } = await import("@/lib/db-helper");
        const dbName = await getDatabaseFromRequest(req);
        const db = client.db(dbName);

        // 1. Identify Target Subjects based on Category
        let targetSubjects = []; // List of Subject Codes
        let subjectToKey = {}; // Map Subject Code -> Grouping Key (Code for Subjects, Domain Name for Domains)
        let keyToDetails = {}; // Map Grouping Key -> { Name, Type, Code? }
        let isDomain = false;

        if (category === "All") {
            // Load ALL categories: Baskets, Skills, and Domains
            
            // Load all Baskets
            const allBaskets = await db.collection("cbcs").find({}).toArray();
            allBaskets.forEach(b => {
                    const code = (b["Subject Code"] || b.Subject_Code || "").trim();
                    const name = b["Subject Name"] || b.Subject_Name || code;
                    const basket = b.Basket || "Unknown";
                    const credits = b.Credits || b.Credit || b.credits || "";
                    if (code) {
                        targetSubjects.push(code);
                        subjectToKey[code] = code;
                        keyToDetails[code] = { Name: name, Type: basket, Code: code, Credits: credits };
                    }
            });
            
            // Load Skills
            const skillCourses = await db.collection("skill_courses").find({}).toArray();
            skillCourses.forEach(c => {
                const code = (c.SubjectCode || "").trim();
                const name = c.SubjectName || code;
                if (code) {
                    targetSubjects.push(code);
                    subjectToKey[code] = code;
                    keyToDetails[code] = { Name: name, Type: "Skill", Code: code };
                }
            });
            
            // Load Domains
            const allDomains = await db.collection("honours_domain_subjects").find({}).toArray();
            allDomains.forEach(d => {
                const code = (d["Subject Code"] || d.SubjectCode || "").trim();
                const domain = d.Domain;
                if (code && domain) {
                    targetSubjects.push(code);
                    subjectToKey[code] = domain;
                    if (!keyToDetails[domain]) {
                        keyToDetails[domain] = { Name: domain, Type: "Domain" };
                    }
                }
            });
        } else if (category === "Skill") {
            const courses = await db.collection("skill_courses").find({}).toArray();
            courses.forEach(c => {
                const code = (c.SubjectCode || "").trim();
                    const name = c.SubjectName || code;
                    const credits = c.Credits || c.Credit || c.credits || "";
                    if (code) {
                        targetSubjects.push(code);
                        subjectToKey[code] = code; // Group by Code
                        keyToDetails[code] = { Name: name, Type: "Skill", Code: code, Credits: credits };
                    }
            });
        } else if (category === "Domain") {
            isDomain = true;
            const domains = await db.collection("honours_domain_subjects").find({}).toArray();
            domains.forEach(d => {
                const code = (d["Subject Code"] || d.SubjectCode || "").trim();
                const domain = d.Domain;
                if (code && domain) {
                    targetSubjects.push(code);
                    subjectToKey[code] = domain; // Group by Domain Name
                    keyToDetails[domain] = { Name: domain, Type: "Domain" };
                }
            });
        } else if (category.startsWith("Basket")) {
            // Normalize Basket Name
            let basketName = category;
            if (category.endsWith("1")) basketName = "Basket I";
            if (category.endsWith("2")) basketName = "Basket II";
            if (category.endsWith("3")) basketName = "Basket III";
            if (category.endsWith("4")) basketName = "Basket IV";
            if (category.endsWith("5")) basketName = "Basket V";

            const basketItems = await db.collection("cbcs").find({ Basket: basketName }).toArray();
            basketItems.forEach(b => {
                const code = (d["Subject Code"] || d.SubjectCode || "").trim();
                const domain = d.Domain;
                const credits = d.Credits || d.Credit || d.credits || "";
                if (code && domain) {
                    targetSubjects.push(code);
                    subjectToKey[code] = domain; // Group by Domain Name
                    if (!keyToDetails[domain]) {
                        keyToDetails[domain] = { Name: domain, Type: "Domain", Credits: credits };
                    }
                }
            return NextResponse.json({ error: "Invalid Category" }, { status: 400 });
        }

        if (targetSubjects.length === 0) {
            return NextResponse.json({ items: [], totalStudents: 0 });
        }

        // 2. Data Fetching
        const baseQuery = {
            Subject_Code: { $in: targetSubjects }
        };

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

        // 3. Helper: Branch Derivation
        const getBranchFromRegNo = (regNo) => {
            if (!regNo) return "Unknown";
            const str = String(regNo).trim();
            // Standard CUTM logic
            if (str.length >= 8) {
                const code3 = str.slice(5, 8);
                const codeMap = {
                    '111': 'Civil', '112': 'CSE', '113': 'ECE', '115': 'EEE', '116': 'Mechanical', '137': 'CSE AIML'
                };
                if (codeMap[code3]) return codeMap[code3];
                const char = str.charAt(7);
                const charMap = {
                    '1': 'Civil', '2': 'CSE', '3': 'ECE', '4': 'ECE', '5': 'EEE', '6': 'Mechanical', '7': 'AIML'
                };
                if (charMap[char]) return charMap[char];
            }
            return "Unknown";
        };

        // 4. In-Memory Processing
        const studentMap = new Map(); // Key: RegNo, Value: Student Object

        const processRecords = (records) => {
            records.forEach(row => {
                const regNoRaw = row.Reg_No;
                if (!regNoRaw) return;
                const regNo = String(regNoRaw).trim();
                const subjectCode = (row.Subject_Code || "").trim();

                // Get Group Key
                const groupKey = subjectToKey[subjectCode];
                if (!groupKey) return;

                // Dynamic Name Discovery:
                // If the metadata collection (cbcs/skill) didn't have a name (so it fell back to Code),
                // but this student record HAS a Subject Name, use it to improve our display.
                // IMPORTANT: Don't override domain names - they should remain as domain names, not subject names
                if (keyToDetails[groupKey] && !isDomain) {
                    const currentName = keyToDetails[groupKey].Name;
                    const recordName = (row.Subject_Name || "").trim();
                    // If current name is just the code, and we have a better name that isn't the code
                    // For domains, we never want to override the domain name with subject names
                    if (currentName === groupKey && recordName && recordName !== subjectCode) {
                        keyToDetails[groupKey].Name = recordName;
                    }
                }

                // Branch Logic
                let studentBranch = row.Branch || "Unknown";
                if (!studentBranch || studentBranch === "Unknown") {
                    studentBranch = getBranchFromRegNo(regNo);
                }

                // --- FILTERS ---
                if (batch && batch !== "All") {
                    const batchStr = String(batch).trim();
                    const yy = batchStr.length === 4 && batchStr.startsWith("20") ? batchStr.slice(2) : batchStr.slice(-2);
                    if (!regNo.startsWith(yy)) return;
                }

                if (sem && sem !== "All") {
                    const rowSem = String(row.Sem || row.Semester || "").toLowerCase().replace(/sem\s*/, "").trim();
                    const targetSem = String(sem).toLowerCase().replace(/sem\s*/, "").trim();
                    if (rowSem !== targetSem) return;
                }

                if (branch && branch !== "All") {
                    // Helper to normalize branch names to strict categories
                    const normalizeBranch = (s) => {
                        const str = String(s).toUpperCase();
                        if (str.includes("AIML") || str.includes("ARTIFICIAL")) return "AIML";
                        if (str.includes("MECH")) return "Mechanical";
                        if (str.includes("CIVIL")) return "Civil";

                        // Electrical vs Electronics
                        // "Electrical and Electronics" (EEE) contains "Electronic", so check Electrical first.
                        if (str.includes("ELECTRICAL") || str.includes("EEE")) return "EEE";
                        if (str.includes("COMMUNICATION") || str.includes("ECE") || str.includes("ELECTRONIC")) return "ECE";

                        // Check CSE last to avoid grabbing AIML (if logic above didn't catch it, though AIML is first)
                        if (str.includes("CSE") || str.includes("COMPUTER") || str.includes("CS")) return "CSE";

                        return "Unknown";
                    };

                    const studentBranchCode = normalizeBranch(studentBranch);
                    const filterBranchCode = normalizeBranch(branch);

                    if (studentBranchCode !== filterBranchCode) return;
                }

                // --- AGGREGATION ---
                if (!studentMap.has(regNo)) {
                    studentMap.set(regNo, {
                        Reg_No: regNo,
                        Name: row.Name || "",
                        Branch: studentBranch,
                        Groups: new Set(), // Set of Domains, Skills, or Subjects this student has
                        Subjects: []
                    });
                }

                const student = studentMap.get(regNo);
                student.Groups.add(groupKey);
                // Track unique subjects just in case
                if (!student.Subjects.includes(subjectCode)) {
                    student.Subjects.push(subjectCode);
                }
            });
        };

        processRecords(resultDataRaw);
        processRecords(regDataRaw);

        // 5. Final Group Aggregation (Group by Item)
        const aggregatedItems = {};

        // For Baskets and Skills, we rely on the data we found.
        // For Domains, we might want to pre-fill all domains even if 0 students.
        if (isDomain) {
            Object.keys(keyToDetails).forEach(k => {
                aggregatedItems[k] = {
                    ...keyToDetails[k],
                    TotalStudents: 0,
                    ByBranch: {},
                    Students: []
                };
            });
        }

        // Ensure items are created based on student data or pre-fill
        // For Baskets/Skills, we only care about active ones mostly, but we can iterate keyToDetails if desired.
        // Let's use the student data primarily, but use keyToDetails for metadata.

        // Actually, to show 0s (active subjects with 0 students in filter), we should iterate keyToDetails.
        // But for Baskets there are too many subjects. Only show active ones or ones in this batch?
        // Let's stick to showing items that have > 0 students OR if it's a Domain (prefilled).
        // If we want to show 0s for Baskets, we can iterate keyToDetails.

        // Logic: 
        // 1. Initialize from keyToDetails if Domain (already done above)
        // 2. Or initialize on demand from student data.

        studentMap.forEach(student => {
            student.Groups.forEach(groupKey => {
                if (!aggregatedItems[groupKey]) {
                    // Lazy initialization for non-prefilled items (Basket/Skill)
                    if (keyToDetails[groupKey]) {
                        aggregatedItems[groupKey] = {
                            ...keyToDetails[groupKey],
                            TotalStudents: 0,
                            ByBranch: {},
                            Students: []
                        };
                    }
                }

                if (aggregatedItems[groupKey]) {
                    const agg = aggregatedItems[groupKey];
                    agg.TotalStudents++;

                    // Branch Breakdown
                    const br = student.Branch || "Unknown";
                    agg.ByBranch[br] = (agg.ByBranch[br] || 0) + 1;

                    agg.Students.push({
                        Reg_No: student.Reg_No,
                        Name: student.Name,
                        Branch: br,
                        Batch: student.Reg_No.length >= 2 ? "20" + student.Reg_No.substring(0, 2) : "Unknown"
                    });
                }
            });
        });

        const items = Object.values(aggregatedItems)
            .sort((a, b) => b.TotalStudents - a.TotalStudents)
            .filter(i => i.TotalStudents > 0);

        // Sort students by Reg_No within each item
        items.forEach(item => {
            item.Students.sort((a, b) => a.Reg_No.localeCompare(b.Reg_No));
        });

        return NextResponse.json({
            items: items,
            totalStudents: studentMap.size
        });

    } catch (error) {
        console.error("Unified Analytics Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

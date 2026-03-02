
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
        let subjectCodeToCredits = {}; // Map Subject Code -> Credits (for accurate credit lookup)
        let domainToSubjects = {}; // Map Domain Name -> [subject codes in that domain]
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
                const credits = c.Credits || c.Credit || c.credits || "";
                if (code) {
                    targetSubjects.push(code);
                    subjectToKey[code] = code;
                    keyToDetails[code] = { Name: name, Type: "Skill", Code: code, Credits: credits };
                }
            });
            
            // Load Domains
            const allDomains = await db.collection("honours_domain_subjects").find({}).toArray();
            allDomains.forEach(d => {
                const code = (d["Subject Code"] || d.SubjectCode || "").trim();
                const domain = d.Domain;
                const credits = d.Credits || d.Credit || d.credits || "";
                if (code && domain) {
                    targetSubjects.push(code);
                    subjectToKey[code] = domain;
                    subjectCodeToCredits[code] = credits; // Track credits per subject
                    
                    // Track domain subjects
                    if (!domainToSubjects[domain]) {
                        domainToSubjects[domain] = [];
                    }
                    domainToSubjects[domain].push({ code, credits });
                    
                    if (!keyToDetails[domain]) {
                        keyToDetails[domain] = { Name: domain, Type: "Domain", Credits: "" };
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
                const credits = d.Credits || d.Credit || d.credits || "";
                if (code && domain) {
                    targetSubjects.push(code);
                    subjectToKey[code] = domain; // Group by Domain Name
                    subjectCodeToCredits[code] = credits; // Track credits per subject
                    
                    // Track domain subjects
                    if (!domainToSubjects[domain]) {
                        domainToSubjects[domain] = [];
                    }
                    domainToSubjects[domain].push({ code, credits });
                    
                    keyToDetails[domain] = { Name: domain, Type: "Domain", Credits: "" };
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
                const code = (b["Subject Code"] || b.Subject_Code || "").trim();
                const name = b["Subject Name"] || b.Subject_Name || code;
                const credits = b.Credits || b.Credit || b.credits || "";
                if (code) {
                    targetSubjects.push(code);
                    subjectToKey[code] = code; // Group by Code for baskets/subjects
                    keyToDetails[code] = { Name: name, Type: "Subject", Code: code, Credits: credits };
                }
            });
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
                // (even when category is "All"; domain entries are marked with Type="Domain").
                if (
                    keyToDetails[groupKey] &&
                    keyToDetails[groupKey].Type !== "Domain"
                ) {
                    const currentName = keyToDetails[groupKey].Name;
                    const recordName = (row.Subject_Name || "").trim();
                    // If current name is just the code, and we have a better name that isn't the code
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
                        Subjects: [],
                        SubjectsByGroup: {} // Map GroupKey -> Set of subject codes
                    });
                }

                const student = studentMap.get(regNo);
                student.Groups.add(groupKey);
                // Track unique subjects just in case
                if (!student.Subjects.includes(subjectCode)) {
                    student.Subjects.push(subjectCode);
                }
                
                // Track subjects per group (for credit calculation)
                if (!student.SubjectsByGroup[groupKey]) {
                    student.SubjectsByGroup[groupKey] = new Set();
                }
                student.SubjectsByGroup[groupKey].add(subjectCode);
                
                // If this group is a domain, make sure domainToSubjects also knows about this code
                if (subjectToKey[subjectCode] && keyToDetails[subjectToKey[subjectCode]]?.Type === "Domain") {
                    const domainName = subjectToKey[subjectCode];
                    if (!domainToSubjects[domainName]) {
                        domainToSubjects[domainName] = [];
                    }
                    // add if not already present
                    if (!domainToSubjects[domainName].some(s => s.code === subjectCode)) {
                        domainToSubjects[domainName].push({ code: subjectCode, credits: subjectCodeToCredits[subjectCode] || "" });
                    }
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
                    // Lazy initialization for non-prefilled items (Basket/Skill or Domain in All)
                    if (keyToDetails[groupKey]) {
                        aggregatedItems[groupKey] = {
                            ...keyToDetails[groupKey],
                            TotalStudents: 0,
                            ByBranch: {},
                            Students: []
                        };
                        // add domain code if applicable
                        if (aggregatedItems[groupKey].Type === "Domain") {
                            const subjects = domainToSubjects[groupKey] || [];
                            if (subjects.length > 0) {
                                aggregatedItems[groupKey].Code = subjects[0].code;
                            }
                        }
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

        // After aggregation ensure every domain item has a code (might have been added lazily earlier)
        items.forEach(it => {
            if (it.Type === "Domain" && !it.Code) {
                const subjects = domainToSubjects[it.Name] || [];
                if (subjects.length > 0) {
                    it.Code = subjects[0].code;
                }
            }
        });
        const sumCreditString = (str) => {
            if (!str || typeof str !== 'string') return 0;
            const parts = str.split('+').map(p => parseFloat(p) || 0);
            return parts.reduce((a,b) => a + b, 0);
        };

        // Sort students by Reg_No within each item and calculate domain credits
        items.forEach(item => {
            item.Students.sort((a, b) => a.Reg_No.localeCompare(b.Reg_No));
            
            // For domains, calculate credits as sum of subjects this specific student has in the domain
            if (item.Type === "Domain") {
                let totalCredits = 0;
                
                // For each student in this domain, get their subjects and sum credits
                item.Students.forEach(studentEntry => {
                    const student = studentMap.get(studentEntry.Reg_No);
                    if (student && student.SubjectsByGroup[item.Name]) {
                        // Sum credits for all subjects this student has in this domain
                        student.SubjectsByGroup[item.Name].forEach(subCode => {
                            const cred = subjectCodeToCredits[subCode];
                            if (cred) {
                                totalCredits += sumCreditString(cred);
                            }
                        });
                    }
                });
                
                // Average the credits across all students in the domain for this filter
                if (item.Students.length > 0 && totalCredits > 0) {
                    item.Credits = Math.round(totalCredits / item.Students.length);
                }
            }

            // For any item that still has a credit expression string, convert to total
            if (typeof item.Credits === 'string' && item.Credits.includes('+')) {
                const total = sumCreditString(item.Credits);
                item.Credits = total;
            }
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

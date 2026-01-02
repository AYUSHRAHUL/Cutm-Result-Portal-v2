import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";

export async function GET(req) {
    try {
        const client = await clientPromise;
        // We suspect the issue might be DB selection or Data matching
        const dbName = "CUTMPKD";
        const db = client.db(dbName);

        // 1. Check Skill Courses
        const skills = await db.collection("skill_courses").find({}).toArray();
        const skillCodes = skills.map(s => s.SubjectCode);

        // 2. Check Data in 'cutm_data_soet'
        const soetCount = await db.collection("cutm_data_soet").countDocuments({});
        const soetMatch = await db.collection("cutm_data_soet").countDocuments({ Subject_Code: { $in: skillCodes } });

        // 3. Check Data in 'result' (as seen in screenshot)
        const resultCount = await db.collection("result").countDocuments({});
        const resultMatch = await db.collection("result").countDocuments({ Subject_Code: { $in: skillCodes } });

        // 4. Check RegistrationData
        const regCount = await db.collection("RegistrationData").countDocuments({ Type: "Registration" });
        const regMatch = await db.collection("RegistrationData").countDocuments({
            Type: "Registration",
            Subject_Code: { $in: skillCodes }
        });

        return NextResponse.json({
            dbName,
            totalSkills: skills.length,
            sampleSkillCodes: skillCodes.slice(0, 5),
            cutm_data_soet: {
                total: soetCount,
                matches: soetMatch
            },
            result: {
                total: resultCount,
                matches: resultMatch
            },
            RegistrationData: {
                total: regCount,
                matches: regMatch
            }
        });
    } catch (err) {
        return NextResponse.json({ error: err.message });
    }
}

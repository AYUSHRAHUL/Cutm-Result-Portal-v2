const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env');
const envData = fs.readFileSync(envPath, 'utf8');
const mongoLine = envData.split('\n').find(line => line.startsWith('MONGO_URI='));
const mongoUri = mongoLine ? mongoLine.substring('MONGO_URI='.length).trim() : null;

async function main() {
    const client = new MongoClient(mongoUri);
    try {
        await client.connect();
        const db = client.db("CUTMSOMPKD");
        const cutm = db.collection("som_result");
        
        // Emulate the API query
        const batch = "2025";
        const branch = "BBA";
        
        const shortYear = "25";
        const batchYear = "2025";
        
        const baseQuery = {
            Reg_No: { $regex: `^(?:${shortYear}|${batchYear})` }
        };
        
        const branchCodes = ['912', 'BBA', 'Bachelor of Business Administration', 'Bachelor of Business Administration (BBA)'];
        const branchNames = ['BBA', 'BBA', 'Bachelor of Business Administration', 'Bachelor of Business Administration (BBA)'];
        
        baseQuery.$or = [
            { Branch: { $in: branchNames } },
            { $expr: { $in: [{ $substr: [{ $toString: "$Reg_No" }, 5, 3] }, branchCodes] } }
        ];
        
        console.log("Query:", JSON.stringify(baseQuery, null, 2));
        
        const pipeline = [
            { $match: baseQuery },
            {
              $group: {
                _id: "$Reg_No",
                Name: { $first: "$Name" },
                subjects: { $push: "$$ROOT" }
              }
            }
        ];
        
        const results = await cutm.aggregate(pipeline).toArray();
        console.log("Result count:", results.length);
        if (results.length > 0) {
            console.log("Sample result:", JSON.stringify(results[0], null, 2));
        }
        
    } finally {
        await client.close();
    }
}

main().catch(console.error);

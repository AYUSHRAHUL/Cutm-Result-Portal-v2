const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env');
const envData = fs.readFileSync(envPath, 'utf8');
const mongoLine = envData.split('\n').find(line => line.startsWith('MONGO_URI='));
const mongoUri = mongoLine ? mongoLine.substring('MONGO_URI='.length).trim() : null;

async function main() {
    console.log("Connecting...");
    const client = new MongoClient(mongoUri);
    try {
        await client.connect();
        const db = client.db("CUTMSOMPKD");
        const cutm = db.collection("som_result");
        
        console.log("Finding BBA (912) 2025 records in CUTMSOMPKD...");
        const records = await cutm.find({ 
            Reg_No: { $regex: "^25" },
            $or: [
                { Branch: "BBA" },
                { Reg_No: { $regex: ".{5}912" } }
            ]
        }).limit(5).toArray();
        
        console.log(`Found ${records.length} sample records:`);
        records.forEach(r => console.log(`- Reg_No: ${r.Reg_No}, Name: ${r.Name}`));
        
        const countAll = await cutm.countDocuments({ 
            Reg_No: { $regex: "^25.*912" } 
        });
        console.log(`Total records for regex ^25.*912: ${countAll}`);
        
    } finally {
        await client.close();
    }
}

main().catch(console.error);

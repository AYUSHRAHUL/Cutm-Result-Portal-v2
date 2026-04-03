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
        
        const collections = await db.listCollections().toArray();
        console.log("Collections in CUTMSOMPKD:", collections.map(c => c.name));
        
        const statusCount = await db.collection("student_status").countDocuments();
        console.log("student_status count:", statusCount);
        
        const overridesCount = await db.collection("branch_overrides").countDocuments();
        console.log("branch_overrides count:", overridesCount);
        
    } finally {
        await client.close();
    }
}

main().catch(console.error);

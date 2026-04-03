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
        const db = client.db("CUTMPKD");
        console.log("Collections in CUTMPKD:", (await db.listCollections().toArray()).map(c => c.name));
        
        const sc = await db.collection("student_status").countDocuments();
        console.log("student_status count:", sc);
        
        const bo = await db.collection("branch_overrides").countDocuments();
        console.log("branch_overrides count:", bo);
        
    } finally {
        await client.close();
    }
}

main().catch(console.error);

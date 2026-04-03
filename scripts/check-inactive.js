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
        const statusCollection = db.collection("student_status");
        
        const count = await statusCollection.countDocuments({ isActive: { $in: [false, "false"] } });
        console.log("Total inactive students:", count);
        
        if (count > 0) {
            const samples = await statusCollection.find({ isActive: { $in: [false, "false"] } }).limit(5).toArray();
            console.log("Samples:", JSON.stringify(samples.map(s => s.Reg_No)));
        }
    } finally {
        await client.close();
    }
}

main().catch(console.error);

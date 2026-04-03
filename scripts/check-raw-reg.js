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
        
        const r = await cutm.findOne({ Reg_No: /^25.*912/ });
        if (r) {
            console.log("Raw Reg_No:", JSON.stringify(r.Reg_No));
            console.log("Length:", r.Reg_No.length);
        }
    } finally {
        await client.close();
    }
}

main().catch(console.error);

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
        const db = client.db("CUTMBBSRSOM");
        
        const collections = await db.listCollections().toArray();
        console.log("Collections in CUTMBBSRSOM:", collections.map(c => c.name));
        
    } finally {
        await client.close();
    }
}

main().catch(console.error);

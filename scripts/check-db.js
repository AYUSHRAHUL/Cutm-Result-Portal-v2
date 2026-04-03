const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Read .env manually
const envPath = path.resolve(process.cwd(), '.env');
const envData = fs.readFileSync(envPath, 'utf8');
const mongoLine = envData.split('\n').find(line => line.startsWith('MONGO_URI='));
// Use substring to get everything after "MONGO_URI="
const mongoUri = mongoLine ? mongoLine.substring('MONGO_URI='.length).trim() : null;

async function main() {
    if (!mongoUri) {
        console.error("MONGO_URI not found");
        return;
    }
    
    console.log("Connecting...");
    const client = new MongoClient(mongoUri);
    try {
        await client.connect();
        
        // Let's check databases and find som_result
        const adminDb = client.db().admin();
        const dbs = await adminDb.listDatabases();
        console.log("Available databases:", dbs.databases.map(d => d.name));
        
        const possibleDbs = ['CUTMSOMPKD', 'CUTMPKD', 'CUTMSOMBBSR', 'CUTMBBSR'];
        for (const dbName of possibleDbs) {
            const db = client.db(dbName);
            const collections = await db.listCollections().toArray();
            if (collections.some(c => c.name === 'som_result')) {
                const count = await db.collection("som_result").countDocuments();
                console.log(`- Database: ${dbName}, Collection: som_result, Total: ${count}`);
                
                if (count > 0) {
                    const sample = await db.collection("som_result").find().limit(2).toArray();
                    console.log(`  Sample (1st Reg_No): ${JSON.stringify(sample[0].Reg_No)}`);
                    
                    const distinctBranches = await db.collection("som_result").distinct("Branch");
                    console.log(`  Branches: ${distinctBranches}`);
                }
            }
        }
    } finally {
        await client.close();
    }
}

main().catch(console.error);

const { MongoClient } = require('mongodb');

async function main() {
    // Try to get connection string from environment or use default
    const client = new MongoClient("mongodb://localhost:27017");
    try {
        await client.connect();
        const db = client.db("CUTMSOMPKD");
        const collection = db.collection("som_result");
        
        const count = await collection.countDocuments();
        console.log("Total records:", count);
        
        const regNos = await collection.distinct("Reg_No");
        const years = new Set();
        regNos.forEach(reg => {
            if (typeof reg === 'string' && reg.length >= 2) {
                years.add(reg.slice(0, 2));
            }
        });
        console.log("Available batches (YY):", Array.from(years).sort());
        
        const branches = await collection.distinct("Branch");
        console.log("Available branches:", branches);
        
        const sample = await collection.find().limit(5).toArray();
        console.log("Sample records:", JSON.stringify(sample, null, 2));
    } finally {
        await client.close();
    }
}

main().catch(console.error);

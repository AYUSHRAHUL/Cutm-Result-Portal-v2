const { MongoClient } = require('mongodb');

async function findAdmin() {
  const uri = "mongodb://localhost:27017"; // Assuming default local mongo
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db("USER");
    const user = await db.collection("users").findOne({ role: "admin" });
    if (user) {
      console.log(`Found admin: ${user.email}`);
    } else {
      console.log("No admin user found in USER.users collection.");
    }
  } catch (err) {
    console.error("Error connecting to MongoDB:", err.message);
  } finally {
    await client.close();
  }
}

findAdmin();

const { MongoClient } = require('mongodb');

async function check() {
  const uri = "mongodb+srv://cutm:Rahul123@cluster0.h9eu1e7.mongodb.net/?appName=Cluster0";
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db("CUTMSOMPKD");
    const doc = await db.collection("cbcs").findOne();
    console.log("Full sample doc:", doc);
    console.log("Type of Basket:", typeof doc.Basket);
  } finally {
    await client.close();
  }
}

check();

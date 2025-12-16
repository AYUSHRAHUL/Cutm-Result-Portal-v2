import { MongoClient } from "mongodb";

const uri = process.env.MONGO_URI;

if (!process.env.MONGO_URI) {
  throw new Error("❌ Please add your MongoDB URI to .env file as MONGO_URI");
}

// Connection pooling options to prevent connection limit issues
const options = {
  maxPoolSize: 50, // Maximum number of connections in the pool (default is 100, but we limit to 50 for Atlas free tier)
  minPoolSize: 5, // Minimum number of connections to maintain
  maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
  serverSelectionTimeoutMS: 5000, // How long to wait for server selection
  socketTimeoutMS: 45000, // How long to wait for socket operations
  connectTimeoutMS: 10000, // How long to wait for initial connection
  retryWrites: true, // Retry writes if they fail
  retryReads: true, // Retry reads if they fail
};

let client;
let clientPromise;

// Use a global variable to cache the connection promise in production
// This ensures we reuse the same connection across all API routes
const globalForMongo = globalThis;

if (process.env.NODE_ENV === "development") {
  // In development mode, use a module-level variable
  if (!globalForMongo._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalForMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalForMongo._mongoClientPromise;
} else {
  // In production, also cache the connection promise
  if (!globalForMongo._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalForMongo._mongoClientPromise = client.connect().catch((err) => {
      globalForMongo._mongoClientPromise = null;
      throw err;
    });
  }
  clientPromise = globalForMongo._mongoClientPromise;
}

export { clientPromise };

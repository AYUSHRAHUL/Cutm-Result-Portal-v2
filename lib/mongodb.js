import { MongoClient } from "mongodb";

const uri = process.env.MONGO_URI;

// Connection retry helper for SSL/TLS errors
async function connectWithRetry(client, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await client.connect();
    } catch (error) {
      lastError = error;
      
      // Check if it's an SSL/TLS error or connection error
      const isConnectionError = 
        error.code === 'ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR' ||
        error.name === 'MongoNetworkError' ||
        error.message?.includes('SSL') ||
        error.message?.includes('TLS') ||
        error.message?.includes('connection') ||
        error.message?.includes('ECONNRESET') ||
        error.message?.includes('ETIMEDOUT');
      
      if (isConnectionError && attempt < maxRetries - 1) {
        // Exponential backoff: 1s, 2s, 4s
        const waitTime = 1000 * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        // Note: Don't close client here - let MongoDB driver handle it
        // Just wait and retry with the same client
        continue;
      }
      
      throw error;
    }
  }
  
  throw lastError;
}

if (!process.env.MONGO_URI) {
  throw new Error("❌ Please add your MongoDB URI to .env file as MONGO_URI");
}

// Connection pooling options to prevent connection limit issues
const options = {
  maxPoolSize: 3, // CRITICAL: Reduced to 3 for Atlas free tier to prevent connection limit (M0 = 50 max, but with multiple instances/users we need to be conservative)
  minPoolSize: 1, // Minimum 1 connection to maintain pool
  maxIdleTimeMS: 45000, // Close idle connections after 45 seconds to free up resources
  serverSelectionTimeoutMS: 15000, // Increased timeout for server selection (15 seconds)
  socketTimeoutMS: 60000, // Socket timeout to 60 seconds
  connectTimeoutMS: 20000, // Increased connection timeout to 20 seconds for SSL handshake
  retryWrites: true, // Retry writes if they fail
  retryReads: true, // Retry reads if they fail
  // Additional options to handle SSL/TLS better
  heartbeatFrequencyMS: 30000, // Check connection health every 30 seconds (reduced frequency to save connections)
  // SSL/TLS options - MongoDB Atlas (mongodb+srv://) automatically uses TLS
  // Note: Explicit TLS settings not needed for mongodb+srv:// but included for compatibility
};

let client;
let clientPromise;

// Use a global variable to cache the connection promise in production
// This ensures we reuse the same connection across all API routes
const globalForMongo = globalThis;

// Initialize connection with retry logic for SSL/TLS errors
function initializeConnection() {
  if (!globalForMongo._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalForMongo._mongoClientPromise = connectWithRetry(client, 3).catch((err) => {
      // Reset connection promise on error to allow retry
      globalForMongo._mongoClientPromise = null;
      if (client) {
        client.close().catch(() => {
          // Ignore errors when closing failed client
        });
      }
      throw err;
    });
  }
  return globalForMongo._mongoClientPromise;
}

// Use same initialization for both dev and production
clientPromise = initializeConnection();

export { clientPromise };

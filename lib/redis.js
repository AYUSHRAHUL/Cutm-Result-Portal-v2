import Redis from 'ioredis';

let redis = null;

export function getRedisClient() {
  if (!redis) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    redis = new Redis(redisUrl, {
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });

    redis.on('error', (err) => {
      // Redis connection error - handled silently in production
      if (process.env.NODE_ENV === 'development') {
       }
    });

    redis.on('connect', () => {
      if (process.env.NODE_ENV === 'development') {
       }
    });

    redis.on('ready', () => {
      if (process.env.NODE_ENV === 'development') {
       }
    });
  }

  return redis;
}

export async function closeRedisConnection() {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

// Helper functions for common Redis operations
export class RedisService {
  constructor() {
    this.client = getRedisClient();
  }

  // Store OTP with expiration
  async storeOTP(key, value, ttlSeconds = 600) {
    await this.client.setex(key, ttlSeconds, JSON.stringify(value));
  }

  // Get OTP
  async getOTP(key) {
    const value = await this.client.get(key);
    return value ? JSON.parse(value) : null;
  }

  // Delete OTP
  async deleteOTP(key) {
    await this.client.del(key);
  }

  // Store session data
  async storeSession(sessionId, data, ttlSeconds = 86400) {
    await this.client.setex(`session:${sessionId}`, ttlSeconds, JSON.stringify(data));
  }

  // Get session data
  async getSession(sessionId) {
    const data = await this.client.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  }

  // Delete session
  async deleteSession(sessionId) {
    await this.client.del(`session:${sessionId}`);
  }

  // Cache API responses
  async cacheResponse(key, data, ttlSeconds = 300) {
    await this.client.setex(`cache:${key}`, ttlSeconds, JSON.stringify(data));
  }

  // Get cached response
  async getCachedResponse(key) {
    const data = await this.client.get(`cache:${key}`);
    return data ? JSON.parse(data) : null;
  }

  // Clear cache
  async clearCache(pattern = 'cache:*') {
    const keys = await this.client.keys(pattern);
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }
}

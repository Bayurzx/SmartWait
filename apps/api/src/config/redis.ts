import { createClient } from 'redis';

// Create Redis client type
type RedisClient = ReturnType<typeof createClient>;

// Global Redis client instance
declare global {
  var __redis: RedisClient | undefined;
}

// Create Redis client with proper configuration
const createRedisClient = (): RedisClient => {
  const client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
      reconnectStrategy: (retries) => {
        // Exponential backoff with max delay of 30 seconds
        const delay = Math.min(retries * 50, 30000);
        console.log(`🔄 Redis reconnecting in ${delay}ms (attempt ${retries})`);
        return delay;
      },
    },
  });

  // Event handlers
  client.on('connect', () => {
    console.log('🔌 Redis client connecting...');
  });

  client.on('ready', () => {
    console.log('✅ Redis client connected and ready');
  });

  client.on('error', (err) => {
    console.error('❌ Redis client error:', err);
  });

  client.on('end', () => {
    console.log('🔌 Redis client disconnected');
  });

  return client;
};

// Use global instance in development to prevent multiple connections
const redis = globalThis.__redis || createRedisClient();

if (process.env.NODE_ENV === 'development') {
  globalThis.__redis = redis;
}

// Connect to Redis
const connectRedis = async (): Promise<void> => {
  try {
    if (!redis.isOpen) {
      await redis.connect();
    }
  } catch (error) {
    console.error('❌ Failed to connect to Redis:', error);
    throw error;
  }
};

// Test Redis connection
const testRedisConnection = async (): Promise<boolean> => {
  try {
    await redis.ping();
    console.log('✅ Redis connection successful');
    return true;
  } catch (error) {
    console.error('❌ Redis connection failed:', error);
    return false;
  }
};

// Get Redis health status
const getRedisHealth = async () => {
  try {
    const startTime = Date.now();
    await redis.ping();
    const responseTime = Date.now() - startTime;

    return {
      status: 'healthy',
      responseTime,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }
};

// Graceful shutdown
process.on('beforeExit', async () => {
  if (redis.isOpen) {
    await redis.disconnect();
  }
});

export { redis, connectRedis, testRedisConnection, getRedisHealth };
export default redis;
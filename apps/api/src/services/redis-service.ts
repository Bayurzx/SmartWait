import redis from '../config/redis';

/**
 * Redis service for caching and real-time features
 */
export class RedisService {
  /**
   * Cache queue position data
   */
  static async cacheQueuePosition(patientId: string, data: any, ttlSeconds = 300): Promise<void> {
    try {
      const key = `queue:position:${patientId}`;
      await redis.setEx(key, ttlSeconds, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to cache queue position:', error);
      // Don't throw error - caching is not critical
    }
  }

  /**
   * Get cached queue position data
   */
  static async getCachedQueuePosition(patientId: string): Promise<any | null> {
    try {
      const key = `queue:position:${patientId}`;
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to get cached queue position:', error);
      return null;
    }
  }

  /**
   * Cache full queue data
   */
  static async cacheQueue(queueData: any[], ttlSeconds = 60): Promise<void> {
    try {
      const key = 'queue:full';
      await redis.setEx(key, ttlSeconds, JSON.stringify(queueData));
    } catch (error) {
      console.error('Failed to cache queue data:', error);
    }
  }

  /**
   * Get cached full queue data
   */
  static async getCachedQueue(): Promise<any[] | null> {
    try {
      const key = 'queue:full';
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to get cached queue data:', error);
      return null;
    }
  }

  /**
   * Invalidate queue cache
   */
  static async invalidateQueueCache(): Promise<void> {
    try {
      const pattern = 'queue:*';
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(keys);
      }
    } catch (error) {
      console.error('Failed to invalidate queue cache:', error);
    }
  }

  /**
   * Store session data
   */
  static async setSession(sessionToken: string, data: any, ttlSeconds = 28800): Promise<void> {
    try {
      const key = `session:${sessionToken}`;
      await redis.setEx(key, ttlSeconds, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to store session:', error);
      throw error; // Session storage is critical
    }
  }

  /**
   * Get session data
   */
  static async getSession(sessionToken: string): Promise<any | null> {
    try {
      const key = `session:${sessionToken}`;
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to get session:', error);
      return null;
    }
  }

  /**
   * Delete session
   */
  static async deleteSession(sessionToken: string): Promise<void> {
    try {
      const key = `session:${sessionToken}`;
      await redis.del(key);
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  }

  /**
   * Publish real-time update
   */
  static async publishUpdate(channel: string, data: any): Promise<void> {
    try {
      await redis.publish(channel, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to publish update:', error);
    }
  }

  /**
   * Subscribe to real-time updates
   */
  static async subscribe(channel: string, callback: (data: any) => void): Promise<void> {
    try {
      const subscriber = redis.duplicate();
      await subscriber.connect();
      
      await subscriber.subscribe(channel, (message) => {
        try {
          const data = JSON.parse(message);
          callback(data);
        } catch (error) {
          console.error('Failed to parse subscription message:', error);
        }
      });
    } catch (error) {
      console.error('Failed to subscribe to channel:', error);
    }
  }

  /**
   * Rate limiting - check if action is allowed
   */
  static async checkRateLimit(key: string, maxRequests: number, windowSeconds: number): Promise<boolean> {
    try {
      const current = await redis.incr(key);
      
      if (current === 1) {
        await redis.expire(key, windowSeconds);
      }
      
      return current <= maxRequests;
    } catch (error) {
      console.error('Failed to check rate limit:', error);
      return true; // Allow on error
    }
  }

  /**
   * Store temporary data with TTL
   */
  static async setTemporary(key: string, data: any, ttlSeconds: number): Promise<void> {
    try {
      await redis.setEx(key, ttlSeconds, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to store temporary data:', error);
    }
  }

  /**
   * Get temporary data
   */
  static async getTemporary(key: string): Promise<any | null> {
    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to get temporary data:', error);
      return null;
    }
  }

  /**
   * Delete key
   */
  static async delete(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch (error) {
      console.error('Failed to delete key:', error);
    }
  }

  /**
   * Check if key exists
   */
  static async exists(key: string): Promise<boolean> {
    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Failed to check key existence:', error);
      return false;
    }
  }
}
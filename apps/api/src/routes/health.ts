import { Router, Request, Response } from 'express';
import { getDatabaseHealth, getDatabaseStats } from '../utils/database';
import { getRedisHealth } from '../config/redis';
import { getSocketIOHealth } from '../config/socket';

const router = Router();

/**
 * Basic health check endpoint
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const [dbHealth, redisHealth, socketHealth] = await Promise.all([
      getDatabaseHealth(),
      getRedisHealth(),
      Promise.resolve(getSocketIOHealth()),
    ]);
    
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbHealth,
      redis: redisHealth,
      socketio: socketHealth,
      version: process.env.npm_package_version || '1.0.0',
    };

    const allHealthy = dbHealth.status === 'healthy' && 
                      redisHealth.status === 'healthy' && 
                      socketHealth.status === 'healthy';
    const statusCode = allHealthy ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Detailed health check with database statistics
 */
router.get('/detailed', async (req: Request, res: Response) => {
  try {
    const [dbHealth, dbStats, redisHealth, socketHealth] = await Promise.all([
      getDatabaseHealth(),
      getDatabaseStats(),
      getRedisHealth(),
      Promise.resolve(getSocketIOHealth()),
    ]);

    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: {
        ...dbHealth,
        statistics: dbStats,
      },
      redis: redisHealth,
      socketio: socketHealth,
      version: process.env.npm_package_version || '1.0.0',
    };

    const allHealthy = dbHealth.status === 'healthy' && 
                      redisHealth.status === 'healthy' && 
                      socketHealth.status === 'healthy';
    const statusCode = allHealthy ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
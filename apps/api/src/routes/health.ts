import { Router, Request, Response } from 'express';
import { getDatabaseHealth, getDatabaseStats } from '../utils/database';
import { getRedisHealth } from '../config/redis';

const router = Router();

/**
 * Basic health check endpoint
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const [dbHealth, redisHealth] = await Promise.all([
      getDatabaseHealth(),
      getRedisHealth(),
    ]);
    
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbHealth,
      redis: redisHealth,
      version: process.env.npm_package_version || '1.0.0',
    };

    const statusCode = (dbHealth.status === 'healthy' && redisHealth.status === 'healthy') ? 200 : 503;
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
    const [dbHealth, dbStats, redisHealth] = await Promise.all([
      getDatabaseHealth(),
      getDatabaseStats(),
      getRedisHealth(),
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
      version: process.env.npm_package_version || '1.0.0',
    };

    const statusCode = (dbHealth.status === 'healthy' && redisHealth.status === 'healthy') ? 200 : 503;
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
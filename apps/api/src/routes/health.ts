import { Router, Request, Response } from 'express';
import { getDatabaseHealth, getDatabaseStats } from '../utils/database';

const router = Router();

/**
 * Basic health check endpoint
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const dbHealth = await getDatabaseHealth();
    
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbHealth,
      version: process.env.npm_package_version || '1.0.0',
    };

    const statusCode = dbHealth.status === 'healthy' ? 200 : 503;
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
    const [dbHealth, dbStats] = await Promise.all([
      getDatabaseHealth(),
      getDatabaseStats(),
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
      version: process.env.npm_package_version || '1.0.0',
    };

    const statusCode = dbHealth.status === 'healthy' ? 200 : 503;
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
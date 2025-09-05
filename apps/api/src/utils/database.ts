import { prisma } from '../config/database';

/**
 * Test database connection
 */
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

/**
 * Get database health status
 */
export async function getDatabaseHealth() {
  try {
    const startTime = Date.now();
    await prisma.$queryRaw`SELECT 1`;
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
}

/**
 * Clean up expired staff sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const result = await prisma.staffSession.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    console.log(`🧹 Cleaned up ${result.count} expired sessions`);
    return result.count;
  } catch (error) {
    console.error('❌ Failed to cleanup expired sessions:', error);
    return 0;
  }
}

/**
 * Get database statistics
 */
export async function getDatabaseStats() {
  try {
    const [
      patientCount,
      activeQueueCount,
      completedQueueCount,
      smsCount,
      sessionCount,
    ] = await Promise.all([
      prisma.patient.count(),
      prisma.queuePosition.count({
        where: {
          status: {
            in: ['waiting', 'called'],
          },
        },
      }),
      prisma.queuePosition.count({
        where: {
          status: 'completed',
        },
      }),
      prisma.smsNotification.count(),
      prisma.staffSession.count({
        where: {
          expiresAt: {
            gt: new Date(),
          },
        },
      }),
    ]);

    return {
      patients: patientCount,
      activeQueue: activeQueueCount,
      completedQueue: completedQueueCount,
      smsNotifications: smsCount,
      activeSessions: sessionCount,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('❌ Failed to get database stats:', error);
    throw error;
  }
}
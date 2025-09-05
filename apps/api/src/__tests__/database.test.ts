import { testDatabaseConnection, getDatabaseHealth, getDatabaseStats } from '../utils/database';
import { prisma } from '../config/database';

describe('Database Configuration', () => {
  beforeAll(async () => {
    // Ensure database is connected before running tests
    const isConnected = await testDatabaseConnection();
    if (!isConnected) {
      throw new Error('Database connection failed. Please ensure PostgreSQL is running.');
    }
  });

  afterAll(async () => {
    // Clean up and disconnect
    await prisma.$disconnect();
  });

  describe('Connection', () => {
    it('should connect to the database successfully', async () => {
      const isConnected = await testDatabaseConnection();
      expect(isConnected).toBe(true);
    });

    it('should return healthy status', async () => {
      const health = await getDatabaseHealth();
      expect(health.status).toBe('healthy');
      expect(health.responseTime).toBeGreaterThan(0);
      expect(health.timestamp).toBeDefined();
    });
  });

  describe('Schema', () => {
    it('should have all required tables', async () => {
      // Test that we can query each table (this will fail if tables don't exist)
      const [patients, queuePositions, staffSessions, smsNotifications] = await Promise.all([
        prisma.patient.findMany({ take: 1 }),
        prisma.queuePosition.findMany({ take: 1 }),
        prisma.staffSession.findMany({ take: 1 }),
        prisma.smsNotification.findMany({ take: 1 }),
      ]);

      // If we get here without errors, all tables exist
      expect(Array.isArray(patients)).toBe(true);
      expect(Array.isArray(queuePositions)).toBe(true);
      expect(Array.isArray(staffSessions)).toBe(true);
      expect(Array.isArray(smsNotifications)).toBe(true);
    });

    it('should be able to create and retrieve a patient', async () => {
      const testPatient = await prisma.patient.create({
        data: {
          name: 'Test Patient',
          phone: '+1234567890',
        },
      });

      expect(testPatient.id).toBeDefined();
      expect(testPatient.name).toBe('Test Patient');
      expect(testPatient.phone).toBe('+1234567890');
      expect(testPatient.createdAt).toBeInstanceOf(Date);

      // Clean up
      await prisma.patient.delete({
        where: { id: testPatient.id },
      });
    });

    it('should enforce unique position constraint for active queue positions', async () => {
      // Create a test patient first
      const patient1 = await prisma.patient.create({
        data: { name: 'Patient 1', phone: '+1111111111' },
      });

      const patient2 = await prisma.patient.create({
        data: { name: 'Patient 2', phone: '+2222222222' },
      });

      try {
        // Create first queue position
        const position1 = await prisma.queuePosition.create({
          data: {
            patientId: patient1.id,
            position: 999,
            status: 'waiting',
          },
        });

        // Try to create second queue position with same position number
        // This should fail due to unique constraint
        await expect(
          prisma.queuePosition.create({
            data: {
              patientId: patient2.id,
              position: 999,
              status: 'waiting',
            },
          })
        ).rejects.toThrow();

        // Clean up
        await prisma.queuePosition.delete({ where: { id: position1.id } });
      } finally {
        // Clean up patients
        await prisma.patient.deleteMany({
          where: { id: { in: [patient1.id, patient2.id] } },
        });
      }
    });
  });

  describe('Statistics', () => {
    it('should return database statistics', async () => {
      const stats = await getDatabaseStats();
      
      expect(typeof stats.patients).toBe('number');
      expect(typeof stats.activeQueue).toBe('number');
      expect(typeof stats.completedQueue).toBe('number');
      expect(typeof stats.smsNotifications).toBe('number');
      expect(typeof stats.activeSessions).toBe('number');
      expect(stats.timestamp).toBeDefined();
    });
  });
});
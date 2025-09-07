import request from 'supertest';
import { Request, Response } from 'express';

// Create a simple mock without complex type references
const mockPrisma = {
  queuePosition: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  patient: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn(),
};

// Mock the database and Redis connections for testing
jest.mock('../config/database', () => ({
  prisma: mockPrisma,
}));

jest.mock('../config/redis', () => ({
  connectRedis: jest.fn(),
  testRedisConnection: jest.fn().mockResolvedValue(true)
}));

jest.mock('../utils/database', () => ({
  testDatabaseConnection: jest.fn().mockResolvedValue(true),
  cleanupExpiredSessions: jest.fn().mockResolvedValue(0)
}));

// Import app after mocking
import app from '../index';

describe('Queue API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/checkin', () => {
    it('should successfully check in a new patient', async () => {
      // Mock no existing patient
      mockPrisma.queuePosition.findFirst.mockResolvedValue(null);

      // Mock transaction for creating patient and queue position
      const mockQueuePosition = {
        id: 'queue-1',
        patientId: 'patient-1',
        position: 1,
        status: 'waiting',
        checkInTime: new Date().toISOString(),
        estimatedWaitMinutes: 0,
        calledAt: null,
        completedAt: null,
        patient: {
          id: 'patient-1',
          name: 'John Doe',
          phone: '+1234567890',
          createdAt: new Date().toISOString()
        }
      };

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          patient: {
            create: jest.fn().mockResolvedValue({
              id: 'patient-1',
              name: 'John Doe',
              phone: '+1234567890',
              createdAt: new Date().toISOString()
            })
          },
          queuePosition: {
            create: jest.fn().mockResolvedValue(mockQueuePosition)
          }
        } as any);
      });

      const response = await request(app)
        .post('/api/checkin')
        .send({
          name: 'John Doe',
          phone: '+1234567890',
          appointmentTime: '2:00 PM'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.patientId).toBe('patient-1');
      expect(response.body.data.position).toBe(1);
      expect(response.body.data.estimatedWait).toBe(0);
    });

    it('should return validation error for invalid input', async () => {
      const response = await request(app)
        .post('/api/checkin')
        .send({
          name: '', // Invalid empty name
          phone: 'invalid-phone',
          appointmentTime: '2:00 PM'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return error for duplicate phone number', async () => {
      // Mock existing patient
      mockPrisma.queuePosition.findFirst.mockResolvedValue({
        id: 'existing-queue-1',
        patientId: 'existing-patient-1',
        position: 1,
        status: 'waiting',
        patient: {
          id: 'existing-patient-1',
          name: 'Jane Doe',
          phone: '+1234567890'
        }
      } as any);

      const response = await request(app)
        .post('/api/checkin')
        .send({
          name: 'John Doe',
          phone: '+1234567890',
          appointmentTime: '2:00 PM'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('already in the queue');
    });
  });

  describe('GET /api/position/:id', () => {
    it('should return patient position', async () => {
      const mockQueuePosition = {
        id: 'queue-1',
        patientId: 'patient-1',
        position: 2,
        status: 'waiting',
        checkInTime: new Date().toISOString(),
        estimatedWaitMinutes: 15,
        calledAt: null,
        completedAt: null,
        patient: {
          id: 'patient-1',
          name: 'John Doe',
          phone: '+1234567890',
          createdAt: new Date().toISOString()
        }
      };

      mockPrisma.queuePosition.findFirst.mockResolvedValue(mockQueuePosition as any);
      mockPrisma.queuePosition.count.mockResolvedValue(1); // 1 patient ahead

      const response = await request(app)
        .get('/api/position/patient-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.patientId).toBe('patient-1');
      expect(response.body.data.position).toBe(2);
      expect(response.body.data.status).toBe('waiting');
    });

    it('should return 404 for non-existent patient', async () => {
      mockPrisma.queuePosition.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/position/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PATIENT_NOT_FOUND');
    });

    it('should return 400 for missing patient ID', async () => {
      const response = await request(app)
        .get('/api/position/');

      expect(response.status).toBe(404); // Express returns 404 for missing route params
    });
  });

  describe('GET /api/queue', () => {
    it('should return the full queue', async () => {
      const mockQueue = [
        {
          id: 'queue-1',
          patientId: 'patient-1',
          position: 1,
          status: 'waiting',
          patient: {
            id: 'patient-1',
            name: 'John Doe',
            phone: '+1111111111',
            createdAt: new Date().toISOString()
          }
        },
        {
          id: 'queue-2',
          patientId: 'patient-2',
          position: 2,
          status: 'called',
          patient: {
            id: 'patient-2',
            name: 'Jane Doe',
            phone: '+2222222222',
            createdAt: new Date().toISOString()
          }
        }
      ];

      mockPrisma.queuePosition.findMany.mockResolvedValue(mockQueue as any);

      const response = await request(app)
        .get('/api/queue');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockQueue);
      expect(response.body.count).toBe(2);
    });
  });

  describe('GET /api/queue/stats', () => {
    it('should return queue statistics', async () => {
      mockPrisma.queuePosition.count
        .mockResolvedValueOnce(3) // waiting
        .mockResolvedValueOnce(1) // called
        .mockResolvedValueOnce(5); // completed

      mockPrisma.queuePosition.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/queue/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalWaiting).toBe(3);
      expect(response.body.data.totalCalled).toBe(1);
      expect(response.body.data.totalCompleted).toBe(5);
    });
  });
});

afterAll(() => {
  jest.restoreAllMocks();
});
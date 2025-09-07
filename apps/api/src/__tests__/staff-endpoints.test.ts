import request from 'supertest';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import staffRoutes from '../routes/staff';

// Create test app
const createTestApp = () => {
  const app = express();
  
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use('/api/staff', staffRoutes);
  
  return app;
};

// Mock Prisma for integration tests
jest.mock('../config/database', () => ({
  prisma: {
    staffSession: {
      create: jest.fn().mockResolvedValue({
        id: 'session-1',
        username: 'staff',
        sessionToken: 'mock-token-123',
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
        createdAt: new Date(),
      }),
      findFirst: jest.fn().mockResolvedValue({
        id: 'session-1',
        username: 'staff',
        sessionToken: 'mock-token-123',
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
        createdAt: new Date(),
      }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    queuePosition: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'queue-1',
          patientId: 'patient-1',
          patient: {
            id: 'patient-1',
            name: 'John Doe',
            phone: '+1234567890',
            createdAt: new Date(),
          },
          position: 1,
          status: 'waiting',
          checkInTime: new Date(),
          estimatedWaitMinutes: 15,
          calledAt: null,
          completedAt: null,
        }
      ]),
      findFirst: jest.fn().mockResolvedValue({
        id: 'queue-1',
        patientId: 'patient-1',
        patient: {
          id: 'patient-1',
          name: 'John Doe',
          phone: '+1234567890',
          createdAt: new Date(),
        },
        position: 1,
        status: 'waiting',
        checkInTime: new Date(),
        estimatedWaitMinutes: 15,
        calledAt: null,
        completedAt: null,
      }),
      update: jest.fn().mockResolvedValue({
        id: 'queue-1',
        patientId: 'patient-1',
        status: 'called',
        calledAt: new Date(),
      }),
      count: jest.fn().mockResolvedValue(5),
    },
  },
}));

describe('Staff Queue Management Endpoints', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();
  });

  describe('GET /api/staff/queue', () => {
    it('should return queue with valid authentication', async () => {
      const response = await request(app)
        .get('/api/staff/queue')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.count).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .get('/api/staff/queue');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/staff/call-next', () => {
    it('should call next patient with valid authentication', async () => {
      const response = await request(app)
        .post('/api/staff/call-next')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.message).toBeDefined();
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .post('/api/staff/call-next');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/staff/complete', () => {
    it('should mark patient as completed with valid data', async () => {
      const response = await request(app)
        .post('/api/staff/complete')
        .set('Authorization', 'Bearer valid-token')
        .send({
          patientId: 'patient-1'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Patient marked as completed');
    });

    it('should reject request without patientId', async () => {
      const response = await request(app)
        .post('/api/staff/complete')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .post('/api/staff/complete')
        .send({
          patientId: 'patient-1'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/staff/login', () => {
    it('should login with valid credentials and return session token', async () => {
      const response = await request(app)
        .post('/api/staff/login')
        .send({
          username: 'staff',
          password: 'smartwait2024'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.username).toBe('staff');
      expect(response.body.data.user.role).toBe('staff');
      expect(response.body.data.expiresAt).toBeDefined();
      expect(response.body.data.expiresIn).toBe('8h');
      expect(response.body.message).toBe('Login successful');
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/staff/login')
        .send({
          username: 'staff',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });
});
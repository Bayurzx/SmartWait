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
  },
}));

describe('Staff Authentication Integration', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();
  });

  describe('POST /api/staff/login', () => {
    it('should login with valid staff credentials', async () => {
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
      expect(response.body.message).toBe('Login successful');
    });

    it('should login with valid admin credentials', async () => {
      const response = await request(app)
        .post('/api/staff/login')
        .send({
          username: 'admin',
          password: 'admin2024'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.username).toBe('admin');
      expect(response.body.data.user.role).toBe('admin');
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

    it('should reject missing credentials', async () => {
      const response = await request(app)
        .post('/api/staff/login')
        .send({
          username: 'staff'
          // missing password
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject unknown username', async () => {
      const response = await request(app)
        .post('/api/staff/login')
        .send({
          username: 'unknown',
          password: 'password'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('GET /api/staff/me', () => {
    it('should return user info with valid token', async () => {
      const response = await request(app)
        .get('/api/staff/me')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/staff/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject request with invalid token format', async () => {
      const response = await request(app)
        .get('/api/staff/me')
        .set('Authorization', 'InvalidFormat');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/staff/logout', () => {
    it('should logout successfully with valid token', async () => {
      const response = await request(app)
        .post('/api/staff/logout')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logout successful');
    });

    it('should reject logout without token', async () => {
      const response = await request(app)
        .post('/api/staff/logout');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Authentication Flow', () => {
    it('should complete full authentication flow', async () => {
      // 1. Login
      const loginResponse = await request(app)
        .post('/api/staff/login')
        .send({
          username: 'staff',
          password: 'smartwait2024'
        });

      expect(loginResponse.status).toBe(200);
      const token = loginResponse.body.data.token;

      // 2. Access protected endpoint
      const meResponse = await request(app)
        .get('/api/staff/me')
        .set('Authorization', `Bearer ${token}`);

      expect(meResponse.status).toBe(200);
      expect(meResponse.body.data.user.username).toBe('staff');

      // 3. Logout
      const logoutResponse = await request(app)
        .post('/api/staff/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(logoutResponse.status).toBe(200);
    });
  });
});
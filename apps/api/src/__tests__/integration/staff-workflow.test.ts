/**
 * Staff Workflow Integration Tests
 * Tests staff dashboard operations and authentication
 */

import request from 'supertest';
import app from '../../index';
import { QueueService } from '../../services/queue-service';
import { AuthService } from '../../services/auth-service';

describe('Staff Workflow Integration', () => {
  let queueService: QueueService;
  let authService: AuthService;
  let staffToken: string;

  beforeAll(async () => {
    queueService = new QueueService();
    authService = new AuthService();
  });

  beforeEach(async () => {
    // Clean up queue and sessions before each test
    await queueService.clearQueue();
    await authService.cleanupExpiredSessions();
  });

  describe('Staff Authentication', () => {
    it('should authenticate staff with valid credentials', async () => {
      const response = await request(app)
        .post('/api/staff/login')
        .send({
          username: 'staff',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.username).toBe('staff');
      expect(response.body.data.expiresAt).toBeDefined();

      staffToken = response.body.data.token;
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
          // Missing password
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should allow staff to logout', async () => {
      // First login
      const loginResponse = await request(app)
        .post('/api/staff/login')
        .send({
          username: 'staff',
          password: 'password123'
        });

      const token = loginResponse.body.data.token;

      // Then logout
      const logoutResponse = await request(app)
        .post('/api/staff/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.body.success).toBe(true);

      // Verify token is invalidated
      const protectedResponse = await request(app)
        .get('/api/staff/queue')
        .set('Authorization', `Bearer ${token}`);

      expect(protectedResponse.status).toBe(401);
    });

    it('should get current user information', async () => {
      // Login first
      const loginResponse = await request(app)
        .post('/api/staff/login')
        .send({
          username: 'staff',
          password: 'password123'
        });

      const token = loginResponse.body.data.token;

      // Get user info
      const userResponse = await request(app)
        .get('/api/staff/me')
        .set('Authorization', `Bearer ${token}`);

      expect(userResponse.status).toBe(200);
      expect(userResponse.body.success).toBe(true);
      expect(userResponse.body.data.user.username).toBe('staff');
      expect(userResponse.body.data.sessionId).toBeDefined();
    });
  });

  describe('Queue Management Operations', () => {
    beforeEach(async () => {
      // Get fresh token for each test
      const loginResponse = await request(app)
        .post('/api/staff/login')
        .send({
          username: 'staff',
          password: 'password123'
        });
      staffToken = loginResponse.body.data.token;
    });

    it('should view empty queue', async () => {
      const response = await request(app)
        .get('/api/staff/queue')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
      expect(response.body.count).toBe(0);
    });

    it('should view queue with patients', async () => {
      // Add patients to queue
      const patients = [
        { name: 'John Doe', phone: '+1111111111', appointmentTime: '1:00 PM' },
        { name: 'Jane Smith', phone: '+2222222222', appointmentTime: '1:30 PM' }
      ];

      for (const patient of patients) {
        await request(app)
          .post('/api/checkin')
          .send(patient);
      }

      const response = await request(app)
        .get('/api/staff/queue')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.count).toBe(2);
      expect(response.body.data[0].patient.name).toBe('John Doe');
      expect(response.body.data[1].patient.name).toBe('Jane Smith');
    });

    it('should call next patient successfully', async () => {
      // Add patient to queue
      const checkInResponse = await request(app)
        .post('/api/checkin')
        .send({
          name: 'John Doe',
          phone: '+1234567890',
          appointmentTime: '2:00 PM'
        });

      const patientId = checkInResponse.body.data.patientId;

      // Call next patient
      const callResponse = await request(app)
        .post('/api/staff/call-next')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(callResponse.status).toBe(200);
      expect(callResponse.body.success).toBe(true);
      expect(callResponse.body.data.patient.name).toBe('John Doe');
      expect(callResponse.body.message).toContain('called');

      // Verify patient status changed
      const positionResponse = await request(app)
        .get(`/api/position/${patientId}`);

      expect(positionResponse.body.data.status).toBe('called');
    });

    it('should handle calling next patient when queue is empty', async () => {
      const response = await request(app)
        .post('/api/staff/call-next')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_PATIENTS_WAITING');
    });

    it('should complete patient successfully', async () => {
      // Add and call patient
      const checkInResponse = await request(app)
        .post('/api/checkin')
        .send({
          name: 'John Doe',
          phone: '+1234567890',
          appointmentTime: '2:00 PM'
        });

      const patientId = checkInResponse.body.data.patientId;

      await request(app)
        .post('/api/staff/call-next')
        .set('Authorization', `Bearer ${staffToken}`);

      // Complete patient
      const completeResponse = await request(app)
        .post('/api/staff/complete')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ patientId });

      expect(completeResponse.status).toBe(200);
      expect(completeResponse.body.success).toBe(true);

      // Verify patient is no longer in active queue
      const queueResponse = await request(app)
        .get('/api/staff/queue')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(queueResponse.body.data).toHaveLength(0);
    });

    it('should handle completing non-existent patient', async () => {
      const response = await request(app)
        .post('/api/staff/complete')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ patientId: 'non-existent-id' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PATIENT_NOT_FOUND');
    });

    it('should handle completing patient without patientId', async () => {
      const response = await request(app)
        .post('/api/staff/complete')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({}); // Missing patientId

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Queue Statistics', () => {
    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/api/staff/login')
        .send({
          username: 'staff',
          password: 'password123'
        });
      staffToken = loginResponse.body.data.token;
    });

    it('should get queue statistics', async () => {
      // Add patients in different states
      const patient1Response = await request(app)
        .post('/api/checkin')
        .send({
          name: 'Waiting Patient',
          phone: '+1111111111',
          appointmentTime: '1:00 PM'
        });

      const patient2Response = await request(app)
        .post('/api/checkin')
        .send({
          name: 'Called Patient',
          phone: '+2222222222',
          appointmentTime: '1:30 PM'
        });

      // Call one patient
      await request(app)
        .post('/api/staff/call-next')
        .set('Authorization', `Bearer ${staffToken}`);

      // Complete one patient
      await request(app)
        .post('/api/staff/complete')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ patientId: patient2Response.body.data.patientId });

      // Get statistics
      const statsResponse = await request(app)
        .get('/api/staff/stats')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(statsResponse.status).toBe(200);
      expect(statsResponse.body.success).toBe(true);
      expect(statsResponse.body.data).toHaveProperty('totalWaiting');
      expect(statsResponse.body.data).toHaveProperty('totalCalled');
      expect(statsResponse.body.data).toHaveProperty('totalCompleted');
      expect(statsResponse.body.data.totalWaiting).toBeGreaterThanOrEqual(0);
      expect(statsResponse.body.data.totalCompleted).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Session Management', () => {
    it('should handle expired tokens', async () => {
      // This would require mocking time or using a very short expiration
      // For now, we'll test with an invalid token format
      const response = await request(app)
        .get('/api/staff/queue')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });

    it('should handle missing authorization header', async () => {
      const response = await request(app)
        .get('/api/staff/queue');

      expect(response.status).toBe(401);
    });

    it('should handle malformed authorization header', async () => {
      const response = await request(app)
        .get('/api/staff/queue')
        .set('Authorization', 'InvalidFormat');

      expect(response.status).toBe(401);
    });
  });

  describe('Concurrent Staff Operations', () => {
    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/api/staff/login')
        .send({
          username: 'staff',
          password: 'password123'
        });
      staffToken = loginResponse.body.data.token;
    });

    it('should handle multiple staff members viewing queue simultaneously', async () => {
      // Add patients to queue
      await request(app)
        .post('/api/checkin')
        .send({
          name: 'Test Patient',
          phone: '+1234567890',
          appointmentTime: '2:00 PM'
        });

      // Simulate multiple staff members accessing queue
      const promises = Array.from({ length: 5 }, () =>
        request(app)
          .get('/api/staff/queue')
          .set('Authorization', `Bearer ${staffToken}`)
      );

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
      });
    });

    it('should handle rapid successive operations', async () => {
      // Add multiple patients
      const patients = Array.from({ length: 3 }, (_, i) => ({
        name: `Patient ${i + 1}`,
        phone: `+123456789${i}`,
        appointmentTime: '2:00 PM'
      }));

      for (const patient of patients) {
        await request(app)
          .post('/api/checkin')
          .send(patient);
      }

      // Rapidly call and complete patients
      for (let i = 0; i < 3; i++) {
        const callResponse = await request(app)
          .post('/api/staff/call-next')
          .set('Authorization', `Bearer ${staffToken}`);

        expect(callResponse.status).toBe(200);

        const patientId = callResponse.body.data.patientId;

        const completeResponse = await request(app)
          .post('/api/staff/complete')
          .set('Authorization', `Bearer ${staffToken}`)
          .send({ patientId });

        expect(completeResponse.status).toBe(200);
      }

      // Verify queue is empty
      const finalQueueResponse = await request(app)
        .get('/api/staff/queue')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(finalQueueResponse.body.data).toHaveLength(0);
    });
  });
});
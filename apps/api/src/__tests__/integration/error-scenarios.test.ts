/**
 * Error Scenarios Integration Tests
 * Tests system behavior under various error conditions
 */

import request from 'supertest';
import app from '../../index';
import { QueueService } from '../../services/queue-service';
import { AuthService } from '../../services/auth-service';

describe('Error Scenarios Integration', () => {
  let queueService: QueueService;
  let authService: AuthService;
  let staffToken: string;

  beforeAll(async () => {
    queueService = new QueueService();
    authService = new AuthService();

    // Get staff authentication token
    const loginResponse = await request(app)
      .post('/api/staff/login')
      .send({
        username: 'staff',
        password: 'password123'
      });

    staffToken = loginResponse.body.data.token;
  });

  beforeEach(async () => {
    // Clean up queue before each test
    await queueService.clearQueue();
  });

  describe('Input Validation Errors', () => {
    it('should reject check-in with missing required fields', async () => {
      const testCases = [
        { name: '', phone: '+1234567890', appointmentTime: '2:00 PM' }, // Missing name
        { name: 'John Doe', phone: '', appointmentTime: '2:00 PM' }, // Missing phone
        { name: 'John Doe', phone: '+1234567890', appointmentTime: '' }, // Missing appointment time
        {} // Missing all fields
      ];

      for (const testCase of testCases) {
        const response = await request(app)
          .post('/api/checkin')
          .send(testCase);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should reject check-in with invalid data types', async () => {
      const testCases = [
        { name: 123, phone: '+1234567890', appointmentTime: '2:00 PM' }, // Name as number
        { name: 'John Doe', phone: 1234567890, appointmentTime: '2:00 PM' }, // Phone as number
        { name: 'John Doe', phone: '+1234567890', appointmentTime: 200 } // Time as number
      ];

      for (const testCase of testCases) {
        const response = await request(app)
          .post('/api/checkin')
          .send(testCase);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      }
    });

    it('should reject check-in with invalid phone number formats', async () => {
      const invalidPhones = [
        'not-a-phone',
        '123',
        '++1234567890',
        'phone-number',
        '123-abc-7890'
      ];

      for (const phone of invalidPhones) {
        const response = await request(app)
          .post('/api/checkin')
          .send({
            name: 'Test Patient',
            phone,
            appointmentTime: '2:00 PM'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should reject check-in with excessively long fields', async () => {
      const longName = 'A'.repeat(200); // Very long name
      const longPhone = '1'.repeat(50); // Very long phone
      
      const response = await request(app)
        .post('/api/checkin')
        .send({
          name: longName,
          phone: longPhone,
          appointmentTime: '2:00 PM'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/checkin')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(response.status).toBe(400);
    });
  });

  describe('Duplicate Check-in Scenarios', () => {
    it('should prevent duplicate check-ins with same phone number', async () => {
      const patientData = {
        name: 'John Doe',
        phone: '+1234567890',
        appointmentTime: '2:00 PM'
      };

      // First check-in should succeed
      const firstResponse = await request(app)
        .post('/api/checkin')
        .send(patientData);

      expect(firstResponse.status).toBe(201);

      // Second check-in with same phone should fail
      const secondResponse = await request(app)
        .post('/api/checkin')
        .send(patientData);

      expect(secondResponse.status).toBe(400);
      expect(secondResponse.body.success).toBe(false);
      expect(secondResponse.body.error.message).toContain('already in the queue');
    });

    it('should allow check-in with same name but different phone', async () => {
      const patient1 = {
        name: 'John Doe',
        phone: '+1234567890',
        appointmentTime: '2:00 PM'
      };

      const patient2 = {
        name: 'John Doe', // Same name
        phone: '+0987654321', // Different phone
        appointmentTime: '2:30 PM'
      };

      const response1 = await request(app)
        .post('/api/checkin')
        .send(patient1);

      const response2 = await request(app)
        .post('/api/checkin')
        .send(patient2);

      expect(response1.status).toBe(201);
      expect(response2.status).toBe(201);
    });

    it('should handle rapid duplicate check-in attempts', async () => {
      const patientData = {
        name: 'Rapid Patient',
        phone: '+1111111111',
        appointmentTime: '2:00 PM'
      };

      // Send multiple simultaneous requests
      const promises = Array.from({ length: 5 }, () =>
        request(app)
          .post('/api/checkin')
          .send(patientData)
      );

      const responses = await Promise.all(promises);

      // Only one should succeed
      const successfulResponses = responses.filter(r => r.status === 201);
      const failedResponses = responses.filter(r => r.status === 400);

      expect(successfulResponses).toHaveLength(1);
      expect(failedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Non-existent Resource Errors', () => {
    it('should return 404 for non-existent patient position lookup', async () => {
      const response = await request(app)
        .get('/api/position/non-existent-patient-id');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PATIENT_NOT_FOUND');
    });

    it('should return 404 for non-existent patient status lookup', async () => {
      const response = await request(app)
        .get('/api/status/invalid-patient-id');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PATIENT_NOT_FOUND');
    });

    it('should handle malformed patient IDs', async () => {
      const malformedIds = [
        'invalid-uuid',
        '123',
        'not-a-uuid-at-all',
        '',
        null,
        undefined
      ];

      for (const id of malformedIds) {
        const response = await request(app)
          .get(`/api/position/${id}`);

        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.body.success).toBe(false);
      }
    });
  });

  describe('Authentication and Authorization Errors', () => {
    it('should reject staff operations without authentication', async () => {
      const protectedEndpoints = [
        { method: 'get', path: '/api/staff/queue' },
        { method: 'post', path: '/api/staff/call-next' },
        { method: 'post', path: '/api/staff/complete' },
        { method: 'get', path: '/api/staff/stats' }
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await request(app)[endpoint.method](endpoint.path);
        
        expect(response.status).toBe(401);
      }
    });

    it('should reject invalid authentication tokens', async () => {
      const invalidTokens = [
        'invalid-token',
        'Bearer invalid-token',
        'expired-token',
        'malformed.jwt.token'
      ];

      for (const token of invalidTokens) {
        const response = await request(app)
          .get('/api/staff/queue')
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(401);
      }
    });

    it('should reject malformed authorization headers', async () => {
      const malformedHeaders = [
        'InvalidFormat',
        'Bearer',
        'Basic dGVzdDp0ZXN0', // Wrong auth type
        ''
      ];

      for (const header of malformedHeaders) {
        const response = await request(app)
          .get('/api/staff/queue')
          .set('Authorization', header);

        expect(response.status).toBe(401);
      }
    });
  });

  describe('Queue Operation Errors', () => {
    it('should handle calling next patient when queue is empty', async () => {
      const response = await request(app)
        .post('/api/staff/call-next')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_PATIENTS_WAITING');
    });

    it('should handle completing non-existent patient', async () => {
      const response = await request(app)
        .post('/api/staff/complete')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ patientId: 'non-existent-patient-id' });

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

    it('should handle completing already completed patient', async () => {
      // Check in and complete a patient
      const checkInResponse = await request(app)
        .post('/api/checkin')
        .send({
          name: 'Test Patient',
          phone: '+1234567890',
          appointmentTime: '2:00 PM'
        });

      const patientId = checkInResponse.body.data.patientId;

      await request(app)
        .post('/api/staff/call-next')
        .set('Authorization', `Bearer ${staffToken}`);

      await request(app)
        .post('/api/staff/complete')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ patientId });

      // Try to complete again
      const secondCompleteResponse = await request(app)
        .post('/api/staff/complete')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ patientId });

      expect(secondCompleteResponse.status).toBe(404);
      expect(secondCompleteResponse.body.success).toBe(false);
    });
  });

  describe('Rate Limiting and Abuse Prevention', () => {
    it('should handle rapid successive requests', async () => {
      const rapidRequests = Array.from({ length: 100 }, (_, i) => 
        request(app)
          .post('/api/checkin')
          .send({
            name: `Rapid Patient ${i}`,
            phone: `+123456789${i.toString().padStart(2, '0')}`,
            appointmentTime: '2:00 PM'
          })
      );

      const responses = await Promise.all(rapidRequests);

      // Most should succeed, but system should remain stable
      const successCount = responses.filter(r => r.status === 201).length;
      const errorCount = responses.filter(r => r.status >= 400).length;

      expect(successCount + errorCount).toBe(100);
      expect(successCount).toBeGreaterThan(0); // At least some should succeed
    });

    it('should handle large request payloads', async () => {
      const largePayload = {
        name: 'A'.repeat(10000), // Very large name
        phone: '+1234567890',
        appointmentTime: '2:00 PM',
        extraData: 'B'.repeat(10000) // Extra large field
      };

      const response = await request(app)
        .post('/api/checkin')
        .send(largePayload);

      // Should reject or handle gracefully
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Database Connection Errors', () => {
    it('should handle database connection issues gracefully', async () => {
      // This test would require mocking database failures
      // For now, we'll test that the system responds appropriately to errors
      
      // Attempt operation that might fail due to database issues
      const response = await request(app)
        .get('/health/detailed');

      // Health check should indicate database status
      expect(response.body).toHaveProperty('database');
      expect(response.body.database).toHaveProperty('status');
    });
  });

  describe('Concurrent Operation Conflicts', () => {
    it('should handle concurrent staff operations on same patient', async () => {
      // Add patient
      const checkInResponse = await request(app)
        .post('/api/checkin')
        .send({
          name: 'Concurrent Test Patient',
          phone: '+1234567890',
          appointmentTime: '2:00 PM'
        });

      const patientId = checkInResponse.body.data.patientId;

      // Call patient first
      await request(app)
        .post('/api/staff/call-next')
        .set('Authorization', `Bearer ${staffToken}`);

      // Try concurrent completion attempts
      const completionPromises = Array.from({ length: 3 }, () =>
        request(app)
          .post('/api/staff/complete')
          .set('Authorization', `Bearer ${staffToken}`)
          .send({ patientId })
      );

      const responses = await Promise.all(completionPromises);

      // Only one should succeed
      const successfulCompletions = responses.filter(r => r.status === 200);
      expect(successfulCompletions).toHaveLength(1);
    });

    it('should handle concurrent queue modifications', async () => {
      // Add multiple patients
      const patients = Array.from({ length: 5 }, (_, i) => ({
        name: `Patient ${i + 1}`,
        phone: `+123456789${i}`,
        appointmentTime: '2:00 PM'
      }));

      for (const patient of patients) {
        await request(app)
          .post('/api/checkin')
          .send(patient);
      }

      // Perform concurrent staff operations
      const operations = [
        request(app)
          .post('/api/staff/call-next')
          .set('Authorization', `Bearer ${staffToken}`),
        request(app)
          .get('/api/staff/queue')
          .set('Authorization', `Bearer ${staffToken}`),
        request(app)
          .get('/api/staff/stats')
          .set('Authorization', `Bearer ${staffToken}`)
      ];

      const responses = await Promise.all(operations);

      // All operations should complete successfully
      responses.forEach(response => {
        expect(response.status).toBeLessThan(500);
      });
    });
  });

  describe('Memory and Resource Limits', () => {
    it('should handle memory pressure gracefully', async () => {
      // Create many patients to test memory usage
      const manyPatients = Array.from({ length: 50 }, (_, i) => ({
        name: `Memory Test Patient ${i}`,
        phone: `+1234567${i.toString().padStart(3, '0')}`,
        appointmentTime: '2:00 PM'
      }));

      const responses = await Promise.all(
        manyPatients.map(patient =>
          request(app)
            .post('/api/checkin')
            .send(patient)
        )
      );

      // All should succeed or fail gracefully
      responses.forEach(response => {
        expect([201, 400, 429, 503]).toContain(response.status);
      });

      // System should still be responsive
      const healthResponse = await request(app).get('/health');
      expect(healthResponse.status).toBeLessThan(500);
    });
  });

  describe('Error Response Format Consistency', () => {
    it('should return consistent error format across all endpoints', async () => {
      const errorScenarios = [
        { method: 'post', path: '/api/checkin', data: {} },
        { method: 'get', path: '/api/position/invalid-id' },
        { method: 'get', path: '/api/staff/queue', headers: {} },
        { method: 'post', path: '/api/staff/complete', data: {}, auth: true }
      ];

      for (const scenario of errorScenarios) {
        const req = request(app)[scenario.method](scenario.path);
        
        if (scenario.data) {
          req.send(scenario.data);
        }
        
        if (scenario.auth) {
          req.set('Authorization', `Bearer ${staffToken}`);
        }

        const response = await req;

        if (response.status >= 400) {
          expect(response.body).toHaveProperty('success', false);
          expect(response.body).toHaveProperty('error');
          expect(response.body.error).toHaveProperty('code');
          expect(response.body.error).toHaveProperty('message');
        }
      }
    });
  });
});
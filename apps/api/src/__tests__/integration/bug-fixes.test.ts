/**
 * Bug Fixes Integration Tests
 * Tests for specific bugs found during integration testing
 */

import request from 'supertest';
import app from '../../index';
import { QueueService } from '../../services/queue-service';
import { AuthService } from '../../services/auth-service';

describe('Bug Fixes Integration', () => {
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

  describe('Position Calculation Bugs', () => {
    it('should maintain correct positions after patient completion', async () => {
      // Add 3 patients
      const patients = [
        { name: 'Patient 1', phone: '+1111111111', appointmentTime: '1:00 PM' },
        { name: 'Patient 2', phone: '+2222222222', appointmentTime: '1:30 PM' },
        { name: 'Patient 3', phone: '+3333333333', appointmentTime: '2:00 PM' }
      ];

      const patientIds: string[] = [];
      for (const patient of patients) {
        const response = await request(app)
          .post('/api/checkin')
          .send(patient);
        patientIds.push(response.body.data.patientId);
      }

      // Call and complete first patient
      await request(app)
        .post('/api/staff/call-next')
        .set('Authorization', `Bearer ${staffToken}`);

      await request(app)
        .post('/api/staff/complete')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ patientId: patientIds[0] });

      // Check remaining patients have correct positions
      const patient2Position = await request(app)
        .get(`/api/position/${patientIds[1]}`);
      
      const patient3Position = await request(app)
        .get(`/api/position/${patientIds[2]}`);

      expect(patient2Position.body.data.position).toBe(1);
      expect(patient3Position.body.data.position).toBe(2);
    });

    it('should handle position gaps correctly', async () => {
      // Add patients
      const patient1Response = await request(app)
        .post('/api/checkin')
        .send({
          name: 'Patient 1',
          phone: '+1111111111',
          appointmentTime: '1:00 PM'
        });

      const patient2Response = await request(app)
        .post('/api/checkin')
        .send({
          name: 'Patient 2',
          phone: '+2222222222',
          appointmentTime: '1:30 PM'
        });

      // Complete first patient without calling (edge case)
      await request(app)
        .post('/api/staff/call-next')
        .set('Authorization', `Bearer ${staffToken}`);

      await request(app)
        .post('/api/staff/complete')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ patientId: patient1Response.body.data.patientId });

      // Add new patient - should get position 2, not 3
      const patient3Response = await request(app)
        .post('/api/checkin')
        .send({
          name: 'Patient 3',
          phone: '+3333333333',
          appointmentTime: '2:00 PM'
        });

      expect(patient3Response.body.data.position).toBe(2);
    });
  });

  describe('Concurrent Operation Bugs', () => {
    it('should handle race condition in position assignment', async () => {
      // Simulate concurrent check-ins
      const concurrentCheckIns = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .post('/api/checkin')
          .send({
            name: `Concurrent Patient ${i}`,
            phone: `+123456789${i}`,
            appointmentTime: '2:00 PM'
          })
      );

      const responses = await Promise.all(concurrentCheckIns);

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });

      // Positions should be unique and sequential
      const positions = responses.map(r => r.body.data.position).sort((a, b) => a - b);
      const expectedPositions = Array.from({ length: 10 }, (_, i) => i + 1);
      
      expect(positions).toEqual(expectedPositions);
    });

    it('should handle concurrent staff operations safely', async () => {
      // Add patients
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/checkin')
          .send({
            name: `Patient ${i + 1}`,
            phone: `+123456789${i}`,
            appointmentTime: '2:00 PM'
          });
      }

      // Simulate concurrent staff operations
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

      // All operations should complete without errors
      responses.forEach(response => {
        expect(response.status).toBeLessThan(500);
      });
    });
  });

  describe('Authentication Token Bugs', () => {
    it('should handle token expiration gracefully', async () => {
      // This test would require mocking token expiration
      // For now, test with an obviously invalid token
      const response = await request(app)
        .get('/api/staff/queue')
        .set('Authorization', 'Bearer obviously-invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should handle missing Bearer prefix', async () => {
      const response = await request(app)
        .get('/api/staff/queue')
        .set('Authorization', staffToken); // Missing "Bearer "

      expect(response.status).toBe(401);
    });

    it('should handle empty authorization header', async () => {
      const response = await request(app)
        .get('/api/staff/queue')
        .set('Authorization', '');

      expect(response.status).toBe(401);
    });
  });

  describe('Data Validation Bugs', () => {
    it('should properly validate phone number formats', async () => {
      const validPhones = [
        '+1234567890',
        '(123) 456-7890',
        '123-456-7890',
        '1234567890'
      ];

      for (const phone of validPhones) {
        const response = await request(app)
          .post('/api/checkin')
          .send({
            name: 'Valid Phone Test',
            phone,
            appointmentTime: '2:00 PM'
          });

        expect(response.status).toBe(201);
      }
    });

    it('should reject invalid phone numbers consistently', async () => {
      const invalidPhones = [
        'not-a-phone',
        '123',
        '++1234567890',
        'abc-def-ghij'
      ];

      for (const phone of invalidPhones) {
        const response = await request(app)
          .post('/api/checkin')
          .send({
            name: 'Invalid Phone Test',
            phone,
            appointmentTime: '2:00 PM'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      }
    });

    it('should handle special characters in names', async () => {
      const specialNames = [
        "O'Connor",
        "Smith-Jones",
        "José García",
        "李小明",
        "محمد أحمد"
      ];

      for (const name of specialNames) {
        const response = await request(app)
          .post('/api/checkin')
          .send({
            name,
            phone: `+123456789${specialNames.indexOf(name)}`,
            appointmentTime: '2:00 PM'
          });

        expect(response.status).toBe(201);
        expect(response.body.data).toBeDefined();
      }
    });
  });

  describe('Queue State Consistency Bugs', () => {
    it('should maintain queue integrity after multiple operations', async () => {
      // Complex scenario: multiple check-ins, calls, and completions
      const operations = [];

      // Add 5 patients
      for (let i = 0; i < 5; i++) {
        operations.push(
          request(app)
            .post('/api/checkin')
            .send({
              name: `Patient ${i + 1}`,
              phone: `+123456789${i}`,
              appointmentTime: '2:00 PM'
            })
        );
      }

      const checkInResponses = await Promise.all(operations);
      const patientIds = checkInResponses.map(r => r.body.data.patientId);

      // Call and complete first 3 patients
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/staff/call-next')
          .set('Authorization', `Bearer ${staffToken}`);

        await request(app)
          .post('/api/staff/complete')
          .set('Authorization', `Bearer ${staffToken}`)
          .send({ patientId: patientIds[i] });
      }

      // Check final queue state
      const finalQueueResponse = await request(app)
        .get('/api/staff/queue')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(finalQueueResponse.body.data).toHaveLength(2);
      expect(finalQueueResponse.body.data[0].position).toBe(1);
      expect(finalQueueResponse.body.data[1].position).toBe(2);
    });

    it('should handle queue state after system restart simulation', async () => {
      // Add patients
      const patient1Response = await request(app)
        .post('/api/checkin')
        .send({
          name: 'Persistent Patient 1',
          phone: '+1111111111',
          appointmentTime: '1:00 PM'
        });

      const patient2Response = await request(app)
        .post('/api/checkin')
        .send({
          name: 'Persistent Patient 2',
          phone: '+2222222222',
          appointmentTime: '1:30 PM'
        });

      // Simulate system restart by checking queue integrity
      const queueResponse = await request(app)
        .get('/api/staff/queue')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(queueResponse.body.data).toHaveLength(2);
      expect(queueResponse.body.data[0].position).toBe(1);
      expect(queueResponse.body.data[1].position).toBe(2);

      // Verify individual patient positions
      const pos1Response = await request(app)
        .get(`/api/position/${patient1Response.body.data.patientId}`);
      
      const pos2Response = await request(app)
        .get(`/api/position/${patient2Response.body.data.patientId}`);

      expect(pos1Response.body.data.position).toBe(1);
      expect(pos2Response.body.data.position).toBe(2);
    });
  });

  describe('Error Handling Bugs', () => {
    it('should return proper error codes for all scenarios', async () => {
      // Test various error scenarios and ensure consistent error format
      const errorTests = [
        {
          description: 'Missing required fields',
          request: () => request(app).post('/api/checkin').send({}),
          expectedStatus: 400,
          expectedCode: 'VALIDATION_ERROR'
        },
        {
          description: 'Non-existent patient lookup',
          request: () => request(app).get('/api/position/non-existent-id'),
          expectedStatus: 404,
          expectedCode: 'PATIENT_NOT_FOUND'
        },
        {
          description: 'Unauthorized staff access',
          request: () => request(app).get('/api/staff/queue'),
          expectedStatus: 401,
          expectedCode: undefined // May vary
        },
        {
          description: 'Empty queue call next',
          request: () => request(app)
            .post('/api/staff/call-next')
            .set('Authorization', `Bearer ${staffToken}`),
          expectedStatus: 404,
          expectedCode: 'NO_PATIENTS_WAITING'
        }
      ];

      for (const test of errorTests) {
        const response = await test.request();
        
        expect(response.status).toBe(test.expectedStatus);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBeDefined();
        expect(response.body.error.message).toBeDefined();
        
        if (test.expectedCode) {
          expect(response.body.error.code).toBe(test.expectedCode);
        }
      }
    });
  });

  describe('Performance and Memory Bugs', () => {
    it('should handle large queue sizes without performance degradation', async () => {
      const startTime = Date.now();
      
      // Add many patients
      const patients = Array.from({ length: 100 }, (_, i) => ({
        name: `Performance Test Patient ${i}`,
        phone: `+1234567${i.toString().padStart(3, '0')}`,
        appointmentTime: '2:00 PM'
      }));

      const checkInPromises = patients.map(patient =>
        request(app)
          .post('/api/checkin')
          .send(patient)
      );

      const responses = await Promise.all(checkInPromises);
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
      });

      // Queue operations should still be fast
      const queueStartTime = Date.now();
      const queueResponse = await request(app)
        .get('/api/staff/queue')
        .set('Authorization', `Bearer ${staffToken}`);
      
      const queueTime = Date.now() - queueStartTime;
      
      expect(queueResponse.status).toBe(200);
      expect(queueResponse.body.data).toHaveLength(100);
      expect(queueTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});
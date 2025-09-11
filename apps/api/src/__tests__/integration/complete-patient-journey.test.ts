/**
 * Complete Patient Journey Integration Tests
 * Tests the full patient workflow from check-in to completion
 */

import request from 'supertest';
import app from '../../index';
import { QueueService } from '../../services/queue-service';
import { AuthService } from '../../services/auth-service';
import { NotificationService } from '../../services/notification-service';
import { RealtimeService } from '../../services/realtime-service';

describe('Complete Patient Journey Integration', () => {
  let queueService: QueueService;
  let authService: AuthService;
  let notificationService: NotificationService;
  let realtimeService: RealtimeService;
  let staffToken: string;

  beforeAll(async () => {
    queueService = new QueueService();
    authService = new AuthService();
    notificationService = new NotificationService();
    realtimeService = new RealtimeService();

    // Get staff authentication token
    const loginResponse = await request(app)
      .post('/api/staff/login')
      .send({
        username: 'staff',
        password: 'password123'
      });

    expect(loginResponse.status).toBe(200);
    staffToken = loginResponse.body.data.token;
  });

  beforeEach(async () => {
    // Clean up queue before each test
    await queueService.clearQueue();
  });

  describe('Happy Path: Complete Patient Journey', () => {
    it('should handle patient from check-in to completion', async () => {
      // Step 1: Patient checks in via API
      const checkInResponse = await request(app)
        .post('/api/checkin')
        .send({
          name: 'John Doe',
          phone: '+1234567890',
          appointmentTime: '2:00 PM'
        });

      expect(checkInResponse.status).toBe(201);
      expect(checkInResponse.body.success).toBe(true);
      expect(checkInResponse.body.data.position).toBe(1);
      expect(checkInResponse.body.data.patientId).toBeDefined();

      const patientId = checkInResponse.body.data.patientId;

      // Step 2: Verify patient can check their position
      const positionResponse = await request(app)
        .get(`/api/position/${patientId}`);

      expect(positionResponse.status).toBe(200);
      expect(positionResponse.body.success).toBe(true);
      expect(positionResponse.body.data.position).toBe(1);
      expect(positionResponse.body.data.status).toBe('waiting');

      // Step 3: Staff views the queue
      const queueResponse = await request(app)
        .get('/api/staff/queue')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(queueResponse.status).toBe(200);
      expect(queueResponse.body.success).toBe(true);
      expect(queueResponse.body.data).toHaveLength(1);
      expect(queueResponse.body.data[0].patient.name).toBe('John Doe');

      // Step 4: Staff calls next patient
      const callNextResponse = await request(app)
        .post('/api/staff/call-next')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(callNextResponse.status).toBe(200);
      expect(callNextResponse.body.success).toBe(true);
      expect(callNextResponse.body.data.patient.name).toBe('John Doe');

      // Step 5: Verify patient status changed to 'called'
      const updatedPositionResponse = await request(app)
        .get(`/api/position/${patientId}`);

      expect(updatedPositionResponse.status).toBe(200);
      expect(updatedPositionResponse.body.data.status).toBe('called');

      // Step 6: Staff marks patient as completed
      const completeResponse = await request(app)
        .post('/api/staff/complete')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ patientId });

      expect(completeResponse.status).toBe(200);
      expect(completeResponse.body.success).toBe(true);

      // Step 7: Verify patient is no longer in active queue
      const finalQueueResponse = await request(app)
        .get('/api/staff/queue')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(finalQueueResponse.status).toBe(200);
      expect(finalQueueResponse.body.data).toHaveLength(0);
    });

    it('should handle multiple patients with correct position management', async () => {
      // Check in multiple patients
      const patients = [
        { name: 'Alice Smith', phone: '+1111111111', appointmentTime: '1:00 PM' },
        { name: 'Bob Johnson', phone: '+2222222222', appointmentTime: '1:30 PM' },
        { name: 'Carol Davis', phone: '+3333333333', appointmentTime: '2:00 PM' }
      ];

      const patientIds: string[] = [];

      // Check in all patients
      for (let i = 0; i < patients.length; i++) {
        const response = await request(app)
          .post('/api/checkin')
          .send(patients[i]);

        expect(response.status).toBe(201);
        expect(response.body.data.position).toBe(i + 1);
        patientIds.push(response.body.data.patientId);
      }

      // Verify queue has all patients
      const queueResponse = await request(app)
        .get('/api/staff/queue')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(queueResponse.body.data).toHaveLength(3);

      // Call first patient
      await request(app)
        .post('/api/staff/call-next')
        .set('Authorization', `Bearer ${staffToken}`);

      // Complete first patient
      await request(app)
        .post('/api/staff/complete')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ patientId: patientIds[0] });

      // Verify positions updated correctly
      const alice2ndPosition = await request(app)
        .get(`/api/position/${patientIds[1]}`);
      
      expect(alice2ndPosition.body.data.position).toBe(1); // Bob should now be position 1

      const carol3rdPosition = await request(app)
        .get(`/api/position/${patientIds[2]}`);
      
      expect(carol3rdPosition.body.data.position).toBe(2); // Carol should now be position 2
    });
  });

  describe('Error Scenarios', () => {
    it('should handle duplicate check-ins', async () => {
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

    it('should handle invalid patient data', async () => {
      const invalidData = {
        name: '', // Empty name
        phone: 'invalid-phone',
        appointmentTime: ''
      };

      const response = await request(app)
        .post('/api/checkin')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle non-existent patient lookup', async () => {
      const response = await request(app)
        .get('/api/position/non-existent-id');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PATIENT_NOT_FOUND');
    });

    it('should handle calling next patient when queue is empty', async () => {
      const response = await request(app)
        .post('/api/staff/call-next')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_PATIENTS_WAITING');
    });

    it('should handle unauthorized staff access', async () => {
      const response = await request(app)
        .get('/api/staff/queue');

      expect(response.status).toBe(401);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple simultaneous check-ins', async () => {
      const patients = Array.from({ length: 5 }, (_, i) => ({
        name: `Patient ${i + 1}`,
        phone: `+123456789${i}`,
        appointmentTime: '2:00 PM'
      }));

      // Simulate concurrent check-ins
      const checkInPromises = patients.map(patient =>
        request(app)
          .post('/api/checkin')
          .send(patient)
      );

      const responses = await Promise.all(checkInPromises);

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });

      // Verify all patients are in queue with correct positions
      const queueResponse = await request(app)
        .get('/api/staff/queue')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(queueResponse.body.data).toHaveLength(5);

      // Verify positions are sequential
      const positions = queueResponse.body.data.map((p: any) => p.position).sort();
      expect(positions).toEqual([1, 2, 3, 4, 5]);
    });

    it('should handle concurrent staff operations', async () => {
      // Set up queue with multiple patients
      const patients = [
        { name: 'Patient 1', phone: '+1111111111', appointmentTime: '1:00 PM' },
        { name: 'Patient 2', phone: '+2222222222', appointmentTime: '1:30 PM' }
      ];

      for (const patient of patients) {
        await request(app)
          .post('/api/checkin')
          .send(patient);
      }

      // Simulate concurrent staff operations
      const [callResponse, queueResponse] = await Promise.all([
        request(app)
          .post('/api/staff/call-next')
          .set('Authorization', `Bearer ${staffToken}`),
        request(app)
          .get('/api/staff/queue')
          .set('Authorization', `Bearer ${staffToken}`)
      ]);

      expect(callResponse.status).toBe(200);
      expect(queueResponse.status).toBe(200);
    });
  });

  describe('Queue Statistics', () => {
    it('should provide accurate queue statistics', async () => {
      // Add patients in different states
      const checkInResponse = await request(app)
        .post('/api/checkin')
        .send({
          name: 'Waiting Patient',
          phone: '+1111111111',
          appointmentTime: '2:00 PM'
        });

      const patientId = checkInResponse.body.data.patientId;

      // Call and complete one patient
      await request(app)
        .post('/api/staff/call-next')
        .set('Authorization', `Bearer ${staffToken}`);

      await request(app)
        .post('/api/staff/complete')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ patientId });

      // Add another waiting patient
      await request(app)
        .post('/api/checkin')
        .send({
          name: 'Another Patient',
          phone: '+2222222222',
          appointmentTime: '2:30 PM'
        });

      // Get statistics
      const statsResponse = await request(app)
        .get('/api/staff/stats')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(statsResponse.status).toBe(200);
      expect(statsResponse.body.success).toBe(true);
      expect(statsResponse.body.data).toHaveProperty('totalWaiting');
      expect(statsResponse.body.data).toHaveProperty('totalCalled');
      expect(statsResponse.body.data).toHaveProperty('totalCompleted');
    });
  });
});
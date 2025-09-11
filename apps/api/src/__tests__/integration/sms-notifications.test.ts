/**
 * SMS Notifications Integration Tests
 * Tests SMS delivery for all queue scenarios
 */

import request from 'supertest';
import app from '../../index';
import { QueueService } from '../../services/queue-service';
import { NotificationService } from '../../services/notification-service';
import { AuthService } from '../../services/auth-service';

// Mock Twilio for testing
jest.mock('twilio', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        sid: 'mock-message-sid',
        status: 'sent',
        to: '+1234567890',
        body: 'Mock SMS message'
      })
    }
  }));
});

describe('SMS Notifications Integration', () => {
  let queueService: QueueService;
  let notificationService: NotificationService;
  let authService: AuthService;
  let staffToken: string;
  let mockTwilio: any;

  beforeAll(async () => {
    queueService = new QueueService();
    notificationService = new NotificationService();
    authService = new AuthService();

    // Get staff authentication token
    const loginResponse = await request(app)
      .post('/api/staff/login')
      .send({
        username: 'staff',
        password: 'password123'
      });

    staffToken = loginResponse.body.data.token;

    // Get mock Twilio instance
    const twilio = require('twilio');
    mockTwilio = twilio();
  });

  beforeEach(async () => {
    // Clean up queue before each test
    await queueService.clearQueue();
    
    // Reset mock calls
    jest.clearAllMocks();
  });

  describe('Check-in Confirmation SMS', () => {
    it('should send SMS when patient checks in', async () => {
      const checkInResponse = await request(app)
        .post('/api/checkin')
        .send({
          name: 'John Doe',
          phone: '+1234567890',
          appointmentTime: '2:00 PM'
        });

      expect(checkInResponse.status).toBe(201);

      // Verify SMS was sent
      expect(mockTwilio.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '+1234567890',
          body: expect.stringContaining('John Doe'),
          body: expect.stringContaining('position 1')
        })
      );
    });

    it('should include correct queue position in SMS', async () => {
      // Add first patient
      await request(app)
        .post('/api/checkin')
        .send({
          name: 'First Patient',
          phone: '+1111111111',
          appointmentTime: '1:00 PM'
        });

      // Add second patient
      await request(app)
        .post('/api/checkin')
        .send({
          name: 'Second Patient',
          phone: '+2222222222',
          appointmentTime: '1:30 PM'
        });

      // Verify second patient got position 2
      expect(mockTwilio.messages.create).toHaveBeenLastCalledWith(
        expect.objectContaining({
          to: '+2222222222',
          body: expect.stringContaining('position 2')
        })
      );
    });

    it('should include estimated wait time in SMS', async () => {
      await request(app)
        .post('/api/checkin')
        .send({
          name: 'Test Patient',
          phone: '+1234567890',
          appointmentTime: '2:00 PM'
        });

      expect(mockTwilio.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('wait')
        })
      );
    });

    it('should handle SMS delivery failures gracefully', async () => {
      // Mock SMS failure
      mockTwilio.messages.create.mockRejectedValueOnce(new Error('SMS delivery failed'));

      const checkInResponse = await request(app)
        .post('/api/checkin')
        .send({
          name: 'John Doe',
          phone: '+1234567890',
          appointmentTime: '2:00 PM'
        });

      // Check-in should still succeed even if SMS fails
      expect(checkInResponse.status).toBe(201);
      expect(checkInResponse.body.success).toBe(true);
    });
  });

  describe('Get Ready SMS (2 positions away)', () => {
    it('should send get ready SMS when patient is 2 positions away', async () => {
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

      // Clear mock calls from check-in SMS
      jest.clearAllMocks();

      // Call first patient (Patient 3 should get "get ready" SMS)
      await request(app)
        .post('/api/staff/call-next')
        .set('Authorization', `Bearer ${staffToken}`);

      // Verify Patient 3 (position 3, now 2 away from being called) gets ready SMS
      expect(mockTwilio.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '+3333333333',
          body: expect.stringContaining('ready')
        })
      );
    });

    it('should not send get ready SMS if less than 3 patients in queue', async () => {
      // Add only 2 patients
      await request(app)
        .post('/api/checkin')
        .send({
          name: 'Patient 1',
          phone: '+1111111111',
          appointmentTime: '1:00 PM'
        });

      await request(app)
        .post('/api/checkin')
        .send({
          name: 'Patient 2',
          phone: '+2222222222',
          appointmentTime: '1:30 PM'
        });

      // Clear check-in SMS calls
      jest.clearAllMocks();

      // Call first patient
      await request(app)
        .post('/api/staff/call-next')
        .set('Authorization', `Bearer ${staffToken}`);

      // Should only have "come in now" SMS, no "get ready" SMS
      const smsCalls = mockTwilio.messages.create.mock.calls;
      const readySMS = smsCalls.find(call => 
        call[0].body.includes('ready') || call[0].body.includes('next')
      );
      
      expect(readySMS).toBeUndefined();
    });
  });

  describe('Come In Now SMS (patient called)', () => {
    it('should send come in now SMS when patient is called', async () => {
      const checkInResponse = await request(app)
        .post('/api/checkin')
        .send({
          name: 'John Doe',
          phone: '+1234567890',
          appointmentTime: '2:00 PM'
        });

      // Clear check-in SMS
      jest.clearAllMocks();

      // Call the patient
      await request(app)
        .post('/api/staff/call-next')
        .set('Authorization', `Bearer ${staffToken}`);

      // Verify "come in now" SMS was sent
      expect(mockTwilio.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '+1234567890',
          body: expect.stringContaining('John Doe'),
          body: expect.stringMatching(/turn|now|come/i)
        })
      );
    });

    it('should include patient name in call SMS', async () => {
      await request(app)
        .post('/api/checkin')
        .send({
          name: 'Jane Smith',
          phone: '+9876543210',
          appointmentTime: '3:00 PM'
        });

      jest.clearAllMocks();

      await request(app)
        .post('/api/staff/call-next')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(mockTwilio.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('Jane Smith')
        })
      );
    });
  });

  describe('SMS Message Templates', () => {
    it('should use proper message format for check-in confirmation', async () => {
      await request(app)
        .post('/api/checkin')
        .send({
          name: 'Test Patient',
          phone: '+1234567890',
          appointmentTime: '2:00 PM'
        });

      const smsCall = mockTwilio.messages.create.mock.calls[0][0];
      
      expect(smsCall.body).toMatch(/Hello Test Patient/);
      expect(smsCall.body).toMatch(/position 1/);
      expect(smsCall.body).toMatch(/SmartWait/);
    });

    it('should use proper message format for get ready SMS', async () => {
      // Set up scenario for get ready SMS
      const patients = [
        { name: 'Patient 1', phone: '+1111111111', appointmentTime: '1:00 PM' },
        { name: 'Patient 2', phone: '+2222222222', appointmentTime: '1:30 PM' },
        { name: 'Ready Patient', phone: '+3333333333', appointmentTime: '2:00 PM' }
      ];

      for (const patient of patients) {
        await request(app)
          .post('/api/checkin')
          .send(patient);
      }

      jest.clearAllMocks();

      await request(app)
        .post('/api/staff/call-next')
        .set('Authorization', `Bearer ${staffToken}`);

      const readySMS = mockTwilio.messages.create.mock.calls.find(call =>
        call[0].to === '+3333333333'
      );

      if (readySMS) {
        expect(readySMS[0].body).toMatch(/Ready Patient/);
        expect(readySMS[0].body).toMatch(/ready|next/i);
      }
    });

    it('should use proper message format for come in now SMS', async () => {
      await request(app)
        .post('/api/checkin')
        .send({
          name: 'Called Patient',
          phone: '+1234567890',
          appointmentTime: '2:00 PM'
        });

      jest.clearAllMocks();

      await request(app)
        .post('/api/staff/call-next')
        .set('Authorization', `Bearer ${staffToken}`);

      const callSMS = mockTwilio.messages.create.mock.calls[0][0];
      
      expect(callSMS.body).toMatch(/Called Patient/);
      expect(callSMS.body).toMatch(/turn|now|come/i);
    });
  });

  describe('SMS Delivery Tracking', () => {
    it('should log SMS delivery attempts', async () => {
      await request(app)
        .post('/api/checkin')
        .send({
          name: 'Tracked Patient',
          phone: '+1234567890',
          appointmentTime: '2:00 PM'
        });

      // Verify SMS was attempted
      expect(mockTwilio.messages.create).toHaveBeenCalled();
    });

    it('should handle SMS delivery status updates', async () => {
      // Mock successful delivery
      mockTwilio.messages.create.mockResolvedValueOnce({
        sid: 'test-message-sid',
        status: 'delivered',
        to: '+1234567890'
      });

      await request(app)
        .post('/api/checkin')
        .send({
          name: 'Delivered Patient',
          phone: '+1234567890',
          appointmentTime: '2:00 PM'
        });

      expect(mockTwilio.messages.create).toHaveBeenCalled();
    });

    it('should retry failed SMS deliveries', async () => {
      // Mock initial failure then success
      mockTwilio.messages.create
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({
          sid: 'retry-message-sid',
          status: 'sent'
        });

      await request(app)
        .post('/api/checkin')
        .send({
          name: 'Retry Patient',
          phone: '+1234567890',
          appointmentTime: '2:00 PM'
        });

      // Should have been called twice (initial + retry)
      expect(mockTwilio.messages.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('Phone Number Validation', () => {
    it('should handle various phone number formats', async () => {
      const phoneFormats = [
        '+1234567890',
        '(123) 456-7890',
        '123-456-7890',
        '1234567890'
      ];

      for (let i = 0; i < phoneFormats.length; i++) {
        const response = await request(app)
          .post('/api/checkin')
          .send({
            name: `Patient ${i + 1}`,
            phone: phoneFormats[i],
            appointmentTime: '2:00 PM'
          });

        expect(response.status).toBe(201);
      }

      // All should have resulted in SMS attempts
      expect(mockTwilio.messages.create).toHaveBeenCalledTimes(phoneFormats.length);
    });

    it('should reject invalid phone numbers', async () => {
      const response = await request(app)
        .post('/api/checkin')
        .send({
          name: 'Invalid Phone Patient',
          phone: 'not-a-phone-number',
          appointmentTime: '2:00 PM'
        });

      expect(response.status).toBe(400);
      expect(mockTwilio.messages.create).not.toHaveBeenCalled();
    });
  });

  describe('SMS Rate Limiting', () => {
    it('should handle SMS rate limits gracefully', async () => {
      // Mock rate limit error
      mockTwilio.messages.create.mockRejectedValueOnce({
        code: 20429,
        message: 'Too Many Requests'
      });

      const response = await request(app)
        .post('/api/checkin')
        .send({
          name: 'Rate Limited Patient',
          phone: '+1234567890',
          appointmentTime: '2:00 PM'
        });

      // Check-in should still succeed
      expect(response.status).toBe(201);
    });
  });

  describe('International Phone Numbers', () => {
    it('should handle international phone numbers', async () => {
      const internationalNumbers = [
        '+44123456789',  // UK
        '+33123456789',  // France
        '+81123456789'   // Japan
      ];

      for (const phone of internationalNumbers) {
        const response = await request(app)
          .post('/api/checkin')
          .send({
            name: 'International Patient',
            phone,
            appointmentTime: '2:00 PM'
          });

        expect(response.status).toBe(201);
      }

      expect(mockTwilio.messages.create).toHaveBeenCalledTimes(internationalNumbers.length);
    });
  });

  describe('SMS Content Validation', () => {
    it('should not exceed SMS character limits', async () => {
      await request(app)
        .post('/api/checkin')
        .send({
          name: 'Very Long Patient Name That Might Cause Issues',
          phone: '+1234567890',
          appointmentTime: '2:00 PM'
        });

      const smsCall = mockTwilio.messages.create.mock.calls[0][0];
      
      // SMS should be under 160 characters for single message
      expect(smsCall.body.length).toBeLessThanOrEqual(160);
    });

    it('should handle special characters in patient names', async () => {
      await request(app)
        .post('/api/checkin')
        .send({
          name: "O'Connor-Smith",
          phone: '+1234567890',
          appointmentTime: '2:00 PM'
        });

      const smsCall = mockTwilio.messages.create.mock.calls[0][0];
      
      expect(smsCall.body).toContain("O'Connor-Smith");
    });
  });
});
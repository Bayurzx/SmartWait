import { NotificationService } from '../services/notification-service';

// Mock Twilio config to avoid validation errors
jest.mock('../config/twilio', () => ({
  twilioClient: null, // Use null to simulate placeholder credentials
  twilioConfig: {
    phoneNumber: '+1234567890'
  }
}));

// Mock Prisma
jest.mock('../config/database', () => ({
  prisma: {
    smsNotification: {
      create: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
  },
}));

// Get the mocked prisma instance
const { prisma } = require('../config/database');

describe('SMS Retry Functionality', () => {
  let notificationService: NotificationService;

  beforeEach(() => {
    notificationService = new NotificationService();
    jest.clearAllMocks();
    
    // Mock database operations
    (prisma.smsNotification.create as jest.Mock).mockResolvedValue({});
    (prisma.smsNotification.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.smsNotification.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.smsNotification.groupBy as jest.Mock).mockResolvedValue([]);
  });

  describe('SMS Templates', () => {
    it('should use consistent check-in confirmation template', async () => {
      const result = await notificationService.sendCheckInConfirmation(
        'John Doe', 
        '+1234567890', 
        5, 
        75, 
        'patient-1'
      );

      expect(result.status).toBe('sent');
      expect(result.messageId).toContain('mock-message-id');
      expect(prisma.smsNotification.create).toHaveBeenCalledWith({
        data: {
          patientId: 'patient-1',
          phoneNumber: '+1234567890',
          message: 'Hello John Doe! You\'re checked in at position 5. Estimated wait: 75 minutes. We\'ll text you when it\'s almost your turn.',
          status: 'sent',
          twilioSid: expect.any(String)
        }
      });
    });

    it('should use consistent get ready template', async () => {
      const result = await notificationService.sendGetReadySMS(
        'Jane Smith', 
        '+1555123456', 
        'patient-2'
      );

      expect(result.status).toBe('sent');
      expect(prisma.smsNotification.create).toHaveBeenCalledWith({
        data: {
          patientId: 'patient-2',
          phoneNumber: '+1555123456',
          message: 'Jane Smith, you\'re next! Please head to the facility now. We\'ll call you in about 15 minutes.',
          status: 'sent',
          twilioSid: expect.any(String)
        }
      });
    });

    it('should use consistent call now template', async () => {
      const result = await notificationService.sendCallNowSMS(
        'Bob Johnson', 
        '+1777888999', 
        'patient-3'
      );

      expect(result.status).toBe('sent');
      expect(prisma.smsNotification.create).toHaveBeenCalledWith({
        data: {
          patientId: 'patient-3',
          phoneNumber: '+1777888999',
          message: 'Bob Johnson, it\'s your turn! Please come to the front desk now.',
          status: 'sent',
          twilioSid: expect.any(String)
        }
      });
    });
  });

  describe('Retry Logic', () => {
    it('should include retry count in SMS result', async () => {
      const result = await notificationService.sendSMS('+1234567890', 'Test message', 'patient-1');

      expect(result.status).toBe('sent');
      expect(result.retryCount).toBe(0); // No retries needed with mock credentials
      expect(result.messageId).toContain('mock-message-id');
    });

    it('should determine retryable vs non-retryable errors correctly', async () => {
      // Test shouldRetryError method (private, so we'll test indirectly)
      const shouldRetryError = (notificationService as any).shouldRetryError;

      // Retryable errors
      expect(shouldRetryError(new Error('network timeout'))).toBe(true);
      expect(shouldRetryError(new Error('service unavailable'))).toBe(true);
      expect(shouldRetryError(new Error('rate limit exceeded'))).toBe(true);

      // Non-retryable errors
      expect(shouldRetryError(new Error('invalid phone number'))).toBe(false);
      expect(shouldRetryError(new Error('message too long'))).toBe(false);
      expect(shouldRetryError(new Error('invalid credentials'))).toBe(false);
    });

    it('should calculate exponential backoff delay correctly', async () => {
      const calculateRetryDelay = (notificationService as any).calculateRetryDelay;
      
      const retryConfig = {
        maxRetries: 3,
        baseDelayMs: 1000,
        maxDelayMs: 30000,
        backoffMultiplier: 2
      };

      const delay0 = calculateRetryDelay(0, retryConfig);
      const delay1 = calculateRetryDelay(1, retryConfig);
      const delay2 = calculateRetryDelay(2, retryConfig);

      // First attempt should be around 1000ms (base delay)
      expect(delay0).toBeGreaterThanOrEqual(1000);
      expect(delay0).toBeLessThanOrEqual(1100); // With 10% jitter

      // Second attempt should be around 2000ms
      expect(delay1).toBeGreaterThanOrEqual(2000);
      expect(delay1).toBeLessThanOrEqual(2200);

      // Third attempt should be around 4000ms
      expect(delay2).toBeGreaterThanOrEqual(4000);
      expect(delay2).toBeLessThanOrEqual(4400);
    });
  });

  describe('Delivery Tracking', () => {
    it('should get SMS delivery statistics', async () => {
      // Mock database group by response
      (prisma.smsNotification.groupBy as jest.Mock).mockResolvedValue([
        { status: 'delivered', _count: { status: 7 } },
        { status: 'sent', _count: { status: 2 } },
        { status: 'failed', _count: { status: 1 } }
      ]);

      const stats = await notificationService.getSMSDeliveryStats(24);

      expect(stats.total).toBe(10);
      expect(stats.delivered).toBe(7);
      expect(stats.sent).toBe(2);
      expect(stats.failed).toBe(1);
      expect(stats.deliveryRate).toBe(70);
      expect(stats.failureRate).toBe(10);
    });

    it('should get pending SMS for status updates', async () => {
      // Mock database response for pending messages
      (prisma.smsNotification.findMany as jest.Mock).mockResolvedValue([
        { twilioSid: 'msg-1' },
        { twilioSid: 'msg-2' },
        { twilioSid: null }, // This should be filtered out
        { twilioSid: 'msg-3' }
      ]);

      const pendingSids = await notificationService.getPendingSMSForStatusUpdate(60);

      expect(pendingSids).toEqual(['msg-1', 'msg-2', 'msg-3']);
      expect(prisma.smsNotification.findMany).toHaveBeenCalledWith({
        where: {
          status: { in: ['pending', 'sent'] },
          twilioSid: { not: null },
          sentAt: { gte: expect.any(Date) }
        },
        select: { twilioSid: true }
      });
    });

    it('should handle delivery status updates', async () => {
      // Mock successful delivery status update
      const deliveryStatus = await notificationService.getDeliveryStatus('test-message-id');

      expect(deliveryStatus.messageId).toBe('test-message-id');
      expect(deliveryStatus.status).toBe('delivered'); // Mock status for development
    });
  });

  describe('Error Handling', () => {
    it('should handle database logging failures gracefully', async () => {
      // Mock database error
      (prisma.smsNotification.create as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Should not throw error, just log it
      const result = await notificationService.sendSMS('+1234567890', 'Test message', 'patient-1');

      expect(result.status).toBe('sent'); // Still succeeds with mock credentials
      expect(result.messageId).toContain('mock-message-id');
    });

    it('should validate phone number format', () => {
      expect(notificationService.validatePhoneNumber('+1234567890')).toBe(true);
      expect(notificationService.validatePhoneNumber('1234567890')).toBe(true);
      expect(notificationService.validatePhoneNumber('invalid')).toBe(false);
      expect(notificationService.validatePhoneNumber('')).toBe(false);
    });

    it('should format phone numbers correctly', () => {
      const formatPhoneNumber = (notificationService as any).formatPhoneNumber;

      expect(formatPhoneNumber('1234567890')).toBe('+11234567890');
      expect(formatPhoneNumber('11234567890')).toBe('+11234567890');
      expect(formatPhoneNumber('+11234567890')).toBe('+11234567890');
    });
  });
});
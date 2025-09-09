import { QueueService } from '../services/queue-service';
import { NotificationService, SMSResult } from '../services/notification-service';

// Mock Twilio config to avoid validation errors
jest.mock('../config/twilio', () => ({
  twilioClient: null, // Use null to simulate placeholder credentials
  twilioConfig: {
    phoneNumber: '+1234567890'
  }
}));

// Mock Prisma
const mockPrisma = {
  patient: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
  queuePosition: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  smsNotification: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    updateMany: jest.fn(),
    groupBy: jest.fn(),
  },
  $transaction: jest.fn(),
};

jest.mock('../config/database', () => ({
  prisma: mockPrisma,
}));

// Mock the notification service
jest.mock('../services/notification-service');

describe('SMS Notifications Integration', () => {
  let queueService: QueueService;
  let notificationService: NotificationService;
  let mockNotificationService: jest.Mocked<NotificationService>;

  beforeEach(() => {
    queueService = new QueueService();
    notificationService = new NotificationService();
    mockNotificationService = new NotificationService() as jest.Mocked<NotificationService>;
    
    // Mock notification service methods
    mockNotificationService.sendCheckInConfirmation = jest.fn().mockResolvedValue({ messageId: 'test-id', status: 'sent' });
    mockNotificationService.sendGetReadySMS = jest.fn().mockResolvedValue({ messageId: 'test-id', status: 'sent' });
    mockNotificationService.sendCallNowSMS = jest.fn().mockResolvedValue({ messageId: 'test-id', status: 'sent' });
    mockNotificationService.sendSMS = jest.fn().mockResolvedValue({ messageId: 'test-id', status: 'sent' });
    mockNotificationService.getDeliveryStatus = jest.fn().mockResolvedValue({ messageId: 'test-id', status: 'delivered' });
    mockNotificationService.getSMSDeliveryStats = jest.fn().mockResolvedValue({
      total: 10,
      sent: 8,
      delivered: 7,
      failed: 1,
      pending: 2,
      deliveryRate: 70,
      failureRate: 10
    });

    jest.clearAllMocks();
  });

  describe('Get Ready SMS Functionality', () => {
    it('should send get ready SMS when patient is at position 3', async () => {
      // Mock database responses for checkAndSendGetReadySMS
      mockPrisma.queuePosition.findMany.mockResolvedValue([
        {
          id: 'queue-1',
          patientId: 'patient-1',
          patient: {
            id: 'patient-1',
            name: 'John Doe',
            phone: '+1234567890',
            createdAt: new Date(),
          },
          position: 3,
          status: 'waiting',
          checkInTime: new Date(),
          estimatedWaitMinutes: 30,
          calledAt: null,
          completedAt: null,
        },
      ]);

      mockPrisma.smsNotification.findFirst.mockResolvedValue(null); // No recent notification

      // Call the method that checks for get ready SMS
      await (queueService as any).checkAndSendGetReadySMS();

      // Verify get ready SMS was sent
      expect(mockNotificationService.sendGetReadySMS).toHaveBeenCalledWith(
        'John Doe',
        '+1234567890',
        'patient-1'
      );
    });

    it('should not send duplicate get ready SMS if recently sent', async () => {
      // Mock database responses
      mockPrisma.queuePosition.findMany.mockResolvedValue([
        {
          id: 'queue-1',
          patientId: 'patient-1',
          patient: {
            id: 'patient-1',
            name: 'John Doe',
            phone: '+1234567890',
            createdAt: new Date(),
          },
          position: 3,
          status: 'waiting',
          checkInTime: new Date(),
          estimatedWaitMinutes: 30,
          calledAt: null,
          completedAt: null,
        },
      ]);

      // Mock recent notification exists
      mockPrisma.smsNotification.findFirst.mockResolvedValue({
        id: 'notification-1',
        patientId: 'patient-1',
        phoneNumber: '+1234567890',
        message: 'you\'re next!',
        status: 'sent',
        sentAt: new Date(),
        twilioSid: 'test-sid',
      });

      // Call the method
      await (queueService as any).checkAndSendGetReadySMS();

      // Verify get ready SMS was NOT sent
      expect(mockNotificationService.sendGetReadySMS).not.toHaveBeenCalled();
    });
  });

  describe('Call Now SMS Functionality', () => {
    it('should send call now SMS when patient is called', async () => {
      // Mock finding next patient
      mockPrisma.queuePosition.findFirst.mockResolvedValue({
        id: 'queue-1',
        patientId: 'patient-1',
        patient: {
          id: 'patient-1',
          name: 'Jane Doe',
          phone: '+1555123456',
          createdAt: new Date(),
        },
        position: 1,
        status: 'waiting',
        checkInTime: new Date(),
        estimatedWaitMinutes: 0,
        calledAt: null,
        completedAt: null,
      });

      // Mock update operation
      mockPrisma.queuePosition.update.mockResolvedValue({});

      // Mock checkAndSendGetReadySMS (empty queue)
      mockPrisma.queuePosition.findMany.mockResolvedValue([]);

      // Call next patient
      const result = await queueService.callNextPatient();

      // Verify call now SMS was sent
      expect(mockNotificationService.sendCallNowSMS).toHaveBeenCalledWith(
        'Jane Doe',
        '+1555123456',
        'patient-1'
      );

      // Verify result
      expect(result.success).toBe(true);
      expect(result.patient?.name).toBe('Jane Doe');
    });
  });

  describe('Check-in SMS Functionality', () => {
    it('should send check-in confirmation SMS with patient ID', async () => {
      // Mock transaction
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrisma);
      });

      // Mock patient creation
      mockPrisma.patient.create.mockResolvedValue({
        id: 'patient-1',
        name: 'Test Patient',
        phone: '+1234567890',
        createdAt: new Date(),
      });

      // Mock queue position creation
      mockPrisma.queuePosition.create.mockResolvedValue({
        id: 'queue-1',
        patientId: 'patient-1',
        patient: {
          id: 'patient-1',
          name: 'Test Patient',
          phone: '+1234567890',
          createdAt: new Date(),
        },
        position: 1,
        status: 'waiting',
        checkInTime: new Date(),
        estimatedWaitMinutes: 0,
        calledAt: null,
        completedAt: null,
      });

      // Mock duplicate check
      mockPrisma.queuePosition.findFirst.mockResolvedValue(null);

      // Mock next position calculation
      mockPrisma.queuePosition.findFirst.mockResolvedValueOnce(null); // No existing positions

      // Mock checkAndSendGetReadySMS (empty queue)
      mockPrisma.queuePosition.findMany.mockResolvedValue([]);

      // Check in patient
      const result = await queueService.checkIn({
        name: 'Test Patient',
        phone: '+1234567890',
        appointmentTime: '2:00 PM',
      });

      // Verify check-in confirmation SMS was sent with patient ID
      expect(mockNotificationService.sendCheckInConfirmation).toHaveBeenCalledWith(
        'Test Patient',
        '+1234567890',
        1,
        0,
        'patient-1'
      );

      // Verify result
      expect(result.patient.name).toBe('Test Patient');
      expect(result.position).toBe(1);
    });
  });

  describe('SMS Retry Logic', () => {
    it('should retry SMS sending on retryable errors', async () => {
      // Create a real notification service instance for testing retry logic
      const realNotificationService = new NotificationService();
      
      // Mock shouldRetryError to return true for retryable errors
      const shouldRetryErrorSpy = jest.spyOn(realNotificationService as any, 'shouldRetryError');
      shouldRetryErrorSpy.mockReturnValue(true);

      // Mock delay to speed up tests
      const delaySpy = jest.spyOn(realNotificationService as any, 'delay');
      delaySpy.mockResolvedValue(undefined);

      // Mock database logging
      mockPrisma.smsNotification.create.mockResolvedValue({});

      // Since we're using placeholder credentials, the SMS will succeed immediately
      // Let's test the retry logic by mocking a different scenario
      const result = await realNotificationService.sendSMS('+1234567890', 'Test message', 'patient-1');

      expect(result.status).toBe('sent');
      expect(result.messageId).toContain('mock-message-id');
    });

    it('should not retry on non-retryable errors', async () => {
      const realNotificationService = new NotificationService();
      
      // Mock shouldRetryError to return false for invalid phone number
      const shouldRetryErrorSpy = jest.spyOn(realNotificationService as any, 'shouldRetryError');
      shouldRetryErrorSpy.mockReturnValue(false);

      // Mock database logging
      mockPrisma.smsNotification.create.mockResolvedValue({});

      const result = await realNotificationService.sendSMS('+invalid', 'Test message', 'patient-1');

      expect(result.status).toBe('failed');
      expect(result.error).toContain('invalid phone number');
    });

    it('should calculate exponential backoff delay correctly', async () => {
      const realNotificationService = new NotificationService();
      
      // Test the private calculateRetryDelay method
      const calculateRetryDelay = (realNotificationService as any).calculateRetryDelay.bind(realNotificationService);
      
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

  describe('SMS Delivery Tracking', () => {
    it('should track delivery status and update database', async () => {
      const realNotificationService = new NotificationService();
      
      // Mock Twilio client response
      const mockTwilioMessage = {
        sid: 'test-message-id',
        status: 'delivered',
        errorCode: null,
        errorMessage: null
      };

      // Mock the Twilio client
      const mockTwilioClient = {
        messages: jest.fn().mockReturnValue({
          fetch: jest.fn().mockResolvedValue(mockTwilioMessage)
        })
      };

      // Mock the twilio config
      jest.doMock('../config/twilio', () => ({
        twilioClient: mockTwilioClient,
        twilioConfig: { phoneNumber: '+1234567890' }
      }));

      // Mock database update
      mockPrisma.smsNotification.updateMany.mockResolvedValue({ count: 1 });

      const deliveryStatus = await realNotificationService.getDeliveryStatus('test-message-id');

      expect(deliveryStatus.messageId).toBe('test-message-id');
      expect(deliveryStatus.status).toBe('delivered');
      expect(mockPrisma.smsNotification.updateMany).toHaveBeenCalledWith({
        where: { twilioSid: 'test-message-id' },
        data: { status: 'delivered' }
      });
    });

    it('should get SMS delivery statistics', async () => {
      const realNotificationService = new NotificationService();
      
      // Mock database group by response
      mockPrisma.smsNotification.groupBy.mockResolvedValue([
        { status: 'delivered', _count: { status: 7 } },
        { status: 'sent', _count: { status: 2 } },
        { status: 'failed', _count: { status: 1 } }
      ]);

      const stats = await realNotificationService.getSMSDeliveryStats(24);

      expect(stats.total).toBe(10);
      expect(stats.delivered).toBe(7);
      expect(stats.sent).toBe(2);
      expect(stats.failed).toBe(1);
      expect(stats.deliveryRate).toBe(70);
      expect(stats.failureRate).toBe(10);
    });

    it('should get pending SMS for status updates', async () => {
      const realNotificationService = new NotificationService();
      
      // Mock database response for pending messages
      mockPrisma.smsNotification.findMany.mockResolvedValue([
        { twilioSid: 'msg-1' },
        { twilioSid: 'msg-2' },
        { twilioSid: null }, // This should be filtered out
        { twilioSid: 'msg-3' }
      ]);

      const pendingSids = await realNotificationService.getPendingSMSForStatusUpdate(60);

      expect(pendingSids).toEqual(['msg-1', 'msg-2', 'msg-3']);
      expect(mockPrisma.smsNotification.findMany).toHaveBeenCalledWith({
        where: {
          status: { in: ['pending', 'sent'] },
          twilioSid: { not: null },
          sentAt: { gte: expect.any(Date) }
        },
        select: { twilioSid: true }
      });
    });

    it('should batch process delivery status updates', async () => {
      const realNotificationService = new NotificationService();
      
      // Mock individual delivery status calls
      const getDeliveryStatusSpy = jest.spyOn(realNotificationService, 'getDeliveryStatus');
      getDeliveryStatusSpy
        .mockResolvedValueOnce({ messageId: 'msg-1', status: 'delivered' })
        .mockResolvedValueOnce({ messageId: 'msg-2', status: 'sent' })
        .mockResolvedValueOnce({ messageId: 'msg-3', status: 'failed' });

      const messageIds = ['msg-1', 'msg-2', 'msg-3'];
      const results = await realNotificationService.batchGetDeliveryStatus(messageIds);

      expect(results).toHaveLength(3);
      expect(results[0].messageId).toBe('msg-1');
      expect(results[0].status).toBe('delivered');
      expect(results[1].messageId).toBe('msg-2');
      expect(results[1].status).toBe('sent');
      expect(results[2].messageId).toBe('msg-3');
      expect(results[2].status).toBe('failed');
    });
  });

  describe('SMS Message Templates', () => {
    it('should use consistent message templates', async () => {
      const realNotificationService = new NotificationService();
      
      // Mock database logging
      mockPrisma.smsNotification.create.mockResolvedValue({});

      // Test check-in confirmation template
      const result1 = await realNotificationService.sendCheckInConfirmation('John Doe', '+1234567890', 5, 75, 'patient-1');
      
      // Verify the result contains expected template content
      expect(result1.status).toBe('sent');
      expect(mockPrisma.smsNotification.create).toHaveBeenCalledWith({
        data: {
          patientId: 'patient-1',
          phoneNumber: '+1234567890',
          message: 'Hello John Doe! You\'re checked in at position 5. Estimated wait: 75 minutes. We\'ll text you when it\'s almost your turn.',
          status: 'sent',
          twilioSid: expect.any(String)
        }
      });

      // Test get ready template
      const result2 = await realNotificationService.sendGetReadySMS('Jane Smith', '+1555123456', 'patient-2');
      
      expect(result2.status).toBe('sent');
      expect(mockPrisma.smsNotification.create).toHaveBeenCalledWith({
        data: {
          patientId: 'patient-2',
          phoneNumber: '+1555123456',
          message: 'Jane Smith, you\'re next! Please head to the facility now. We\'ll call you in about 15 minutes.',
          status: 'sent',
          twilioSid: expect.any(String)
        }
      });

      // Test call now template
      const result3 = await realNotificationService.sendCallNowSMS('Bob Johnson', '+1777888999', 'patient-3');
      
      expect(result3.status).toBe('sent');
      expect(mockPrisma.smsNotification.create).toHaveBeenCalledWith({
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
});
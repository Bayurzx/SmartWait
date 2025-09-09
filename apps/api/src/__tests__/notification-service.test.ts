import { NotificationService } from '../services/notification-service';
import { twilioClient } from '../config/twilio';

// Mock Twilio client
jest.mock('../config/twilio', () => ({
  twilioClient: {
    messages: {
      create: jest.fn(),
    }
  },
  twilioConfig: {
    accountSid: 'test_account_sid',
    authToken: 'test_auth_token',
    phoneNumber: '+1234567890'
  }
}));

// Mock Prisma client
jest.mock('../config/database', () => ({
  prisma: {
    smsNotification: {
      create: jest.fn()
    }
  }
}));

describe('NotificationService', () => {
  let notificationService: NotificationService;
  const mockTwilioCreate = twilioClient.messages.create as jest.MockedFunction<typeof twilioClient.messages.create>;

  beforeEach(() => {
    notificationService = new NotificationService();
    jest.clearAllMocks();
  });

  describe('sendSMS', () => {
    it('should send SMS successfully', async () => {
      // Mock successful Twilio response
      mockTwilioCreate.mockResolvedValue({
        sid: 'test_message_sid',
        status: 'sent'
      } as any);

      const result = await notificationService.sendSMS('+1234567890', 'Test message');

      expect(result).toEqual({
        messageId: 'test_message_sid',
        status: 'sent'
      });

      expect(mockTwilioCreate).toHaveBeenCalledWith({
        body: 'Test message',
        from: '+1234567890',
        to: '+11234567890'
      });
    });

    it('should handle SMS sending failure', async () => {
      // Mock Twilio error
      mockTwilioCreate.mockRejectedValue(new Error('Twilio error'));

      const result = await notificationService.sendSMS('+1234567890', 'Test message');

      expect(result).toEqual({
        messageId: '',
        status: 'failed',
        error: 'Twilio error'
      });
    });

    it('should format phone numbers correctly', async () => {
      mockTwilioCreate.mockResolvedValue({
        sid: 'test_message_sid',
        status: 'sent'
      } as any);

      // Test various phone number formats
      await notificationService.sendSMS('1234567890', 'Test message');
      expect(mockTwilioCreate).toHaveBeenCalledWith({
        body: 'Test message',
        from: '+1234567890',
        to: '+11234567890'
      });

      await notificationService.sendSMS('(123) 456-7890', 'Test message');
      expect(mockTwilioCreate).toHaveBeenCalledWith({
        body: 'Test message',
        from: '+1234567890',
        to: '+11234567890'
      });
    });

    it('should reject messages that are too long', async () => {
      const longMessage = 'a'.repeat(1601); // Exceed 1600 character limit

      const result = await notificationService.sendSMS('+1234567890', longMessage);

      expect(result).toEqual({
        messageId: '',
        status: 'failed',
        error: 'Message too long. Maximum 1600 characters allowed.'
      });

      expect(mockTwilioCreate).not.toHaveBeenCalled();
    });
  });

  describe('sendCheckInConfirmation', () => {
    it('should send check-in confirmation with correct message format', async () => {
      mockTwilioCreate.mockResolvedValue({
        sid: 'test_message_sid',
        status: 'sent'
      } as any);

      const result = await notificationService.sendCheckInConfirmation(
        'John Doe',
        '+1234567890',
        5,
        25,
        'test-patient-id'
      );

      expect(result.status).toBe('sent');
      expect(mockTwilioCreate).toHaveBeenCalledWith({
        body: "Hello John Doe! You're checked in at position 5. Estimated wait: 25 minutes. We'll text you when it's almost your turn.",
        from: '+1234567890',
        to: '+11234567890'
      });
    });
  });

  describe('sendGetReadySMS', () => {
    it('should send get ready SMS with correct message format', async () => {
      mockTwilioCreate.mockResolvedValue({
        sid: 'test_message_sid',
        status: 'sent'
      } as any);

      const result = await notificationService.sendGetReadySMS('John Doe', '+1234567890', 'test-patient-id');

      expect(result.status).toBe('sent');
      expect(mockTwilioCreate).toHaveBeenCalledWith({
        body: "John Doe, you're next! Please head to the facility now. We'll call you in about 15 minutes.",
        from: '+1234567890',
        to: '+11234567890'
      });
    });
  });

  describe('sendCallNowSMS', () => {
    it('should send call now SMS with correct message format', async () => {
      mockTwilioCreate.mockResolvedValue({
        sid: 'test_message_sid',
        status: 'sent'
      } as any);

      const result = await notificationService.sendCallNowSMS('John Doe', '+1234567890', 'test-patient-id');

      expect(result.status).toBe('sent');
      expect(mockTwilioCreate).toHaveBeenCalledWith({
        body: "John Doe, it's your turn! Please come to the front desk now.",
        from: '+1234567890',
        to: '+11234567890'
      });
    });
  });

  describe('validatePhoneNumber', () => {
    it('should validate US phone numbers correctly', () => {
      expect(notificationService.validatePhoneNumber('+12345678901')).toBe(true);
      expect(notificationService.validatePhoneNumber('2345678901')).toBe(true);
      expect(notificationService.validatePhoneNumber('(234) 567-8901')).toBe(true);
      
      // Invalid numbers
      expect(notificationService.validatePhoneNumber('1234567890')).toBe(false); // Starts with 1
      expect(notificationService.validatePhoneNumber('0234567890')).toBe(false); // Starts with 0
      expect(notificationService.validatePhoneNumber('234567890')).toBe(false);  // Too short
    });
  });
});
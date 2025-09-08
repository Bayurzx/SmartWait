import { twilioClient, twilioConfig } from '../config/twilio';
import { MessageInstance } from 'twilio/lib/rest/api/v2010/account/message';

// SMS result interface
export interface SMSResult {
  messageId: string;
  status: 'sent' | 'failed';
  error?: string;
}

// SMS delivery status interface
export interface DeliveryStatus {
  messageId: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'undelivered';
  errorCode?: string;
  errorMessage?: string;
}

// Notification service class
export class NotificationService {
  /**
   * Send SMS message using Twilio
   * @param phoneNumber - Recipient phone number (E.164 format recommended)
   * @param message - SMS message content
   * @returns Promise<SMSResult>
   */
  async sendSMS(phoneNumber: string, message: string): Promise<SMSResult> {
    try {
      // Check if Twilio client is available (not using placeholder credentials)
      if (!twilioClient) {
        console.warn('⚠️  Twilio client not available. Using placeholder credentials. SMS not sent.');
        return {
          messageId: 'mock-message-id-' + Date.now(),
          status: 'sent', // Return success for development
          error: 'Using placeholder Twilio credentials - SMS not actually sent'
        };
      }

      // Validate phone number format
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      
      // Validate message length (SMS limit is 160 characters for single message)
      if (message.length > 1600) { // Twilio supports up to 1600 chars for concatenated messages
        throw new Error('Message too long. Maximum 1600 characters allowed.');
      }

      // Send SMS via Twilio
      const messageInstance: MessageInstance = await twilioClient.messages.create({
        body: message,
        from: twilioConfig.phoneNumber,
        to: formattedPhone
      });

      return {
        messageId: messageInstance.sid,
        status: 'sent'
      };
    } catch (error) {
      console.error('SMS sending failed:', error);
      
      return {
        messageId: '',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get SMS delivery status from Twilio
   * @param messageId - Twilio message SID
   * @returns Promise<DeliveryStatus>
   */
  async getDeliveryStatus(messageId: string): Promise<DeliveryStatus> {
    try {
      // Check if Twilio client is available
      if (!twilioClient) {
        return {
          messageId,
          status: 'delivered', // Mock status for development
          errorMessage: 'Using placeholder Twilio credentials - status mocked'
        };
      }

      const message = await twilioClient.messages(messageId).fetch();
      
      return {
        messageId: message.sid,
        status: message.status as DeliveryStatus['status'],
        errorCode: message.errorCode?.toString(),
        errorMessage: message.errorMessage || undefined
      };
    } catch (error) {
      console.error('Failed to fetch delivery status:', error);
      
      return {
        messageId,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Send check-in confirmation SMS
   * @param patientName - Patient's name
   * @param phoneNumber - Patient's phone number
   * @param position - Queue position
   * @param estimatedWait - Estimated wait time in minutes
   * @returns Promise<SMSResult>
   */
  async sendCheckInConfirmation(
    patientName: string,
    phoneNumber: string,
    position: number,
    estimatedWait: number
  ): Promise<SMSResult> {
    const message = `Hello ${patientName}! You're checked in at position ${position}. Estimated wait: ${estimatedWait} minutes. We'll text you when it's almost your turn.`;
    return this.sendSMS(phoneNumber, message);
  }

  /**
   * Send "get ready" SMS when patient is 2 positions away
   * @param patientName - Patient's name
   * @param phoneNumber - Patient's phone number
   * @returns Promise<SMSResult>
   */
  async sendGetReadySMS(patientName: string, phoneNumber: string): Promise<SMSResult> {
    const message = `${patientName}, you're next! Please head to the facility now. We'll call you in about 15 minutes.`;
    return this.sendSMS(phoneNumber, message);
  }

  /**
   * Send "come in now" SMS when patient is called
   * @param patientName - Patient's name
   * @param phoneNumber - Patient's phone number
   * @returns Promise<SMSResult>
   */
  async sendCallNowSMS(patientName: string, phoneNumber: string): Promise<SMSResult> {
    const message = `${patientName}, it's your turn! Please come to the front desk now.`;
    return this.sendSMS(phoneNumber, message);
  }

  /**
   * Send follow-up SMS if patient doesn't respond
   * @param patientName - Patient's name
   * @param phoneNumber - Patient's phone number
   * @returns Promise<SMSResult>
   */
  async sendFollowUpSMS(patientName: string, phoneNumber: string): Promise<SMSResult> {
    const message = `${patientName}, this is a reminder that it's your turn. Please come to the front desk immediately or you may lose your place in line.`;
    return this.sendSMS(phoneNumber, message);
  }

  /**
   * Validate and format phone number
   * @param phoneNumber - Raw phone number
   * @returns Formatted phone number
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    const digitsOnly = phoneNumber.replace(/\D/g, '');
    
    // Handle US phone numbers
    if (digitsOnly.length === 10) {
      return `+1${digitsOnly}`;
    }
    
    // Handle international numbers that already include country code
    if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
      return `+${digitsOnly}`;
    }
    
    // If already formatted with +, return as is
    if (phoneNumber.startsWith('+')) {
      return phoneNumber;
    }
    
    // For other cases, assume it needs +1 prefix
    return `+1${digitsOnly}`;
  }

  /**
   * Validate phone number format
   * @param phoneNumber - Phone number to validate
   * @returns boolean indicating if phone number is valid
   */
  validatePhoneNumber(phoneNumber: string): boolean {
    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      
      // Basic validation for US phone numbers in E.164 format
      const phoneRegex = /^\+1[2-9]\d{2}[2-9]\d{2}\d{4}$/;
      return phoneRegex.test(formattedPhone);
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();

export default NotificationService;
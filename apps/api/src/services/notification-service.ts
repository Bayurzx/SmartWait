import { twilioClient, twilioConfig } from '../config/twilio';
import { MessageInstance } from 'twilio/lib/rest/api/v2010/account/message';
import { prisma } from '../config/database';

// SMS result interface
export interface SMSResult {
  messageId: string;
  status: 'sent' | 'failed';
  error?: string;
  retryCount?: number;
}

// SMS delivery status interface
export interface DeliveryStatus {
  messageId: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'undelivered';
  errorCode?: string;
  errorMessage?: string;
}

// SMS retry configuration
interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

// SMS message template interface
interface SMSTemplate {
  checkInConfirmation: (name: string, position: number, waitTime: number) => string;
  getReady: (name: string) => string;
  callNow: (name: string) => string;
  followUp: (name: string) => string;
}

// Notification service class
export class NotificationService {
  private static readonly DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    baseDelayMs: 1000, // 1 second
    maxDelayMs: 30000, // 30 seconds
    backoffMultiplier: 2
  };

  // SMS message templates with consistent formatting
  private static readonly SMS_TEMPLATES: SMSTemplate = {
    checkInConfirmation: (name: string, position: number, waitTime: number) => 
      `Hello ${name}! You're checked in at position ${position}. Estimated wait: ${waitTime} minutes. We'll text you when it's almost your turn.`,
    
    getReady: (name: string) => 
      `${name}, you're next! Please head to the facility now. We'll call you in about 15 minutes.`,
    
    callNow: (name: string) => 
      `${name}, it's your turn! Please come to the front desk now.`,
    
    followUp: (name: string) => 
      `${name}, this is a reminder that it's your turn. Please come to the front desk immediately or you may lose your place in line.`
  };
  /**
   * Send SMS message using Twilio with retry logic
   * @param phoneNumber - Recipient phone number (E.164 format recommended)
   * @param message - SMS message content
   * @param patientId - Optional patient ID for logging
   * @param retryConfig - Optional retry configuration
   * @returns Promise<SMSResult>
   */
  async sendSMS(
    phoneNumber: string, 
    message: string, 
    patientId?: string,
    retryConfig: RetryConfig = NotificationService.DEFAULT_RETRY_CONFIG
  ): Promise<SMSResult> {
    return this.sendSMSWithRetry(phoneNumber, message, patientId, retryConfig, 0);
  }

  /**
   * Internal method to send SMS with retry logic
   * @param phoneNumber - Recipient phone number
   * @param message - SMS message content
   * @param patientId - Optional patient ID for logging
   * @param retryConfig - Retry configuration
   * @param currentAttempt - Current retry attempt (0-based)
   * @returns Promise<SMSResult>
   */
  private async sendSMSWithRetry(
    phoneNumber: string,
    message: string,
    patientId: string | undefined,
    retryConfig: RetryConfig,
    currentAttempt: number
  ): Promise<SMSResult> {
    try {
      // Check if Twilio client is available (not using placeholder credentials)
      if (!twilioClient) {
        console.warn('⚠️  Twilio client not available. Using placeholder credentials. SMS not sent.');
        
        // Log to database even for mock messages
        if (patientId) {
          await this.logSMSNotification(patientId, phoneNumber, message, 'sent', 'mock-message-id-' + Date.now());
        }
        
        return {
          messageId: 'mock-message-id-' + Date.now(),
          status: 'sent', // Return success for development
          error: 'Using placeholder Twilio credentials - SMS not actually sent',
          retryCount: currentAttempt
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

      // Log successful SMS to database
      if (patientId) {
        await this.logSMSNotification(patientId, formattedPhone, message, 'sent', messageInstance.sid);
      }

      console.log(`✅ SMS sent successfully to ${formattedPhone} (attempt ${currentAttempt + 1})`);

      return {
        messageId: messageInstance.sid,
        status: 'sent',
        retryCount: currentAttempt
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`❌ SMS sending failed (attempt ${currentAttempt + 1}):`, errorMessage);
      
      // Check if we should retry
      if (currentAttempt < retryConfig.maxRetries && this.shouldRetryError(error)) {
        const delay = this.calculateRetryDelay(currentAttempt, retryConfig);
        console.log(`⏳ Retrying SMS in ${delay}ms (attempt ${currentAttempt + 2}/${retryConfig.maxRetries + 1})`);
        
        // Wait before retrying
        await this.delay(delay);
        
        // Recursive retry
        return this.sendSMSWithRetry(phoneNumber, message, patientId, retryConfig, currentAttempt + 1);
      }
      
      // All retries exhausted or non-retryable error
      console.error(`💥 SMS sending failed after ${currentAttempt + 1} attempts`);
      
      // Log failed SMS to database
      if (patientId) {
        await this.logSMSNotification(patientId, phoneNumber, message, 'failed');
      }
      
      return {
        messageId: '',
        status: 'failed',
        error: errorMessage,
        retryCount: currentAttempt
      };
    }
  }

  /**
   * Get SMS delivery status from Twilio and update database
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
      
      const deliveryStatus: DeliveryStatus = {
        messageId: message.sid,
        status: message.status as DeliveryStatus['status'],
        errorCode: message.errorCode?.toString(),
        errorMessage: message.errorMessage || undefined
      };

      // Update database with delivery status
      await this.updateSMSDeliveryStatus(messageId, deliveryStatus.status, deliveryStatus.errorCode, deliveryStatus.errorMessage);
      
      return deliveryStatus;
    } catch (error) {
      console.error('Failed to fetch delivery status:', error);
      
      const failedStatus: DeliveryStatus = {
        messageId,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error occurred'
      };

      // Update database with failed status
      await this.updateSMSDeliveryStatus(messageId, 'failed', undefined, failedStatus.errorMessage);
      
      return failedStatus;
    }
  }

  /**
   * Batch update delivery statuses for multiple messages
   * @param messageIds - Array of Twilio message SIDs
   * @returns Promise<DeliveryStatus[]>
   */
  async batchGetDeliveryStatus(messageIds: string[]): Promise<DeliveryStatus[]> {
    const results: DeliveryStatus[] = [];
    
    // Process in batches to avoid rate limiting
    const batchSize = 10;
    for (let i = 0; i < messageIds.length; i += batchSize) {
      const batch = messageIds.slice(i, i + batchSize);
      const batchPromises = batch.map(messageId => this.getDeliveryStatus(messageId));
      
      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      } catch (error) {
        console.error(`Failed to process batch ${i / batchSize + 1}:`, error);
        // Continue with next batch
      }
      
      // Add small delay between batches to respect rate limits
      if (i + batchSize < messageIds.length) {
        await this.delay(100); // 100ms delay between batches
      }
    }
    
    return results;
  }

  /**
   * Get pending SMS notifications that need delivery status updates
   * @param maxAge - Maximum age in minutes for pending messages (default: 60)
   * @returns Promise<string[]> - Array of Twilio SIDs
   */
  async getPendingSMSForStatusUpdate(maxAge: number = 60): Promise<string[]> {
    try {
      const cutoffTime = new Date(Date.now() - maxAge * 60 * 1000);
      
      const pendingMessages = await prisma.smsNotification.findMany({
        where: {
          status: {
            in: ['pending', 'sent']
          },
          twilioSid: {
            not: null
          },
          sentAt: {
            gte: cutoffTime
          }
        },
        select: {
          twilioSid: true
        }
      });

      return pendingMessages
        .map(msg => msg.twilioSid)
        .filter((sid): sid is string => sid !== null);
    } catch (error) {
      console.error('Failed to get pending SMS for status update:', error);
      return [];
    }
  }

  /**
   * Calculate retry delay using exponential backoff with jitter
   * @param attemptNumber - Current attempt number (0-based)
   * @param retryConfig - Retry configuration
   * @returns Delay in milliseconds
   */
  private calculateRetryDelay(attemptNumber: number, retryConfig: RetryConfig): number {
    const exponentialDelay = retryConfig.baseDelayMs * Math.pow(retryConfig.backoffMultiplier, attemptNumber);
    const jitter = Math.random() * 0.1 * exponentialDelay; // Add 10% jitter
    const totalDelay = exponentialDelay + jitter;
    
    return Math.min(totalDelay, retryConfig.maxDelayMs);
  }

  /**
   * Determine if an error should trigger a retry
   * @param error - The error that occurred
   * @returns True if the error is retryable
   */
  private shouldRetryError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const errorMessage = error.message.toLowerCase();
    
    // Retry on network/temporary errors
    const retryableErrors = [
      'network',
      'timeout',
      'rate limit',
      'service unavailable',
      'internal server error',
      'bad gateway',
      'gateway timeout',
      'temporarily unavailable'
    ];

    // Don't retry on permanent errors
    const nonRetryableErrors = [
      'invalid phone number',
      'message too long',
      'invalid credentials',
      'account suspended',
      'insufficient funds'
    ];

    // Check for non-retryable errors first
    if (nonRetryableErrors.some(nonRetryable => errorMessage.includes(nonRetryable))) {
      return false;
    }

    // Check for retryable errors
    return retryableErrors.some(retryable => errorMessage.includes(retryable));
  }

  /**
   * Utility method to create a delay
   * @param ms - Milliseconds to delay
   * @returns Promise that resolves after the delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Send check-in confirmation SMS using template
   * @param patientName - Patient's name
   * @param phoneNumber - Patient's phone number
   * @param position - Queue position
   * @param estimatedWait - Estimated wait time in minutes
   * @param patientId - Patient ID for logging
   * @returns Promise<SMSResult>
   */
  async sendCheckInConfirmation(
    patientName: string,
    phoneNumber: string,
    position: number,
    estimatedWait: number,
    patientId?: string
  ): Promise<SMSResult> {
    const message = NotificationService.SMS_TEMPLATES.checkInConfirmation(patientName, position, estimatedWait);
    return this.sendSMS(phoneNumber, message, patientId);
  }

  /**
   * Send "get ready" SMS when patient is 2 positions away using template
   * @param patientName - Patient's name
   * @param phoneNumber - Patient's phone number
   * @param patientId - Patient ID for logging
   * @returns Promise<SMSResult>
   */
  async sendGetReadySMS(patientName: string, phoneNumber: string, patientId?: string): Promise<SMSResult> {
    const message = NotificationService.SMS_TEMPLATES.getReady(patientName);
    return this.sendSMS(phoneNumber, message, patientId);
  }

  /**
   * Send "come in now" SMS when patient is called using template
   * @param patientName - Patient's name
   * @param phoneNumber - Patient's phone number
   * @param patientId - Patient ID for logging
   * @returns Promise<SMSResult>
   */
  async sendCallNowSMS(patientName: string, phoneNumber: string, patientId?: string): Promise<SMSResult> {
    const message = NotificationService.SMS_TEMPLATES.callNow(patientName);
    return this.sendSMS(phoneNumber, message, patientId);
  }

  /**
   * Send follow-up SMS if patient doesn't respond using template
   * @param patientName - Patient's name
   * @param phoneNumber - Patient's phone number
   * @param patientId - Patient ID for logging
   * @returns Promise<SMSResult>
   */
  async sendFollowUpSMS(patientName: string, phoneNumber: string, patientId?: string): Promise<SMSResult> {
    const message = NotificationService.SMS_TEMPLATES.followUp(patientName);
    return this.sendSMS(phoneNumber, message, patientId);
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

  /**
   * Log SMS notification to database for tracking and audit purposes
   * @param patientId - Patient ID
   * @param phoneNumber - Phone number
   * @param message - SMS message content
   * @param status - SMS status
   * @param twilioSid - Twilio message SID (optional)
   */
  private async logSMSNotification(
    patientId: string,
    phoneNumber: string,
    message: string,
    status: 'pending' | 'sent' | 'delivered' | 'failed',
    twilioSid?: string
  ): Promise<void> {
    try {
      await prisma.smsNotification.create({
        data: {
          patientId,
          phoneNumber,
          message,
          status,
          twilioSid
        }
      });
    } catch (error) {
      console.error('Failed to log SMS notification:', error);
      // Don't throw error as this is just for logging
    }
  }

  /**
   * Update SMS delivery status in database
   * @param twilioSid - Twilio message SID
   * @param status - Updated delivery status
   * @param errorCode - Error code if failed
   * @param errorMessage - Error message if failed
   */
  private async updateSMSDeliveryStatus(
    twilioSid: string,
    status: 'pending' | 'sent' | 'delivered' | 'failed' | 'queued' | 'undelivered',
    errorCode?: string,
    errorMessage?: string
  ): Promise<void> {
    try {
      // Map Twilio statuses to our database statuses
      let dbStatus: 'pending' | 'sent' | 'delivered' | 'failed';
      
      switch (status) {
        case 'queued':
        case 'pending':
          dbStatus = 'pending';
          break;
        case 'sent':
          dbStatus = 'sent';
          break;
        case 'delivered':
          dbStatus = 'delivered';
          break;
        case 'failed':
        case 'undelivered':
          dbStatus = 'failed';
          break;
        default:
          dbStatus = 'pending';
      }

      await prisma.smsNotification.updateMany({
        where: {
          twilioSid: twilioSid
        },
        data: {
          status: dbStatus
        }
      });

      console.log(`📱 Updated SMS delivery status: ${twilioSid} -> ${dbStatus}`);
    } catch (error) {
      console.error('Failed to update SMS delivery status:', error);
      // Don't throw error as this is just for tracking
    }
  }

  /**
 * Health check for the notification service
 */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      // Test Twilio connection (or your SMS provider)
      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
        return {
          healthy: false,
          message: 'SMS credentials not configured'
        };
      }

      // You could test the Twilio client here if needed
      // const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      // await twilioClient.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();

      return {
        healthy: true,
        message: 'Notification service healthy'
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        healthy: false,
        message: `Notification service error: ${errorMessage}`
      };
    }
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(): Promise<{
    totalSent: number;
    totalFailed: number;
    successRate: number;
  }> {
    try {
      const [totalSent, totalFailed] = await Promise.all([
        prisma.smsNotification.count({
          where: { status: 'sent' }
        }),
        prisma.smsNotification.count({
          where: { status: 'failed' }
        })
      ]);

      const successRate = totalSent + totalFailed > 0
        ? (totalSent / (totalSent + totalFailed)) * 100
        : 100;

      return {
        totalSent,
        totalFailed,
        successRate: Math.round(successRate * 100) / 100
      };
    } catch (error) {
      console.error('Failed to get notification stats:', error);
      return {
        totalSent: 0,
        totalFailed: 0,
        successRate: 0
      };
    }
  }
  /**
   * Get SMS delivery statistics for monitoring
   * @param hours - Number of hours to look back (default: 24)
   * @returns Promise with delivery statistics
   */
  async getSMSDeliveryStats(hours: number = 24): Promise<{
    total: number;
    sent: number;
    delivered: number;
    failed: number;
    pending: number;
    deliveryRate: number;
    failureRate: number;
  }> {
    try {
      const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      
      const stats = await prisma.smsNotification.groupBy({
        by: ['status'],
        where: {
          sentAt: {
            gte: cutoffTime
          }
        },
        _count: {
          status: true
        }
      });

      const totals = {
        total: 0,
        sent: 0,
        delivered: 0,
        failed: 0,
        pending: 0
      };

      stats.forEach(stat => {
        const count = stat._count.status;
        totals.total += count;
        
        switch (stat.status) {
          case 'sent':
            totals.sent += count;
            break;
          case 'delivered':
            totals.delivered += count;
            break;
          case 'failed':
            totals.failed += count;
            break;
          case 'pending':
            totals.pending += count;
            break;
        }
      });

      const deliveryRate = totals.total > 0 ? (totals.delivered / totals.total) * 100 : 0;
      const failureRate = totals.total > 0 ? (totals.failed / totals.total) * 100 : 0;

      return {
        ...totals,
        deliveryRate: Math.round(deliveryRate * 100) / 100,
        failureRate: Math.round(failureRate * 100) / 100
      };
    } catch (error) {
      console.error('Failed to get SMS delivery stats:', error);
      return {
        total: 0,
        sent: 0,
        delivered: 0,
        failed: 0,
        pending: 0,
        deliveryRate: 0,
        failureRate: 0
      };
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();

export default NotificationService;
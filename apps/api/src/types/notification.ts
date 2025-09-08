// SMS notification types
export interface SMSNotification {
  id: string;
  patientId: string;
  phoneNumber: string;
  message: string;
  messageType: NotificationMessageType;
  status: NotificationStatus;
  twilioSid?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  errorMessage?: string;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Notification message types
export enum NotificationMessageType {
  CHECK_IN_CONFIRMATION = 'check_in_confirmation',
  GET_READY = 'get_ready',
  CALL_NOW = 'call_now',
  FOLLOW_UP = 'follow_up',
  APPOINTMENT_REMINDER = 'appointment_reminder',
  QUEUE_UPDATE = 'queue_update'
}

// Notification status
export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

// SMS sending request
export interface SendSMSRequest {
  phoneNumber: string;
  message: string;
  messageType: NotificationMessageType;
  patientId?: string;
  scheduledAt?: Date;
}

// SMS sending response
export interface SendSMSResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  retryAfter?: number;
}

// Notification preferences
export interface NotificationPreferences {
  patientId: string;
  smsEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  phoneNumber?: string;
  email?: string;
  language: string;
  timezone: string;
  quietHoursStart?: string; // HH:MM format
  quietHoursEnd?: string;   // HH:MM format
}

// Bulk notification request
export interface BulkNotificationRequest {
  notifications: SendSMSRequest[];
  batchId?: string;
  scheduledAt?: Date;
}

// Notification template
export interface NotificationTemplate {
  id: string;
  messageType: NotificationMessageType;
  template: string;
  variables: string[];
  language: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Notification analytics
export interface NotificationAnalytics {
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  deliveryRate: number;
  averageDeliveryTime: number;
  failureReasons: Record<string, number>;
  messageTypeBreakdown: Record<NotificationMessageType, number>;
}

// Twilio webhook payload
export interface TwilioWebhookPayload {
  MessageSid: string;
  MessageStatus: string;
  ErrorCode?: string;
  ErrorMessage?: string;
  To: string;
  From: string;
  Body: string;
  NumSegments: string;
  AccountSid: string;
}

// Queue notification data
export interface QueueNotificationData {
  patientId: string;
  patientName: string;
  phoneNumber: string;
  position: number;
  estimatedWait: number;
  queueId: string;
  facilityName?: string;
}

// export default {
//   SMSNotification,
//   NotificationMessageType,
//   NotificationStatus,
//   SendSMSRequest,
//   SendSMSResponse,
//   NotificationPreferences,
//   BulkNotificationRequest,
//   NotificationTemplate,
//   NotificationAnalytics,
//   TwilioWebhookPayload,
//   QueueNotificationData
// };
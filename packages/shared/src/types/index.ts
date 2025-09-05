// Core data types for SmartWait system

export interface Patient {
  id: string;
  name: string;
  phone: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface QueuePosition {
  id: string;
  patientId: string;
  patient?: Patient;
  position: number;
  status: 'waiting' | 'called' | 'completed' | 'no_show';
  checkInTime: Date;
  estimatedWaitMinutes: number;
  calledAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CheckInRequest {
  name: string;
  phone: string;
  appointmentTime: string;
}

export interface CheckInResponse {
  success: boolean;
  data?: {
    patientId: string;
    position: number;
    estimatedWait: number;
  };
  error?: string;
}

export interface QueueStatus {
  patientId: string;
  position: number;
  estimatedWaitMinutes: number;
  status: 'waiting' | 'called' | 'completed' | 'no_show';
  checkInTime: Date;
  totalInQueue: number;
}

export interface QueueUpdate {
  type: 'position_change' | 'patient_called' | 'patient_completed' | 'queue_updated';
  patientId?: string;
  newPosition?: number;
  estimatedWait?: number;
  timestamp: Date;
  data?: any;
}

export interface SMSNotification {
  id: string;
  patientId: string;
  phoneNumber: string;
  message: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  sentAt: Date;
  twilioSid?: string;
  errorMessage?: string;
}

export interface StaffSession {
  id: string;
  username: string;
  sessionToken: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Error types
export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  QUEUE_FULL: 'QUEUE_FULL',
  PATIENT_NOT_FOUND: 'PATIENT_NOT_FOUND',
  DUPLICATE_CHECKIN: 'DUPLICATE_CHECKIN',
  SMS_FAILED: 'SMS_FAILED',
  DATABASE_ERROR: 'DATABASE_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];
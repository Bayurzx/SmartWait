// Core data types for the mobile app

export interface CheckInData {
  name: string;
  phone: string;
  appointmentTime: string;
}

export interface QueuePosition {
  id: string;
  patientId: string;
  position: number;
  status: 'waiting' | 'called' | 'completed' | 'no_show';
  checkInTime: Date;
  estimatedWaitMinutes: number;
  calledAt?: Date;
  completedAt?: Date;
}

export interface Patient {
  id: string;
  name: string;
  phone: string;
  createdAt: Date;
}

export interface CheckInResponse {
  success: boolean;
  data: {
    patientId: string;
    position: number;
    estimatedWait: number;
  };
}

export interface QueueStatus {
  patientId: string;
  position: number;
  estimatedWait: number;
  status: 'waiting' | 'called' | 'completed';
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}
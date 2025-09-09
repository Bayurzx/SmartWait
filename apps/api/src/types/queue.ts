/**
 * Queue-related type definitions for SmartWait API
 */

export interface CheckInRequest {
  name: string;
  phone: string;
  appointmentTime: string;
}

export interface CheckInResponse {
  success: boolean;
  data: {
    patientId: string;
    position: number;
    estimatedWait: number;
  };
}

export interface QueuePosition {
  id: string;
  patientId: string;
  patient: {
    id: string;
    name: string;
    phone: string;
    createdAt: Date;
  };
  position: number;
  status: 'waiting' | 'called' | 'completed' | 'no_show';
  checkInTime: Date;
  estimatedWaitMinutes: number | null;
  calledAt: Date | null;
  completedAt: Date | null;
}

export interface QueueStatus {
  patientId: string;
  position: number;
  status: 'waiting' | 'called' | 'completed' | 'no_show';
  estimatedWaitMinutes: number;
  checkInTime: Date;
  calledAt?: Date;
  completedAt?: Date;
}

export interface QueueUpdate {
  type: 'position_change' | 'patient_called' | 'patient_completed' | 'patient_checked_in' | 'patient_no_show' | 'queue_cleared';
  patientId: string;
  newPosition?: number;
  estimatedWait?: number;
  timestamp: Date;
  reason?: string;
  affectedPatients?: number;
}

export interface PatientCallResult {
  success: boolean;
  patient?: {
    id: string;
    name: string;
    phone: string;
    position: number;
  };
  message: string;
}

export interface QueueStats {
  totalWaiting: number;
  totalCalled: number;
  totalCompleted: number;
  averageWaitTime: number;
  longestWaitTime: number;
}
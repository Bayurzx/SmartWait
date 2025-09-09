// Staff-specific types for the dashboard

export interface StaffCredentials {
  username: string;
  password: string;
}

export interface StaffSession {
  token: string;
  username: string;
  expiresAt: Date;
}

export interface StaffLoginResponse {
  success: boolean;
  data?: {
    token: string;
    username: string;
    expiresAt: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface QueuePatient {
  id: string;
  patientId: string;
  patient: {
    id: string;
    name: string;
    phone: string;
    createdAt: string;
  };
  position: number;
  status: 'waiting' | 'called' | 'completed' | 'no_show';
  checkInTime: string;
  estimatedWaitMinutes: number;
  calledAt?: string;
  completedAt?: string;
}

export interface CallNextPatientResponse {
  success: boolean;
  data?: {
    patient: QueuePatient;
    message: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface CompletePatientResponse {
  success: boolean;
  data?: {
    patientId: string;
    message: string;
  };
  error?: {
    code: string;
    message: string;
  };
}
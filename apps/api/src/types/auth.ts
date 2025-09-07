export interface StaffUser {
  id: string;
  username: string;
  role: 'staff' | 'admin';
}

export interface AuthResult {
  success: boolean;
  data?: {
    token: string;
    user: StaffUser;
    expiresAt: string;
    expiresIn: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface SessionData {
  sessionId: string;
  user: StaffUser;
  expiresAt: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LogoutRequest {
  token?: string;
}
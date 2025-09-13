// Staff API service for authentication and queue management

import { 
  StaffCredentials, 
  StaffLoginResponse, 
  QueuePatient, 
  CallNextPatientResponse, 
  CompletePatientResponse 
} from '../types/staff';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class StaffApiService {
  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('staffToken');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  async login(credentials: StaffCredentials): Promise<StaffLoginResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/staff/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (data.success && data.data?.token) {
        // Store token in localStorage
        localStorage.setItem('staffToken', data.data.token);
        localStorage.setItem('staffUsername', data.data.user.username);
        localStorage.setItem('staffExpiresAt', data.data.expiresAt);
      }

      return data;
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Unable to connect to server. Please try again.',
        },
      };
    }
  }

  async logout(): Promise<void> {
    // Clear stored authentication data
    localStorage.removeItem('staffToken');
    localStorage.removeItem('staffUsername');
    localStorage.removeItem('staffExpiresAt');
  }

  isAuthenticated(): boolean {
    const token = localStorage.getItem('staffToken');
    const expiresAt = localStorage.getItem('staffExpiresAt');
    
    if (!token || !expiresAt) {
      return false;
    }

    // Check if token is expired
    const expiry = new Date(expiresAt);
    return expiry > new Date();
  }

  getUsername(): string | null {
    return localStorage.getItem('staffUsername');
  }

  async getQueue(): Promise<QueuePatient[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/staff/queue`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.success ? data.data : [];
    } catch (error) {
      console.error('Get queue error:', error);
      throw new Error('Failed to fetch queue data');
    }
  }

  async callNextPatient(): Promise<CallNextPatientResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/staff/call-next`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Call next patient error:', error);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Unable to call next patient. Please try again.',
        },
      };
    }
  }

  async completePatient(patientId: string): Promise<CompletePatientResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/staff/complete`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ patientId }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Complete patient error:', error);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Unable to complete patient. Please try again.',
        },
      };
    }
  }
}

export const staffApiService = new StaffApiService();
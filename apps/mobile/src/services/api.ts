// apps\mobile\src\services\api.ts
import { CheckInData, CheckInResponse, QueueStatus, ApiError } from '../types';
import { configService } from './config';

export interface SavedCheckin {
  id: string;
  patientId: string;
  deviceId: string;
  patientName?: string;
  facilityName?: string;
  checkinTime: string;
  lastAccessed: string;
  isActive: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  meta?: {
    total?: number;
    timestamp?: string;
  };
}

export class ApiService {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || configService.getApiUrl();
  }

  // Public method for external use
  async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    return this.makeRequestInternal<T>(endpoint, options);
  }

  private async makeRequestInternal<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, defaultOptions);

      // Handle empty responses (like 204 No Content)
      if (response.status === 204) {
        return {} as T;
      }

      let data;
      const contentType = response.headers.get('content-type');

      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        // Handle non-JSON responses
        const text = await response.text();
        data = text ? { message: text } : {};
      }

      if (!response.ok) {
        // Handle different error response formats
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

        if (data?.errors && Array.isArray(data.errors) && data.errors.length > 0) {
          // JSON API error format
          errorMessage = data.errors[0].detail || data.errors[0].title || errorMessage;
        } else if (data?.error?.message) {
          // Custom error format
          errorMessage = data.error.message;
        } else if (data?.message) {
          // Simple message format
          errorMessage = data.message;
        } else if (typeof data === 'string') {
          errorMessage = data;
        }

        throw new Error(errorMessage);
      }

      return data;
    } catch (error) {
      if (error instanceof TypeError && error.message === 'Network request failed') {
        throw new Error('Unable to connect to the server. Please check your internet connection.');
      }
      throw error;
    }
  }

  async checkIn(data: CheckInData): Promise<CheckInResponse> {
    return this.makeRequestInternal<CheckInResponse>('/api/checkin', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getQueueStatus(patientId: string): Promise<QueueStatus> {
    return this.makeRequestInternal<QueueStatus>(`/api/position/${patientId}`);
  }

  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.makeRequestInternal<{ status: string; timestamp: string }>('/api/health');
  }

  // Check-in History Methods

  /**
   * Get saved check-ins for this device
   */
  async getSavedCheckins(deviceId: string): Promise<SavedCheckin[]> {
    try {
      const response = await this.makeRequestInternal<ApiResponse<SavedCheckin[]>>(
        `/api/v1/checkin-history?deviceId=${encodeURIComponent(deviceId)}`
      );
      return response.data || [];
    } catch (error) {
      console.error('Error getting saved check-ins:', error);
      throw new Error('Failed to retrieve saved check-ins');
    }
  }

  /**
   * Save a check-in for future reference
   */
  async saveCheckin(data: {
    patientId: string;
    deviceId: string;
    patientName?: string;
    facilityName?: string;
  }): Promise<SavedCheckin> {
    try {
      const response = await this.makeRequestInternal<ApiResponse<SavedCheckin>>(
        '/api/v1/checkin-history',
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      );

      if (!response.data) {
        throw new Error('No data returned from save check-in request');
      }

      return response.data;
    } catch (error) {
      console.error('Error saving check-in:', error);
      throw new Error('Failed to save check-in for future reference');
    }
  }

  /**
   * Remove a saved check-in
   */
  async removeSavedCheckin(patientId: string, deviceId: string): Promise<boolean> {
    try {
      await this.makeRequestInternal<void>(
        `/api/v1/checkin-history/${encodeURIComponent(patientId)}?deviceId=${encodeURIComponent(deviceId)}`,
        {
          method: 'DELETE',
        }
      );
      return true;
    } catch (error) {
      console.error('Error removing saved check-in:', error);
      throw new Error('Failed to remove saved check-in');
    }
  }

  /**
   * Validate if a saved check-in is still active and get current status
   */
  async validateSavedCheckin(patientId: string): Promise<{
    isValid: boolean;
    status?: string;
    position?: number;
    estimatedWait?: number;
  }> {
    try {
      const queueStatus = await this.getQueueStatus(patientId);
      return {
        isValid: true,
        status: queueStatus.status,
        position: queueStatus.position,
        estimatedWait: queueStatus.estimatedWaitMinutes,
      };
    } catch (error) {
      // If we can't get queue status, the check-in is likely no longer valid
      console.log('Saved check-in validation failed:', error);
      return { isValid: false };
    }
  }
}

// Singleton instance
export const apiService = new ApiService();
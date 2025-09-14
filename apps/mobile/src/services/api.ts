// apps\mobile\src\services\api.ts - FIXED VERSION
// apps\mobile\src\services\api.ts - FIXED VERSION
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
      console.log(`Making API request to: ${url}`);
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

      // CRITICAL FIX: Auto-extract data from wrapped responses
      if (data && typeof data === 'object' && 'data' in data && 'success' in data) {
        // This is a wrapped ApiResponse format
        const apiResponse = data as ApiResponse<T>;
        if (apiResponse.success && apiResponse.data) {
          console.log('Extracted data from wrapped response:', apiResponse.data);
          return apiResponse.data;
        } else if (!apiResponse.success) {
          throw new Error(apiResponse.message || 'API request failed');
        }
      }

      console.log('Returning direct response data:', data);
      return data;
    } catch (error) {
      console.error(`API request failed for ${url}:`, error);
      if (error instanceof TypeError && error.message === 'Network request failed') {
        throw new Error('Unable to connect to the server. Please check your internet connection.');
      }
      throw error;
    }
  }

  async checkIn(data: CheckInData): Promise<CheckInResponse> {
    console.log('Making check-in request with data:', data);
    return this.makeRequestInternal<CheckInResponse>('/api/checkin', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getQueueStatus(patientId: string): Promise<QueueStatus> {
    console.log('Getting queue status for patientId:', patientId);

    // Validate patientId before making request
    if (!patientId || patientId === 'undefined' || patientId.trim() === '') {
      throw new Error('Invalid patient ID: Patient ID cannot be empty or undefined');
    }

    return this.makeRequestInternal<QueueStatus>(`/api/position/${encodeURIComponent(patientId)}`);
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
      console.log('Getting saved check-ins for deviceId:', deviceId);

      if (!deviceId || deviceId.trim() === '') {
        throw new Error('Device ID is required');
      }

      const response = await this.makeRequestInternal<any>(
        `/api/v1/checkin-history?deviceId=${encodeURIComponent(deviceId)}`
      );

      console.log('Raw getSavedCheckins response:', response);

      // CRITICAL FIX: Handle both wrapped and unwrapped responses
      if (response && typeof response === 'object') {
        if ('data' in response && Array.isArray(response.data)) {
          // Response is wrapped: {data: [...], meta: {...}}
          console.log('Extracting data array from wrapped response:', response.data.length);
          return response.data;
        } else if (Array.isArray(response)) {
          // Response is already the array
          console.log('Using direct array response:', response.length);
          return response;
        }
      }

      console.warn('Unexpected getSavedCheckins response format:', response);
      return [];
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
      console.log('Saving check-in with data:', data);

      if (!data.patientId || !data.deviceId) {
        throw new Error('Patient ID and Device ID are required');
      }

      const response = await this.makeRequestInternal<SavedCheckin>(
        '/api/v1/checkin-history',
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      );

      // Response should already be extracted by makeRequestInternal
      if (!response) {
        throw new Error('No data returned from save check-in request');
      }

      return response;
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
      console.log('Removing saved check-in:', { patientId, deviceId });

      if (!patientId || !deviceId) {
        throw new Error('Patient ID and Device ID are required');
      }

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
      console.log('Validating saved check-in for patientId:', patientId);

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

  /**
   * Update base URL (useful for configuration changes)
   */
  updateBaseUrl(newBaseUrl: string): void {
    this.baseUrl = newBaseUrl;
    console.log('Updated API base URL to:', newBaseUrl);
  }

  /**
   * Get current base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }
}

// Singleton instance
export const apiService = new ApiService();
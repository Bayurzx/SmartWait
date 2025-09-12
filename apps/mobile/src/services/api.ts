// apps\mobile\src\services\api.ts
import { CheckInData, CheckInResponse, QueueStatus, ApiError } from '../types';
import { configService } from './config';

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
      const data = await response.json();

      if (!response.ok) {
        const error: ApiError = data;
        throw new Error(error.error?.message || `HTTP ${response.status}: ${response.statusText}`);
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
}

// Singleton instance
export const apiService = new ApiService();
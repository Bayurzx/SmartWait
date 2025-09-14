// apps\web\src\services\api.ts
import { CheckInData, CheckInResponse, QueueStatus, ApiError } from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ApiService {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData: ApiError = await response.json();
        throw new Error(errorData.error.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      // If the response has a 'data' property, return that; otherwise return the whole response
      if (result && typeof result === 'object' && 'data' in result) {
        return result.data;
      }
      
      return result;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network error occurred');
    }
  }

  async checkIn(data: CheckInData): Promise<CheckInResponse> {
    return this.request<CheckInResponse>('/api/checkin', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getQueueStatus(patientId: string): Promise<QueueStatus> {
    return this.request<QueueStatus>(`/api/position/${patientId}`);
  }

  async getQueuePosition(patientId: string): Promise<QueueStatus> {
    return this.request<QueueStatus>(`/api/status/${patientId}`);
  }
}

export const apiService = new ApiService();
export default apiService;
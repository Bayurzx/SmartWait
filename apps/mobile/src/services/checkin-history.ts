// apps\mobile\src\services\checkin-history.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from './api';

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

export interface SaveCheckinData {
  patientId: string;
  deviceId: string;
  patientName?: string;
  facilityName?: string;
}

class CheckinHistoryService {
  private deviceId: string | null = null;

  constructor() {
    this.initializeDeviceId();
  }

  /**
   * Initialize device ID
   */
  private async initializeDeviceId(): Promise<void> {
    try {
      this.deviceId = await this.getOrCreateDeviceId();
    } catch (error) {
      console.error('Failed to initialize device ID:', error);
      this.deviceId = this.generateDeviceId();
    }
  }

  /**
   * Get or create a unique device ID for this device
   */
  private async getOrCreateDeviceId(): Promise<string> {
    const storageKey = 'smartwait_device_id';
    
    try {
      let deviceId = await AsyncStorage.getItem(storageKey);
      
      if (!deviceId) {
        // Generate a new device ID
        deviceId = this.generateDeviceId();
        await AsyncStorage.setItem(storageKey, deviceId);
      }
      
      return deviceId;
    } catch (error) {
      console.error('Failed to access AsyncStorage, using session-based device ID:', error);
      // Fallback to session-based ID if AsyncStorage is not available
      return this.generateDeviceId();
    }
  }

  /**
   * Generate a unique device ID
   */
  private generateDeviceId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    return `mobile_device_${timestamp}_${randomPart}`;
  }

  /**
   * Ensure device ID is available
   */
  private async ensureDeviceId(): Promise<string> {
    if (!this.deviceId) {
      this.deviceId = await this.getOrCreateDeviceId();
    }
    return this.deviceId;
  }

  /**
   * Get saved check-ins for this device
   */
  async getSavedCheckins(): Promise<SavedCheckin[]> {
    try {
      const deviceId = await this.ensureDeviceId();
      const response = await apiService.makeRequest<{ data: SavedCheckin[] }>(
        `/api/v1/checkin-history?deviceId=${deviceId}`,
        { method: 'GET' }
      );

      return response.data || [];
    } catch (error) {
      console.error('Error getting saved check-ins:', error);
      return [];
    }
  }

  /**
   * Save a check-in for future reference
   */
  async saveCheckin(data: SaveCheckinData): Promise<SavedCheckin | null> {
    try {
      const deviceId = await this.ensureDeviceId();
      const response = await apiService.makeRequest<{ data: SavedCheckin }>(
        '/api/v1/checkin-history',
        {
          method: 'POST',
          body: JSON.stringify({
            ...data,
            deviceId,
          }),
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error saving check-in:', error);
      return null;
    }
  }

  /**
   * Remove a saved check-in
   */
  async removeSavedCheckin(patientId: string): Promise<boolean> {
    try {
      const deviceId = await this.ensureDeviceId();
      await apiService.makeRequest(
        `/api/v1/checkin-history/${patientId}?deviceId=${deviceId}`,
        { method: 'DELETE' }
      );

      return true;
    } catch (error) {
      console.error('Error removing saved check-in:', error);
      return false;
    }
  }

  /**
   * Check if a saved check-in is still valid (patient is still in queue)
   */
  async validateSavedCheckin(patientId: string): Promise<{
    isValid: boolean;
    status?: string;
    position?: number;
    estimatedWait?: number;
  }> {
    try {
      const queueStatus = await apiService.getQueueStatus(patientId);
      return {
        isValid: true,
        status: queueStatus.status,
        position: queueStatus.position,
        estimatedWait: queueStatus.estimatedWaitMinutes,
      };
    } catch (error) {
      console.error('Error validating saved check-in:', error);
      return { isValid: false };
    }
  }

  /**
   * Get the current device ID
   */
  async getDeviceId(): Promise<string> {
    return await this.ensureDeviceId();
  }

  /**
   * Clear all saved check-ins for this device (local cleanup)
   */
  async clearAllSavedCheckins(): Promise<boolean> {
    try {
      const savedCheckins = await this.getSavedCheckins();
      
      const removePromises = savedCheckins.map(checkin => 
        this.removeSavedCheckin(checkin.patientId)
      );
      
      await Promise.all(removePromises);
      return true;
    } catch (error) {
      console.error('Error clearing all saved check-ins:', error);
      return false;
    }
  }

  /**
   * Format check-in time for display
   */
  formatCheckinTime(checkinTime: string): string {
    const date = new Date(checkinTime);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60);
      return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
    } else if (diffInHours < 24) {
      const hours = Math.floor(diffInHours);
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffInHours / 24);
      if (days < 7) {
        return `${days} day${days !== 1 ? 's' : ''} ago`;
      } else {
        return date.toLocaleDateString();
      }
    }
  }

  /**
   * Get status display information
   */
  getStatusDisplay(status: string): { text: string; color: string; icon: string } {
    switch (status) {
      case 'waiting':
        return {
          text: 'In Queue',
          color: '#2563EB',
          icon: '⏳'
        };
      case 'called':
        return {
          text: 'Called',
          color: '#059669',
          icon: '📢'
        };
      case 'completed':
        return {
          text: 'Completed',
          color: '#6B7280',
          icon: '✅'
        };
      default:
        return {
          text: 'Unknown',
          color: '#6B7280',
          icon: '❓'
        };
    }
  }

  /**
   * Store check-in locally for offline access
   */
  async storeCheckinLocally(checkinData: {
    patientId: string;
    patientName: string;
    patientPhone: string;
    position: number;
    estimatedWait: number;
  }): Promise<void> {
    try {
      const localCheckin = {
        ...checkinData,
        timestamp: new Date().toISOString(),
        deviceId: await this.ensureDeviceId(),
      };

      await AsyncStorage.setItem(
        `local_checkin_${checkinData.patientId}`,
        JSON.stringify(localCheckin)
      );

      // Also store as current active checkin
      await AsyncStorage.setItem('current_checkin', JSON.stringify(localCheckin));
    } catch (error) {
      console.error('Error storing check-in locally:', error);
    }
  }

  /**
   * Get locally stored check-in
   */
  async getLocalCheckin(patientId?: string): Promise<any | null> {
    try {
      let checkinData;

      if (patientId) {
        const stored = await AsyncStorage.getItem(`local_checkin_${patientId}`);
        checkinData = stored ? JSON.parse(stored) : null;
      } else {
        const stored = await AsyncStorage.getItem('current_checkin');
        checkinData = stored ? JSON.parse(stored) : null;
      }

      return checkinData;
    } catch (error) {
      console.error('Error getting local check-in:', error);
      return null;
    }
  }

  /**
   * Clear local check-in data
   */
  async clearLocalCheckin(patientId?: string): Promise<void> {
    try {
      if (patientId) {
        await AsyncStorage.removeItem(`local_checkin_${patientId}`);
      }
      await AsyncStorage.removeItem('current_checkin');
    } catch (error) {
      console.error('Error clearing local check-in:', error);
    }
  }
}

// Export singleton instance
export const checkinHistoryService = new CheckinHistoryService();
export default checkinHistoryService;
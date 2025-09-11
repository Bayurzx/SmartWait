import { apiService } from './api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
  private deviceId: string;

  constructor() {
    // Generate or retrieve device ID for this browser/device
    this.deviceId = this.getOrCreateDeviceId();
  }

  /**
   * Get or create a unique device ID for this browser
   */
  private getOrCreateDeviceId(): string {
    const storageKey = 'smartwait_device_id';
    
    try {
      let deviceId = localStorage.getItem(storageKey);
      
      if (!deviceId) {
        // Generate a new device ID
        deviceId = this.generateDeviceId();
        localStorage.setItem(storageKey, deviceId);
      }
      
      return deviceId;
    } catch (error) {
      console.error('Failed to access localStorage, using session-based device ID:', error);
      // Fallback to session-based ID if localStorage is not available
      return this.generateDeviceId();
    }
  }

  /**
   * Generate a unique device ID
   */
  private generateDeviceId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    return `device_${timestamp}_${randomPart}`;
  }

  /**
   * Get saved check-ins for this device
   */
  async getSavedCheckins(): Promise<SavedCheckin[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/checkin-history?deviceId=${this.deviceId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get saved check-ins: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data || [];
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
      const response = await fetch(`${API_BASE_URL}/api/v1/checkin-history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          deviceId: this.deviceId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save check-in: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data;
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
      const response = await fetch(`${API_BASE_URL}/api/v1/checkin-history/${patientId}?deviceId=${this.deviceId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      return response.ok;
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
        estimatedWait: queueStatus.estimatedWait,
      };
    } catch (error) {
      console.error('Error validating saved check-in:', error);
      return { isValid: false };
    }
  }

  /**
   * Get the current device ID
   */
  getDeviceId(): string {
    return this.deviceId;
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
          color: 'text-blue-600',
          icon: '⏳'
        };
      case 'called':
        return {
          text: 'Called',
          color: 'text-green-600',
          icon: '📢'
        };
      case 'completed':
        return {
          text: 'Completed',
          color: 'text-gray-600',
          icon: '✅'
        };
      default:
        return {
          text: 'Unknown',
          color: 'text-gray-600',
          icon: '❓'
        };
    }
  }
}

// Export singleton instance
export const checkinHistoryService = new CheckinHistoryService();
export default checkinHistoryService;
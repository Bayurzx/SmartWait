import { prisma } from '../config/database';

export interface SavedCheckin {
  id: string;
  patientId: string;
  deviceId: string;
  patientName?: string;
  facilityName?: string;
  checkinTime: Date;
  lastAccessed: Date;
  isActive: boolean;
}

export interface SaveCheckinData {
  patientId: string;
  deviceId: string;
  patientName?: string;
  facilityName?: string;
  checkinTime: Date;
}

export class CheckinHistoryService {
  constructor() {
    // No initialization needed with Prisma
  }

  /**
   * Save a check-in for future reference
   */
  async saveCheckin(data: SaveCheckinData): Promise<SavedCheckin> {
    try {
      // Use raw SQL since we need UPSERT functionality
      const result = await prisma.$queryRaw`
        INSERT INTO saved_checkins (
          patient_id, device_id, patient_name, facility_name, 
          checkin_time, last_accessed, is_active
        ) VALUES (
          ${data.patientId}::uuid, 
          ${data.deviceId}, 
          ${data.patientName || null}, 
          ${data.facilityName || 'SmartWait Clinic'}, 
          ${data.checkinTime}, 
          ${new Date()}, 
          ${true}
        )
        ON CONFLICT (patient_id, device_id) 
        DO UPDATE SET 
          patient_name = EXCLUDED.patient_name,
          facility_name = EXCLUDED.facility_name,
          checkin_time = EXCLUDED.checkin_time,
          last_accessed = EXCLUDED.last_accessed,
          is_active = EXCLUDED.is_active
        RETURNING *
      ` as any[];

      if (!result || result.length === 0) {
        throw new Error('No result returned from insert operation');
      }

      return this.mapRowToSavedCheckin(result[0]);
    } catch (error) {
      console.error('Error in saveCheckin:', error);
      throw error;
    }
  }

  /**
   * Get saved check-ins for a device
   */
  async getSavedCheckins(deviceId: string): Promise<SavedCheckin[]> {
    try {
      const result = await prisma.$queryRaw`
        SELECT * FROM saved_checkins 
        WHERE device_id = ${deviceId} AND is_active = true
        ORDER BY last_accessed DESC, checkin_time DESC
        LIMIT 10
      ` as any[];
      
      // Update last_accessed for retrieved check-ins
      if (result.length > 0) {
        const patientIds = result.map((row: any) => row.patient_id);
        await this.updateLastAccessed(patientIds, deviceId);
      }

      return result.map((row: any) => this.mapRowToSavedCheckin(row));
    } catch (error) {
      console.error('Error in getSavedCheckins:', error);
      throw error;
    }
  }

  /**
   * Remove a saved check-in
   */
  async removeSavedCheckin(patientId: string, deviceId: string): Promise<boolean> {
    try {
      const result = await prisma.$executeRaw`
        UPDATE saved_checkins 
        SET is_active = false 
        WHERE patient_id = ${patientId}::uuid AND device_id = ${deviceId} AND is_active = true
      `;

      return result > 0;
    } catch (error) {
      console.error('Error in removeSavedCheckin:', error);
      throw error;
    }
  }

  /**
   * Update last accessed time for check-ins
   */
  private async updateLastAccessed(patientIds: string[], deviceId: string): Promise<void> {
    try {
      await prisma.$executeRaw`
        UPDATE saved_checkins 
        SET last_accessed = ${new Date()} 
        WHERE patient_id = ANY(${patientIds}::uuid[]) AND device_id = ${deviceId}
      `;
    } catch (error) {
      console.error('Error in updateLastAccessed:', error);
      // Don't throw error for this non-critical operation
    }
  }

  /**
   * Clean up old saved check-ins (older than 30 days)
   */
  async cleanupOldCheckins(): Promise<number> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await prisma.$executeRaw`
        UPDATE saved_checkins 
        SET is_active = false 
        WHERE last_accessed < ${thirtyDaysAgo} AND is_active = true
      `;

      return result;
    } catch (error) {
      console.error('Error in cleanupOldCheckins:', error);
      return 0;
    }
  }

  /**
   * Check if a patient ID is valid and get current status
   */
  async validateAndGetPatientStatus(patientId: string): Promise<{
    isValid: boolean;
    status?: string;
    position?: number;
    estimatedWait?: number;
  }> {
    try {
      const result = await prisma.$queryRaw`
        SELECT status, position, estimated_wait_minutes
        FROM queue_positions 
        WHERE patient_id = ${patientId}::uuid AND status != 'completed'
        ORDER BY check_in_time DESC 
        LIMIT 1
      ` as any[];
      
      if (result.length === 0) {
        return { isValid: false };
      }

      const row = result[0];
      return {
        isValid: true,
        status: row.status,
        position: row.position,
        estimatedWait: row.estimated_wait_minutes
      };
    } catch (error) {
      console.error('Error in validateAndGetPatientStatus:', error);
      return { isValid: false };
    }
  }

  /**
   * Map database row to SavedCheckin interface
   */
  private mapRowToSavedCheckin(row: any): SavedCheckin {
    return {
      id: row.id,
      patientId: row.patient_id,
      deviceId: row.device_id,
      patientName: row.patient_name,
      facilityName: row.facility_name,
      checkinTime: new Date(row.checkin_time),
      lastAccessed: new Date(row.last_accessed),
      isActive: row.is_active
    };
  }
}
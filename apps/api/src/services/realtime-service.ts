import { 
  getSocketIO, 
  broadcastToPatient, 
  broadcastToStaff, 
  broadcastToPatients,
  getConnectedUsers,
  getRoomInfo,
  sendToUser,
  isUserConnected
} from '../config/socket';

/**
 * Queue update event types
 */
export interface QueueUpdate {
  type: 'position_change' | 'patient_called' | 'patient_completed' | 'queue_refresh';
  patientId?: string;
  newPosition?: number;
  estimatedWait?: number;
  timestamp: string;
  data?: any;
}

/**
 * Real-time service for broadcasting queue updates
 */
export class RealtimeService {
  /**
   * Broadcast queue update to all relevant parties
   */
  static broadcastQueueUpdate(update: QueueUpdate): void {
    try {
      const timestamp = new Date().toISOString();
      const updateWithTimestamp = { ...update, timestamp };

      // Broadcast to all patients for general queue awareness
      broadcastToPatients('queue_update', updateWithTimestamp);

      // Broadcast to staff dashboard
      broadcastToStaff('queue_update', updateWithTimestamp);

      console.log(`📡 Broadcasted queue update: ${update.type}`, {
        patientId: update.patientId,
        position: update.newPosition,
        estimatedWait: update.estimatedWait
      });

    } catch (error) {
      console.error('❌ Failed to broadcast queue update:', error);
    }
  }

  /**
   * Notify specific patient about their position change
   */
  static notifyPatientPositionChange(
    patientId: string, 
    newPosition: number, 
    estimatedWait: number
  ): void {
    try {
      const update = {
        type: 'position_update' as const,
        position: newPosition,
        estimatedWait,
        timestamp: new Date().toISOString()
      };

      // Send to specific patient
      broadcastToPatient(patientId, 'position_update', update);

      console.log(`📱 Notified patient ${patientId} of position change:`, {
        position: newPosition,
        estimatedWait
      });

    } catch (error) {
      console.error(`❌ Failed to notify patient ${patientId}:`, error);
    }
  }

  /**
   * Notify patient they are being called
   */
  static notifyPatientCalled(patientId: string, message?: string): void {
    try {
      const notification = {
        type: 'patient_called',
        message: message || 'It\'s your turn! Please come to the front desk.',
        timestamp: new Date().toISOString()
      };

      broadcastToPatient(patientId, 'patient_called', notification);

      console.log(`📢 Notified patient ${patientId} they are being called`);

    } catch (error) {
      console.error(`❌ Failed to notify patient ${patientId} of call:`, error);
    }
  }

  /**
   * Notify patient to get ready (2 positions away)
   */
  static notifyPatientGetReady(patientId: string, estimatedWait: number): void {
    try {
      const notification = {
        type: 'get_ready',
        message: 'You\'re next! Please head to the facility now.',
        estimatedWait,
        timestamp: new Date().toISOString()
      };

      broadcastToPatient(patientId, 'get_ready', notification);

      console.log(`⏰ Notified patient ${patientId} to get ready`);

    } catch (error) {
      console.error(`❌ Failed to notify patient ${patientId} to get ready:`, error);
    }
  }

  /**
   * Broadcast full queue refresh to staff
   */
  static broadcastQueueRefresh(queueData: any[]): void {
    try {
      const update: QueueUpdate = {
        type: 'queue_refresh',
        timestamp: new Date().toISOString(),
        data: queueData
      };

      broadcastToStaff('queue_refresh', update);

      console.log(`🔄 Broadcasted queue refresh to staff (${queueData.length} patients)`);

    } catch (error) {
      console.error('❌ Failed to broadcast queue refresh:', error);
    }
  }

  /**
   * Notify staff of new patient check-in
   */
  static notifyStaffNewPatient(patientData: any): void {
    try {
      const notification = {
        type: 'new_patient',
        patient: patientData,
        timestamp: new Date().toISOString()
      };

      broadcastToStaff('new_patient', notification);

      console.log(`👤 Notified staff of new patient: ${patientData.name}`);

    } catch (error) {
      console.error('❌ Failed to notify staff of new patient:', error);
    }
  }

  /**
   * Get real-time service health status
   */
  static getHealthStatus() {
    try {
      const io = getSocketIO();
      const connectedClients = io.engine.clientsCount;

      return {
        status: 'healthy',
        connectedClients,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Socket.io not initialized',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Send test message to verify real-time functionality
   */
  static sendTestMessage(room: string, message: string): void {
    try {
      const io = getSocketIO();
      io.to(room).emit('test_message', {
        message,
        timestamp: new Date().toISOString()
      });

      console.log(`🧪 Sent test message to room ${room}: ${message}`);
    } catch (error) {
      console.error(`❌ Failed to send test message to ${room}:`, error);
    }
  }

  /**
   * Send message to specific authenticated user
   */
  static sendToUser(userId: string, event: string, data: any): boolean {
    try {
      return sendToUser(userId, event, data);
    } catch (error) {
      console.error(`❌ Failed to send message to user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Check if a user is currently connected
   */
  static isUserConnected(userId: string): boolean {
    try {
      return isUserConnected(userId);
    } catch (error) {
      console.error(`❌ Failed to check user connection status for ${userId}:`, error);
      return false;
    }
  }

  /**
   * Get connected users information
   */
  static getConnectedUsers() {
    try {
      return getConnectedUsers();
    } catch (error) {
      console.error('❌ Failed to get connected users:', error);
      return {
        total: 0,
        staff: 0,
        patients: 0,
        users: []
      };
    }
  }

  /**
   * Get room information
   */
  static async getRoomInfo(roomName?: string) {
    try {
      return await getRoomInfo(roomName);
    } catch (error) {
      console.error(`❌ Failed to get room info for ${roomName}:`, error);
      return roomName ? { room: roomName, memberCount: 0, members: [] } : { rooms: [] };
    }
  }

  /**
   * Notify patient with connection status check
   */
  static notifyPatientWithConnectionCheck(
    patientId: string, 
    event: string, 
    data: any
  ): { sent: boolean; connected: boolean } {
    try {
      const connected = isUserConnected(patientId);
      
      if (connected) {
        const sent = sendToUser(patientId, event, data);
        console.log(`📱 Notified connected patient ${patientId} via WebSocket`);
        return { sent, connected: true };
      } else {
        console.log(`📱 Patient ${patientId} not connected, notification not sent via WebSocket`);
        return { sent: false, connected: false };
      }
    } catch (error) {
      console.error(`❌ Failed to notify patient ${patientId}:`, error);
      return { sent: false, connected: false };
    }
  }

  /**
   * Enhanced position update with connection awareness
   */
  static notifyPatientPositionChangeEnhanced(
    patientId: string, 
    newPosition: number, 
    estimatedWait: number
  ): { websocketSent: boolean; connected: boolean } {
    try {
      const update = {
        type: 'position_update' as const,
        position: newPosition,
        estimatedWait,
        timestamp: new Date().toISOString()
      };

      // Try WebSocket first
      const result = this.notifyPatientWithConnectionCheck(patientId, 'position_update', update);
      
      // Also broadcast to patient room for redundancy
      broadcastToPatient(patientId, 'position_update', update);

      console.log(`📱 Enhanced position notification for patient ${patientId}:`, {
        position: newPosition,
        estimatedWait,
        websocketSent: result.sent,
        connected: result.connected
      });

      return { websocketSent: result.sent, connected: result.connected };

    } catch (error) {
      console.error(`❌ Failed enhanced position notification for patient ${patientId}:`, error);
      return { websocketSent: false, connected: false };
    }
  }
}

export default RealtimeService;
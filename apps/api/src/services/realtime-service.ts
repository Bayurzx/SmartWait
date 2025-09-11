/**
 * Real-time Service for SmartWait MVP
 * 
 * Handles all real-time event broadcasting, room management, and WebSocket communication
 */

import { 
  getSocketIO, 
  broadcastToRoom, 
  broadcastToPatient, 
  broadcastToStaff, 
  broadcastToPatients,
  getConnectedUsers,
  isUserConnected
} from '../config/socket';

import {
  RealtimeEvent,
  RealtimeEventType,
  EventPriority,
  WebSocketRoom,
  BroadcastConfig,
  QueuePositionUpdateEvent,
  PatientCheckedInEvent,
  PatientCalledEvent,
  PatientCompletedEvent,
  PatientNoShowEvent,
  QueueClearedEvent,
  StaffCalledNextEvent,
  StaffMarkedCompleteEvent,
  StaffJoinedEvent,
  StaffLeftEvent,
  SystemMaintenanceEvent,
  ConnectionStatusEvent,
  HeartbeatEvent,
  ErrorEvent,
  ValidationErrorEvent,
  createEvent,
  generateEventId
} from '../types/realtime';

import { QueuePosition, QueueStatus } from '../types/queue';

/**
 * Real-time service for managing WebSocket events and broadcasting
 */
export class RealtimeService {
  private static instance: RealtimeService;
  private eventHistory: Map<string, RealtimeEvent> = new Map();
  private readonly MAX_HISTORY_SIZE = 1000;
  private readonly HISTORY_TTL_HOURS = 24;

  private constructor() {
    // Start periodic cleanup of event history
    setInterval(() => this.cleanupEventHistory(), 60 * 60 * 1000); // Every hour
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): RealtimeService {
    if (!RealtimeService.instance) {
      RealtimeService.instance = new RealtimeService();
    }
    return RealtimeService.instance;
  }

  // ============================================================================
  // Queue Event Broadcasting
  // ============================================================================

  /**
   * Broadcast queue position update to affected patients and staff
   */
  public broadcastQueuePositionUpdate(
    patientId: string,
    oldPosition: number,
    newPosition: number,
    estimatedWaitMinutes: number,
    totalInQueue: number,
    reason: 'patient_completed' | 'patient_called' | 'patient_no_show' | 'queue_reorder'
  ): void {
    const event = createEvent<QueuePositionUpdateEvent>({
      type: RealtimeEventType.QUEUE_POSITION_UPDATED,
      priority: EventPriority.HIGH,
      timestamp: new Date().toISOString(),
      source: 'server',
      version: '1.0',
      data: {
        patientId,
        oldPosition,
        newPosition,
        estimatedWaitMinutes,
        totalInQueue,
        positionChange: oldPosition - newPosition,
        reason
      }
    });

    // Send to specific patient
    broadcastToPatient(patientId, 'queue_update', event);
    
    // Send to all staff
    broadcastToStaff('queue_update', event);

    // Store in history
    this.storeEvent(event);

    console.log(`📡 Broadcasted position update: Patient ${patientId} moved from ${oldPosition} to ${newPosition}`);
  }

  /**
   * Broadcast patient check-in event
   */
  public broadcastPatientCheckedIn(
    patientId: string,
    patientName: string,
    position: number,
    estimatedWaitMinutes: number,
    totalInQueue: number,
    checkInTime: Date,
    appointmentTime?: string
  ): void {
    const event = createEvent<PatientCheckedInEvent>({
      type: RealtimeEventType.PATIENT_CHECKED_IN,
      priority: EventPriority.NORMAL,
      timestamp: new Date().toISOString(),
      source: 'server',
      version: '1.0',
      data: {
        patientId,
        patientName: this.sanitizePatientName(patientName),
        position,
        estimatedWaitMinutes,
        checkInTime: checkInTime.toISOString(),
        totalInQueue,
        appointmentTime
      }
    });

    // Send to all staff (they need to see new check-ins)
    broadcastToStaff('queue_update', event);
    
    // Send to all patients (they need to see queue size changes)
    broadcastToPatients('queue_update', event);

    // Send confirmation to the specific patient
    broadcastToPatient(patientId, 'queue_update', event);

    this.storeEvent(event);

    console.log(`📡 Broadcasted patient check-in: ${patientName} at position ${position}`);
  }

  /**
   * Broadcast patient called event
   */
  public broadcastPatientCalled(
    patientId: string,
    patientName: string,
    previousPosition: number,
    calledBy: string,
    totalInQueue: number,
    estimatedServiceTime?: number
  ): void {
    const event = createEvent<PatientCalledEvent>({
      type: RealtimeEventType.PATIENT_CALLED,
      priority: EventPriority.CRITICAL,
      timestamp: new Date().toISOString(),
      source: 'server',
      version: '1.0',
      data: {
        patientId,
        patientName: this.sanitizePatientName(patientName),
        previousPosition,
        calledAt: new Date().toISOString(),
        calledBy,
        totalInQueue,
        estimatedServiceTime
      }
    });

    // Send urgent notification to the called patient
    broadcastToPatient(patientId, 'queue_update', event);
    
    // Send to all staff
    broadcastToStaff('queue_update', event);
    
    // Send to all other patients (their positions may have changed)
    broadcastToPatients('queue_update', event);

    this.storeEvent(event);

    console.log(`📡 Broadcasted patient called: ${patientName} (was position ${previousPosition})`);
  }

  /**
   * Broadcast patient completed event
   */
  public broadcastPatientCompleted(
    patientId: string,
    completedBy: string,
    totalWaitTime: number,
    totalServiceTime: number,
    totalInQueue: number
  ): void {
    const event = createEvent<PatientCompletedEvent>({
      type: RealtimeEventType.PATIENT_COMPLETED,
      priority: EventPriority.NORMAL,
      timestamp: new Date().toISOString(),
      source: 'server',
      version: '1.0',
      data: {
        patientId,
        completedAt: new Date().toISOString(),
        completedBy,
        totalWaitTime,
        totalServiceTime,
        totalInQueue
      }
    });

    // Send to all staff
    broadcastToStaff('queue_update', event);
    
    // Send to all remaining patients (their positions have changed)
    broadcastToPatients('queue_update', event);

    this.storeEvent(event);

    console.log(`📡 Broadcasted patient completed: ${patientId} (wait: ${totalWaitTime}min, service: ${totalServiceTime}min)`);
  }

  /**
   * Broadcast patient no-show event
   */
  public broadcastPatientNoShow(
    patientId: string,
    patientName: string,
    markedBy: string,
    waitTime: number,
    totalInQueue: number
  ): void {
    const event = createEvent<PatientNoShowEvent>({
      type: RealtimeEventType.PATIENT_NO_SHOW,
      priority: EventPriority.NORMAL,
      timestamp: new Date().toISOString(),
      source: 'server',
      version: '1.0',
      data: {
        patientId,
        patientName: this.sanitizePatientName(patientName),
        markedNoShowAt: new Date().toISOString(),
        markedBy,
        waitTime,
        totalInQueue
      }
    });

    // Send to all staff
    broadcastToStaff('queue_update', event);
    
    // Send to all remaining patients
    broadcastToPatients('queue_update', event);

    this.storeEvent(event);

    console.log(`📡 Broadcasted patient no-show: ${patientName} (waited ${waitTime}min)`);
  }

  /**
   * Broadcast queue cleared event
   */
  public broadcastQueueCleared(
    clearedBy: string,
    reason: 'end_of_day' | 'emergency' | 'system_maintenance' | 'manual_clear',
    affectedPatients: number,
    message?: string
  ): void {
    const event = createEvent<QueueClearedEvent>({
      type: RealtimeEventType.QUEUE_CLEARED,
      priority: EventPriority.HIGH,
      timestamp: new Date().toISOString(),
      source: 'server',
      version: '1.0',
      data: {
        clearedAt: new Date().toISOString(),
        clearedBy,
        reason,
        affectedPatients,
        message
      }
    });

    // Send to all patients and staff
    broadcastToPatients('queue_update', event);
    broadcastToStaff('queue_update', event);

    this.storeEvent(event);

    console.log(`📡 Broadcasted queue cleared: ${reason} (${affectedPatients} patients affected)`);
  }

  // ============================================================================
  // Staff Event Broadcasting
  // ============================================================================

  /**
   * Broadcast staff called next patient event
   */
  public broadcastStaffCalledNext(
    staffId: string,
    staffName: string,
    patientId: string,
    patientName: string,
    patientPosition: number,
    estimatedServiceTime?: number
  ): void {
    const event = createEvent<StaffCalledNextEvent>({
      type: RealtimeEventType.STAFF_CALLED_NEXT,
      priority: EventPriority.NORMAL,
      timestamp: new Date().toISOString(),
      source: 'server',
      version: '1.0',
      data: {
        staffId,
        staffName,
        patientId,
        patientName: this.sanitizePatientName(patientName),
        patientPosition,
        calledAt: new Date().toISOString(),
        estimatedServiceTime
      }
    });

    // Send to all staff (for coordination)
    broadcastToStaff('staff_action', event);

    this.storeEvent(event);

    console.log(`📡 Broadcasted staff action: ${staffName} called ${patientName}`);
  }

  /**
   * Broadcast staff marked patient complete event
   */
  public broadcastStaffMarkedComplete(
    staffId: string,
    staffName: string,
    patientId: string,
    serviceTime: number,
    totalInQueue: number
  ): void {
    const event = createEvent<StaffMarkedCompleteEvent>({
      type: RealtimeEventType.STAFF_MARKED_COMPLETE,
      priority: EventPriority.NORMAL,
      timestamp: new Date().toISOString(),
      source: 'server',
      version: '1.0',
      data: {
        staffId,
        staffName,
        patientId,
        completedAt: new Date().toISOString(),
        serviceTime,
        totalInQueue
      }
    });

    // Send to all staff
    broadcastToStaff('staff_action', event);

    this.storeEvent(event);

    console.log(`📡 Broadcasted staff completion: ${staffName} completed patient ${patientId}`);
  }

  /**
   * Broadcast staff joined event
   */
  public broadcastStaffJoined(
    staffId: string,
    staffName: string,
    role: string
  ): void {
    const connectedUsers = getConnectedUsers();
    
    const event = createEvent<StaffJoinedEvent>({
      type: RealtimeEventType.STAFF_JOINED,
      priority: EventPriority.LOW,
      timestamp: new Date().toISOString(),
      source: 'server',
      version: '1.0',
      data: {
        staffId,
        staffName,
        role,
        joinedAt: new Date().toISOString(),
        activeStaffCount: connectedUsers.staff
      }
    });

    // Send to all staff
    broadcastToStaff('staff_presence', event);

    this.storeEvent(event);

    console.log(`📡 Broadcasted staff joined: ${staffName} (${role})`);
  }

  /**
   * Broadcast staff left event
   */
  public broadcastStaffLeft(
    staffId: string,
    staffName: string,
    sessionDuration: number
  ): void {
    const connectedUsers = getConnectedUsers();
    
    const event = createEvent<StaffLeftEvent>({
      type: RealtimeEventType.STAFF_LEFT,
      priority: EventPriority.LOW,
      timestamp: new Date().toISOString(),
      source: 'server',
      version: '1.0',
      data: {
        staffId,
        staffName,
        leftAt: new Date().toISOString(),
        activeStaffCount: connectedUsers.staff,
        sessionDuration
      }
    });

    // Send to all remaining staff
    broadcastToStaff('staff_presence', event);

    this.storeEvent(event);

    console.log(`📡 Broadcasted staff left: ${staffName} (session: ${sessionDuration}min)`);
  }

  // ============================================================================
  // System Event Broadcasting
  // ============================================================================

  /**
   * Broadcast system maintenance event
   */
  public broadcastSystemMaintenance(
    maintenanceType: 'scheduled' | 'emergency' | 'update',
    startTime: Date,
    estimatedDuration: number,
    message: string,
    affectsQueue: boolean = true,
    allowNewCheckIns: boolean = false
  ): void {
    const event = createEvent<SystemMaintenanceEvent>({
      type: RealtimeEventType.SYSTEM_MAINTENANCE,
      priority: EventPriority.CRITICAL,
      timestamp: new Date().toISOString(),
      source: 'server',
      version: '1.0',
      data: {
        maintenanceType,
        startTime: startTime.toISOString(),
        estimatedDuration,
        message,
        affectsQueue,
        allowNewCheckIns
      }
    });

    // Send to all connected users
    broadcastToPatients('system_alert', event);
    broadcastToStaff('system_alert', event);

    this.storeEvent(event);

    console.log(`📡 Broadcasted system maintenance: ${maintenanceType} (${estimatedDuration}min)`);
  }

  /**
   * Broadcast connection status update
   */
  public broadcastConnectionStatus(
    patientId: string,
    status: 'connected' | 'reconnected' | 'unstable' | 'disconnected',
    latency?: number,
    reconnectAttempts?: number
  ): void {
    const event = createEvent<ConnectionStatusEvent>({
      type: RealtimeEventType.CONNECTION_STATUS,
      priority: EventPriority.LOW,
      timestamp: new Date().toISOString(),
      source: 'server',
      version: '1.0',
      data: {
        status,
        latency,
        reconnectAttempts,
        lastSeen: new Date().toISOString()
      }
    });

    // Send to specific patient
    broadcastToPatient(patientId, 'connection_status', event);

    console.log(`📡 Sent connection status to ${patientId}: ${status}`);
  }

  /**
   * Broadcast heartbeat to all connected clients
   */
  public broadcastHeartbeat(): void {
    const connectedUsers = getConnectedUsers();
    
    const event = createEvent<HeartbeatEvent>({
      type: RealtimeEventType.HEARTBEAT,
      priority: EventPriority.LOW,
      timestamp: new Date().toISOString(),
      source: 'server',
      version: '1.0',
      data: {
        serverTime: new Date().toISOString(),
        uptime: process.uptime(),
        activeConnections: connectedUsers.total,
        queueSize: 0 // This would be populated by queue service
      }
    });

    // Send to all connected clients
    broadcastToPatients('heartbeat', event);
    broadcastToStaff('heartbeat', event);

    console.log(`📡 Broadcasted heartbeat to ${connectedUsers.total} clients`);
  }

  // ============================================================================
  // Error Event Broadcasting
  // ============================================================================

  /**
   * Broadcast error event
   */
  public broadcastError(
    targetId: string,
    errorCode: string,
    errorMessage: string,
    errorType: 'validation' | 'system' | 'network' | 'authentication' | 'authorization',
    context?: Record<string, any>,
    retryable: boolean = false,
    retryAfter?: number
  ): void {
    const event = createEvent<ErrorEvent>({
      type: RealtimeEventType.ERROR_OCCURRED,
      priority: EventPriority.HIGH,
      timestamp: new Date().toISOString(),
      source: 'server',
      version: '1.0',
      data: {
        errorCode,
        errorMessage,
        errorType,
        context,
        retryable,
        retryAfter
      }
    });

    // Send to specific target (patient or staff)
    if (isUserConnected(targetId)) {
      broadcastToPatient(targetId, 'error', event);
    }

    this.storeEvent(event);

    console.log(`📡 Sent error to ${targetId}: ${errorCode} - ${errorMessage}`);
  }

  /**
   * Broadcast validation error
   */
  public broadcastValidationError(
    targetId: string,
    field: string,
    value: any,
    constraint: string,
    message: string,
    code: string
  ): void {
    const event = createEvent<ValidationErrorEvent>({
      type: RealtimeEventType.VALIDATION_ERROR,
      priority: EventPriority.NORMAL,
      timestamp: new Date().toISOString(),
      source: 'server',
      version: '1.0',
      data: {
        field,
        value,
        constraint,
        message,
        code
      }
    });

    // Send to specific target
    if (isUserConnected(targetId)) {
      broadcastToPatient(targetId, 'validation_error', event);
    }

    console.log(`📡 Sent validation error to ${targetId}: ${field} - ${message}`);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Sanitize patient name for privacy (first name only)
   */
  private sanitizePatientName(fullName: string): string {
    const parts = fullName.trim().split(' ');
    return parts[0] || 'Patient';
  }

  /**
   * Store event in history for offline clients
   */
  private storeEvent(event: RealtimeEvent): void {
    // Remove oldest events if we're at capacity
    if (this.eventHistory.size >= this.MAX_HISTORY_SIZE) {
      const oldestKey = this.eventHistory.keys().next().value;
      if (oldestKey !== undefined) {
        this.eventHistory.delete(oldestKey);
      }
    }

    this.eventHistory.set(event.eventId, event);
  }

  /**
   * Clean up old events from history
   */
  private cleanupEventHistory(): void {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - this.HISTORY_TTL_HOURS);

    for (const [eventId, event] of this.eventHistory.entries()) {
      const eventTime = new Date(event.timestamp);
      if (eventTime < cutoffTime) {
        this.eventHistory.delete(eventId);
      }
    }

    console.log(`🧹 Cleaned up event history. Current size: ${this.eventHistory.size}`);
  }

  /**
   * Get event history for a specific time range
   */
  public getEventHistory(since?: Date, eventTypes?: RealtimeEventType[]): RealtimeEvent[] {
    const events = Array.from(this.eventHistory.values());
    
    let filteredEvents = events;

    if (since) {
      filteredEvents = filteredEvents.filter(event => 
        new Date(event.timestamp) >= since
      );
    }

    if (eventTypes && eventTypes.length > 0) {
      filteredEvents = filteredEvents.filter(event => 
        eventTypes.includes(event.type)
      );
    }

    return filteredEvents.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  /**
   * Get service health status
   */
  public getHealthStatus() {
    const connectedUsers = getConnectedUsers();
    
    return {
      status: 'healthy',
      eventHistorySize: this.eventHistory.size,
      connectedUsers: connectedUsers.total,
      staffUsers: connectedUsers.staff,
      patientUsers: connectedUsers.patients,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
  }
}

// Export singleton instance
export const realtimeService = RealtimeService.getInstance();
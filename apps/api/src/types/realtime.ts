/**
 * Real-time update event types and data structures for SmartWait MVP
 * 
 * This file defines all WebSocket event types, payloads, and data structures
 * used for real-time communication between clients and the server.
 */

// ============================================================================
// Base Event Types
// ============================================================================

/**
 * Base interface for all real-time events
 */
export interface BaseRealtimeEvent {
  eventId: string;
  timestamp: string; // ISO 8601 UTC timestamp
  source: 'server' | 'client';
  version: string; // Event schema version
}

/**
 * Event types for real-time updates
 */
export enum RealtimeEventType {
  // Queue-related events
  QUEUE_POSITION_UPDATED = 'queue_position_updated',
  PATIENT_CHECKED_IN = 'patient_checked_in',
  PATIENT_CALLED = 'patient_called',
  PATIENT_COMPLETED = 'patient_completed',
  PATIENT_NO_SHOW = 'patient_no_show',
  QUEUE_CLEARED = 'queue_cleared',
  
  // Staff-related events
  STAFF_CALLED_NEXT = 'staff_called_next',
  STAFF_MARKED_COMPLETE = 'staff_marked_complete',
  STAFF_JOINED = 'staff_joined',
  STAFF_LEFT = 'staff_left',
  
  // System events
  SYSTEM_MAINTENANCE = 'system_maintenance',
  CONNECTION_STATUS = 'connection_status',
  HEARTBEAT = 'heartbeat',
  
  // Error events
  ERROR_OCCURRED = 'error_occurred',
  VALIDATION_ERROR = 'validation_error'
}

/**
 * Event priority levels for client handling
 */
export enum EventPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// ============================================================================
// Queue Update Events
// ============================================================================

/**
 * Queue position update event - sent when patient's position changes
 */
export interface QueuePositionUpdateEvent extends BaseRealtimeEvent {
  type: RealtimeEventType.QUEUE_POSITION_UPDATED;
  priority: EventPriority.HIGH;
  data: {
    patientId: string;
    oldPosition: number;
    newPosition: number;
    estimatedWaitMinutes: number;
    totalInQueue: number;
    positionChange: number; // Positive = moved forward, negative = moved back
    reason: 'patient_completed' | 'patient_called' | 'patient_no_show' | 'queue_reorder';
  };
}

/**
 * Patient check-in event - sent when new patient joins queue
 */
export interface PatientCheckedInEvent extends BaseRealtimeEvent {
  type: RealtimeEventType.PATIENT_CHECKED_IN;
  priority: EventPriority.NORMAL;
  data: {
    patientId: string;
    patientName: string; // First name only for privacy
    position: number;
    estimatedWaitMinutes: number;
    checkInTime: string; // ISO 8601 timestamp
    totalInQueue: number;
    appointmentTime?: string;
  };
}

/**
 * Patient called event - sent when patient is called by staff
 */
export interface PatientCalledEvent extends BaseRealtimeEvent {
  type: RealtimeEventType.PATIENT_CALLED;
  priority: EventPriority.CRITICAL;
  data: {
    patientId: string;
    patientName: string;
    previousPosition: number;
    calledAt: string; // ISO 8601 timestamp
    calledBy: string; // Staff member ID
    totalInQueue: number;
    estimatedServiceTime?: number; // Minutes
  };
}

/**
 * Patient completed event - sent when patient visit is completed
 */
export interface PatientCompletedEvent extends BaseRealtimeEvent {
  type: RealtimeEventType.PATIENT_COMPLETED;
  priority: EventPriority.NORMAL;
  data: {
    patientId: string;
    completedAt: string; // ISO 8601 timestamp
    completedBy: string; // Staff member ID
    totalWaitTime: number; // Minutes from check-in to completion
    totalServiceTime: number; // Minutes from called to completed
    totalInQueue: number; // Remaining patients
  };
}

/**
 * Patient no-show event - sent when patient doesn't respond to call
 */
export interface PatientNoShowEvent extends BaseRealtimeEvent {
  type: RealtimeEventType.PATIENT_NO_SHOW;
  priority: EventPriority.NORMAL;
  data: {
    patientId: string;
    patientName: string;
    markedNoShowAt: string; // ISO 8601 timestamp
    markedBy: string; // Staff member ID
    waitTime: number; // Minutes from check-in to no-show
    totalInQueue: number;
  };
}

/**
 * Queue cleared event - sent when entire queue is cleared (end of day, emergency, etc.)
 */
export interface QueueClearedEvent extends BaseRealtimeEvent {
  type: RealtimeEventType.QUEUE_CLEARED;
  priority: EventPriority.HIGH;
  data: {
    clearedAt: string; // ISO 8601 timestamp
    clearedBy: string; // Staff member ID
    reason: 'end_of_day' | 'emergency' | 'system_maintenance' | 'manual_clear';
    affectedPatients: number;
    message?: string; // Optional message to display to patients
  };
}

// ============================================================================
// Staff Events
// ============================================================================

/**
 * Staff called next patient event - sent when staff calls next patient
 */
export interface StaffCalledNextEvent extends BaseRealtimeEvent {
  type: RealtimeEventType.STAFF_CALLED_NEXT;
  priority: EventPriority.NORMAL;
  data: {
    staffId: string;
    staffName: string;
    patientId: string;
    patientName: string;
    patientPosition: number;
    calledAt: string; // ISO 8601 timestamp
    estimatedServiceTime?: number;
  };
}

/**
 * Staff marked patient complete event
 */
export interface StaffMarkedCompleteEvent extends BaseRealtimeEvent {
  type: RealtimeEventType.STAFF_MARKED_COMPLETE;
  priority: EventPriority.NORMAL;
  data: {
    staffId: string;
    staffName: string;
    patientId: string;
    completedAt: string; // ISO 8601 timestamp
    serviceTime: number; // Minutes
    totalInQueue: number;
  };
}

/**
 * Staff joined event - sent when staff member connects
 */
export interface StaffJoinedEvent extends BaseRealtimeEvent {
  type: RealtimeEventType.STAFF_JOINED;
  priority: EventPriority.LOW;
  data: {
    staffId: string;
    staffName: string;
    role: string;
    joinedAt: string; // ISO 8601 timestamp
    activeStaffCount: number;
  };
}

/**
 * Staff left event - sent when staff member disconnects
 */
export interface StaffLeftEvent extends BaseRealtimeEvent {
  type: RealtimeEventType.STAFF_LEFT;
  priority: EventPriority.LOW;
  data: {
    staffId: string;
    staffName: string;
    leftAt: string; // ISO 8601 timestamp
    activeStaffCount: number;
    sessionDuration: number; // Minutes
  };
}

// ============================================================================
// System Events
// ============================================================================

/**
 * System maintenance event - sent when system is going into maintenance
 */
export interface SystemMaintenanceEvent extends BaseRealtimeEvent {
  type: RealtimeEventType.SYSTEM_MAINTENANCE;
  priority: EventPriority.CRITICAL;
  data: {
    maintenanceType: 'scheduled' | 'emergency' | 'update';
    startTime: string; // ISO 8601 timestamp
    estimatedDuration: number; // Minutes
    message: string;
    affectsQueue: boolean;
    allowNewCheckIns: boolean;
  };
}

/**
 * Connection status event - sent to confirm connection health
 */
export interface ConnectionStatusEvent extends BaseRealtimeEvent {
  type: RealtimeEventType.CONNECTION_STATUS;
  priority: EventPriority.LOW;
  data: {
    status: 'connected' | 'reconnected' | 'unstable' | 'disconnected';
    latency?: number; // Milliseconds
    reconnectAttempts?: number;
    lastSeen?: string; // ISO 8601 timestamp
  };
}

/**
 * Heartbeat event - sent periodically to maintain connection
 */
export interface HeartbeatEvent extends BaseRealtimeEvent {
  type: RealtimeEventType.HEARTBEAT;
  priority: EventPriority.LOW;
  data: {
    serverTime: string; // ISO 8601 timestamp
    uptime: number; // Seconds
    activeConnections: number;
    queueSize: number;
  };
}

// ============================================================================
// Error Events
// ============================================================================

/**
 * Error event - sent when an error occurs
 */
export interface ErrorEvent extends BaseRealtimeEvent {
  type: RealtimeEventType.ERROR_OCCURRED;
  priority: EventPriority.HIGH;
  data: {
    errorCode: string;
    errorMessage: string;
    errorType: 'validation' | 'system' | 'network' | 'authentication' | 'authorization';
    context?: Record<string, any>;
    retryable: boolean;
    retryAfter?: number; // Seconds
  };
}

/**
 * Validation error event - sent when input validation fails
 */
export interface ValidationErrorEvent extends BaseRealtimeEvent {
  type: RealtimeEventType.VALIDATION_ERROR;
  priority: EventPriority.NORMAL;
  data: {
    field: string;
    value: any;
    constraint: string;
    message: string;
    code: string;
  };
}

// ============================================================================
// Union Types and Utilities
// ============================================================================

/**
 * Union type of all possible real-time events
 */
export type RealtimeEvent = 
  | QueuePositionUpdateEvent
  | PatientCheckedInEvent
  | PatientCalledEvent
  | PatientCompletedEvent
  | PatientNoShowEvent
  | QueueClearedEvent
  | StaffCalledNextEvent
  | StaffMarkedCompleteEvent
  | StaffJoinedEvent
  | StaffLeftEvent
  | SystemMaintenanceEvent
  | ConnectionStatusEvent
  | HeartbeatEvent
  | ErrorEvent
  | ValidationErrorEvent;

/**
 * Event payload type extraction utility
 */
export type EventPayload<T extends RealtimeEventType> = Extract<RealtimeEvent, { type: T }>['data'];

// ============================================================================
// WebSocket Room Types
// ============================================================================

/**
 * WebSocket room types for targeted broadcasting
 */
export enum WebSocketRoom {
  // General rooms
  ALL_PATIENTS = 'patients',
  ALL_STAFF = 'staff',
  ALL_ADMIN = 'admin',
  
  // Patient-specific rooms (format: patient_{patientId})
  PATIENT_PREFIX = 'patient_',
  
  // Staff-specific rooms (format: staff_{staffId})
  STAFF_PREFIX = 'staff_',
  
  // Queue-specific rooms (format: queue_{queueId})
  QUEUE_PREFIX = 'queue_',
  
  // System rooms
  SYSTEM_ALERTS = 'system_alerts',
  MAINTENANCE = 'maintenance'
}

/**
 * Room membership information
 */
export interface RoomMembership {
  room: string;
  memberCount: number;
  members: string[]; // Socket IDs
  createdAt: string;
  lastActivity: string;
}

// ============================================================================
// Client-Server Communication Types
// ============================================================================

/**
 * Client-to-server event types
 */
export enum ClientEventType {
  // Connection management
  JOIN_ROOM = 'join_room',
  LEAVE_ROOM = 'leave_room',
  GET_ROOMS = 'get_rooms',
  
  // Queue interactions
  REQUEST_POSITION_UPDATE = 'request_position_update',
  REQUEST_QUEUE_STATUS = 'request_queue_status',
  
  // Staff actions
  CALL_NEXT_PATIENT = 'call_next_patient',
  MARK_PATIENT_COMPLETE = 'mark_patient_complete',
  MARK_PATIENT_NO_SHOW = 'mark_patient_no_show',
  
  // System
  PING = 'ping',
  HEARTBEAT_RESPONSE = 'heartbeat_response'
}

/**
 * Server-to-client event types
 */
export enum ServerEventType {
  // Connection responses
  AUTHENTICATED = 'authenticated',
  ROOM_JOINED = 'room_joined',
  ROOM_LEFT = 'room_left',
  CURRENT_ROOMS = 'current_rooms',
  
  // Queue updates (using RealtimeEventType values)
  QUEUE_UPDATE = 'queue_update',
  
  // System responses
  PONG = 'pong',
  ERROR = 'error',
  SUCCESS = 'success'
}

/**
 * Client event payloads
 */
export interface ClientEventPayloads {
  [ClientEventType.JOIN_ROOM]: {
    room: string;
    patientId?: string;
  };
  [ClientEventType.LEAVE_ROOM]: {
    room: string;
  };
  [ClientEventType.GET_ROOMS]: {};
  [ClientEventType.REQUEST_POSITION_UPDATE]: {
    patientId: string;
  };
  [ClientEventType.REQUEST_QUEUE_STATUS]: {};
  [ClientEventType.CALL_NEXT_PATIENT]: {};
  [ClientEventType.MARK_PATIENT_COMPLETE]: {
    patientId: string;
  };
  [ClientEventType.MARK_PATIENT_NO_SHOW]: {
    patientId: string;
  };
  [ClientEventType.PING]: {};
  [ClientEventType.HEARTBEAT_RESPONSE]: {
    clientTime: string;
  };
}

/**
 * Server event payloads
 */
export interface ServerEventPayloads {
  [ServerEventType.AUTHENTICATED]: {
    userType: 'patient' | 'staff';
    userId: string;
    username?: string;
    role?: string;
    rooms: string[];
    message: string;
  };
  [ServerEventType.ROOM_JOINED]: {
    room: string;
    message: string;
    timestamp: string;
  };
  [ServerEventType.ROOM_LEFT]: {
    room: string;
    message: string;
    timestamp: string;
  };
  [ServerEventType.CURRENT_ROOMS]: {
    rooms: string[];
    timestamp: string;
  };
  [ServerEventType.QUEUE_UPDATE]: RealtimeEvent;
  [ServerEventType.PONG]: {
    timestamp: string;
  };
  [ServerEventType.ERROR]: {
    message: string;
    code?: string;
    details?: any;
  };
  [ServerEventType.SUCCESS]: {
    message: string;
    data?: any;
  };
}

// ============================================================================
// Event Broadcasting Utilities
// ============================================================================

/**
 * Event broadcasting configuration
 */
export interface BroadcastConfig {
  rooms: string[];
  excludeRooms?: string[];
  excludeSockets?: string[];
  priority: EventPriority;
  persistent?: boolean; // Whether to store for offline clients
  ttl?: number; // Time to live in seconds
}

/**
 * Event filter for client-side processing
 */
export interface EventFilter {
  eventTypes?: RealtimeEventType[];
  patientIds?: string[];
  staffIds?: string[];
  priorities?: EventPriority[];
  since?: string; // ISO 8601 timestamp
}

/**
 * Event subscription configuration
 */
export interface EventSubscription {
  eventTypes: RealtimeEventType[];
  filter?: EventFilter;
  callback: (event: RealtimeEvent) => void;
  onError?: (error: Error) => void;
}

// ============================================================================
// Event History and Persistence
// ============================================================================

/**
 * Event history entry for offline clients
 */
export interface EventHistoryEntry {
  id: string;
  event: RealtimeEvent;
  targetRooms: string[];
  createdAt: string;
  expiresAt: string;
  delivered: boolean;
  deliveryAttempts: number;
}

/**
 * Client event acknowledgment
 */
export interface EventAcknowledgment {
  eventId: string;
  receivedAt: string;
  processed: boolean;
  error?: string;
}

// ============================================================================
// Type Guards and Validation
// ============================================================================

/**
 * Type guard to check if an event is a queue-related event
 */
export const isQueueEvent = (event: RealtimeEvent): event is 
  | QueuePositionUpdateEvent 
  | PatientCheckedInEvent 
  | PatientCalledEvent 
  | PatientCompletedEvent 
  | PatientNoShowEvent 
  | QueueClearedEvent => {
  return [
    RealtimeEventType.QUEUE_POSITION_UPDATED,
    RealtimeEventType.PATIENT_CHECKED_IN,
    RealtimeEventType.PATIENT_CALLED,
    RealtimeEventType.PATIENT_COMPLETED,
    RealtimeEventType.PATIENT_NO_SHOW,
    RealtimeEventType.QUEUE_CLEARED
  ].includes(event.type);
};

/**
 * Type guard to check if an event is a staff-related event
 */
export const isStaffEvent = (event: RealtimeEvent): event is 
  | StaffCalledNextEvent 
  | StaffMarkedCompleteEvent 
  | StaffJoinedEvent 
  | StaffLeftEvent => {
  return [
    RealtimeEventType.STAFF_CALLED_NEXT,
    RealtimeEventType.STAFF_MARKED_COMPLETE,
    RealtimeEventType.STAFF_JOINED,
    RealtimeEventType.STAFF_LEFT
  ].includes(event.type);
};

/**
 * Type guard to check if an event is a system event
 */
export const isSystemEvent = (event: RealtimeEvent): event is 
  | SystemMaintenanceEvent 
  | ConnectionStatusEvent 
  | HeartbeatEvent => {
  return [
    RealtimeEventType.SYSTEM_MAINTENANCE,
    RealtimeEventType.CONNECTION_STATUS,
    RealtimeEventType.HEARTBEAT
  ].includes(event.type);
};

/**
 * Type guard to check if an event is an error event
 */
export const isErrorEvent = (event: RealtimeEvent): event is 
  | ErrorEvent 
  | ValidationErrorEvent => {
  return [
    RealtimeEventType.ERROR_OCCURRED,
    RealtimeEventType.VALIDATION_ERROR
  ].includes(event.type);
};

// ============================================================================
// Event Factory Functions
// ============================================================================

/**
 * Create a base event with common properties
 */
export const createBaseEvent = (
  type: RealtimeEventType,
  priority: EventPriority = EventPriority.NORMAL
): Omit<BaseRealtimeEvent, 'eventId'> => ({
  timestamp: new Date().toISOString(),
  source: 'server',
  version: '1.0'
});

/**
 * Generate unique event ID
 */
export const generateEventId = (): string => {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Create a complete event with ID
 */
export const createEvent = <T extends RealtimeEvent>(
  eventData: Omit<T, 'eventId'>
): T => ({
  ...eventData,
  eventId: generateEventId()
} as T);
/**
 * Real-time utilities for SmartWait MVP
 * 
 * Helper functions for real-time event processing, validation, and formatting
 */

import {
    RealtimeEvent,
    RealtimeEventType,
    EventPriority,
    WebSocketRoom,
    EventFilter,
    isQueueEvent,
    isStaffEvent,
    isSystemEvent,
    isErrorEvent
} from '../types/realtime';

// ============================================================================
// Event Validation
// ============================================================================

/**
 * Validate real-time event structure
 */
export const validateRealtimeEvent = (event: any): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Check required base properties
    if (!event.eventId || typeof event.eventId !== 'string') {
        errors.push('eventId is required and must be a string');
    }

    if (!event.type || !Object.values(RealtimeEventType).includes(event.type)) {
        errors.push('type is required and must be a valid RealtimeEventType');
    }

    if (!event.timestamp || !isValidISODate(event.timestamp)) {
        errors.push('timestamp is required and must be a valid ISO 8601 date string');
    }

    if (!event.source || !['server', 'client'].includes(event.source)) {
        errors.push('source is required and must be either "server" or "client"');
    }

    if (!event.version || typeof event.version !== 'string') {
        errors.push('version is required and must be a string');
    }

    if (!event.priority || !Object.values(EventPriority).includes(event.priority)) {
        errors.push('priority is required and must be a valid EventPriority');
    }

    if (!event.data || typeof event.data !== 'object') {
        errors.push('data is required and must be an object');
    }

    return {
        valid: errors.length === 0,
        errors
    };
};

/**
 * Validate ISO 8601 date string
 */
export const isValidISODate = (dateString: string): boolean => {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime()) && dateString === date.toISOString();
};

/**
 * Validate patient ID format
 */
export const isValidPatientId = (patientId: string): boolean => {
    // Basic UUID v4 validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(patientId);
};

/**
 * Validate staff ID format
 */
export const isValidStaffId = (staffId: string): boolean => {
    // Basic UUID v4 validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(staffId);
};

// ============================================================================
// Event Filtering
// ============================================================================

/**
 * Filter events based on criteria
 */
export const filterEvents = (events: RealtimeEvent[], filter: EventFilter): RealtimeEvent[] => {
    let filteredEvents = events;

    // Filter by event types
    if (filter.eventTypes && filter.eventTypes.length > 0) {
        filteredEvents = filteredEvents.filter(event =>
            filter.eventTypes!.includes(event.type)
        );
    }

    // Filter by patient IDs
    if (filter.patientIds && filter.patientIds.length > 0) {
        filteredEvents = filteredEvents.filter(event => {
            if (isQueueEvent(event) && 'patientId' in event.data) {
                return filter.patientIds!.includes(event.data.patientId);
            }
            return false;
        });
    }

    // Filter by staff IDs
    if (filter.staffIds && filter.staffIds.length > 0) {
        filteredEvents = filteredEvents.filter(event => {
            if (isStaffEvent(event) && 'staffId' in event.data) {
                return filter.staffIds!.includes(event.data.staffId);
            }
            return false;
        });
    }

    // Filter by priorities
    if (filter.priorities && filter.priorities.length > 0) {
        filteredEvents = filteredEvents.filter(event =>
            filter.priorities!.includes(event.priority)
        );
    }

    // Filter by timestamp
    if (filter.since) {
        const sinceDate = new Date(filter.since);
        filteredEvents = filteredEvents.filter(event =>
            new Date(event.timestamp) >= sinceDate
        );
    }

    return filteredEvents;
};

/**
 * Get events relevant to a specific patient
 */
export const getPatientRelevantEvents = (
    events: RealtimeEvent[],
    patientId: string
): RealtimeEvent[] => {
    return events.filter(event => {
        // Queue events for this patient
        if (isQueueEvent(event) && 'patientId' in event.data && event.data.patientId === patientId) {
            return true;
        }

        // System events that affect all patients
        if (isSystemEvent(event)) {
            return true;
        }

        // General queue events that might affect position
        if (event.type === RealtimeEventType.PATIENT_CHECKED_IN ||
            event.type === RealtimeEventType.PATIENT_COMPLETED ||
            event.type === RealtimeEventType.PATIENT_NO_SHOW ||
            event.type === RealtimeEventType.QUEUE_CLEARED) {
            return true;
        }

        return false;
    });
};

/**
 * Get events relevant to staff
 */
export const getStaffRelevantEvents = (
    events: RealtimeEvent[],
    staffId?: string
): RealtimeEvent[] => {
    return events.filter(event => {
        // All queue events are relevant to staff
        if (isQueueEvent(event)) {
            return true;
        }

        // Staff events
        if (isStaffEvent(event) && 'staffId' in event.data) {
            // If staffId provided, include all staff events
            // If specific staffId, include only their events or general staff events
            return !staffId || event.data.staffId === staffId;
        }

        // System events
        if (isSystemEvent(event)) {
            return true;
        }

        return false;
    });
};

// ============================================================================
// Event Formatting
// ============================================================================

/**
 * Format event for client consumption
 */
export const formatEventForClient = (event: RealtimeEvent): any => {
    // Create a copy to avoid modifying the original
    const formattedEvent = { ...event };

    // Add human-readable timestamp
    formattedEvent.timestamp = new Date(event.timestamp).toISOString();

    // Add relative time for UI display
    const relativeTime = getRelativeTime(new Date(event.timestamp));
    (formattedEvent as any).relativeTime = relativeTime;

    // Add display message based on event type
    (formattedEvent as any).displayMessage = getEventDisplayMessage(event);

    return formattedEvent;
};

/**
 * Get human-readable relative time
 */
export const getRelativeTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) {
        return 'just now';
    } else if (diffMinutes < 60) {
        return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
        return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else {
        return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    }
};

/**
 * Get display message for event
 */
export const getEventDisplayMessage = (event: RealtimeEvent): string => {
    switch (event.type) {
        case RealtimeEventType.QUEUE_POSITION_UPDATED:
            const positionData = event.data;
            const direction = positionData.positionChange > 0 ? 'moved up' : 'moved back';
            return `Your position ${direction} to #${positionData.newPosition}`;

        case RealtimeEventType.PATIENT_CHECKED_IN:
            return `${event.data.patientName} checked in at position #${event.data.position}`;

        case RealtimeEventType.PATIENT_CALLED:
            return `${event.data.patientName} has been called`;

        case RealtimeEventType.PATIENT_COMPLETED:
            return `A patient has completed their visit`;

        case RealtimeEventType.PATIENT_NO_SHOW:
            return `${event.data.patientName} was marked as no-show`;

        case RealtimeEventType.QUEUE_CLEARED:
            return `Queue has been cleared: ${event.data.reason.replace('_', ' ')}`;

        case RealtimeEventType.STAFF_CALLED_NEXT:
            return `${event.data.staffName} called ${event.data.patientName}`;

        case RealtimeEventType.STAFF_MARKED_COMPLETE:
            return `${event.data.staffName} completed a patient visit`;

        case RealtimeEventType.STAFF_JOINED:
            return `${event.data.staffName} joined (${event.data.role})`;

        case RealtimeEventType.STAFF_LEFT:
            return `${event.data.staffName} left`;

        case RealtimeEventType.SYSTEM_MAINTENANCE:
            return `System maintenance: ${event.data.message}`;

        case RealtimeEventType.CONNECTION_STATUS:
            return `Connection ${event.data.status}`;

        case RealtimeEventType.HEARTBEAT:
            return `System heartbeat`;

        case RealtimeEventType.ERROR_OCCURRED:
            return `Error: ${event.data.errorMessage}`;

        case RealtimeEventType.VALIDATION_ERROR:
            return `Validation error: ${event.data.message}`;

        default:
            return 'Queue update received';
    }
};

// ============================================================================
// Room Management Utilities
// ============================================================================

/**
 * Get room name for patient
 */
export const getPatientRoom = (patientId: string): string => {
    return `${WebSocketRoom.PATIENT_PREFIX}${patientId}`;
};

/**
 * Get room name for staff member
 */
export const getStaffRoom = (staffId: string): string => {
    return `${WebSocketRoom.STAFF_PREFIX}${staffId}`;
};

/**
 * Get room name for queue
 */
export const getQueueRoom = (queueId: string): string => {
    return `${WebSocketRoom.QUEUE_PREFIX}${queueId}`;
};

/**
 * Parse patient ID from room name
 */
export const parsePatientIdFromRoom = (roomName: string): string | null => {
    if (roomName.startsWith(WebSocketRoom.PATIENT_PREFIX)) {
        return roomName.substring(WebSocketRoom.PATIENT_PREFIX.length);
    }
    return null;
};

/**
 * Parse staff ID from room name
 */
export const parseStaffIdFromRoom = (roomName: string): string | null => {
    if (roomName.startsWith(WebSocketRoom.STAFF_PREFIX)) {
        return roomName.substring(WebSocketRoom.STAFF_PREFIX.length);
    }
    return null;
};

/**
 * Check if room is a patient room
 */
export const isPatientRoom = (roomName: string): boolean => {
    return roomName.startsWith(WebSocketRoom.PATIENT_PREFIX);
};

/**
 * Check if room is a staff room
 */
export const isStaffRoom = (roomName: string): boolean => {
    return roomName.startsWith(WebSocketRoom.STAFF_PREFIX);
};

// ============================================================================
// Event Priority Utilities
// ============================================================================

/**
 * Get numeric priority value for sorting
 */
export const getPriorityValue = (priority: EventPriority): number => {
    switch (priority) {
        case EventPriority.LOW:
            return 1;
        case EventPriority.NORMAL:
            return 2;
        case EventPriority.HIGH:
            return 3;
        case EventPriority.CRITICAL:
            return 4;
        default:
            return 2; // Default to normal
    }
};

/**
 * Sort events by priority (highest first) and then by timestamp
 */
export const sortEventsByPriority = (events: RealtimeEvent[]): RealtimeEvent[] => {
    return events.sort((a, b) => {
        const priorityDiff = getPriorityValue(b.priority) - getPriorityValue(a.priority);
        if (priorityDiff !== 0) {
            return priorityDiff;
        }
        // If same priority, sort by timestamp (newest first)
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
};

/**
 * Check if event should trigger immediate notification
 */
export const shouldTriggerImmediateNotification = (event: RealtimeEvent): boolean => {
    // Critical events always trigger immediate notification
    if (event.priority === EventPriority.CRITICAL) {
        return true;
    }

    // Specific event types that should trigger immediate notification
    const immediateEventTypes = [
        RealtimeEventType.PATIENT_CALLED,
        RealtimeEventType.QUEUE_CLEARED,
        RealtimeEventType.SYSTEM_MAINTENANCE,
        RealtimeEventType.ERROR_OCCURRED
    ];

    return immediateEventTypes.includes(event.type);
};

// ============================================================================
// Performance Utilities
// ============================================================================

/**
 * Batch events for efficient processing
 */
export const batchEvents = (events: RealtimeEvent[], batchSize: number = 10): RealtimeEvent[][] => {
    const batches: RealtimeEvent[][] = [];

    for (let i = 0; i < events.length; i += batchSize) {
        batches.push(events.slice(i, i + batchSize));
    }

    return batches;
};

/**
 * Debounce event processing to avoid spam
 */
export const createEventDebouncer = (delay: number = 1000) => {
    const timeouts = new Map<string, NodeJS.Timeout>();

    return (key: string, callback: () => void) => {
        // Clear existing timeout for this key
        const existingTimeout = timeouts.get(key);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }

        // Set new timeout
        const timeout = setTimeout(() => {
            callback();
            timeouts.delete(key);
        }, delay);

        timeouts.set(key, timeout);
    };
};

/**
 * Rate limit event processing
 */
export const createEventRateLimiter = (maxEvents: number = 100, windowMs: number = 60000) => {
    const windows = new Map<string, { count: number; resetTime: number }>();

    return (key: string): boolean => {
        const now = Date.now();
        const window = windows.get(key);

        if (!window || now > window.resetTime) {
            // New window or expired window
            windows.set(key, { count: 1, resetTime: now + windowMs });
            return true;
        }

        if (window.count >= maxEvents) {
            // Rate limit exceeded
            return false;
        }

        // Increment count
        window.count++;
        return true;
    };
};

// ============================================================================
// Constants
// ============================================================================

/**
 * Default event configuration
 */
export const DEFAULT_EVENT_CONFIG = {
    HISTORY_SIZE: 1000,
    HISTORY_TTL_HOURS: 24,
    BATCH_SIZE: 10,
    DEBOUNCE_DELAY: 1000,
    RATE_LIMIT_MAX: 100,
    RATE_LIMIT_WINDOW: 60000,
    HEARTBEAT_INTERVAL: 30000,
    CONNECTION_TIMEOUT: 60000
};

/**
 * Event type categories for easier management
 */
export const EVENT_CATEGORIES = {
    QUEUE: [
        RealtimeEventType.QUEUE_POSITION_UPDATED,
        RealtimeEventType.PATIENT_CHECKED_IN,
        RealtimeEventType.PATIENT_CALLED,
        RealtimeEventType.PATIENT_COMPLETED,
        RealtimeEventType.PATIENT_NO_SHOW,
        RealtimeEventType.QUEUE_CLEARED
    ],
    STAFF: [
        RealtimeEventType.STAFF_CALLED_NEXT,
        RealtimeEventType.STAFF_MARKED_COMPLETE,
        RealtimeEventType.STAFF_JOINED,
        RealtimeEventType.STAFF_LEFT
    ],
    SYSTEM: [
        RealtimeEventType.SYSTEM_MAINTENANCE,
        RealtimeEventType.CONNECTION_STATUS,
        RealtimeEventType.HEARTBEAT
    ],
    ERROR: [
        RealtimeEventType.ERROR_OCCURRED,
        RealtimeEventType.VALIDATION_ERROR
    ]
};

/**
 * Priority-based styling classes for UI
 */
export const PRIORITY_STYLES = {
    [EventPriority.LOW]: 'text-gray-600 bg-gray-100',
    [EventPriority.NORMAL]: 'text-blue-600 bg-blue-100',
    [EventPriority.HIGH]: 'text-orange-600 bg-orange-100',
    [EventPriority.CRITICAL]: 'text-red-600 bg-red-100'
};
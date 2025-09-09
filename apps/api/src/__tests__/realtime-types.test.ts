/**
 * Tests for real-time event types and utilities
 */

import {
  RealtimeEventType,
  EventPriority,
  QueuePositionUpdateEvent,
  PatientCheckedInEvent,
  PatientCalledEvent,
  createEvent,
  generateEventId,
  isQueueEvent,
  isStaffEvent,
  isSystemEvent,
  isErrorEvent
} from '../types/realtime';

import {
  validateRealtimeEvent,
  isValidISODate,
  isValidPatientId,
  filterEvents,
  getPatientRelevantEvents,
  formatEventForClient,
  getRelativeTime,
  getEventDisplayMessage,
  getPatientRoom,
  parsePatientIdFromRoom,
  getPriorityValue,
  sortEventsByPriority,
  shouldTriggerImmediateNotification
} from '../utils/realtime-utils';

describe('Real-time Event Types', () => {
  describe('Event Creation', () => {
    it('should generate unique event IDs', () => {
      const id1 = generateEventId();
      const id2 = generateEventId();
      
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^evt_\d+_[a-z0-9]+$/);
    });

    it('should create a complete queue position update event', () => {
      const eventData: Omit<QueuePositionUpdateEvent, 'eventId'> = {
        type: RealtimeEventType.QUEUE_POSITION_UPDATED,
        priority: EventPriority.HIGH,
        timestamp: new Date().toISOString(),
        source: 'server' as const,
        version: '1.0',
        data: {
          patientId: 'patient-123',
          oldPosition: 5,
          newPosition: 3,
          estimatedWaitMinutes: 15,
          totalInQueue: 10,
          positionChange: 2,
          reason: 'patient_completed' as const
        }
      };

      const event = createEvent<QueuePositionUpdateEvent>(eventData);

      expect(event.eventId).toBeDefined();
      expect(event.type).toBe(RealtimeEventType.QUEUE_POSITION_UPDATED);
      expect(event.priority).toBe(EventPriority.HIGH);
      expect(event.data.patientId).toBe('patient-123');
      expect(event.data.positionChange).toBe(2);
    });

    it('should create a patient checked-in event', () => {
      const eventData: Omit<PatientCheckedInEvent, 'eventId'> = {
        type: RealtimeEventType.PATIENT_CHECKED_IN,
        priority: EventPriority.NORMAL,
        timestamp: new Date().toISOString(),
        source: 'server' as const,
        version: '1.0',
        data: {
          patientId: 'patient-456',
          patientName: 'John',
          position: 1,
          estimatedWaitMinutes: 30,
          checkInTime: new Date().toISOString(),
          totalInQueue: 5,
          appointmentTime: '2:00 PM'
        }
      };

      const event = createEvent<PatientCheckedInEvent>(eventData);

      expect(event.eventId).toBeDefined();
      expect(event.type).toBe(RealtimeEventType.PATIENT_CHECKED_IN);
      expect(event.data.patientName).toBe('John');
      expect(event.data.position).toBe(1);
    });
  });

  describe('Type Guards', () => {
    const queueEvent = createEvent<QueuePositionUpdateEvent>({
      type: RealtimeEventType.QUEUE_POSITION_UPDATED,
      priority: EventPriority.HIGH,
      timestamp: new Date().toISOString(),
      source: 'server',
      version: '1.0',
      data: {
        patientId: 'patient-123',
        oldPosition: 5,
        newPosition: 3,
        estimatedWaitMinutes: 15,
        totalInQueue: 10,
        positionChange: 2,
        reason: 'patient_completed'
      }
    });

    it('should correctly identify queue events', () => {
      expect(isQueueEvent(queueEvent)).toBe(true);
      expect(isStaffEvent(queueEvent)).toBe(false);
      expect(isSystemEvent(queueEvent)).toBe(false);
      expect(isErrorEvent(queueEvent)).toBe(false);
    });
  });
});

describe('Real-time Utilities', () => {
  describe('Event Validation', () => {
    it('should validate correct event structure', () => {
      const validEvent = {
        eventId: 'evt_123_abc',
        type: RealtimeEventType.PATIENT_CALLED,
        priority: EventPriority.CRITICAL,
        timestamp: new Date().toISOString(),
        source: 'server',
        version: '1.0',
        data: {
          patientId: 'patient-123',
          patientName: 'John',
          previousPosition: 1,
          calledAt: new Date().toISOString(),
          calledBy: 'staff-456',
          totalInQueue: 5
        }
      };

      const result = validateRealtimeEvent(validEvent);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid event structure', () => {
      const invalidEvent = {
        type: 'invalid_type',
        timestamp: 'invalid_date',
        source: 'invalid_source'
      };

      const result = validateRealtimeEvent(invalidEvent);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate ISO date strings', () => {
      expect(isValidISODate('2023-12-01T10:30:00.000Z')).toBe(true);
      expect(isValidISODate('invalid-date')).toBe(false);
      expect(isValidISODate('2023-12-01')).toBe(false);
    });

    it('should validate patient ID format', () => {
      expect(isValidPatientId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isValidPatientId('invalid-id')).toBe(false);
      expect(isValidPatientId('')).toBe(false);
    });
  });

  describe('Event Filtering', () => {
    const events = [
      createEvent<QueuePositionUpdateEvent>({
        type: RealtimeEventType.QUEUE_POSITION_UPDATED,
        priority: EventPriority.HIGH,
        timestamp: new Date().toISOString(),
        source: 'server',
        version: '1.0',
        data: {
          patientId: 'patient-1',
          oldPosition: 2,
          newPosition: 1,
          estimatedWaitMinutes: 10,
          totalInQueue: 5,
          positionChange: 1,
          reason: 'patient_completed'
        }
      }),
      createEvent<PatientCheckedInEvent>({
        type: RealtimeEventType.PATIENT_CHECKED_IN,
        priority: EventPriority.NORMAL,
        timestamp: new Date().toISOString(),
        source: 'server',
        version: '1.0',
        data: {
          patientId: 'patient-2',
          patientName: 'Jane',
          position: 3,
          estimatedWaitMinutes: 20,
          checkInTime: new Date().toISOString(),
          totalInQueue: 6
        }
      })
    ];

    it('should filter events by type', () => {
      const filtered = filterEvents(events, {
        eventTypes: [RealtimeEventType.PATIENT_CHECKED_IN]
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].type).toBe(RealtimeEventType.PATIENT_CHECKED_IN);
    });

    it('should filter events by patient ID', () => {
      const filtered = filterEvents(events, {
        patientIds: ['patient-1']
      });

      expect(filtered).toHaveLength(1);
      const firstEvent = filtered[0];
      if (firstEvent.type === RealtimeEventType.QUEUE_POSITION_UPDATED) {
        expect(firstEvent.data.patientId).toBe('patient-1');
      }
    });

    it('should get patient-relevant events', () => {
      const patientEvents = getPatientRelevantEvents(events, 'patient-1');
      expect(patientEvents).toHaveLength(2); // Both events affect patient queue
    });
  });

  describe('Event Formatting', () => {
    it('should format event for client consumption', () => {
      const event = createEvent<PatientCalledEvent>({
        type: RealtimeEventType.PATIENT_CALLED,
        priority: EventPriority.CRITICAL,
        timestamp: new Date().toISOString(),
        source: 'server',
        version: '1.0',
        data: {
          patientId: 'patient-123',
          patientName: 'John',
          previousPosition: 1,
          calledAt: new Date().toISOString(),
          calledBy: 'staff-456',
          totalInQueue: 5
        }
      });

      const formatted = formatEventForClient(event);

      expect(formatted.relativeTime).toBeDefined();
      expect(formatted.displayMessage).toBeDefined();
      expect(formatted.displayMessage).toContain('John has been called');
    });

    it('should generate relative time strings', () => {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      expect(getRelativeTime(now)).toBe('just now');
      expect(getRelativeTime(oneMinuteAgo)).toBe('1 minute ago');
      expect(getRelativeTime(oneHourAgo)).toBe('1 hour ago');
    });

    it('should generate appropriate display messages', () => {
      const positionEvent = createEvent<QueuePositionUpdateEvent>({
        type: RealtimeEventType.QUEUE_POSITION_UPDATED,
        priority: EventPriority.HIGH,
        timestamp: new Date().toISOString(),
        source: 'server',
        version: '1.0',
        data: {
          patientId: 'patient-1',
          oldPosition: 3,
          newPosition: 1,
          estimatedWaitMinutes: 5,
          totalInQueue: 5,
          positionChange: 2,
          reason: 'patient_completed'
        }
      });

      const message = getEventDisplayMessage(positionEvent);
      expect(message).toContain('moved up to #1');
    });
  });

  describe('Room Management', () => {
    it('should generate correct patient room names', () => {
      expect(getPatientRoom('patient-123')).toBe('patient_patient-123');
    });

    it('should parse patient ID from room name', () => {
      expect(parsePatientIdFromRoom('patient_patient-123')).toBe('patient-123');
      expect(parsePatientIdFromRoom('staff_staff-456')).toBeNull();
    });
  });

  describe('Priority Handling', () => {
    it('should assign correct priority values', () => {
      expect(getPriorityValue(EventPriority.LOW)).toBe(1);
      expect(getPriorityValue(EventPriority.NORMAL)).toBe(2);
      expect(getPriorityValue(EventPriority.HIGH)).toBe(3);
      expect(getPriorityValue(EventPriority.CRITICAL)).toBe(4);
    });

    it('should sort events by priority', () => {
      const events = [
        createEvent<PatientCheckedInEvent>({
          type: RealtimeEventType.PATIENT_CHECKED_IN,
          priority: EventPriority.NORMAL,
          timestamp: new Date().toISOString(),
          source: 'server',
          version: '1.0',
          data: {
            patientId: 'patient-1',
            patientName: 'John',
            position: 2,
            estimatedWaitMinutes: 10,
            checkInTime: new Date().toISOString(),
            totalInQueue: 5
          }
        }),
        createEvent<PatientCalledEvent>({
          type: RealtimeEventType.PATIENT_CALLED,
          priority: EventPriority.CRITICAL,
          timestamp: new Date().toISOString(),
          source: 'server',
          version: '1.0',
          data: {
            patientId: 'patient-2',
            patientName: 'Jane',
            previousPosition: 1,
            calledAt: new Date().toISOString(),
            calledBy: 'staff-456',
            totalInQueue: 4
          }
        })
      ];

      const sorted = sortEventsByPriority(events);
      expect(sorted[0].priority).toBe(EventPriority.CRITICAL);
      expect(sorted[1].priority).toBe(EventPriority.NORMAL);
    });

    it('should identify events requiring immediate notification', () => {
      const criticalEvent = createEvent<PatientCalledEvent>({
        type: RealtimeEventType.PATIENT_CALLED,
        priority: EventPriority.CRITICAL,
        timestamp: new Date().toISOString(),
        source: 'server',
        version: '1.0',
        data: {
          patientId: 'patient-1',
          patientName: 'John',
          previousPosition: 1,
          calledAt: new Date().toISOString(),
          calledBy: 'staff-456',
          totalInQueue: 4
        }
      });

      const normalEvent = createEvent<PatientCheckedInEvent>({
        type: RealtimeEventType.PATIENT_CHECKED_IN,
        priority: EventPriority.NORMAL,
        timestamp: new Date().toISOString(),
        source: 'server',
        version: '1.0',
        data: {
          patientId: 'patient-2',
          patientName: 'Jane',
          position: 2,
          estimatedWaitMinutes: 15,
          checkInTime: new Date().toISOString(),
          totalInQueue: 5
        }
      });

      expect(shouldTriggerImmediateNotification(criticalEvent)).toBe(true);
      expect(shouldTriggerImmediateNotification(normalEvent)).toBe(false);
    });
  });
});
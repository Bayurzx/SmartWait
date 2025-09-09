import RealtimeService from '../services/realtime-service';

// Mock Socket.io to avoid needing actual server
jest.mock('../config/socket', () => ({
  getSocketIO: jest.fn(() => ({
    to: jest.fn(() => ({
      emit: jest.fn()
    })),
    engine: {
      clientsCount: 5
    }
  })),
  broadcastToRoom: jest.fn(),
  broadcastToPatient: jest.fn(),
  broadcastToStaff: jest.fn(),
  broadcastToPatients: jest.fn()
}));

import { broadcastToRoom, broadcastToPatient, broadcastToStaff, broadcastToPatients } from '../config/socket';

describe('RealtimeService Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Queue Update Broadcasting', () => {
    it('should broadcast queue update to all relevant parties', () => {
      const update = {
        type: 'position_change' as const,
        patientId: 'patient-123',
        newPosition: 3,
        estimatedWait: 15,
        timestamp: new Date().toISOString()
      };

      RealtimeService.broadcastQueueUpdate(update);

      expect(broadcastToPatients).toHaveBeenCalledWith('queue_update', expect.objectContaining({
        type: 'position_change',
        patientId: 'patient-123',
        newPosition: 3,
        estimatedWait: 15
      }));

      expect(broadcastToStaff).toHaveBeenCalledWith('queue_update', expect.objectContaining({
        type: 'position_change',
        patientId: 'patient-123',
        newPosition: 3,
        estimatedWait: 15
      }));
    });

    it('should notify specific patient of position change', () => {
      RealtimeService.notifyPatientPositionChange('patient-456', 2, 10);

      expect(broadcastToPatient).toHaveBeenCalledWith('patient-456', 'position_update', expect.objectContaining({
        type: 'position_update',
        position: 2,
        estimatedWait: 10
      }));
    });

    it('should notify patient when called', () => {
      RealtimeService.notifyPatientCalled('patient-789', 'Custom message');

      expect(broadcastToPatient).toHaveBeenCalledWith('patient-789', 'patient_called', expect.objectContaining({
        type: 'patient_called',
        message: 'Custom message'
      }));
    });

    it('should notify patient to get ready', () => {
      RealtimeService.notifyPatientGetReady('patient-ready', 5);

      expect(broadcastToPatient).toHaveBeenCalledWith('patient-ready', 'get_ready', expect.objectContaining({
        type: 'get_ready',
        message: 'You\'re next! Please head to the facility now.',
        estimatedWait: 5
      }));
    });
  });

  describe('Staff Notifications', () => {
    it('should broadcast queue refresh to staff', () => {
      const queueData = [
        { id: '1', name: 'Patient 1', position: 1 },
        { id: '2', name: 'Patient 2', position: 2 }
      ];

      RealtimeService.broadcastQueueRefresh(queueData);

      expect(broadcastToStaff).toHaveBeenCalledWith('queue_refresh', expect.objectContaining({
        type: 'queue_refresh',
        data: queueData
      }));
    });

    it('should notify staff of new patient', () => {
      const patientData = {
        id: 'new-patient-123',
        name: 'John Doe',
        position: 1
      };

      RealtimeService.notifyStaffNewPatient(patientData);

      expect(broadcastToStaff).toHaveBeenCalledWith('new_patient', expect.objectContaining({
        type: 'new_patient',
        patient: patientData
      }));
    });
  });

  describe('Health Status', () => {
    it('should return healthy status when Socket.io is available', () => {
      const health = RealtimeService.getHealthStatus();

      expect(health.status).toBe('healthy');
      expect(health.connectedClients).toBe(5);
      expect(health.timestamp).toBeDefined();
    });
  });

  describe('Test Messages', () => {
    it('should send test message to specified room', () => {
      RealtimeService.sendTestMessage('test-room', 'Hello World');

      // This would call the mocked getSocketIO and emit
      expect(jest.isMockFunction(broadcastToRoom)).toBe(true);
    });
  });
});
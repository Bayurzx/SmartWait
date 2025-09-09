import { QueueService } from '../services/queue-service';
import RealtimeService from '../services/realtime-service';
import { prisma } from '../config/database';

// Mock the database
jest.mock('../config/database', () => ({
  prisma: {
    queuePosition: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn()
    },
    patient: {
      create: jest.fn()
    },
    smsNotification: {
      findFirst: jest.fn()
    },
    $transaction: jest.fn()
  }
}));

// Mock the notification service
jest.mock('../services/notification-service', () => ({
  notificationService: {
    sendCheckInConfirmation: jest.fn(),
    sendGetReadySMS: jest.fn(),
    sendCallNowSMS: jest.fn()
  }
}));

// Mock the realtime service
jest.mock('../services/realtime-service', () => ({
  default: {
    broadcastQueueUpdate: jest.fn(),
    notifyPatientPositionChange: jest.fn(),
    notifyPatientCalled: jest.fn(),
    notifyPatientGetReady: jest.fn(),
    notifyStaffNewPatient: jest.fn(),
    broadcastQueueRefresh: jest.fn()
  }
}));

describe('Queue Position Updates - Real-time Integration', () => {
  let queueService: QueueService;
  const mockPrisma = prisma as jest.Mocked<typeof prisma>;

  beforeEach(() => {
    queueService = new QueueService();
    jest.clearAllMocks();
  });

  describe('Patient Check-in Position Updates', () => {
    it('should trigger real-time updates when patient checks in', async () => {
      // Mock database responses
      mockPrisma.queuePosition.findFirst.mockResolvedValue(null); // No existing patient
      mockPrisma.queuePosition.findFirst.mockResolvedValueOnce(null); // For getNextAvailablePosition
      
      const mockPatient = {
        id: 'patient-123',
        name: 'John Doe',
        phone: '+1234567890',
        createdAt: new Date()
      };

      const mockQueuePosition = {
        id: 'queue-123',
        patientId: 'patient-123',
        patient: mockPatient,
        position: 1,
        status: 'waiting',
        checkInTime: new Date(),
        estimatedWaitMinutes: 0,
        calledAt: null,
        completedAt: null
      };

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          patient: {
            create: jest.fn().mockResolvedValue(mockPatient)
          },
          queuePosition: {
            create: jest.fn().mockResolvedValue(mockQueuePosition)
          }
        } as any);
      });

      // Mock SMS notification check
      mockPrisma.smsNotification.findFirst.mockResolvedValue(null);

      // Execute check-in
      await queueService.checkIn({
        name: 'John Doe',
        phone: '+1234567890',
        appointmentTime: '2:00 PM'
      });

      // Verify real-time updates were triggered
      expect(RealtimeService.notifyStaffNewPatient).toHaveBeenCalledWith({
        id: 'patient-123',
        name: 'John Doe',
        phone: '+1234567890',
        position: 1,
        estimatedWait: 0,
        checkInTime: expect.any(Date)
      });

      expect(RealtimeService.broadcastQueueUpdate).toHaveBeenCalledWith({
        type: 'position_change',
        patientId: 'patient-123',
        newPosition: 1,
        estimatedWait: 0,
        timestamp: expect.any(String)
      });
    });
  });

  describe('Patient Completion Position Updates', () => {
    it('should trigger position updates for all remaining patients when one completes', async () => {
      // Mock finding the patient to complete
      const mockCompletingPatient = {
        id: 'queue-completing',
        patientId: 'patient-completing',
        position: 2,
        status: 'called'
      };

      mockPrisma.queuePosition.findFirst.mockResolvedValue(mockCompletingPatient);
      mockPrisma.queuePosition.update.mockResolvedValue({} as any);

      // Mock the updated queue after recalculation
      const mockUpdatedQueue = [
        {
          id: 'queue-1',
          patientId: 'patient-1',
          patient: { id: 'patient-1', name: 'Patient 1', phone: '+1111111111', createdAt: new Date() },
          position: 1,
          status: 'waiting',
          checkInTime: new Date(),
          estimatedWaitMinutes: 0,
          calledAt: null,
          completedAt: null
        },
        {
          id: 'queue-2',
          patientId: 'patient-2',
          patient: { id: 'patient-2', name: 'Patient 2', phone: '+2222222222', createdAt: new Date() },
          position: 2,
          status: 'waiting',
          checkInTime: new Date(),
          estimatedWaitMinutes: 15,
          calledAt: null,
          completedAt: null
        }
      ];

      // Mock the recalculatePositions method by mocking the findMany call
      mockPrisma.queuePosition.findMany.mockResolvedValue(mockUpdatedQueue);
      mockPrisma.smsNotification.findFirst.mockResolvedValue(null);

      // Execute patient completion
      await queueService.markPatientCompleted('patient-completing');

      // Verify completion broadcast
      expect(RealtimeService.broadcastQueueUpdate).toHaveBeenCalledWith({
        type: 'patient_completed',
        patientId: 'patient-completing',
        timestamp: expect.any(String)
      });

      // Verify queue refresh to staff
      expect(RealtimeService.broadcastQueueRefresh).toHaveBeenCalledWith(mockUpdatedQueue);

      // Verify individual position updates for remaining patients
      expect(RealtimeService.notifyPatientPositionChange).toHaveBeenCalledWith(
        'patient-1',
        1,
        0
      );

      expect(RealtimeService.notifyPatientPositionChange).toHaveBeenCalledWith(
        'patient-2',
        2,
        15
      );
    });
  });

  describe('Patient Called Position Updates', () => {
    it('should trigger real-time updates when patient is called', async () => {
      const mockNextPatient = {
        id: 'queue-next',
        patientId: 'patient-next',
        patient: {
          id: 'patient-next',
          name: 'Next Patient',
          phone: '+3333333333',
          createdAt: new Date()
        },
        position: 1,
        status: 'waiting',
        checkInTime: new Date(),
        estimatedWaitMinutes: 0,
        calledAt: null,
        completedAt: null
      };

      mockPrisma.queuePosition.findFirst.mockResolvedValue(mockNextPatient);
      mockPrisma.queuePosition.update.mockResolvedValue({} as any);
      mockPrisma.smsNotification.findFirst.mockResolvedValue(null);

      // Execute call next patient
      const result = await queueService.callNextPatient();

      // Verify the patient was called successfully
      expect(result.success).toBe(true);

      // Verify real-time notifications
      expect(RealtimeService.notifyPatientCalled).toHaveBeenCalledWith(
        'patient-next',
        'Next Patient, it\'s your turn! Please come to the front desk now.'
      );

      expect(RealtimeService.broadcastQueueUpdate).toHaveBeenCalledWith({
        type: 'patient_called',
        patientId: 'patient-next',
        newPosition: 1,
        timestamp: expect.any(String)
      });
    });
  });

  describe('Position Recalculation Logic', () => {
    it('should properly recalculate positions when gaps exist', async () => {
      // This test verifies that the recalculatePositions method works correctly
      // by checking the database calls made during patient completion

      const mockCompletingPatient = {
        id: 'queue-completing',
        patientId: 'patient-completing',
        position: 2,
        status: 'called'
      };

      // Mock patients before recalculation (with gaps)
      const mockPatientsBeforeRecalc = [
        { id: 'queue-1', patientId: 'patient-1', position: 1, status: 'waiting' },
        { id: 'queue-3', patientId: 'patient-3', position: 3, status: 'waiting' }, // Gap at position 2
        { id: 'queue-4', patientId: 'patient-4', position: 4, status: 'waiting' }
      ];

      // Mock patients after recalculation (no gaps)
      const mockPatientsAfterRecalc = [
        {
          id: 'queue-1',
          patientId: 'patient-1',
          patient: { id: 'patient-1', name: 'Patient 1', phone: '+1111111111', createdAt: new Date() },
          position: 1,
          status: 'waiting',
          checkInTime: new Date(),
          estimatedWaitMinutes: 0,
          calledAt: null,
          completedAt: null
        },
        {
          id: 'queue-3',
          patientId: 'patient-3',
          patient: { id: 'patient-3', name: 'Patient 3', phone: '+3333333333', createdAt: new Date() },
          position: 2, // Moved from position 3 to 2
          status: 'waiting',
          checkInTime: new Date(),
          estimatedWaitMinutes: 15,
          calledAt: null,
          completedAt: null
        },
        {
          id: 'queue-4',
          patientId: 'patient-4',
          patient: { id: 'patient-4', name: 'Patient 4', phone: '+4444444444', createdAt: new Date() },
          position: 3, // Moved from position 4 to 3
          status: 'waiting',
          checkInTime: new Date(),
          estimatedWaitMinutes: 30,
          calledAt: null,
          completedAt: null
        }
      ];

      mockPrisma.queuePosition.findFirst.mockResolvedValue(mockCompletingPatient);
      mockPrisma.queuePosition.update.mockResolvedValue({} as any);
      
      // First call for recalculatePositions, second call for getQueue
      mockPrisma.queuePosition.findMany
        .mockResolvedValueOnce(mockPatientsBeforeRecalc as any)
        .mockResolvedValueOnce(mockPatientsAfterRecalc as any);

      mockPrisma.smsNotification.findFirst.mockResolvedValue(null);

      // Execute patient completion
      await queueService.markPatientCompleted('patient-completing');

      // Verify that position updates were sent for patients whose positions changed
      expect(RealtimeService.notifyPatientPositionChange).toHaveBeenCalledWith(
        'patient-1',
        1,
        0
      );

      expect(RealtimeService.notifyPatientPositionChange).toHaveBeenCalledWith(
        'patient-3',
        2,
        15
      );

      expect(RealtimeService.notifyPatientPositionChange).toHaveBeenCalledWith(
        'patient-4',
        3,
        30
      );
    });
  });

  describe('Error Handling in Real-time Updates', () => {
    it('should continue queue operations even if real-time updates fail', async () => {
      // Mock RealtimeService to throw an error
      (RealtimeService.broadcastQueueUpdate as jest.Mock).mockImplementation(() => {
        throw new Error('WebSocket connection failed');
      });

      const mockPatient = {
        id: 'patient-123',
        name: 'John Doe',
        phone: '+1234567890',
        createdAt: new Date()
      };

      const mockQueuePosition = {
        id: 'queue-123',
        patientId: 'patient-123',
        patient: mockPatient,
        position: 1,
        status: 'waiting',
        checkInTime: new Date(),
        estimatedWaitMinutes: 0,
        calledAt: null,
        completedAt: null
      };

      mockPrisma.queuePosition.findFirst.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          patient: {
            create: jest.fn().mockResolvedValue(mockPatient)
          },
          queuePosition: {
            create: jest.fn().mockResolvedValue(mockQueuePosition)
          }
        } as any);
      });

      mockPrisma.smsNotification.findFirst.mockResolvedValue(null);

      // Execute check-in - should not throw error even if real-time updates fail
      const result = await queueService.checkIn({
        name: 'John Doe',
        phone: '+1234567890',
        appointmentTime: '2:00 PM'
      });

      // Verify check-in still succeeded
      expect(result.patient.name).toBe('John Doe');
      expect(result.position).toBe(1);

      // Verify that the real-time update was attempted
      expect(RealtimeService.broadcastQueueUpdate).toHaveBeenCalled();
    });
  });
});
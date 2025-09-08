// Mock the database first
jest.mock('../config/database', () => ({
  prisma: {
    queuePosition: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    patient: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

import { QueueService } from '../services/queue-service';
import { prisma } from '../config/database';

const mockPrisma = prisma as any;

describe('Queue Position Recalculation', () => {
  let queueService: QueueService;

  beforeEach(() => {
    queueService = new QueueService();
    jest.clearAllMocks();
  });

  describe('Position recalculation after patient completion', () => {
    it('should recalculate positions when a patient is marked as completed', async () => {
      // Mock finding the patient to complete
      mockPrisma.queuePosition.findFirst.mockResolvedValue({
        id: 'queue-2',
        patientId: 'patient-2',
        position: 2,
        status: 'called',
        checkInTime: new Date(),
        estimatedWaitMinutes: 15,
        calledAt: new Date(),
        completedAt: null,
      } as any);

      // Mock updating the patient to completed
      mockPrisma.queuePosition.update.mockResolvedValue({
        id: 'queue-2',
        patientId: 'patient-2',
        status: 'completed',
        completedAt: new Date(),
      } as any);

      // Mock the active patients after completion (positions 1, 3, 4 become 1, 2, 3)
      mockPrisma.queuePosition.findMany.mockResolvedValue([
        {
          id: 'queue-1',
          patientId: 'patient-1',
          position: 1,
          status: 'waiting',
        },
        {
          id: 'queue-3',
          patientId: 'patient-3',
          position: 3, // This should become position 2
          status: 'waiting',
        },
        {
          id: 'queue-4',
          patientId: 'patient-4',
          position: 4, // This should become position 3
          status: 'waiting',
        },
      ] as any);

      // Execute the completion
      await queueService.markPatientCompleted('patient-2');

      // Verify the patient was marked as completed
      expect(mockPrisma.queuePosition.update).toHaveBeenCalledWith({
        where: { id: 'queue-2' },
        data: {
          status: 'completed',
          completedAt: expect.any(Date),
        },
      });

      // Verify positions were recalculated
      expect(mockPrisma.queuePosition.findMany).toHaveBeenCalledWith({
        where: {
          status: { in: ['waiting', 'called'] },
        },
        orderBy: { position: 'asc' },
      });

      // Verify position updates were called for patients that needed repositioning
      expect(mockPrisma.queuePosition.update).toHaveBeenCalledWith({
        where: { id: 'queue-3' },
        data: {
          position: 2,
          estimatedWaitMinutes: 15, // (2-1) * 15 minutes
        },
      });

      expect(mockPrisma.queuePosition.update).toHaveBeenCalledWith({
        where: { id: 'queue-4' },
        data: {
          position: 3,
          estimatedWaitMinutes: 30, // (3-1) * 15 minutes
        },
      });
    });

    it('should handle completion when patient is not found', async () => {
      mockPrisma.queuePosition.findFirst.mockResolvedValue(null);

      await expect(queueService.markPatientCompleted('non-existent-patient'))
        .rejects
        .toThrow('Patient not found in active queue');
    });

    it('should not recalculate positions if no active patients remain', async () => {
      // Mock finding the last patient
      mockPrisma.queuePosition.findFirst.mockResolvedValue({
        id: 'queue-1',
        patientId: 'patient-1',
        position: 1,
        status: 'waiting',
      } as any);

      // Mock updating the patient to completed
      mockPrisma.queuePosition.update.mockResolvedValue({
        id: 'queue-1',
        status: 'completed',
      } as any);

      // Mock no remaining active patients
      mockPrisma.queuePosition.findMany.mockResolvedValue([]);

      await queueService.markPatientCompleted('patient-1');

      // Verify the patient was marked as completed
      expect(mockPrisma.queuePosition.update).toHaveBeenCalledWith({
        where: { id: 'queue-1' },
        data: {
          status: 'completed',
          completedAt: expect.any(Date),
        },
      });

      // Verify recalculation was attempted but no updates needed
      expect(mockPrisma.queuePosition.findMany).toHaveBeenCalled();
      
      // Should only have been called once (for marking completed)
      expect(mockPrisma.queuePosition.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('Position gaps removal', () => {
    it('should remove gaps in queue positions correctly', async () => {
      // Simulate a scenario where positions 1, 3, 5, 7 exist (gaps at 2, 4, 6)
      mockPrisma.queuePosition.findFirst.mockResolvedValue({
        id: 'queue-3',
        patientId: 'patient-3',
        position: 3,
        status: 'waiting',
      } as any);

      mockPrisma.queuePosition.update.mockResolvedValue({} as any);

      // Mock active patients with gaps
      mockPrisma.queuePosition.findMany.mockResolvedValue([
        {
          id: 'queue-1',
          patientId: 'patient-1',
          position: 1,
          status: 'waiting',
        },
        {
          id: 'queue-5',
          patientId: 'patient-5',
          position: 5, // Should become position 2
          status: 'waiting',
        },
        {
          id: 'queue-7',
          patientId: 'patient-7',
          position: 7, // Should become position 3
          status: 'called',
        },
      ] as any);

      await queueService.markPatientCompleted('patient-3');

      // Verify positions were recalculated to remove gaps
      expect(mockPrisma.queuePosition.update).toHaveBeenCalledWith({
        where: { id: 'queue-5' },
        data: {
          position: 2,
          estimatedWaitMinutes: 15,
        },
      });

      expect(mockPrisma.queuePosition.update).toHaveBeenCalledWith({
        where: { id: 'queue-7' },
        data: {
          position: 3,
          estimatedWaitMinutes: 30,
        },
      });
    });

    it('should preserve order when recalculating positions', async () => {
      mockPrisma.queuePosition.findFirst.mockResolvedValue({
        id: 'queue-2',
        patientId: 'patient-2',
        position: 2,
        status: 'waiting',
      } as any);

      mockPrisma.queuePosition.update.mockResolvedValue({} as any);

      // Mock patients in correct order but with gaps
      mockPrisma.queuePosition.findMany.mockResolvedValue([
        {
          id: 'queue-1',
          patientId: 'patient-1',
          position: 1,
          status: 'waiting',
        },
        {
          id: 'queue-4',
          patientId: 'patient-4',
          position: 4,
          status: 'waiting',
        },
        {
          id: 'queue-6',
          patientId: 'patient-6',
          position: 6,
          status: 'called',
        },
      ] as any);

      await queueService.markPatientCompleted('patient-2');

      // Verify the order is preserved: 1 stays 1, 4 becomes 2, 6 becomes 3
      expect(mockPrisma.queuePosition.update).toHaveBeenCalledWith({
        where: { id: 'queue-4' },
        data: {
          position: 2,
          estimatedWaitMinutes: 15,
        },
      });

      expect(mockPrisma.queuePosition.update).toHaveBeenCalledWith({
        where: { id: 'queue-6' },
        data: {
          position: 3,
          estimatedWaitMinutes: 30,
        },
      });
    });
  });

  describe('Wait time recalculation', () => {
    it('should update estimated wait times when positions change', async () => {
      mockPrisma.queuePosition.findFirst.mockResolvedValue({
        id: 'queue-1',
        patientId: 'patient-1',
        position: 1,
        status: 'called',
      } as any);

      mockPrisma.queuePosition.update.mockResolvedValue({} as any);

      mockPrisma.queuePosition.findMany.mockResolvedValue([
        {
          id: 'queue-3',
          patientId: 'patient-3',
          position: 3,
          status: 'waiting',
        },
        {
          id: 'queue-5',
          patientId: 'patient-5',
          position: 5,
          status: 'waiting',
        },
      ] as any);

      await queueService.markPatientCompleted('patient-1');

      // Verify wait times are calculated correctly (position - 1) * 15 minutes
      expect(mockPrisma.queuePosition.update).toHaveBeenCalledWith({
        where: { id: 'queue-3' },
        data: {
          position: 1,
          estimatedWaitMinutes: 0, // (1-1) * 15 = 0
        },
      });

      expect(mockPrisma.queuePosition.update).toHaveBeenCalledWith({
        where: { id: 'queue-5' },
        data: {
          position: 2,
          estimatedWaitMinutes: 15, // (2-1) * 15 = 15
        },
      });
    });
  });
});
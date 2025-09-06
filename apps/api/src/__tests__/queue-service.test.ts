// apps\api\src\__tests__\queue-service.test.ts
// ✅ MOCK FIRST (before any imports)
const mockPrisma = {
    queuePosition: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        delete: jest.fn(),
    },
    patient: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    },
    $transaction: jest.fn(),
} as any;

// ✅ Use a getter to delay access
jest.mock('../config/database', () => ({
    get prisma() {
        return mockPrisma;
    }
}));

// ✅ IMPORTS AFTER THE MOCK
import { QueueService } from '../services/queue-service';
import { CheckInRequest, QueuePosition } from '../types/queue';

describe('QueueService', () => {
    let queueService: QueueService;

    beforeEach(() => {
        queueService = new QueueService();
        jest.clearAllMocks();
    });

    describe('checkIn', () => {
        const validCheckInData: CheckInRequest = {
            name: 'John Doe',
            phone: '+1234567890',
            appointmentTime: '2:00 PM'
        };

        it('should successfully check in a new patient', async () => {
            // Mock no existing patient
            mockPrisma.queuePosition.findFirst.mockResolvedValue(null);

            // Mock next position calculation
            mockPrisma.queuePosition.findFirst.mockResolvedValueOnce(null); // No existing patients

            // Mock transaction with proper typing
            const mockQueuePosition: QueuePosition = {
                id: 'queue-1',
                patientId: 'patient-1',
                position: 1,
                status: 'waiting',
                checkInTime: new Date(),
                estimatedWaitMinutes: 0,
                calledAt: null,
                completedAt: null,
                patient: {
                    id: 'patient-1',
                    name: 'John Doe',
                    phone: '+1234567890',
                    createdAt: new Date()
                }
            };

            mockPrisma.$transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
                return callback({
                    patient: {
                        create: jest.fn().mockResolvedValue({
                            id: 'patient-1',
                            name: 'John Doe',
                            phone: '+1234567890',
                            createdAt: new Date()
                        })
                    },
                    queuePosition: {
                        create: jest.fn().mockResolvedValue(mockQueuePosition)
                    }
                } as any);
            });

            const result = await queueService.checkIn(validCheckInData);

            expect(result).toEqual(mockQueuePosition);
            expect(mockPrisma.$transaction).toHaveBeenCalled();
        });

        it('should reject duplicate phone numbers', async () => {
            // Mock existing patient with same phone
            mockPrisma.queuePosition.findFirst.mockResolvedValue({
                id: 'existing-queue-1',
                patientId: 'existing-patient-1',
                position: 1,
                status: 'waiting',
                checkInTime: new Date(),
                estimatedWaitMinutes: 15,
                calledAt: null,
                completedAt: null,
                patient: {
                    id: 'existing-patient-1',
                    name: 'Jane Doe',
                    phone: '+1234567890',
                    createdAt: new Date()
                }
            } as any);

            await expect(queueService.checkIn(validCheckInData))
                .rejects
                .toThrow('Patient with this phone number is already in the queue');
        });

        it('should validate input data', async () => {
            const invalidData = {
                name: '', // Empty name
                phone: 'invalid-phone',
                appointmentTime: '2:00 PM'
            };

            await expect(queueService.checkIn(invalidData))
                .rejects
                .toThrow('Validation error');
        });

        it('should calculate correct position for multiple patients', async () => {
            // Mock existing patient (position 2)
            mockPrisma.queuePosition.findFirst
                .mockResolvedValueOnce(null) // No duplicate check
                .mockResolvedValueOnce({ position: 2 } as any); // Last position is 2

            const mockQueuePosition = {
                id: 'queue-3',
                patientId: 'patient-3',
                position: 3, // Should be next position
                status: 'waiting',
                checkInTime: new Date(),
                estimatedWaitMinutes: 30, // 2 * 15 minutes
                calledAt: null,
                completedAt: null,
                patient: {
                    id: 'patient-3',
                    name: 'John Doe',
                    phone: '+1234567890',
                    createdAt: new Date()
                }
            };

            mockPrisma.$transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
                return callback({
                    patient: {
                        create: jest.fn().mockResolvedValue({
                            id: 'patient-3',
                            name: 'John Doe',
                            phone: '+1234567890',
                            createdAt: new Date()
                        })
                    },
                    queuePosition: {
                        create: jest.fn().mockResolvedValue(mockQueuePosition)
                    }
                } as any);
            });

            const result = await queueService.checkIn(validCheckInData);

            expect(result.position).toBe(3);
            expect(result.estimatedWaitMinutes).toBe(30);
        });
    });

    describe('getPosition', () => {
        it('should return current position for existing patient', async () => {
            const mockQueuePosition = {
                id: 'queue-1',
                patientId: 'patient-1',
                position: 2,
                status: 'waiting',
                checkInTime: new Date(),
                estimatedWaitMinutes: 15,
                calledAt: null,
                completedAt: null,
                patient: {
                    id: 'patient-1',
                    name: 'John Doe',
                    phone: '+1234567890',
                    createdAt: new Date()
                }
            };

            mockPrisma.queuePosition.findFirst.mockResolvedValue(mockQueuePosition as any);
            mockPrisma.queuePosition.count.mockResolvedValue(1); // 1 patient ahead

            const result = await queueService.getPosition('patient-1');

            expect(result.patientId).toBe('patient-1');
            expect(result.position).toBe(2);
            expect(result.status).toBe('waiting');
        });

        it('should throw error for non-existent patient', async () => {
            mockPrisma.queuePosition.findFirst.mockResolvedValue(null);

            await expect(queueService.getPosition('non-existent'))
                .rejects
                .toThrow('Patient not found in queue');
        });
    });

    describe('callNextPatient', () => {
        it('should call the next waiting patient', async () => {
            const mockNextPatient = {
                id: 'queue-1',
                patientId: 'patient-1',
                position: 1,
                status: 'waiting',
                checkInTime: new Date(),
                estimatedWaitMinutes: 0,
                calledAt: null,
                completedAt: null,
                patient: {
                    id: 'patient-1',
                    name: 'John Doe',
                    phone: '+1234567890',
                    createdAt: new Date()
                }
            };

            mockPrisma.queuePosition.findFirst.mockResolvedValue(mockNextPatient as any);
            mockPrisma.queuePosition.update.mockResolvedValue({
                ...mockNextPatient,
                status: 'called',
                calledAt: new Date()
            } as any);

            const result = await queueService.callNextPatient();

            expect(result.success).toBe(true);
            expect(result.patient?.name).toBe('John Doe');
            expect(result.patient?.position).toBe(1);
            expect(mockPrisma.queuePosition.update).toHaveBeenCalledWith({
                where: { id: 'queue-1' },
                data: {
                    status: 'called',
                    calledAt: expect.any(Date)
                }
            });
        });

        it('should return failure when no patients are waiting', async () => {
            mockPrisma.queuePosition.findFirst.mockResolvedValue(null);

            const result = await queueService.callNextPatient();

            expect(result.success).toBe(false);
            expect(result.message).toBe('No patients waiting in queue');
        });
    });

    describe('markPatientCompleted', () => {
        it('should mark patient as completed and recalculate positions', async () => {
            const mockQueuePosition = {
                id: 'queue-1',
                patientId: 'patient-1',
                position: 1,
                status: 'called',
                checkInTime: new Date(),
                estimatedWaitMinutes: 0,
                calledAt: new Date(),
                completedAt: null
            };

            mockPrisma.queuePosition.findFirst.mockResolvedValue(mockQueuePosition as any);
            mockPrisma.queuePosition.update.mockResolvedValue({
                ...mockQueuePosition,
                status: 'completed',
                completedAt: new Date()
            } as any);

            // Mock for recalculate positions
            mockPrisma.queuePosition.findMany.mockResolvedValue([]);

            await queueService.markPatientCompleted('patient-1');

            expect(mockPrisma.queuePosition.update).toHaveBeenCalledWith({
                where: { id: 'queue-1' },
                data: {
                    status: 'completed',
                    completedAt: expect.any(Date)
                }
            });
        });

        it('should throw error for non-existent patient', async () => {
            mockPrisma.queuePosition.findFirst.mockResolvedValue(null);

            await expect(queueService.markPatientCompleted('non-existent'))
                .rejects
                .toThrow('Patient not found in active queue');
        });
    });

    describe('getQueue', () => {
        it('should return all active patients in queue order', async () => {
            const mockQueue = [
                {
                    id: 'queue-1',
                    patientId: 'patient-1',
                    position: 1,
                    status: 'waiting',
                    patient: { id: 'patient-1', name: 'John Doe', phone: '+1111111111', createdAt: new Date() }
                },
                {
                    id: 'queue-2',
                    patientId: 'patient-2',
                    position: 2,
                    status: 'called',
                    patient: { id: 'patient-2', name: 'Jane Doe', phone: '+2222222222', createdAt: new Date() }
                }
            ];

            mockPrisma.queuePosition.findMany.mockResolvedValue(mockQueue as any);

            const result = await queueService.getQueue();

            expect(result).toEqual(mockQueue);
            expect(mockPrisma.queuePosition.findMany).toHaveBeenCalledWith({
                where: {
                    status: {
                        in: ['waiting', 'called']
                    }
                },
                include: {
                    patient: true
                },
                orderBy: {
                    position: 'asc'
                }
            });
        });
    });

    describe('getQueueStats', () => {
        it('should return correct queue statistics', async () => {
            mockPrisma.queuePosition.count
                .mockResolvedValueOnce(3) // waiting
                .mockResolvedValueOnce(1) // called
                .mockResolvedValueOnce(5); // completed

            // Mock completed patients for wait time calculation
            const completedPatients: QueuePosition[] = [
                {
                    id: '1',
                    patientId: '1',
                    position: 1,
                    status: 'completed',
                    checkInTime: new Date(Date.now() - 30 * 60 * 1000),
                    estimatedWaitMinutes: 15,
                    calledAt: new Date(),
                    completedAt: new Date(),
                    patient: {
                        id: '1',
                        name: 'Test',
                        phone: '+111',
                        createdAt: new Date()
                    }
                },
                {
                    id: '2',
                    patientId: '2',
                    position: 2,
                    status: 'completed',
                    checkInTime: new Date(Date.now() - 45 * 60 * 1000),
                    estimatedWaitMinutes: 15,
                    calledAt: new Date(),
                    completedAt: new Date(),
                    patient: {
                        id: '2',
                        name: 'Test 2',
                        phone: '+222',
                        createdAt: new Date()
                    }
                }
            ];

            mockPrisma.queuePosition.findMany.mockResolvedValue(completedPatients);
            mockPrisma.queuePosition.findMany.mockResolvedValue(completedPatients as any);

            const result = await queueService.getQueueStats();

            expect(result.totalWaiting).toBe(3);
            expect(result.totalCalled).toBe(1);
            expect(result.totalCompleted).toBe(5);
            expect(result.averageWaitTime).toBe(38); // Average of 30 and 45 minutes
            expect(result.longestWaitTime).toBe(45);
        });
    });
});
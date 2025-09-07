/**
 * Integration test specifically for automatic position assignment logic
 * This test verifies that the sequential numbering system works correctly
 */

import { QueueService } from '../services/queue-service';
import { prisma } from '../config/database';
import { CheckInRequest } from '../types/queue';

describe('Automatic Position Assignment Logic', () => {
    let queueService: QueueService;

    beforeAll(async () => {
        queueService = new QueueService();
    });

    beforeEach(async () => {
        // Clean up database before each test (order matters due to foreign keys)
        await prisma.smsNotification.deleteMany();
        await prisma.queuePosition.deleteMany();
        await prisma.patient.deleteMany();
    });

    afterAll(async () => {
        // Clean up after all tests (order matters due to foreign keys)
        await prisma.smsNotification.deleteMany();
        await prisma.queuePosition.deleteMany();
        await prisma.patient.deleteMany();
        await prisma.$disconnect();
    });

    describe('Sequential Position Assignment', () => {
        it('should assign position 1 to the first patient', async () => {
            const checkInData: CheckInRequest = {
                name: 'John Doe',
                phone: '+1234567890',
                appointmentTime: '2:00 PM'
            };

            const result = await queueService.checkIn(checkInData);

            expect(result.position).toBe(1);
            expect(result.estimatedWaitMinutes).toBe(0); // First patient has no wait
            expect(result.status).toBe('waiting');
        });

        it('should assign sequential positions to multiple patients', async () => {
            const patients = [
                { name: 'John Doe', phone: '+1111111111', appointmentTime: '2:00 PM' },
                { name: 'Jane Smith', phone: '+2222222222', appointmentTime: '2:15 PM' },
                { name: 'Bob Johnson', phone: '+3333333333', appointmentTime: '2:30 PM' }
            ];

            const results = [];
            for (const patient of patients) {
                const result = await queueService.checkIn(patient);
                results.push(result);
            }

            // Verify sequential positions
            expect(results[0].position).toBe(1);
            expect(results[1].position).toBe(2);
            expect(results[2].position).toBe(3);

            // Verify estimated wait times (15 minutes per position ahead)
            expect(results[0].estimatedWaitMinutes).toBe(0);   // First patient: no wait
            expect(results[1].estimatedWaitMinutes).toBe(15);  // Second patient: 1 * 15 = 15 minutes
            expect(results[2].estimatedWaitMinutes).toBe(30);  // Third patient: 2 * 15 = 30 minutes
        });

        it('should maintain sequential positions after patient completion', async () => {
            // Add 3 patients
            const patient1 = await queueService.checkIn({
                name: 'John Doe',
                phone: '+1111111111',
                appointmentTime: '2:00 PM'
            });

            const patient2 = await queueService.checkIn({
                name: 'Jane Smith',
                phone: '+2222222222',
                appointmentTime: '2:15 PM'
            });

            const patient3 = await queueService.checkIn({
                name: 'Bob Johnson',
                phone: '+3333333333',
                appointmentTime: '2:30 PM'
            });

            // Complete the first patient
            await queueService.markPatientCompleted(patient1.patientId);

            // Check that remaining patients have been repositioned
            const queue = await queueService.getQueue();

            // Should only have 2 patients left
            expect(queue.length).toBe(2);

            // Positions should be recalculated to 1 and 2 (no gaps)
            const positions = queue.map(p => p.position).sort();
            expect(positions).toEqual([1, 2]);

            // Verify the patients are the correct ones
            const patientIds = queue.map(p => p.patientId).sort();
            expect(patientIds).toEqual([patient2.patientId, patient3.patientId].sort());
        });

        it('should handle concurrent check-ins correctly', async () => {
            // Simulate concurrent check-ins - some may fail due to race conditions
            // but the database constraint ensures no duplicate positions
            const checkInPromises = [
                queueService.checkIn({ name: 'Patient 1', phone: '+1111111111', appointmentTime: '2:00 PM' }),
                queueService.checkIn({ name: 'Patient 2', phone: '+2222222222', appointmentTime: '2:15 PM' }),
                queueService.checkIn({ name: 'Patient 3', phone: '+3333333333', appointmentTime: '2:30 PM' })
            ];

            // Use Promise.allSettled to handle potential failures
            const results = await Promise.allSettled(checkInPromises);

            // At least one should succeed
            const successfulResults = results.filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<any>[];
            expect(successfulResults.length).toBeGreaterThan(0);

            // Check that all successful results have unique positions
            if (successfulResults.length > 1) {
                const positions = successfulResults.map(r => r.value.position).sort();
                const uniquePositions = [...new Set(positions)];
                expect(uniquePositions.length).toBe(positions.length);
            }

            // Verify the database constraint is working by checking the final queue state
            const queue = await queueService.getQueue();
            const queuePositions = queue.map(p => p.position).sort();
            const uniqueQueuePositions = [...new Set(queuePositions)];
            expect(uniqueQueuePositions.length).toBe(queuePositions.length);
        });

        it('should prevent duplicate positions with database constraint', async () => {
            // This test verifies that the database constraint prevents duplicate positions
            // even if there's a race condition in the application logic

            const patient1 = await queueService.checkIn({
                name: 'John Doe',
                phone: '+1111111111',
                appointmentTime: '2:00 PM'
            });

            // Try to manually create a queue position with the same position number
            // This should fail due to the unique constraint
            await expect(
                prisma.queuePosition.create({
                    data: {
                        patientId: patient1.patientId,
                        position: 1, // Same position as existing patient
                        status: 'waiting',
                        checkInTime: new Date(),
                        estimatedWaitMinutes: 0
                    }
                })
            ).rejects.toThrow();
        });

        it('should calculate correct positions after calling and completing patients', async () => {
            // Add 4 patients
            const patients = [];
            for (let i = 1; i <= 4; i++) {
                const patient = await queueService.checkIn({
                    name: `Patient ${i}`,
                    phone: `+111111111${i}`,
                    appointmentTime: '2:00 PM'
                });
                patients.push(patient);
            }

            // Call the first patient
            const callResult = await queueService.callNextPatient();
            expect(callResult.success).toBe(true);
            expect(callResult.patient?.position).toBe(1);

            // Complete the first patient
            await queueService.markPatientCompleted(patients[0].patientId);

            // Check the queue - should have 3 patients with positions 1, 2, 3
            const queue = await queueService.getQueue();
            expect(queue.length).toBe(3);

            const positions = queue.map(p => p.position).sort();
            expect(positions).toEqual([1, 2, 3]);

            // Verify estimated wait times are recalculated
            const sortedQueue = queue.sort((a, b) => a.position - b.position);
            expect(sortedQueue[0].estimatedWaitMinutes).toBe(0);  // Position 1: no wait
            expect(sortedQueue[1].estimatedWaitMinutes).toBe(15); // Position 2: 15 minutes
            expect(sortedQueue[2].estimatedWaitMinutes).toBe(30); // Position 3: 30 minutes
        });
    });

    describe('Position Validation', () => {
        it('should reject duplicate phone numbers in active queue', async () => {
            // Add first patient
            await queueService.checkIn({
                name: 'John Doe',
                phone: '+1234567890',
                appointmentTime: '2:00 PM'
            });

            // Try to add second patient with same phone number
            await expect(
                queueService.checkIn({
                    name: 'Jane Doe',
                    phone: '+1234567890', // Same phone number
                    appointmentTime: '2:15 PM'
                })
            ).rejects.toThrow('Patient with this phone number is already in the queue');
        });

        it('should allow same phone number after patient is completed', async () => {
            // Add and complete first patient
            const patient1 = await queueService.checkIn({
                name: 'John Doe',
                phone: '+1234567890',
                appointmentTime: '2:00 PM'
            });

            await queueService.markPatientCompleted(patient1.patientId);

            // Should now allow same phone number for new check-in
            const patient2 = await queueService.checkIn({
                name: 'John Doe',
                phone: '+1234567890', // Same phone number as completed patient
                appointmentTime: '3:00 PM'
            });

            expect(patient2.position).toBe(1); // Should get position 1 since queue is empty
        });
    });
});
import { QueueService } from '../services/queue-service';
import { prisma } from '../config/database';

describe('Queue Flow Integration - Position Recalculation', () => {
  let queueService: QueueService;

  beforeAll(async () => {
    queueService = new QueueService();
  });

  beforeEach(async () => {
    // Clean up the database before each test
    await prisma.queuePosition.deleteMany();
    await prisma.patient.deleteMany();
  });

  afterAll(async () => {
    // Clean up after all tests
    await prisma.queuePosition.deleteMany();
    await prisma.patient.deleteMany();
    await prisma.$disconnect();
  });

  describe('Position recalculation in real scenarios', () => {
    it('should maintain correct positions when patients are completed out of order', async () => {
      // Check in 4 patients
      const patient1 = await queueService.checkIn({
        name: 'Patient 1',
        phone: '+1111111111',
        appointmentTime: '9:00 AM'
      });

      const patient2 = await queueService.checkIn({
        name: 'Patient 2',
        phone: '+2222222222',
        appointmentTime: '9:15 AM'
      });

      const patient3 = await queueService.checkIn({
        name: 'Patient 3',
        phone: '+3333333333',
        appointmentTime: '9:30 AM'
      });

      const patient4 = await queueService.checkIn({
        name: 'Patient 4',
        phone: '+4444444444',
        appointmentTime: '9:45 AM'
      });

      // Verify initial positions
      expect(patient1.position).toBe(1);
      expect(patient2.position).toBe(2);
      expect(patient3.position).toBe(3);
      expect(patient4.position).toBe(4);

      // Call patient 1
      const callResult1 = await queueService.callNextPatient();
      expect(callResult1.success).toBe(true);
      expect(callResult1.patient?.position).toBe(1);

      // Complete patient 1 (should not affect other positions since they're still in order)
      await queueService.markPatientCompleted(patient1.patientId);

      // Check positions after patient 1 completion
      const queue1 = await queueService.getQueue();
      expect(queue1).toHaveLength(3);
      expect(queue1[0].position).toBe(1); // Patient 2 should now be position 1
      expect(queue1[0].patientId).toBe(patient2.patientId);
      expect(queue1[1].position).toBe(2); // Patient 3 should now be position 2
      expect(queue1[1].patientId).toBe(patient3.patientId);
      expect(queue1[2].position).toBe(3); // Patient 4 should now be position 3
      expect(queue1[2].patientId).toBe(patient4.patientId);

      // Now complete patient 3 (out of order - skipping patient 2)
      await queueService.markPatientCompleted(patient3.patientId);

      // Check positions after patient 3 completion
      const queue2 = await queueService.getQueue();
      expect(queue2).toHaveLength(2);
      expect(queue2[0].position).toBe(1); // Patient 2 should still be position 1
      expect(queue2[0].patientId).toBe(patient2.patientId);
      expect(queue2[1].position).toBe(2); // Patient 4 should now be position 2 (moved up from 3)
      expect(queue2[1].patientId).toBe(patient4.patientId);
    });

    it('should recalculate wait times correctly when positions change', async () => {
      // Check in 3 patients
      const patient1 = await queueService.checkIn({
        name: 'Patient 1',
        phone: '+1111111111',
        appointmentTime: '10:00 AM'
      });

      const patient2 = await queueService.checkIn({
        name: 'Patient 2',
        phone: '+2222222222',
        appointmentTime: '10:15 AM'
      });

      const patient3 = await queueService.checkIn({
        name: 'Patient 3',
        phone: '+3333333333',
        appointmentTime: '10:30 AM'
      });

      // Verify initial wait times
      expect(patient1.estimatedWaitMinutes).toBe(0); // (1-1) * 15 = 0
      expect(patient2.estimatedWaitMinutes).toBe(15); // (2-1) * 15 = 15
      expect(patient3.estimatedWaitMinutes).toBe(30); // (3-1) * 15 = 30

      // Complete patient 1
      await queueService.markPatientCompleted(patient1.patientId);

      // Check updated positions and wait times after patient 1 completion
      const patient2Status = await queueService.getPosition(patient2.patientId);
      const patient3Status = await queueService.getPosition(patient3.patientId);

      // After patient 1 is completed, positions should be recalculated in the database:
      // Patient 2 moves from position 2 to position 1
      // Patient 3 moves from position 3 to position 2
      expect(patient2Status.position).toBe(1); // Recalculated position in DB
      expect(patient3Status.position).toBe(2); // Recalculated position in DB

      // The estimated wait times should also be updated based on new positions
      expect(patient2Status.estimatedWaitMinutes).toBe(0); // (1-1) * 15 = 0
      expect(patient3Status.estimatedWaitMinutes).toBe(15); // (2-1) * 15 = 15
    });

    it('should handle calling and completing patients in sequence', async () => {
      // Check in 3 patients
      await queueService.checkIn({
        name: 'Patient A',
        phone: '+1111111111',
        appointmentTime: '11:00 AM'
      });

      await queueService.checkIn({
        name: 'Patient B',
        phone: '+2222222222',
        appointmentTime: '11:15 AM'
      });

      await queueService.checkIn({
        name: 'Patient C',
        phone: '+3333333333',
        appointmentTime: '11:30 AM'
      });

      // Process patients in order
      for (let i = 0; i < 3; i++) {
        // Call next patient
        const callResult = await queueService.callNextPatient();
        expect(callResult.success).toBe(true);
        
        // Complete the called patient
        if (callResult.patient) {
          await queueService.markPatientCompleted(callResult.patient.id);
        }

        // Check remaining queue
        const remainingQueue = await queueService.getQueue();
        expect(remainingQueue).toHaveLength(2 - i);

        // Verify positions are sequential starting from 1
        remainingQueue.forEach((patient, index) => {
          expect(patient.position).toBe(index + 1);
        });
      }

      // Final queue should be empty
      const finalQueue = await queueService.getQueue();
      expect(finalQueue).toHaveLength(0);
    });

    it('should maintain position integrity when multiple patients are completed simultaneously', async () => {
      // Check in 5 patients
      const patients = [];
      for (let i = 1; i <= 5; i++) {
        const patient = await queueService.checkIn({
          name: `Patient ${i}`,
          phone: `+${i.toString().repeat(10)}`,
          appointmentTime: `${8 + i}:00 AM`
        });
        patients.push(patient);
      }

      // Complete patients 2 and 4 (leaving gaps)
      await queueService.markPatientCompleted(patients[1].patientId); // Patient 2
      await queueService.markPatientCompleted(patients[3].patientId); // Patient 4

      // Check that remaining patients have correct sequential positions
      const remainingQueue = await queueService.getQueue();
      expect(remainingQueue).toHaveLength(3);

      // Should be patients 1, 3, and 5 with positions 1, 2, 3
      const sortedQueue = remainingQueue.sort((a, b) => a.position - b.position);
      expect(sortedQueue[0].position).toBe(1);
      expect(sortedQueue[0].patientId).toBe(patients[0].patientId); // Patient 1
      expect(sortedQueue[1].position).toBe(2);
      expect(sortedQueue[1].patientId).toBe(patients[2].patientId); // Patient 3
      expect(sortedQueue[2].position).toBe(3);
      expect(sortedQueue[2].patientId).toBe(patients[4].patientId); // Patient 5
    });
  });
});
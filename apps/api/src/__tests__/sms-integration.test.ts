import { QueueService } from '../services/queue-service';
import { notificationService } from '../services/notification-service';

// Mock the database
const mockPrisma = {
  queuePosition: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  patient: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
} as any;

jest.mock('../config/database', () => ({
  get prisma() {
    return mockPrisma;
  }
}));

// Mock notification service
jest.mock('../services/notification-service', () => ({
  notificationService: {
    sendCheckInConfirmation: jest.fn(),
  }
}));

describe('SMS Integration with Queue Service', () => {
  let queueService: QueueService;
  const mockSendCheckInConfirmation = notificationService.sendCheckInConfirmation as jest.MockedFunction<typeof notificationService.sendCheckInConfirmation>;

  beforeEach(() => {
    queueService = new QueueService();
    jest.clearAllMocks();
  });

  it('should send SMS notification when patient checks in successfully', async () => {
    // Mock no existing patient
    mockPrisma.queuePosition.findFirst.mockResolvedValue(null);

    // Mock successful SMS sending
    mockSendCheckInConfirmation.mockResolvedValue({
      messageId: 'test-sms-123',
      status: 'sent'
    });

    // Mock database transaction
    const mockPatient = {
      id: 'patient-123',
      name: 'Jane Smith',
      phone: '+1555123456',
      createdAt: new Date()
    };

    const mockQueuePosition = {
      id: 'queue-123',
      patientId: 'patient-123',
      position: 2,
      status: 'waiting',
      checkInTime: new Date(),
      estimatedWaitMinutes: 30,
      calledAt: null,
      completedAt: null,
      patient: mockPatient
    };

    mockPrisma.$transaction.mockImplementation(async (callback: any) => {
      return callback({
        patient: {
          create: jest.fn().mockResolvedValue(mockPatient)
        },
        queuePosition: {
          create: jest.fn().mockResolvedValue(mockQueuePosition)
        }
      });
    });

    // Perform check-in
    const result = await queueService.checkIn({
      name: 'Jane Smith',
      phone: '+1555123456',
      appointmentTime: '3:00 PM'
    });

    // Verify check-in was successful
    expect(result.patient.name).toBe('Jane Smith');
    expect(result.position).toBe(2);
    expect(result.estimatedWaitMinutes).toBe(30);

    // Verify SMS was sent with correct parameters
    expect(mockSendCheckInConfirmation).toHaveBeenCalledWith(
      'Jane Smith',
      '+1555123456',
      2,
      30
    );

    // Verify SMS was called exactly once
    expect(mockSendCheckInConfirmation).toHaveBeenCalledTimes(1);
  });

  it('should handle SMS failures gracefully without affecting check-in', async () => {
    // Mock no existing patient
    mockPrisma.queuePosition.findFirst.mockResolvedValue(null);

    // Mock SMS failure
    mockSendCheckInConfirmation.mockRejectedValue(new Error('Twilio service down'));

    // Mock database transaction
    const mockPatient = {
      id: 'patient-456',
      name: 'Bob Johnson',
      phone: '+1555987654',
      createdAt: new Date()
    };

    const mockQueuePosition = {
      id: 'queue-456',
      patientId: 'patient-456',
      position: 1,
      status: 'waiting',
      checkInTime: new Date(),
      estimatedWaitMinutes: 15,
      calledAt: null,
      completedAt: null,
      patient: mockPatient
    };

    mockPrisma.$transaction.mockImplementation(async (callback: any) => {
      return callback({
        patient: {
          create: jest.fn().mockResolvedValue(mockPatient)
        },
        queuePosition: {
          create: jest.fn().mockResolvedValue(mockQueuePosition)
        }
      });
    });

    // Perform check-in - should succeed despite SMS failure
    const result = await queueService.checkIn({
      name: 'Bob Johnson',
      phone: '+1555987654',
      appointmentTime: '4:00 PM'
    });

    // Verify check-in was successful
    expect(result.patient.name).toBe('Bob Johnson');
    expect(result.position).toBe(1);

    // Verify SMS was attempted
    expect(mockSendCheckInConfirmation).toHaveBeenCalledWith(
      'Bob Johnson',
      '+1555987654',
      1,
      15
    );
  });
});
import { prisma } from '../config/database';
import { 
  CheckInRequest, 
  QueuePosition, 
  QueueStatus, 
  PatientCallResult,
  QueueStats 
} from '../types/queue';
import { Prisma } from '@prisma/client';
import Joi from 'joi';

type PrismaQueuePosition = {
    id: string;
    patientId: string;
    patient: {
        id: string;
        name: string;
        phone: string;
        createdAt: Date;
    };
    position: number;
    status: string;
    checkInTime: Date;
    estimatedWaitMinutes: number | null;
    calledAt: Date | null;
    completedAt: Date | null;
};

/**
 * Core queue management service for SmartWait
 * Handles patient check-in, position tracking, and queue operations
 */
export class QueueService {
  private static readonly AVERAGE_WAIT_PER_POSITION = 15; // minutes

  /**
   * Validation schema for check-in data
   */
  private static checkInSchema = Joi.object({
    name: Joi.string().trim().min(1).max(100).required().messages({
      'string.empty': 'Name is required',
      'string.min': 'Name must be at least 1 character long',
      'string.max': 'Name must be no more than 100 characters long',
      'any.required': 'Name is required'
    }),
    phone: Joi.string().trim().pattern(/^\+?[\d\s\-\(\)]+$/).min(10).max(20).required().messages({
      'string.empty': 'Phone number is required',
      'string.pattern.base': 'Phone number must contain only digits, spaces, hyphens, parentheses, and optional + prefix',
      'string.min': 'Phone number must be at least 10 characters long',
      'string.max': 'Phone number must be no more than 20 characters long',
      'any.required': 'Phone number is required'
    }),
    appointmentTime: Joi.string().trim().min(1).max(50).required().messages({
      'string.empty': 'Appointment time is required',
      'string.min': 'Appointment time must be at least 1 character long',
      'string.max': 'Appointment time must be no more than 50 characters long',
      'any.required': 'Appointment time is required'
    })
  });

  /**
   * Helper to safely cast status string to union type
   * This is needed because Prisma returns strings but we want strict union types
   */
  private castQueueStatus(status: string): 'waiting' | 'called' | 'completed' | 'no_show' {
    if (status === 'waiting' || status === 'called' || status === 'completed' || status === 'no_show') {
      return status;
    }
    throw new Error(`Invalid queue status: ${status}`);
  }

  /**
   * Helper to cast Prisma result to QueuePosition with proper status type
   * This ensures type safety when returning data from Prisma operations
   */
    private castToQueuePosition(data: PrismaQueuePosition): QueuePosition {
    return {
      ...data,
      status: this.castQueueStatus(data.status)
    };
  }

  /**
   * Check in a patient to the queue
   * @param data Patient check-in information
   * @returns Queue position information
   */
  async checkIn(data: CheckInRequest): Promise<QueuePosition> {
    // Validate input data
    const { error, value } = QueueService.checkInSchema.validate(data);
    if (error) {
      throw new Error(`Validation error: ${error.details[0].message}`);
    }

    const { name, phone, appointmentTime } = value;

    try {
      // Check for duplicate phone numbers in active queue
      const existingPatient = await prisma.queuePosition.findFirst({
        where: {
          patient: {
            phone: phone
          },
          status: {
            in: ['waiting', 'called']
          }
        },
        include: {
          patient: true
        }
      });

      if (existingPatient) {
        throw new Error('Patient with this phone number is already in the queue');
      }

      // Get next available position
      const nextPosition = await this.getNextAvailablePosition();

      // Calculate estimated wait time
      const estimatedWaitMinutes = this.calculateEstimatedWaitTime(nextPosition);

      // Create patient and queue position in a transaction
      // Using Prisma.TransactionClient ensures proper typing for the transaction
      const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Create patient record
        const patient = await tx.patient.create({
          data: {
            name,
            phone
          }
        });

        // Create queue position with all required fields including status and checkInTime
        const queuePosition = await tx.queuePosition.create({
          data: {
            patientId: patient.id,
            position: nextPosition,
            estimatedWaitMinutes,
            status: 'waiting', // Explicitly set status
            checkInTime: new Date() // Explicitly set check-in time
          },
          include: {
            patient: true
          }
        });

        return queuePosition;
      });

      // Cast the result to ensure proper typing since Prisma returns string status
      return this.castToQueuePosition(result);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to check in patient');
    }
  }

  /**
   * Get current position and status for a patient
   * @param patientId Patient ID
   * @returns Current queue status
   */
  async getPosition(patientId: string): Promise<QueueStatus> {
    try {
      const queuePosition = await prisma.queuePosition.findFirst({
        where: {
          patientId,
          status: {
            in: ['waiting', 'called', 'completed']
          }
        },
        include: {
          patient: true
        },
        orderBy: {
          checkInTime: 'desc'
        }
      });

      if (!queuePosition) {
        throw new Error('Patient not found in queue');
      }

      // Recalculate current wait time based on current position
      let currentEstimatedWait = queuePosition.estimatedWaitMinutes || 0;
      
      if (queuePosition.status === 'waiting') {
        // Get current position in queue (may have changed due to other patients being processed)
        try {
          const currentPosition = await this.getCurrentPosition(queuePosition.id);
          currentEstimatedWait = this.calculateEstimatedWaitTime(currentPosition);
        } catch (error) {
          // If we can't get current position, use the stored estimated wait time
          currentEstimatedWait = queuePosition.estimatedWaitMinutes || 0;
        }
      }

      // Use the helper method to cast the status to the proper union type
      return {
        patientId: queuePosition.patientId,
        position: queuePosition.position,
        status: this.castQueueStatus(queuePosition.status), // Use helper instead of type assertion
        estimatedWaitMinutes: currentEstimatedWait,
        checkInTime: queuePosition.checkInTime,
        calledAt: queuePosition.calledAt || undefined,
        completedAt: queuePosition.completedAt || undefined
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to get patient position');
    }
  }

  /**
   * Get the full queue with all waiting and called patients
   * @returns Array of queue positions
   */
  async getQueue(): Promise<QueuePosition[]> {
    try {
      const queue = await prisma.queuePosition.findMany({
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

      // Map each item using the casting helper to ensure proper status types
      return queue.map((item: PrismaQueuePosition) => this.castToQueuePosition(item));
    } catch (error) {
      throw new Error('Failed to retrieve queue');
    }
  }

  /**
   * Call the next patient in the queue
   * @returns Information about the called patient
   */
  async callNextPatient(): Promise<PatientCallResult> {
    try {
      const nextPatient = await prisma.queuePosition.findFirst({
        where: {
          status: 'waiting'
        },
        include: {
          patient: true
        },
        orderBy: {
          position: 'asc'
        }
      });

      if (!nextPatient) {
        return {
          success: false,
          message: 'No patients waiting in queue'
        };
      }

      // Update patient status to 'called'
      await prisma.queuePosition.update({
        where: {
          id: nextPatient.id
        },
        data: {
          status: 'called',
          calledAt: new Date()
        }
      });

      return {
        success: true,
        patient: {
          id: nextPatient.patient.id,
          name: nextPatient.patient.name,
          phone: nextPatient.patient.phone,
          position: nextPatient.position
        },
        message: `Called ${nextPatient.patient.name} (Position ${nextPatient.position})`
      };
    } catch (error) {
      throw new Error('Failed to call next patient');
    }
  }

  /**
   * Mark a patient as completed and remove from queue
   * @param patientId Patient ID to mark as completed
   */
  async markPatientCompleted(patientId: string): Promise<void> {
    try {
      const queuePosition = await prisma.queuePosition.findFirst({
        where: {
          patientId,
          status: {
            in: ['waiting', 'called']
          }
        }
      });

      if (!queuePosition) {
        throw new Error('Patient not found in active queue');
      }

      // Mark patient as completed
      await prisma.queuePosition.update({
        where: {
          id: queuePosition.id
        },
        data: {
          status: 'completed',
          completedAt: new Date()
        }
      });

      // Recalculate positions for remaining patients
      await this.recalculatePositions();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to mark patient as completed');
    }
  }

  /**
   * Get queue statistics
   * @returns Queue statistics
   */
  async getQueueStats(): Promise<QueueStats> {
    try {
      const [waitingCount, calledCount, completedCount] = await Promise.all([
        prisma.queuePosition.count({
          where: { status: 'waiting' }
        }),
        prisma.queuePosition.count({
          where: { status: 'called' }
        }),
        prisma.queuePosition.count({
          where: { status: 'completed' }
        })
      ]);

      // Calculate average wait time for completed patients today
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Type for the completed queue entries we're querying
      type CompletedQueueEntry = {
        checkInTime: Date;
        completedAt: Date | null;
      };

      const completedToday: CompletedQueueEntry[] = await prisma.queuePosition.findMany({
        where: {
          status: 'completed',
          completedAt: {
            gte: today,
            not: null // Ensure we only get entries with completedAt set
          }
        },
        select: {
          checkInTime: true,
          completedAt: true
        }
      });

      let averageWaitTime = 0;
      let longestWaitTime = 0;

      if (completedToday.length > 0) {
        // Type guard to ensure we only process entries with completedAt
        const validEntries = completedToday.filter((p): p is { checkInTime: Date; completedAt: Date } => 
          p.completedAt !== null
        );

        if (validEntries.length > 0) {
          const waitTimes = validEntries.map((p) => {
            const waitTime = (p.completedAt.getTime() - p.checkInTime.getTime()) / (1000 * 60); // minutes
            return waitTime;
          });

          averageWaitTime = waitTimes.reduce((sum, time) => sum + time, 0) / waitTimes.length;
          longestWaitTime = Math.max(...waitTimes);
        }
      }

      return {
        totalWaiting: waitingCount,
        totalCalled: calledCount,
        totalCompleted: completedCount,
        averageWaitTime: Math.round(averageWaitTime),
        longestWaitTime: Math.round(longestWaitTime)
      };
    } catch (error) {
      throw new Error('Failed to get queue statistics');
    }
  }

  /**
   * Get the next available position in the queue
   * @returns Next position number
   */
  private async getNextAvailablePosition(): Promise<number> {
    const lastPosition = await prisma.queuePosition.findFirst({
      where: {
        status: {
          in: ['waiting', 'called']
        }
      },
      orderBy: {
        position: 'desc'
      },
      select: {
        position: true
      }
    });

    return (lastPosition?.position || 0) + 1;
  }

  /**
   * Calculate estimated wait time based on position
   * @param position Position in queue
   * @returns Estimated wait time in minutes
   */
  private calculateEstimatedWaitTime(position: number): number {
    // Simple calculation: position * average time per patient
    // In a real system, this could be more sophisticated based on historical data
    return Math.max(0, (position - 1) * QueueService.AVERAGE_WAIT_PER_POSITION);
  }

  /**
   * Get current position for a queue entry (accounting for completed patients)
   * @param queuePositionId Queue position ID
   * @returns Current position in queue
   */
  private async getCurrentPosition(queuePositionId: string): Promise<number> {
    const queuePosition = await prisma.queuePosition.findUnique({
      where: { id: queuePositionId }
    });

    if (!queuePosition) {
      throw new Error('Queue position not found');
    }

    // Count how many patients are ahead in the queue (waiting or called)
    const patientsAhead = await prisma.queuePosition.count({
      where: {
        position: {
          lt: queuePosition.position
        },
        status: {
          in: ['waiting', 'called']
        }
      }
    });

    return patientsAhead + 1;
  }

  /**
   * Recalculate positions for all active patients after someone is completed
   * This ensures there are no gaps in the queue positions
   */
  private async recalculatePositions(): Promise<void> {
    const activePatients = await prisma.queuePosition.findMany({
      where: {
        status: {
          in: ['waiting', 'called']
        }
      },
      orderBy: {
        position: 'asc'
      }
    });

    // Update positions to be sequential (1, 2, 3, ...)
    for (let i = 0; i < activePatients.length; i++) {
      const newPosition = i + 1;
      if (activePatients[i].position !== newPosition) {
        await prisma.queuePosition.update({
          where: {
            id: activePatients[i].id
          },
          data: {
            position: newPosition,
            estimatedWaitMinutes: this.calculateEstimatedWaitTime(newPosition)
          }
        });
      }
    }
  }
}
// apps\api\src\services\queue-service.ts
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
import { notificationService } from './notification-service';
import { realtimeService } from './realtime-service';

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
      const queuePosition = this.castToQueuePosition(result);

      // Send check-in confirmation SMS
      try {
        await notificationService.sendCheckInConfirmation(
          queuePosition.patient.name,
          queuePosition.patient.phone,
          queuePosition.position,
          queuePosition.estimatedWaitMinutes || 0,
          queuePosition.patient.id
        );
        console.log(`✅ Check-in confirmation SMS sent to ${queuePosition.patient.name} at ${queuePosition.patient.phone}`);
      } catch (smsError) {
        // Log SMS error but don't fail the check-in process
        console.error('⚠️  Failed to send check-in confirmation SMS:', smsError);
      }

      // After a new patient checks in, check if any existing patients need "get ready" SMS
      // This handles the case where the queue was shorter and now someone is at position 3
      await this.checkAndSendGetReadySMS();

      // Broadcast real-time updates
      try {
        // Broadcast patient check-in event
        realtimeService.broadcastPatientCheckedIn(
          queuePosition.patient.id,
          queuePosition.patient.name,
          queuePosition.position,
          queuePosition.estimatedWaitMinutes || 0,
          queuePosition.position, // totalInQueue (using position as approximation)
          queuePosition.checkInTime,
          appointmentTime
        );

        console.log(`📡 Real-time updates sent for new patient: ${queuePosition.patient.name}`);
      } catch (realtimeError) {
        // Log real-time error but don't fail the check-in process
        console.error('⚠️  Failed to send real-time updates:', realtimeError);
      }

      return queuePosition;
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

      // Send "come in now" SMS to the called patient
      try {
        await notificationService.sendCallNowSMS(
          nextPatient.patient.name,
          nextPatient.patient.phone,
          nextPatient.patient.id
        );
        console.log(`✅ "Come in now" SMS sent to ${nextPatient.patient.name} at ${nextPatient.patient.phone}`);
      } catch (smsError) {
        // Log SMS error but don't fail the call operation
        console.error('⚠️  Failed to send "come in now" SMS:', smsError);
      }

      // After calling a patient, check if we need to send "get ready" SMS to the patient who is now 2 positions away
      await this.checkAndSendGetReadySMS();

      // Broadcast real-time updates
      try {
        // Get current queue size for the broadcast
        const currentQueue = await this.getQueue();
        
        // Broadcast patient called event
        realtimeService.broadcastPatientCalled(
          nextPatient.patient.id,
          nextPatient.patient.name,
          nextPatient.position,
          'staff', // calledBy - could be enhanced to track actual staff member
          currentQueue.length
        );

        console.log(`📡 Real-time updates sent for called patient: ${nextPatient.patient.name}`);
      } catch (realtimeError) {
        // Log real-time error but don't fail the call operation
        console.error('⚠️  Failed to send real-time updates:', realtimeError);
      }

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

      // After completing a patient, check if we need to send "get ready" SMS to patients who are now 2 positions away
      await this.checkAndSendGetReadySMS();

      // Broadcast real-time updates
      try {
        // Get updated queue for accurate counts
        const updatedQueue = await this.getQueue();
        
        // Calculate service time (simplified - could be enhanced with actual tracking)
        const serviceTime = 15; // Default service time in minutes
        const waitTime = queuePosition.estimatedWaitMinutes || 0;
        
        // Broadcast patient completed event
        realtimeService.broadcastPatientCompleted(
          patientId,
          'staff', // completedBy - could be enhanced to track actual staff member
          waitTime,
          serviceTime,
          updatedQueue.length
        );

        // Notify all remaining patients of their updated positions
        for (const position of updatedQueue) {
          if (position.status === 'waiting') {
            // Calculate new position based on current queue
            const newPosition = updatedQueue.findIndex(p => p.patient.id === position.patient.id) + 1;
            realtimeService.broadcastQueuePositionUpdate(
              position.patient.id,
              position.position,
              newPosition,
              position.estimatedWaitMinutes || 0,
              updatedQueue.length,
              'patient_completed'
            );
          }
        }

        console.log(`📡 Real-time updates sent for completed patient: ${patientId}`);
      } catch (realtimeError) {
        // Log real-time error but don't fail the completion operation
        console.error('⚠️  Failed to send real-time updates:', realtimeError);
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to mark patient as completed');
    }
  }

  /**
   * Mark a patient as no-show and remove from queue
   * @param patientId Patient ID to mark as no-show
   */
  async markPatientNoShow(patientId: string): Promise<void> {
    try {
      const queuePosition = await prisma.queuePosition.findFirst({
        where: {
          patientId,
          status: {
            in: ['waiting', 'called']
          }
        },
        include: {
          patient: true
        }
      });

      if (!queuePosition) {
        throw new Error('Patient not found in active queue');
      }

      // Mark patient as no-show
      await prisma.queuePosition.update({
        where: {
          id: queuePosition.id
        },
        data: {
          status: 'no_show',
          completedAt: new Date()
        }
      });

      // Recalculate positions for remaining patients
      await this.recalculatePositions();

      // After marking no-show, check if we need to send "get ready" SMS to patients who are now 2 positions away
      await this.checkAndSendGetReadySMS();

      // Broadcast real-time updates
      try {
        // Get updated queue for accurate counts
        const updatedQueue = await this.getQueue();
        
        // Calculate wait time
        const waitTime = queuePosition.estimatedWaitMinutes || 0;
        
        // Broadcast patient no-show event
        realtimeService.broadcastPatientNoShow(
          patientId,
          queuePosition.patient.name,
          'staff', // markedBy - could be enhanced to track actual staff member
          waitTime,
          updatedQueue.length
        );

        // Notify all remaining patients of their updated positions
        for (const position of updatedQueue) {
          if (position.status === 'waiting') {
            // Calculate new position based on current queue
            const newPosition = updatedQueue.findIndex(p => p.patient.id === position.patient.id) + 1;
            realtimeService.broadcastQueuePositionUpdate(
              position.patient.id,
              position.position,
              newPosition,
              position.estimatedWaitMinutes || 0,
              updatedQueue.length,
              'patient_no_show'
            );
          }
        }

        console.log(`📡 Real-time updates sent for no-show patient: ${patientId}`);
      } catch (realtimeError) {
        // Log real-time error but don't fail the no-show operation
        console.error('⚠️  Failed to send real-time updates:', realtimeError);
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to mark patient as no-show');
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

  /**
   * Check if any patients are 2 positions away from being called and send "get ready" SMS
   * This method is called after queue changes (patient called or completed)
   */
  private async checkAndSendGetReadySMS(): Promise<void> {
    try {
      // Find patients who are in position 3 (2 positions away from being called)
      // Position 1 = currently being called, Position 2 = next up, Position 3 = get ready
      const patientsToNotify = await prisma.queuePosition.findMany({
        where: {
          status: 'waiting',
          position: 3
        },
        include: {
          patient: true
        }
      });

      // Send "get ready" SMS to each patient at position 3
      for (const queuePosition of patientsToNotify) {
        try {
          // Check if we've already sent a "get ready" SMS to this patient
          // We'll use a simple approach: check if they were recently notified
          const recentNotification = await this.hasRecentGetReadyNotification(queuePosition.patientId);
          
          if (!recentNotification) {
            await notificationService.sendGetReadySMS(
              queuePosition.patient.name,
              queuePosition.patient.phone,
              queuePosition.patient.id
            );
            
            // Send real-time "get ready" notification via position update
            try {
              realtimeService.broadcastQueuePositionUpdate(
                queuePosition.patient.id,
                queuePosition.position,
                queuePosition.position,
                queuePosition.estimatedWaitMinutes || 15,
                queuePosition.position, // totalInQueue approximation
                'queue_reorder'
              );
              console.log(`📡 Real-time "get ready" notification sent to ${queuePosition.patient.name}`);
            } catch (realtimeError) {
              console.error('⚠️  Failed to send real-time "get ready" notification:', realtimeError);
            }
            
            console.log(`✅ "Get ready" SMS sent to ${queuePosition.patient.name} at ${queuePosition.patient.phone} (Position 3)`);
          }
        } catch (smsError) {
          // Log SMS error but continue with other patients
          console.error(`⚠️  Failed to send "get ready" SMS to ${queuePosition.patient.name}:`, smsError);
        }
      }
    } catch (error) {
      console.error('⚠️  Error checking for "get ready" SMS notifications:', error);
    }
  }

  /**
 * Add these methods to your QueueService class
 * These are the missing methods referenced in your test files
 */

  /**
   * Clear all queue entries - useful for testing
   */
  async clearQueue(): Promise<void> {
    try {
      await prisma.queuePosition.deleteMany({});
      await prisma.patient.deleteMany({});
      console.log('✅ Queue cleared successfully');
    } catch (error) {
      console.error('❌ Failed to clear queue:', error);
      throw new Error('Failed to clear queue');
    }
  }

  /**
   * Health check for the queue service
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      // Test database connection
      await prisma.$queryRaw`SELECT 1`;

      // Test basic operations
      const queueCount = await prisma.queuePosition.count();

      return {
        healthy: true,
        message: `Queue service healthy. Current queue size: ${queueCount}`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        healthy: false,
        message: `Database connection failed: ${errorMessage}`
      };
    }
  }
  
  /**
   * Check if a patient has received a "get ready" notification recently
   * This prevents duplicate notifications when queue positions change
   */
  private async hasRecentGetReadyNotification(patientId: string): Promise<boolean> {
    try {
      // Check if there's a recent SMS notification for this patient
      // We'll look for notifications sent in the last 30 minutes
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      
      const recentNotification = await prisma.smsNotification.findFirst({
        where: {
          patientId,
          message: {
            contains: 'you\'re next!' // Part of the "get ready" message
          },
          sentAt: {
            gte: thirtyMinutesAgo
          }
        }
      });

      return recentNotification !== null;
    } catch (error) {
      console.error('Error checking recent notifications:', error);
      return false; // If we can't check, err on the side of sending the notification
    }
  }


}
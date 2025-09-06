import {
  Router, Request, Response } from 'express';
import { QueueService } from '../services/queue-service';
import { CheckInRequest } from '../types/queue';

const router = Router();
const queueService = new QueueService();

// Create a shared handler function
const handlePositionRequest = async (req: Request, res: Response) => {
  try {
    const patientId = req.params.id;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Patient ID is required'
        }
      });
    }

    const queueStatus = await queueService.getPosition(patientId);

    res.json({
      success: true,
      data: queueStatus
    });
  } catch (error) {
    console.error('Get position error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to get position';
    const statusCode = errorMessage.includes('not found') ? 404 : 500;

    res.status(statusCode).json({
      success: false,
      error: {
        code: statusCode === 404 ? 'PATIENT_NOT_FOUND' : 'INTERNAL_ERROR',
        message: errorMessage
      }
    });
  }
};

// // Use the same handler for both routes
// router.get('/position/:id', handlePositionRequest);
// router.get('/status/:id', handlePositionRequest);



/**
 * POST /api/checkin
 * Check in a patient to the queue
 */
router.post('/checkin', async (req, res) => {
  try {
    const checkInData: CheckInRequest = req.body;
    
    const queuePosition = await queueService.checkIn(checkInData);
    
    res.status(201).json({
      success: true,
      data: {
        patientId: queuePosition.patientId,
        position: queuePosition.position,
        estimatedWait: queuePosition.estimatedWaitMinutes || 0
      },
      message: 'Successfully checked in to queue'
    });
  } catch (error) {
    console.error('Check-in error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to check in';
    const statusCode = errorMessage.includes('Validation error') || 
                      errorMessage.includes('already in the queue') ? 400 : 500;
    
    res.status(statusCode).json({
      success: false,
      error: {
        code: statusCode === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR',
        message: errorMessage
      }
    });
  }
});

/**
 * GET /api/position/:id
 * Get current position for a patient
 */
router.get('/position/:id', async (req, res) => {
  try {
    const patientId = req.params.id;
    
    if (!patientId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Patient ID is required'
        }
      });
    }
    
    const queueStatus = await queueService.getPosition(patientId);
    
    res.json({
      success: true,
      data: queueStatus
    });
  } catch (error) {
    console.error('Get position error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to get position';
    const statusCode = errorMessage.includes('not found') ? 404 : 500;
    
    res.status(statusCode).json({
      success: false,
      error: {
        code: statusCode === 404 ? 'PATIENT_NOT_FOUND' : 'INTERNAL_ERROR',
        message: errorMessage
      }
    });
  }
});

/**
 * GET /api/status/:id
 * Alias for position endpoint (for compatibility)
 */
router.get('/status/:id', handlePositionRequest);

/**
 * GET /api/queue
 * Get the full queue (for staff dashboard)
 */
router.get('/queue', async (req, res) => {
  try {
    const queue = await queueService.getQueue();
    
    res.json({
      success: true,
      data: queue,
      count: queue.length
    });
  } catch (error) {
    console.error('Get queue error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve queue'
      }
    });
  }
});

/**
 * GET /api/queue/stats
 * Get queue statistics
 */
router.get('/queue/stats', async (req, res) => {
  try {
    const stats = await queueService.getQueueStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get queue stats error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve queue statistics'
      }
    });
  }
});

export default router;
import express from 'express';
import { QueueService } from '../services/queue-service';

const router = express.Router();
const queueService = new QueueService();

// Simple authentication middleware (basic implementation for MVP)
const authenticateStaff = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      }
    });
  }
  
  // For MVP, we'll use a simple token check
  // In production, this should validate JWT tokens properly
  const token = authHeader.substring(7);
  if (!token || token.length < 10) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid authentication token'
      }
    });
  }
  
  // Add user info to request (simplified for MVP)
  (req as any).user = { id: 'staff-1', username: 'staff', role: 'staff' };
  next();
};

/**
 * POST /api/staff/login
 * Simple staff authentication (MVP implementation)
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Username and password are required'
        }
      });
    }
    
    // Simple hardcoded credentials for MVP
    // In production, this should check against a proper user database
    if (username === 'staff' && password === 'smartwait2024') {
      const sessionToken = `staff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      res.json({
        success: true,
        data: {
          token: sessionToken,
          user: {
            id: 'staff-1',
            username: 'staff',
            role: 'staff'
          },
          expiresIn: '8h'
        },
        message: 'Login successful'
      });
    } else {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid username or password'
        }
      });
    }
  } catch (error) {
    console.error('Staff login error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Login failed'
      }
    });
  }
});

/**
 * GET /api/staff/queue
 * Get the full queue for staff dashboard
 */
router.get('/queue', authenticateStaff, async (req, res) => {
  try {
    const queue = await queueService.getQueue();
    
    res.json({
      success: true,
      data: queue,
      count: queue.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Staff get queue error:', error);
    
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
 * POST /api/staff/call-next
 * Call the next patient in the queue
 */
router.post('/call-next', authenticateStaff, async (req, res) => {
  try {
    const result = await queueService.callNextPatient();
    
    if (result.success) {
      res.json({
        success: true,
        data: result.patient,
        message: result.message
      });
    } else {
      res.status(404).json({
        success: false,
        error: {
          code: 'NO_PATIENTS_WAITING',
          message: result.message
        }
      });
    }
  } catch (error) {
    console.error('Call next patient error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to call next patient'
      }
    });
  }
});

/**
 * POST /api/staff/complete
 * Mark a patient as completed
 */
router.post('/complete', authenticateStaff, async (req, res) => {
  try {
    const { patientId } = req.body;
    
    if (!patientId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Patient ID is required'
        }
      });
    }
    
    await queueService.markPatientCompleted(patientId);
    
    res.json({
      success: true,
      message: 'Patient marked as completed'
    });
  } catch (error) {
    console.error('Mark patient completed error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to mark patient as completed';
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
 * GET /api/staff/stats
 * Get queue statistics for staff dashboard
 */
router.get('/stats', authenticateStaff, async (req, res) => {
  try {
    const stats = await queueService.getQueueStats();
    
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get staff stats error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve statistics'
      }
    });
  }
});

export default router;
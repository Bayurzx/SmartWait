import express from 'express';
import { QueueService } from '../services/queue-service';
import { AuthService } from '../services/auth-service';
import { authenticateStaff, requireAdmin } from '../middleware/auth';
import { LoginRequest } from '../types/auth';

const router = express.Router();
const queueService = new QueueService();
const authService = new AuthService();

/**
 * POST /api/staff/login
 * Staff authentication with username and password
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password }: LoginRequest = req.body;
    
    // Validate input
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Username and password are required'
        }
      });
    }

    // Authenticate user
    const authResult = await authService.authenticateStaff(username, password);
    
    if (authResult.success && authResult.data) {
      res.json({
        success: true,
        data: authResult.data,
        message: 'Login successful'
      });
    } else {
      const statusCode = authResult.error?.code === 'VALIDATION_ERROR' ? 400 : 401;
      res.status(statusCode).json({
        success: false,
        error: authResult.error
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
 * POST /api/staff/logout
 * Logout staff member and invalidate session
 */
router.post('/logout', authenticateStaff, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.substring(7); // Remove 'Bearer ' prefix
    
    if (token) {
      const logoutSuccess = await authService.logout(token);
      
      if (logoutSuccess) {
        res.json({
          success: true,
          message: 'Logout successful'
        });
      } else {
        res.status(400).json({
          success: false,
          error: {
            code: 'LOGOUT_FAILED',
            message: 'Failed to logout'
          }
        });
      }
    } else {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'No valid token provided'
        }
      });
    }
  } catch (error) {
    console.error('Staff logout error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Logout failed'
      }
    });
  }
});

/**
 * GET /api/staff/me
 * Get current user information
 */
router.get('/me', authenticateStaff, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        user: req.user,
        sessionId: req.sessionId
      }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get user information'
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

/**
 * GET /api/staff/sessions
 * Get active staff sessions (admin only)
 */
router.get('/sessions', authenticateStaff, requireAdmin, async (req, res) => {
  try {
    const activeSessions = await authService.getActiveSessions();
    
    res.json({
      success: true,
      data: activeSessions,
      count: activeSessions.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get active sessions error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve active sessions'
      }
    });
  }
});

/**
 * POST /api/staff/cleanup-sessions
 * Clean up expired sessions (admin only)
 */
router.post('/cleanup-sessions', authenticateStaff, requireAdmin, async (req, res) => {
  try {
    const cleanedCount = await authService.cleanupExpiredSessions();
    
    res.json({
      success: true,
      data: {
        cleanedSessions: cleanedCount
      },
      message: `Cleaned up ${cleanedCount} expired sessions`
    });
  } catch (error) {
    console.error('Cleanup sessions error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to cleanup expired sessions'
      }
    });
  }
});

export default router;
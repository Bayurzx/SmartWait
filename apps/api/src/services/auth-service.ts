import bcrypt from 'bcrypt';
import { prisma } from '../config/database';
import { AuthResult, StaffUser, SessionData } from '../types/auth';

export class AuthService {
  private readonly SALT_ROUNDS = 12;
  private readonly SESSION_DURATION_HOURS = 8;

  // For MVP, we'll use hardcoded staff credentials
  // In production, this would come from a staff users table
  private readonly STAFF_CREDENTIALS = {
    'staff': {
      id: 'staff-1',
      username: 'staff',
      passwordHash: '$2b$12$bgexq9w9b3inL93T8KwmVO7UD43.r7AmWfpZAIsCkcP.W1ruHEcLe', // 'smartwait2024'
      role: 'staff' as const
    },
    'admin': {
      id: 'admin-1', 
      username: 'admin',
      passwordHash: '$2b$12$cFPKpBzsu20fKr9DpDvRiO0wkD.4RS0oGXNWu.2o6jvpUpFnAr5E.', // 'admin2024'
      role: 'admin' as const
    }
  };

  /**
   * Authenticate staff member with username and password
   */
  async authenticateStaff(username: string, password: string): Promise<AuthResult> {
    try {
      // Validate input
      if (!username || !password) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Username and password are required'
          }
        };
      }

      // Check if user exists in our hardcoded credentials
      const staffMember = this.STAFF_CREDENTIALS[username as keyof typeof this.STAFF_CREDENTIALS];
      if (!staffMember) {
        return {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid username or password'
          }
        };
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, staffMember.passwordHash);
      if (!isPasswordValid) {
        return {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid username or password'
          }
        };
      }

      // Create session token
      const sessionToken = this.generateSessionToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.SESSION_DURATION_HOURS);

      // Store session in database
      await prisma.staffSession.create({
        data: {
          username: staffMember.username,
          sessionToken,
          expiresAt
        }
      });

      // Return successful authentication
      return {
        success: true,
        data: {
          token: sessionToken,
          user: {
            id: staffMember.id,
            username: staffMember.username,
            role: staffMember.role
          },
          expiresAt: expiresAt.toISOString(),
          expiresIn: `${this.SESSION_DURATION_HOURS}h`
        }
      };

    } catch (error) {
      console.error('Authentication error:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Authentication failed'
        }
      };
    }
  }

  /**
   * Validate session token and return user data
   */
  async validateSession(token: string): Promise<SessionData | null> {
    try {
      if (!token) {
        return null;
      }

      // Find active session in database
      const session = await prisma.staffSession.findFirst({
        where: {
          sessionToken: token,
          expiresAt: {
            gt: new Date()
          }
        }
      });

      if (!session) {
        return null;
      }

      // Get user data from hardcoded credentials
      const staffMember = this.STAFF_CREDENTIALS[session.username as keyof typeof this.STAFF_CREDENTIALS];
      if (!staffMember) {
        return null;
      }

      return {
        sessionId: session.id,
        user: {
          id: staffMember.id,
          username: staffMember.username,
          role: staffMember.role
        },
        expiresAt: session.expiresAt.toISOString()
      };

    } catch (error) {
      console.error('Session validation error:', error);
      return null;
    }
  }

  /**
   * Logout staff member by invalidating session
   */
  async logout(token: string): Promise<boolean> {
    try {
      if (!token) {
        return false;
      }

      // Delete session from database
      const result = await prisma.staffSession.deleteMany({
        where: {
          sessionToken: token
        }
      });

      return result.count > 0;

    } catch (error) {
      console.error('Logout error:', error);
      return false;
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const result = await prisma.staffSession.deleteMany({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      });

      return result.count;
    } catch (error) {
      console.error('Session cleanup error:', error);
      return 0;
    }
  }

  /**
   * Generate a secure session token
   */
  private generateSessionToken(): string {
    const timestamp = Date.now().toString();
    const randomBytes = Math.random().toString(36).substring(2, 15);
    const moreRandomBytes = Math.random().toString(36).substring(2, 15);
    
    return `staff_${timestamp}_${randomBytes}${moreRandomBytes}`;
  }

  /**
   * Hash password for storage (utility method for future use)
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * Get all active sessions (for admin purposes)
   */
  async getActiveSessions(): Promise<Array<{ username: string; createdAt: Date; expiresAt: Date }>> {
    try {
      const sessions = await prisma.staffSession.findMany({
        where: {
          expiresAt: {
            gt: new Date()
          }
        },
        select: {
          username: true,
          createdAt: true,
          expiresAt: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return sessions;
    } catch (error) {
      console.error('Get active sessions error:', error);
      return [];
    }
  }
}
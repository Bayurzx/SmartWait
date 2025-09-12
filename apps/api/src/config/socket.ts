// apps\api\src\config\socket.ts
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { Server as HTTPServer } from 'http';
import { AuthService } from '../services/auth-service';

// Extend Socket interface to include custom properties
declare module 'socket.io' {
  interface Socket {
    userId?: string;
    userType?: 'patient' | 'staff';
    username?: string;
    role?: string;
    authenticated?: boolean;
  }
}

// Socket.io server instance
let io: SocketIOServer | null = null;

// Redis clients for Socket.io adapter
let pubClient: ReturnType<typeof createClient> | null = null;
let subClient: ReturnType<typeof createClient> | null = null;

// Auth service instance
const authService = new AuthService();

// Connected user interface
interface ConnectedUser {
  socketId: string;
  userId: string;
  userType: 'patient' | 'staff';
  username?: string;
  role?: string;
  connectedAt: Date;
}

// Connected users tracking
const connectedUsers = new Map<string, ConnectedUser>();

// Socket to user mapping
const socketToUser = new Map<string, string>();

/**
 * Initialize Socket.io server with Redis adapter for scaling
 */
export const initializeSocketIO = async (httpServer: HTTPServer): Promise<SocketIOServer> => {
  try {
    console.log('🔌 Initializing Socket.io server...');

    // Create Socket.io server
    io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000
    });

    // Create Redis clients for adapter
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    pubClient = createClient({ url: redisUrl });
    subClient = pubClient.duplicate();

    // Connect Redis clients
    await Promise.all([
      pubClient.connect(),
      subClient.connect()
    ]);

    console.log('✅ Redis clients for Socket.io connected');

    // Set up Redis adapter
    io.adapter(createAdapter(pubClient, subClient));
    console.log('✅ Socket.io Redis adapter configured');

    // Set up connection handling
    setupSocketHandlers(io);

    console.log('🚀 Socket.io server initialized successfully');
    return io;

  } catch (error) {
    console.error('❌ Failed to initialize Socket.io:', error);
    throw error;
  }
};

/**
 * Authenticate WebSocket connection
 */
const authenticateSocket = async (socket: any, next: any) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    const patientId = socket.handshake.auth?.patientId || socket.handshake.query?.patientId;
    
    // Try staff authentication first if token is provided
    if (token) {
      try {
        const sessionData = await authService.validateSession(token);
        
        if (sessionData) {
          // Staff authentication successful
          socket.userId = sessionData.user.id;
          socket.userType = 'staff';
          socket.username = sessionData.user.username;
          socket.role = sessionData.user.role;
          socket.authenticated = true;
          
          console.log(`🔐 Staff authenticated: ${sessionData.user.username} (${sessionData.user.role})`);
          return next();
        }
      } catch (error) {
        console.error('❌ Staff token validation failed:', error);
        // Continue to patient authentication if staff auth fails
      }
    }

    // Try patient authentication if patientId is provided
    if (patientId && typeof patientId === 'string' && patientId.length > 0) {
      // Basic patient ID validation - check format (UUID-like)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      
      if (uuidRegex.test(patientId)) {
        // Patient authentication successful
        socket.userId = patientId;
        socket.userType = 'patient';
        socket.authenticated = true;
        
        console.log(`🔐 Patient authenticated: ${patientId}`);
        return next();
      } else {
        console.error(`❌ Invalid patient ID format: ${patientId}`);
        return next(new Error('Invalid patient ID format'));
      }
    }

    // No valid authentication provided
    if (!token && !patientId) {
      return next(new Error('Authentication required: provide either token (staff) or patientId (patient)'));
    }

    return next(new Error('Invalid authentication credentials'));
    
  } catch (error) {
    console.error('❌ Socket authentication error:', error);
    return next(new Error('Authentication failed'));
  }
};

/**
 * Set up Socket.io connection handlers
 */
const setupSocketHandlers = (io: SocketIOServer): void => {
  // Add authentication middleware
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    const userId = socket.userId;
    const userType = socket.userType;
    const username = socket.username;
    
    if (!userId || !userType) {
      console.error('❌ Socket connected without proper authentication data');
      socket.disconnect();
      return;
    }
    
    console.log(`👤 Authenticated client connected: ${socket.id} (${userType}: ${userId})`);

    // Track connected user
    connectedUsers.set(userId, {
      socketId: socket.id,
      userId,
      userType,
      username,
      role: socket.role,
      connectedAt: new Date()
    });
    
    socketToUser.set(socket.id, userId);

    // Auto-join appropriate rooms based on user type
    if (userType === 'staff') {
      socket.join('staff');
      console.log(`👨‍⚕️ Staff ${username} auto-joined staff room`);
      
      socket.emit('authenticated', {
        userType: 'staff',
        username,
        role: socket.role,
        rooms: ['staff'],
        message: 'Successfully authenticated as staff member'
      });
    } else if (userType === 'patient') {
      socket.join('patients');
      socket.join(`patient_${userId}`);
      console.log(`👤 Patient ${userId} auto-joined patient rooms`);
      
      socket.emit('authenticated', {
        userType: 'patient',
        patientId: userId,
        rooms: ['patients', `patient_${userId}`],
        message: 'Successfully authenticated as patient'
      });
    }

    // Handle manual room joining (with validation)
    socket.on('join-room', async (data: { room: string; patientId?: string }) => {
      try {
        const { room, patientId } = data;
        
        if (!socket.authenticated) {
          socket.emit('error', { message: 'Authentication required to join rooms' });
          return;
        }

        // Validate room access permissions
        const canJoin = await validateRoomAccess(socket, room, patientId);
        
        if (!canJoin.allowed) {
          socket.emit('error', { message: canJoin.reason });
          return;
        }

        socket.join(room);
        console.log(`🚪 User ${userId} (${userType}) joined room: ${room}`);
        
        socket.emit('room-joined', {
          room,
          message: `Successfully joined room: ${room}`,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.error(`❌ Error joining room:`, error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // Handle leaving rooms
    socket.on('leave-room', (room: string) => {
      try {
        if (!socket.authenticated) {
          socket.emit('error', { message: 'Authentication required' });
          return;
        }

        socket.leave(room);
        console.log(`🚪 User ${userId} (${userType}) left room: ${room}`);
        
        socket.emit('room-left', {
          room,
          message: `Successfully left room: ${room}`,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.error(`❌ Error leaving room:`, error);
        socket.emit('error', { message: 'Failed to leave room' });
      }
    });

    // Handle getting user's current rooms
    socket.on('get-rooms', () => {
      try {
        if (!socket.authenticated) {
          socket.emit('error', { message: 'Authentication required' });
          return;
        }

        const rooms = Array.from(socket.rooms).filter(room => room !== socket.id);
        
        socket.emit('current-rooms', {
          rooms,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.error(`❌ Error getting rooms:`, error);
        socket.emit('error', { message: 'Failed to get rooms' });
      }
    });

    // Handle heartbeat/ping for connection monitoring
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`👤 Client disconnected: ${socket.id} (${userType}: ${userId}), reason: ${reason}`);
      
      // Clean up tracking
      if (userId) {
        connectedUsers.delete(userId);
      }
      socketToUser.delete(socket.id);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`❌ Socket error for ${socket.id} (${userType}: ${userId}):`, error);
    });
  });

  // Log server events
  io.engine.on('connection_error', (err) => {
    console.error('❌ Socket.io connection error:', err);
  });
};

/**
 * Validate if a user can access a specific room
 */
const validateRoomAccess = async (
  socket: any, 
  room: string, 
  patientId?: string
): Promise<{ allowed: boolean; reason?: string }> => {
  const userType = socket.userType;
  const userId = socket.userId;
  const role = socket.role;

  // Staff can access most rooms
  if (userType === 'staff') {
    // Staff room - all staff can access
    if (room === 'staff') {
      return { allowed: true };
    }
    
    // Patient-specific rooms - staff can access for management
    if (room.startsWith('patient_')) {
      return { allowed: true };
    }
    
    // General patients room - staff can access
    if (room === 'patients') {
      return { allowed: true };
    }
    
    // Admin-only rooms
    if (room === 'admin' && role !== 'admin') {
      return { allowed: false, reason: 'Admin access required' };
    }
    
    return { allowed: true };
  }

  // Patient access rules
  if (userType === 'patient') {
    // Patients can access general patients room
    if (room === 'patients') {
      return { allowed: true };
    }
    
    // Patients can only access their own patient room
    if (room === `patient_${userId}`) {
      return { allowed: true };
    }
    
    // Patients cannot access staff or other patient rooms
    if (room === 'staff' || room.startsWith('patient_')) {
      return { allowed: false, reason: 'Access denied to this room' };
    }
    
    return { allowed: false, reason: 'Room not found or access denied' };
  }

  return { allowed: false, reason: 'Invalid user type' };
};

/**
 * Get Socket.io server instance
 */
export const getSocketIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.io server not initialized. Call initializeSocketIO first.');
  }
  return io;
};

/**
 * Broadcast message to specific room
 */
export const broadcastToRoom = (room: string, event: string, data: any): void => {
  if (io) {
    io.to(room).emit(event, data);
    console.log(`📡 Broadcasted ${event} to room: ${room}`);
  }
};

/**
 * Broadcast message to specific patient
 */
export const broadcastToPatient = (patientId: string, event: string, data: any): void => {
  broadcastToRoom(`patient_${patientId}`, event, data);
};

/**
 * Broadcast message to all staff
 */
export const broadcastToStaff = (event: string, data: any): void => {
  broadcastToRoom('staff', event, data);
};

/**
 * Broadcast message to all patients
 */
export const broadcastToPatients = (event: string, data: any): void => {
  broadcastToRoom('patients', event, data);
};

/**
 * Get connected users information
 */
export const getConnectedUsers = () => {
  const users = Array.from(connectedUsers.values());
  return {
    total: users.length,
    staff: users.filter(u => u.userType === 'staff').length,
    patients: users.filter(u => u.userType === 'patient').length,
    users: users.map(u => ({
      userId: u.userId,
      userType: u.userType,
      username: u.username,
      role: u.role,
      connectedAt: u.connectedAt
    }))
  };
};

/**
 * Get room information
 */
export const getRoomInfo = async (roomName?: string) => {
  if (!io) {
    throw new Error('Socket.io server not initialized');
  }

  if (roomName) {
    // Get specific room info
    const room = io.sockets.adapter.rooms.get(roomName);
    return {
      room: roomName,
      memberCount: room ? room.size : 0,
      members: room ? Array.from(room) : []
    };
  }

  // Get all rooms info
  const rooms = Array.from(io.sockets.adapter.rooms.entries())
    .filter(([roomName]) => !socketToUser.has(roomName)) // Filter out socket ID rooms
    .map(([roomName, room]) => ({
      room: roomName,
      memberCount: room.size,
      members: Array.from(room)
    }));

  return { rooms };
};

/**
 * Disconnect a specific user
 */
export const disconnectUser = (userId: string, reason?: string) => {
  const user = connectedUsers.get(userId);
  if (user && io) {
    const socket = io.sockets.sockets.get(user.socketId);
    if (socket) {
      socket.disconnect(true);
      console.log(`🔌 Forcibly disconnected user ${userId}: ${reason || 'No reason provided'}`);
      return true;
    }
  }
  return false;
};

/**
 * Send message to specific user
 */
export const sendToUser = (userId: string, event: string, data: any) => {
  const user = connectedUsers.get(userId);
  if (user && io) {
    const socket = io.sockets.sockets.get(user.socketId);
    if (socket) {
      socket.emit(event, data);
      console.log(`📤 Sent ${event} to user ${userId}`);
      return true;
    }
  }
  return false;
};

/**
 * Check if user is connected
 */
export const isUserConnected = (userId: string): boolean => {
  return connectedUsers.has(userId);
};

/**
 * Get Socket.io server health status
 */
export const getSocketIOHealth = () => {
  try {
    if (!io) {
      return {
        status: 'unhealthy',
        error: 'Socket.io server not initialized',
        timestamp: new Date().toISOString()
      };
    }

    const connectedClients = io.engine.clientsCount;
    const connectedUsersInfo = getConnectedUsers();
    
    return {
      status: 'healthy',
      connectedClients,
      authenticatedUsers: connectedUsersInfo.total,
      staffUsers: connectedUsersInfo.staff,
      patientUsers: connectedUsersInfo.patients,
      redisAdapter: !!pubClient?.isOpen && !!subClient?.isOpen,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Graceful shutdown of Socket.io and Redis clients
 */
export const shutdownSocketIO = async (): Promise<void> => {
  try {
    console.log('🔌 Shutting down Socket.io server...');

    if (io) {
      io.close();
      io = null;
    }

    if (pubClient?.isOpen) {
      await pubClient.quit();
      pubClient = null;
    }

    if (subClient?.isOpen) {
      await subClient.quit();
      subClient = null;
    }

    console.log('✅ Socket.io server shut down successfully');
  } catch (error) {
    console.error('❌ Error shutting down Socket.io:', error);
  }
};

// Graceful shutdown on process termination
process.on('SIGTERM', shutdownSocketIO);
process.on('SIGINT', shutdownSocketIO);
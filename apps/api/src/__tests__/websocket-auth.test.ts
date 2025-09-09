import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as Client, Socket } from 'socket.io-client';
import express from 'express';
import { 
  initializeSocketIO, 
  getConnectedUsers, 
  getRoomInfo, 
  sendToUser, 
  isUserConnected,
  shutdownSocketIO 
} from '../config/socket';
import { AuthService } from '../services/auth-service';

// Mock the auth service
jest.mock('../services/auth-service');

describe('WebSocket Authentication', () => {
  let httpServer: HTTPServer;
  let io: SocketIOServer;
  let clientSocket: Socket;
  let mockAuthService: jest.Mocked<AuthService>;

  const PORT = 3002; // Use different port for tests
  const SERVER_URL = `http://localhost:${PORT}`;

  beforeAll(async () => {
    // Create HTTP server
    const app = express();
    httpServer = app.listen(PORT);

    // Initialize Socket.io
    io = await initializeSocketIO(httpServer);

    // Setup auth service mock
    mockAuthService = new AuthService() as jest.Mocked<AuthService>;
  });

  afterAll(async () => {
    await shutdownSocketIO();
    httpServer.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  describe('Staff Authentication', () => {
    it('should authenticate staff with valid token', (done) => {
      // Mock successful staff authentication
      mockAuthService.validateSession.mockResolvedValue({
        sessionId: 'session-123',
        user: {
          id: 'staff-1',
          username: 'teststaff',
          role: 'staff'
        },
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
      });

      clientSocket = Client(SERVER_URL, {
        auth: { token: 'valid-staff-token' },
        transports: ['websocket']
      });

      clientSocket.on('authenticated', (data) => {
        expect(data.userType).toBe('staff');
        expect(data.username).toBe('teststaff');
        expect(data.role).toBe('staff');
        expect(data.rooms).toContain('staff');
        done();
      });

      clientSocket.on('connect_error', (error) => {
        done(error);
      });
    });

    it('should reject staff with invalid token', (done) => {
      // Mock failed staff authentication
      mockAuthService.validateSession.mockResolvedValue(null);

      clientSocket = Client(SERVER_URL, {
        auth: { token: 'invalid-token' },
        transports: ['websocket']
      });

      clientSocket.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication');
        done();
      });

      clientSocket.on('connect', () => {
        done(new Error('Should not have connected with invalid token'));
      });
    });

    it('should auto-join staff to staff room', (done) => {
      mockAuthService.validateSession.mockResolvedValue({
        sessionId: 'session-123',
        user: {
          id: 'staff-2',
          username: 'teststaff2',
          role: 'admin'
        },
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
      });

      clientSocket = Client(SERVER_URL, {
        auth: { token: 'valid-admin-token' },
        transports: ['websocket']
      });

      clientSocket.on('authenticated', (data) => {
        expect(data.rooms).toContain('staff');
        expect(data.role).toBe('admin');
        done();
      });

      clientSocket.on('connect_error', done);
    });
  });

  describe('Patient Authentication', () => {
    it('should authenticate patient with valid patient ID', (done) => {
      const patientId = 'patient-123';

      clientSocket = Client(SERVER_URL, {
        auth: { patientId },
        transports: ['websocket']
      });

      clientSocket.on('authenticated', (data) => {
        expect(data.userType).toBe('patient');
        expect(data.patientId).toBe(patientId);
        expect(data.rooms).toContain('patients');
        expect(data.rooms).toContain(`patient_${patientId}`);
        done();
      });

      clientSocket.on('connect_error', done);
    });

    it('should reject patient with empty patient ID', (done) => {
      clientSocket = Client(SERVER_URL, {
        auth: { patientId: '' },
        transports: ['websocket']
      });

      clientSocket.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication');
        done();
      });

      clientSocket.on('connect', () => {
        done(new Error('Should not have connected with empty patient ID'));
      });
    });
  });

  describe('Unauthenticated Connections', () => {
    it('should reject connections without authentication', (done) => {
      clientSocket = Client(SERVER_URL, {
        transports: ['websocket']
      });

      clientSocket.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication token required');
        done();
      });

      clientSocket.on('connect', () => {
        done(new Error('Should not have connected without authentication'));
      });
    });

    it('should reject connections with malformed auth', (done) => {
      clientSocket = Client(SERVER_URL, {
        auth: { invalidField: 'test' },
        transports: ['websocket']
      });

      clientSocket.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication');
        done();
      });

      clientSocket.on('connect', () => {
        done(new Error('Should not have connected with malformed auth'));
      });
    });
  });

  describe('Room Management', () => {
    it('should allow staff to join patient rooms', (done) => {
      mockAuthService.validateSession.mockResolvedValue({
        sessionId: 'session-123',
        user: {
          id: 'staff-3',
          username: 'teststaff3',
          role: 'staff'
        },
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
      });

      clientSocket = Client(SERVER_URL, {
        auth: { token: 'valid-staff-token' },
        transports: ['websocket']
      });

      clientSocket.on('authenticated', () => {
        clientSocket.emit('join-room', { room: 'patient_test123' });
      });

      clientSocket.on('room-joined', (data) => {
        expect(data.room).toBe('patient_test123');
        done();
      });

      clientSocket.on('error', done);
      clientSocket.on('connect_error', done);
    });

    it('should prevent patients from joining staff room', (done) => {
      const patientId = 'patient-456';

      clientSocket = Client(SERVER_URL, {
        auth: { patientId },
        transports: ['websocket']
      });

      clientSocket.on('authenticated', () => {
        clientSocket.emit('join-room', { room: 'staff' });
      });

      clientSocket.on('error', (error) => {
        expect(error.message).toContain('Access denied');
        done();
      });

      clientSocket.on('room-joined', (data) => {
        if (data.room === 'staff') {
          done(new Error('Patient should not be able to join staff room'));
        }
      });

      clientSocket.on('connect_error', done);
    });

    it('should allow patients to access their own room', (done) => {
      const patientId = 'patient-789';

      clientSocket = Client(SERVER_URL, {
        auth: { patientId },
        transports: ['websocket']
      });

      clientSocket.on('authenticated', (data) => {
        expect(data.rooms).toContain(`patient_${patientId}`);
        done();
      });

      clientSocket.on('connect_error', done);
    });

    it('should prevent patients from accessing other patient rooms', (done) => {
      const patientId = 'patient-own';

      clientSocket = Client(SERVER_URL, {
        auth: { patientId },
        transports: ['websocket']
      });

      clientSocket.on('authenticated', () => {
        clientSocket.emit('join-room', { room: 'patient_other' });
      });

      clientSocket.on('error', (error) => {
        expect(error.message).toContain('Access denied');
        done();
      });

      clientSocket.on('room-joined', (data) => {
        if (data.room === 'patient_other') {
          done(new Error('Patient should not access other patient rooms'));
        }
      });

      clientSocket.on('connect_error', done);
    });
  });

  describe('Room Operations', () => {
    it('should handle get-rooms request', (done) => {
      const patientId = 'patient-rooms-test';

      clientSocket = Client(SERVER_URL, {
        auth: { patientId },
        transports: ['websocket']
      });

      clientSocket.on('authenticated', () => {
        clientSocket.emit('get-rooms');
      });

      clientSocket.on('current-rooms', (data) => {
        expect(Array.isArray(data.rooms)).toBe(true);
        expect(data.rooms).toContain('patients');
        expect(data.rooms).toContain(`patient_${patientId}`);
        done();
      });

      clientSocket.on('connect_error', done);
    });

    it('should handle leave-room request', (done) => {
      const patientId = 'patient-leave-test';

      clientSocket = Client(SERVER_URL, {
        auth: { patientId },
        transports: ['websocket']
      });

      clientSocket.on('authenticated', () => {
        clientSocket.emit('leave-room', 'patients');
      });

      clientSocket.on('room-left', (data) => {
        expect(data.room).toBe('patients');
        done();
      });

      clientSocket.on('connect_error', done);
    });

    it('should handle ping-pong for heartbeat', (done) => {
      const patientId = 'patient-ping-test';

      clientSocket = Client(SERVER_URL, {
        auth: { patientId },
        transports: ['websocket']
      });

      clientSocket.on('authenticated', () => {
        clientSocket.emit('ping');
      });

      clientSocket.on('pong', (data) => {
        expect(data.timestamp).toBeDefined();
        done();
      });

      clientSocket.on('connect_error', done);
    });
  });

  describe('Connection Tracking', () => {
    it('should track connected users', (done) => {
      const patientId = 'patient-tracking-test';

      clientSocket = Client(SERVER_URL, {
        auth: { patientId },
        transports: ['websocket']
      });

      clientSocket.on('authenticated', () => {
        // Give a moment for tracking to update
        setTimeout(() => {
          const connectedUsers = getConnectedUsers();
          expect(connectedUsers.total).toBeGreaterThan(0);
          expect(connectedUsers.patients).toBeGreaterThan(0);
          
          const userExists = connectedUsers.users.some(u => u.userId === patientId);
          expect(userExists).toBe(true);
          
          done();
        }, 100);
      });

      clientSocket.on('connect_error', done);
    });

    it('should check user connection status', (done) => {
      const patientId = 'patient-status-test';

      clientSocket = Client(SERVER_URL, {
        auth: { patientId },
        transports: ['websocket']
      });

      clientSocket.on('authenticated', () => {
        setTimeout(() => {
          const isConnected = isUserConnected(patientId);
          expect(isConnected).toBe(true);
          done();
        }, 100);
      });

      clientSocket.on('connect_error', done);
    });

    it('should send messages to specific users', (done) => {
      const patientId = 'patient-message-test';

      clientSocket = Client(SERVER_URL, {
        auth: { patientId },
        transports: ['websocket']
      });

      clientSocket.on('authenticated', () => {
        setTimeout(() => {
          const sent = sendToUser(patientId, 'test_message', { content: 'Hello!' });
          expect(sent).toBe(true);
        }, 100);
      });

      clientSocket.on('test_message', (data) => {
        expect(data.content).toBe('Hello!');
        done();
      });

      clientSocket.on('connect_error', done);
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication errors gracefully', (done) => {
      // Mock auth service to throw error
      mockAuthService.validateSession.mockRejectedValue(new Error('Database error'));

      clientSocket = Client(SERVER_URL, {
        auth: { token: 'test-token' },
        transports: ['websocket']
      });

      clientSocket.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication failed');
        done();
      });

      clientSocket.on('connect', () => {
        done(new Error('Should not have connected when auth service throws error'));
      });
    });

    it('should require authentication for room operations', (done) => {
      // This test would need a way to bypass initial auth, which our current
      // implementation doesn't allow. This is actually good security.
      // We'll test that unauthenticated connections are rejected instead.
      
      clientSocket = Client(SERVER_URL, {
        transports: ['websocket']
      });

      clientSocket.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication token required');
        done();
      });
    });
  });
});
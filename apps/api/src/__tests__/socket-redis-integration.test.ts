import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';

// Mock Redis to avoid requiring actual Redis server for testing
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    duplicate: jest.fn().mockReturnThis(),
    isOpen: true
  }))
}));

jest.mock('@socket.io/redis-adapter', () => ({
  createAdapter: jest.fn(() => {
    // Return a proper adapter constructor function
    return function MockAdapter() {
      return {
        addAll: jest.fn(),
        del: jest.fn(),
        delAll: jest.fn(),
        broadcast: jest.fn(),
        broadcastWithAck: jest.fn(),
        sockets: jest.fn(),
        socketRooms: jest.fn(),
        fetchSockets: jest.fn(),
        serverSideEmit: jest.fn(),
        persistSession: jest.fn(),
        restoreSession: jest.fn()
      };
    };
  })
}));

import { initializeSocketIO, getSocketIOHealth, shutdownSocketIO } from '../config/socket';
import RealtimeService from '../services/realtime-service';

describe('Socket.io Redis Integration', () => {
  let httpServer: any;
  let serverSocket: SocketIOServer;
  let clientSocket: ClientSocket;
  let port: number;

  beforeAll(async () => {
    // Create HTTP server
    httpServer = createServer();
    
    // Get available port
    port = 3002; // Use different port for testing
    
    // Initialize Socket.io (with mocked Redis)
    serverSocket = await initializeSocketIO(httpServer);
    
    // Start server
    await new Promise<void>((resolve) => {
      httpServer.listen(port, resolve);
    });
  });

  afterAll(async () => {
    // Clean up
    if (clientSocket) {
      clientSocket.disconnect();
    }
    
    await shutdownSocketIO();
    
    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer.close(resolve);
      });
    }
  });

  beforeEach((done) => {
    // Create client connection
    clientSocket = Client(`http://localhost:${port}`, {
      transports: ['websocket']
    });
    
    clientSocket.on('connect', done);
  });

  afterEach(() => {
    if (clientSocket) {
      clientSocket.disconnect();
    }
  });

  describe('Socket.io Server Setup', () => {
    it('should initialize Socket.io server successfully', () => {
      expect(serverSocket).toBeDefined();
      expect(serverSocket.engine).toBeDefined();
    });

    it('should have Redis adapter configured', () => {
      // Check if adapter is set (Redis adapter will be present)
      expect(serverSocket.adapter).toBeDefined();
    });

    it('should report healthy status', () => {
      const health = getSocketIOHealth();
      expect(health.status).toBe('healthy');
      expect(health.connectedClients).toBeGreaterThanOrEqual(0);
      expect(health.redisAdapter).toBe(true);
    });
  });

  describe('Client Connection', () => {
    it('should allow client to connect', (done) => {
      expect(clientSocket.connected).toBe(true);
      done();
    });

    it('should allow client to join patient room', (done) => {
      const patientId = 'test-patient-123';
      
      clientSocket.on('room-joined', (data) => {
        expect(data.room).toBe(`patient_${patientId}`);
        expect(data.message).toContain('Successfully joined patient room');
        done();
      });

      clientSocket.emit('join-patient-room', patientId);
    });

    it('should allow client to join staff room', (done) => {
      const staffId = 'test-staff-456';
      
      clientSocket.on('room-joined', (data) => {
        expect(data.room).toBe('staff');
        expect(data.message).toContain('Successfully joined staff room');
        done();
      });

      clientSocket.emit('join-staff-room', staffId);
    });

    it('should allow client to join patients room', (done) => {
      clientSocket.on('room-joined', (data) => {
        expect(data.room).toBe('patients');
        expect(data.message).toContain('Successfully joined patients room');
        done();
      });

      clientSocket.emit('join-patients-room');
    });
  });

  describe('Real-time Service Integration', () => {
    it('should broadcast queue updates to patients room', (done) => {
      // Join patients room first
      clientSocket.emit('join-patients-room');
      
      clientSocket.on('room-joined', () => {
        // Listen for queue update
        clientSocket.on('queue_update', (data) => {
          expect(data.type).toBe('position_change');
          expect(data.patientId).toBe('test-patient-123');
          expect(data.newPosition).toBe(5);
          expect(data.timestamp).toBeDefined();
          done();
        });

        // Broadcast update
        RealtimeService.broadcastQueueUpdate({
          type: 'position_change',
          patientId: 'test-patient-123',
          newPosition: 5,
          estimatedWait: 15,
          timestamp: new Date().toISOString()
        });
      });
    });

    it('should send position updates to specific patient', (done) => {
      const patientId = 'test-patient-456';
      
      // Join patient room
      clientSocket.emit('join-patient-room', patientId);
      
      clientSocket.on('room-joined', () => {
        // Listen for position update
        clientSocket.on('position_update', (data) => {
          expect(data.type).toBe('position_update');
          expect(data.position).toBe(3);
          expect(data.estimatedWait).toBe(10);
          expect(data.timestamp).toBeDefined();
          done();
        });

        // Send position update
        RealtimeService.notifyPatientPositionChange(patientId, 3, 10);
      });
    });

    it('should notify patient when called', (done) => {
      const patientId = 'test-patient-789';
      
      // Join patient room
      clientSocket.emit('join-patient-room', patientId);
      
      clientSocket.on('room-joined', () => {
        // Listen for call notification
        clientSocket.on('patient_called', (data) => {
          expect(data.type).toBe('patient_called');
          expect(data.message).toContain('It\'s your turn!');
          expect(data.timestamp).toBeDefined();
          done();
        });

        // Send call notification
        RealtimeService.notifyPatientCalled(patientId);
      });
    });

    it('should notify patient to get ready', (done) => {
      const patientId = 'test-patient-ready';
      
      // Join patient room
      clientSocket.emit('join-patient-room', patientId);
      
      clientSocket.on('room-joined', () => {
        // Listen for get ready notification
        clientSocket.on('get_ready', (data) => {
          expect(data.type).toBe('get_ready');
          expect(data.message).toContain('You\'re next!');
          expect(data.estimatedWait).toBe(5);
          expect(data.timestamp).toBeDefined();
          done();
        });

        // Send get ready notification
        RealtimeService.notifyPatientGetReady(patientId, 5);
      });
    });
  });

  describe('Staff Notifications', () => {
    it('should broadcast queue refresh to staff', (done) => {
      // Join staff room
      clientSocket.emit('join-staff-room', 'test-staff');
      
      clientSocket.on('room-joined', () => {
        // Listen for queue refresh
        clientSocket.on('queue_refresh', (data) => {
          expect(data.type).toBe('queue_refresh');
          expect(data.data).toHaveLength(2);
          expect(data.timestamp).toBeDefined();
          done();
        });

        // Send queue refresh
        const queueData = [
          { id: '1', name: 'Patient 1', position: 1 },
          { id: '2', name: 'Patient 2', position: 2 }
        ];
        RealtimeService.broadcastQueueRefresh(queueData);
      });
    });

    it('should notify staff of new patient', (done) => {
      // Join staff room
      clientSocket.emit('join-staff-room', 'test-staff');
      
      clientSocket.on('room-joined', () => {
        // Listen for new patient notification
        clientSocket.on('new_patient', (data) => {
          expect(data.type).toBe('new_patient');
          expect(data.patient.name).toBe('John Doe');
          expect(data.timestamp).toBeDefined();
          done();
        });

        // Send new patient notification
        RealtimeService.notifyStaffNewPatient({
          id: 'new-patient-123',
          name: 'John Doe',
          position: 1
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid room joins gracefully', (done) => {
      // Try to join with empty patient ID
      clientSocket.emit('join-patient-room', '');
      
      // Should not receive room-joined event
      const timeout = setTimeout(() => {
        done(); // Test passes if no room-joined event is received
      }, 1000);

      clientSocket.on('room-joined', () => {
        clearTimeout(timeout);
        done(new Error('Should not join room with empty ID'));
      });
    });

    it('should handle disconnection gracefully', (done) => {
      clientSocket.on('disconnect', (reason) => {
        expect(reason).toBeDefined();
        done();
      });

      clientSocket.disconnect();
    });
  });
});
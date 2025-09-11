/**
 * Real-Time Updates Integration Tests
 * Tests WebSocket functionality and real-time queue updates
 */

import { io as Client, Socket } from 'socket.io-client';
import request from 'supertest';
import app from '../../index';
import { QueueService } from '../../services/queue-service';
import { AuthService } from '../../services/auth-service';

describe('Real-Time Updates Integration', () => {
  let queueService: QueueService;
  let authService: AuthService;
  let staffToken: string;
  let clientSocket: Socket;
  let staffSocket: Socket;
  const serverUrl = 'http://localhost:3001';

  beforeAll(async () => {
    queueService = new QueueService();
    authService = new AuthService();

    // Get staff authentication token
    const loginResponse = await request(app)
      .post('/api/staff/login')
      .send({
        username: 'staff',
        password: 'password123'
      });

    staffToken = loginResponse.body.data.token;
  });

  beforeEach(async () => {
    // Clean up queue before each test
    await queueService.clearQueue();

    // Create WebSocket connections
    clientSocket = Client(serverUrl, {
      transports: ['websocket'],
      forceNew: true
    });

    staffSocket = Client(serverUrl, {
      transports: ['websocket'],
      forceNew: true,
      auth: {
        token: staffToken
      }
    });

    // Wait for connections
    await Promise.all([
      new Promise(resolve => clientSocket.on('connect', resolve)),
      new Promise(resolve => staffSocket.on('connect', resolve))
    ]);
  });

  afterEach(() => {
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }
    if (staffSocket.connected) {
      staffSocket.disconnect();
    }
  });

  describe('WebSocket Connection', () => {
    it('should establish WebSocket connections', () => {
      expect(clientSocket.connected).toBe(true);
      expect(staffSocket.connected).toBe(true);
    });

    it('should handle connection with authentication', (done) => {
      const authenticatedSocket = Client(serverUrl, {
        transports: ['websocket'],
        auth: {
          token: staffToken
        }
      });

      authenticatedSocket.on('connect', () => {
        expect(authenticatedSocket.connected).toBe(true);
        authenticatedSocket.disconnect();
        done();
      });
    });

    it('should handle connection without authentication', (done) => {
      const unauthenticatedSocket = Client(serverUrl, {
        transports: ['websocket']
      });

      unauthenticatedSocket.on('connect', () => {
        expect(unauthenticatedSocket.connected).toBe(true);
        unauthenticatedSocket.disconnect();
        done();
      });
    });
  });

  describe('Room Management', () => {
    it('should join patient room', (done) => {
      const patientId = 'test-patient-123';
      
      clientSocket.emit('join-room', { room: `patient_${patientId}` });
      
      clientSocket.on('room-joined', (data) => {
        expect(data.room).toBe(`patient_${patientId}`);
        done();
      });
    });

    it('should join staff room', (done) => {
      staffSocket.emit('join-room', { room: 'staff' });
      
      staffSocket.on('room-joined', (data) => {
        expect(data.room).toBe('staff');
        done();
      });
    });

    it('should leave room', (done) => {
      const room = 'test-room';
      
      clientSocket.emit('join-room', { room });
      
      clientSocket.on('room-joined', () => {
        clientSocket.emit('leave-room', room);
        
        clientSocket.on('room-left', (data) => {
          expect(data.room).toBe(room);
          done();
        });
      });
    });
  });

  describe('Queue Update Broadcasting', () => {
    it('should broadcast queue updates when patient checks in', (done) => {
      let updateReceived = false;

      // Join staff room to receive updates
      staffSocket.emit('join-room', { room: 'staff' });
      
      staffSocket.on('room-joined', async () => {
        staffSocket.on('queue_update', (data) => {
          if (!updateReceived) {
            updateReceived = true;
            expect(data.type).toBe('patient_checked_in');
            expect(data.patient).toBeDefined();
            expect(data.patient.name).toBe('John Doe');
            expect(data.position).toBe(1);
            done();
          }
        });

        // Trigger check-in after setting up listener
        await request(app)
          .post('/api/checkin')
          .send({
            name: 'John Doe',
            phone: '+1234567890',
            appointmentTime: '2:00 PM'
          });
      });
    });

    it('should broadcast position updates when patient is called', (done) => {
      let patientId: string;
      let updateReceived = false;

      // Set up patient room listener
      clientSocket.on('position_update', (data) => {
        if (!updateReceived) {
          updateReceived = true;
          expect(data.status).toBe('called');
          expect(data.patientId).toBe(patientId);
          done();
        }
      });

      // Check in patient and then call them
      request(app)
        .post('/api/checkin')
        .send({
          name: 'Jane Smith',
          phone: '+1111111111',
          appointmentTime: '1:00 PM'
        })
        .then(response => {
          patientId = response.body.data.patientId;
          
          // Join patient room
          clientSocket.emit('join-room', { room: `patient_${patientId}` });
          
          clientSocket.on('room-joined', async () => {
            // Call the patient
            await request(app)
              .post('/api/staff/call-next')
              .set('Authorization', `Bearer ${staffToken}`);
          });
        });
    });

    it('should broadcast to multiple clients', (done) => {
      const client2 = Client(serverUrl, {
        transports: ['websocket'],
        forceNew: true
      });

      let updates = 0;
      const expectedUpdates = 2;

      const handleUpdate = (data: any) => {
        updates++;
        expect(data.type).toBe('patient_checked_in');
        
        if (updates === expectedUpdates) {
          client2.disconnect();
          done();
        }
      };

      Promise.all([
        new Promise(resolve => client2.on('connect', resolve)),
        new Promise(resolve => {
          staffSocket.emit('join-room', { room: 'staff' });
          staffSocket.on('room-joined', resolve);
        })
      ]).then(() => {
        client2.emit('join-room', { room: 'staff' });
        
        client2.on('room-joined', () => {
          staffSocket.on('queue_update', handleUpdate);
          client2.on('queue_update', handleUpdate);

          // Trigger update
          request(app)
            .post('/api/checkin')
            .send({
              name: 'Broadcast Test',
              phone: '+9999999999',
              appointmentTime: '3:00 PM'
            });
        });
      });
    });
  });

  describe('Connection Health', () => {
    it('should respond to ping with pong', (done) => {
      clientSocket.emit('ping');
      
      clientSocket.on('pong', (data) => {
        expect(data.timestamp).toBeDefined();
        done();
      });
    });

    it('should handle disconnection gracefully', (done) => {
      clientSocket.on('disconnect', (reason) => {
        expect(reason).toBeDefined();
        done();
      });

      clientSocket.disconnect();
    });

    it('should handle reconnection', (done) => {
      let disconnected = false;
      
      clientSocket.on('disconnect', () => {
        disconnected = true;
      });

      clientSocket.on('connect', () => {
        if (disconnected) {
          expect(clientSocket.connected).toBe(true);
          done();
        }
      });

      // Force disconnect and reconnect
      clientSocket.disconnect();
      setTimeout(() => {
        clientSocket.connect();
      }, 100);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid room names', (done) => {
      clientSocket.emit('join-room', { room: '' });
      
      clientSocket.on('error', (error) => {
        expect(error.message).toContain('Invalid room name');
        done();
      });
    });

    it('should handle malformed events', (done) => {
      clientSocket.emit('join-room', 'invalid-data');
      
      clientSocket.on('error', (error) => {
        expect(error).toBeDefined();
        done();
      });
    });

    it('should handle unauthorized room access', (done) => {
      // Try to join admin room without proper authentication
      clientSocket.emit('join-room', { room: 'admin' });
      
      clientSocket.on('error', (error) => {
        expect(error.message).toContain('Unauthorized');
        done();
      });
    });
  });

  describe('Performance', () => {
    it('should handle multiple rapid events', (done) => {
      let eventCount = 0;
      const totalEvents = 10;

      staffSocket.emit('join-room', { room: 'staff' });
      
      staffSocket.on('room-joined', () => {
        staffSocket.on('queue_update', () => {
          eventCount++;
          if (eventCount === totalEvents) {
            done();
          }
        });

        // Send multiple check-ins rapidly
        for (let i = 0; i < totalEvents; i++) {
          request(app)
            .post('/api/checkin')
            .send({
              name: `Rapid Patient ${i}`,
              phone: `+12345678${i.toString().padStart(2, '0')}`,
              appointmentTime: '2:00 PM'
            });
        }
      });
    });

    it('should maintain connection under load', (done) => {
      const connections: Socket[] = [];
      const connectionCount = 5;
      let connectedCount = 0;

      // Create multiple connections
      for (let i = 0; i < connectionCount; i++) {
        const socket = Client(serverUrl, {
          transports: ['websocket'],
          forceNew: true
        });

        socket.on('connect', () => {
          connectedCount++;
          if (connectedCount === connectionCount) {
            // All connections established
            expect(connectedCount).toBe(connectionCount);
            
            // Clean up
            connections.forEach(s => s.disconnect());
            done();
          }
        });

        connections.push(socket);
      }
    });
  });

  describe('Data Integrity', () => {
    it('should maintain data consistency across real-time updates', (done) => {
      let checkInComplete = false;
      let updateReceived = false;

      staffSocket.emit('join-room', { room: 'staff' });
      
      staffSocket.on('room-joined', () => {
        staffSocket.on('queue_update', async (data) => {
          if (!updateReceived) {
            updateReceived = true;
            
            // Verify the real-time update matches the API response
            const queueResponse = await request(app)
              .get('/api/staff/queue')
              .set('Authorization', `Bearer ${staffToken}`);

            expect(queueResponse.body.data).toHaveLength(1);
            expect(queueResponse.body.data[0].patient.name).toBe(data.patient.name);
            expect(queueResponse.body.data[0].position).toBe(data.position);
            
            done();
          }
        });

        // Trigger check-in
        request(app)
          .post('/api/checkin')
          .send({
            name: 'Consistency Test',
            phone: '+5555555555',
            appointmentTime: '2:00 PM'
          })
          .then(() => {
            checkInComplete = true;
          });
      });
    });
  });
});
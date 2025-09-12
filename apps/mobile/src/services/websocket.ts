// apps\mobile\src\services\websocket.ts
import { io, Socket } from 'socket.io-client';
import { configService } from './config';

export interface QueueUpdate {
  type: 'position_change' | 'patient_called' | 'patient_completed';
  patientId: string;
  newPosition?: number;
  estimatedWait?: number;
  status?: 'waiting' | 'called' | 'completed';
  timestamp: string;
}

export interface PositionUpdate {
  position: number;
  estimatedWait: number;
  timestamp: string;
}

export class WebSocketService {
  private socket: Socket | null = null;
  private baseUrl: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private isConnecting = false;
  private patientId: string | null = null;
  private authToken: string | null = null;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || configService.getWebSocketUrl();
  }

  // Connect as a patient with patientId
  connectAsPatient(patientId: string): Promise<void> {
    this.patientId = patientId;
    this.authToken = null;
    return this.connect();
  }

  // Connect as staff with token
  connectAsStaff(token: string): Promise<void> {
    this.authToken = token;
    this.patientId = null;
    return this.connect();
  }

  private connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      if (this.isConnecting) {
        // If already connecting, wait for the current connection attempt
        const checkConnection = () => {
          if (this.socket?.connected) {
            resolve();
          } else if (!this.isConnecting) {
            reject(new Error('Connection failed'));
          } else {
            setTimeout(checkConnection, 100);
          }
        };
        checkConnection();
        return;
      }

      // Must have either patientId or token for authentication
      if (!this.patientId && !this.authToken) {
        reject(new Error('Authentication required: provide either patientId or token'));
        return;
      }

      this.isConnecting = true;

      try {
        // Prepare authentication data
        const auth: { patientId?: string; token?: string } = {};
        if (this.patientId) {
          auth.patientId = this.patientId;
        }
        if (this.authToken) {
          auth.token = this.authToken;
        }

        this.socket = io(this.baseUrl, {
          transports: ['websocket', 'polling'],
          timeout: 20000,
          forceNew: true,
          auth,
          reconnection: true,
          reconnectionAttempts: this.maxReconnectAttempts,
          reconnectionDelay: this.reconnectDelay,
        });

        this.socket.on('connect', () => {
          console.log('WebSocket connected successfully');
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
          this.isConnecting = false;
          resolve();
        });

        this.socket.on('authenticated', (data) => {
          console.log('WebSocket authenticated successfully:', data);
        });

        this.socket.on('disconnect', (reason) => {
          console.log('WebSocket disconnected:', reason);
          this.isConnecting = false;

          if (reason === 'io server disconnect') {
            // Server initiated disconnect, don't reconnect automatically
            return;
          }

          this.scheduleReconnect();
        });

        this.socket.on('connect_error', (error) => {
          console.error('WebSocket connection error:', error);
          this.isConnecting = false;

          // Check if it's an authentication error
          if (error.message.includes('Authentication')) {
            console.error('Authentication failed - check patientId/token validity');
            reject(new Error(`Authentication failed: ${error.message}`));
            return;
          }

          this.reconnectAttempts++;

          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            reject(new Error(`Failed to connect after ${this.maxReconnectAttempts} attempts: ${error.message}`));
          } else {
            this.scheduleReconnect();
          }
        });

        this.socket.on('reconnect', (attemptNumber) => {
          console.log('WebSocket reconnected after', attemptNumber, 'attempts');
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
        });

        this.socket.on('reconnect_failed', () => {
          console.error('WebSocket reconnection failed');
          reject(new Error('Reconnection failed'));
        });

        // Handle room joining confirmation
        this.socket.on('room-joined', (data) => {
          console.log('Successfully joined room:', data);
        });

        this.socket.on('room-left', (data) => {
          console.log('Successfully left room:', data);
        });

        this.socket.on('error', (error) => {
          console.error('Socket error:', error);
        });

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    console.log(`Scheduling reconnection attempt ${this.reconnectAttempts + 1} in ${delay}ms`);

    setTimeout(() => {
      if (!this.socket?.connected) {
        this.connect(); // Will use stored credentials
      }
    }, delay);
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.patientId = null;
    this.authToken = null;
  }

  joinPatientRoom(patientId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('join-room', { room: `patient_${patientId}`, patientId });
      console.log('Requested to join patient room:', patientId);
    } else {
      console.warn('Cannot join patient room: WebSocket not connected');
    }
  }

  leavePatientRoom(patientId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('leave-room', `patient_${patientId}`);
      console.log('Requested to leave patient room:', patientId);
    }
  }

  joinRoom(room: string, patientId?: string): void {
    if (this.socket?.connected) {
      this.socket.emit('join-room', { room, patientId });
      console.log('Requested to join room:', room);
    } else {
      console.warn('Cannot join room: WebSocket not connected');
    }
  }

  leaveRoom(room: string): void {
    if (this.socket?.connected) {
      this.socket.emit('leave-room', room);
      console.log('Requested to leave room:', room);
    }
  }

  getCurrentRooms(): void {
    if (this.socket?.connected) {
      this.socket.emit('get-rooms');
    }
  }

  onQueueUpdate(callback: (update: QueueUpdate) => void): void {
    if (this.socket) {
      this.socket.on('queue_update', callback);
    }
  }

  onPositionUpdate(callback: (update: PositionUpdate) => void): void {
    if (this.socket) {
      this.socket.on('position_update', callback);
    }
  }

  onStatusChange(callback: (update: QueueUpdate) => void): void {
    if (this.socket) {
      this.socket.on('status_change', callback);
    }
  }

  onConnect(callback: () => void): void {
    if (this.socket) {
      this.socket.on('connect', callback);
    }
  }

  onDisconnect(callback: () => void): void {
    if (this.socket) {
      this.socket.on('disconnect', callback);
    }
  }

  onConnectionError(callback: (error: Error) => void): void {
    if (this.socket) {
      this.socket.on('connect_error', callback);
    }
  }

  onRoomJoined(callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on('room-joined', callback);
    }
  }

  onRoomLeft(callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on('room-left', callback);
    }
  }

  onCurrentRooms(callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on('current-rooms', callback);
    }
  }

  offQueueUpdate(callback?: (update: QueueUpdate) => void): void {
    if (this.socket) {
      if (callback) {
        this.socket.off('queue_update', callback);
      } else {
        this.socket.off('queue_update');
      }
    }
  }

  offPositionUpdate(callback?: (update: PositionUpdate) => void): void {
    if (this.socket) {
      if (callback) {
        this.socket.off('position_update', callback);
      } else {
        this.socket.off('position_update');
      }
    }
  }

  removeAllListeners(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getConnectionStatus(): {
    connected: boolean;
    connecting: boolean;
    reconnectAttempts: number;
    authenticated: boolean;
  } {
    return {
      connected: this.socket?.connected || false,
      connecting: this.isConnecting,
      reconnectAttempts: this.reconnectAttempts,
      authenticated: !!(this.patientId || this.authToken),
    };
  }
}

// Create singleton instance
let webSocketServiceInstance: WebSocketService | null = null;

export const getWebSocketService = (): WebSocketService => {
  if (!webSocketServiceInstance) {
    webSocketServiceInstance = new WebSocketService();
  }
  return webSocketServiceInstance;
};

// Export singleton instance for backward compatibility
export const webSocketService = getWebSocketService();
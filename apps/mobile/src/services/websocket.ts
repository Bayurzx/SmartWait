// apps\mobile\src\services\websocket.ts
import { io, Socket } from 'socket.io-client';
import { configService } from './config';

export interface QueueUpdate {
  type: 'position_change' | 'patient_called' | 'patient_completed';
  patientId: string;
  newPosition?: number;
  estimatedWaitMinutes?: number;
  status?: 'waiting' | 'called' | 'completed';
  timestamp: string;
}

export interface PositionUpdate {
  position: number;
  estimatedWaitMinutes: number;
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
    // Validate patientId format (basic validation)
    if (!patientId || patientId.trim().length === 0) {
      return Promise.reject(new Error('Invalid patient ID: Patient ID cannot be empty'));
    }

    // Check if it's a valid UUID format (basic check)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(patientId)) {
      console.warn('Patient ID may not be in UUID format:', patientId);
      // Don't reject here - let the server handle validation
    }

    this.patientId = patientId;
    this.authToken = null;
    return this.connect();
  }

  // Connect as staff with token
  connectAsStaff(token: string): Promise<void> {
    if (!token || token.trim().length === 0) {
      return Promise.reject(new Error('Invalid token: Token cannot be empty'));
    }

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

        console.log('Connecting to WebSocket with auth:', {
          hasPatientId: !!this.patientId,
          hasToken: !!this.authToken,
          patientIdLength: this.patientId?.length || 0
        });

        this.socket = io(this.baseUrl, {
          transports: ['websocket', 'polling'],
          timeout: 20000,
          forceNew: true,
          auth,
          reconnection: false, // We handle reconnection manually
          reconnectionAttempts: 0,
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

          // Enhanced error handling
          let errorMessage = error.message || 'Connection failed';

          if (errorMessage.includes('Authentication') || errorMessage.includes('Invalid patient ID')) {
            console.error('Authentication failed - check patientId/token validity');
            reject(new Error(`Authentication failed: ${errorMessage}`));
            return;
          }

          if (errorMessage.includes('timeout')) {
            errorMessage = 'Connection timeout - server may be unavailable';
          }

          this.reconnectAttempts++;

          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            reject(new Error(`Failed to connect after ${this.maxReconnectAttempts} attempts: ${errorMessage}`));
          } else {
            console.log(`Connection attempt ${this.reconnectAttempts} failed, will retry...`);
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

    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), 30000); // Cap at 30 seconds
    console.log(`Scheduling reconnection attempt ${this.reconnectAttempts + 1} in ${delay}ms`);

    setTimeout(() => {
      if (!this.socket?.connected && (this.patientId || this.authToken)) {
        this.connect().catch(error => {
          console.error('Reconnection attempt failed:', error);
        });
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
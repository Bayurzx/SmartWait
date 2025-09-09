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

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || configService.getWebSocketUrl();
  }

  connect(): Promise<void> {
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

      this.isConnecting = true;

      try {
        this.socket = io(this.baseUrl, {
          transports: ['websocket', 'polling'],
          timeout: 10000,
          reconnection: true,
          reconnectionAttempts: this.maxReconnectAttempts,
          reconnectionDelay: this.reconnectDelay,
        });

        this.socket.on('connect', () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
          this.isConnecting = false;
          resolve();
        });

        this.socket.on('disconnect', (reason) => {
          console.log('WebSocket disconnected:', reason);
          this.isConnecting = false;
        });

        this.socket.on('connect_error', (error) => {
          console.error('WebSocket connection error:', error);
          this.isConnecting = false;
          this.reconnectAttempts++;
          
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            reject(new Error(`Failed to connect after ${this.maxReconnectAttempts} attempts`));
          } else {
            // Exponential backoff
            this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
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

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnecting = false;
    this.reconnectAttempts = 0;
  }

  joinPatientRoom(patientId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('join_patient_room', patientId);
      console.log('Joined patient room:', patientId);
    } else {
      console.warn('Cannot join patient room: WebSocket not connected');
    }
  }

  leavePatientRoom(patientId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('leave_patient_room', patientId);
      console.log('Left patient room:', patientId);
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

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getConnectionStatus(): 'connected' | 'connecting' | 'disconnected' {
    if (this.socket?.connected) return 'connected';
    if (this.isConnecting) return 'connecting';
    return 'disconnected';
  }
}

// Singleton instance
export const webSocketService = new WebSocketService();
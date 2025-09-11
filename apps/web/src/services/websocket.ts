'use client';

import { io, Socket } from 'socket.io-client';
import { QueueStatus } from '../types';

export interface QueueUpdate {
  type: 'position_change' | 'status_change' | 'queue_update';
  patientId: string;
  position?: number;
  estimatedWait?: number;
  status?: string;
  timestamp: string;
}

export interface WebSocketEvents {
  position_update: (data: QueueUpdate) => void;
  queue_update: (data: QueueUpdate) => void;
  status_change: (data: QueueUpdate) => void;
  connect: () => void;
  disconnect: () => void;
  connect_error: (error: Error) => void;
}

class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;
  private patientId: string | null = null;

  constructor() {
    // Don't auto-connect in constructor - wait for patientId
  }

  connect(patientId?: string): void {
    if (this.isConnecting || this.socket?.connected) {
      return;
    }

    // Store patientId for reconnections
    if (patientId) {
      this.patientId = patientId;
    }

    // Don't connect without patientId for authentication
    if (!this.patientId) {
      console.warn('🌐 Cannot connect WebSocket without patientId for authentication');
      return;
    }

    this.isConnecting = true;
    const socketUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    
    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true,
      auth: {
        patientId: this.patientId
      }
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('🌐 Connected to WebSocket server');
      this.isConnecting = false;
      this.reconnectAttempts = 0;
    });

    this.socket.on('authenticated', (data) => {
      console.log('🌐 WebSocket authenticated successfully:', data);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🌐 Disconnected from WebSocket server:', reason);
      this.isConnecting = false;
      
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, don't reconnect automatically
        return;
      }
      
      this.scheduleReconnect();
    });

    this.socket.on('connect_error', (error) => {
      console.error('🌐 WebSocket connection error:', error);
      this.isConnecting = false;
      
      // Check if it's an authentication error
      if (error.message.includes('Authentication')) {
        console.error('🌐 Authentication failed - patientId may be invalid:', this.patientId);
      }
      
      this.scheduleReconnect();
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('🌐 Max reconnection attempts reached');
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    console.log(`🌐 Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      if (!this.socket?.connected) {
        this.connect(); // Will use stored patientId
      }
    }, delay);
  }

  joinPatientRoom(patientId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('join-room', { room: `patient_${patientId}`, patientId });
      console.log(`🌐 Joined patient room: patient_${patientId}`);
    } else {
      console.warn('🌐 Cannot join room: WebSocket not connected');
    }
  }

  leavePatientRoom(patientId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('leave-room', `patient_${patientId}`);
      console.log(`🌐 Left patient room: patient_${patientId}`);
    }
  }

  onPositionUpdate(callback: (data: QueueUpdate) => void): void {
    if (this.socket) {
      this.socket.on('position_update', callback);
    }
  }

  onQueueUpdate(callback: (data: QueueUpdate) => void): void {
    if (this.socket) {
      this.socket.on('queue_update', callback);
    }
  }

  onStatusChange(callback: (data: QueueUpdate) => void): void {
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

  removeAllListeners(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.patientId = null; // Clear stored patientId
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getConnectionStatus(): {
    connected: boolean;
    connecting: boolean;
    reconnectAttempts: number;
  } {
    return {
      connected: this.socket?.connected || false,
      connecting: this.isConnecting,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}

// Create a singleton instance
let webSocketService: WebSocketService | null = null;

export const getWebSocketService = (patientId?: string): WebSocketService => {
  if (!webSocketService && typeof window !== 'undefined') {
    webSocketService = new WebSocketService();
  }
  
  // Connect with patientId if provided and not already connected
  if (webSocketService && patientId && !webSocketService.isConnected()) {
    webSocketService.connect(patientId);
  }
  
  return webSocketService!;
};

export default WebSocketService;
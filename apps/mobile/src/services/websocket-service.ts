import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface WebSocketConfig {
  url: string;
  autoConnect?: boolean;
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
  reconnectionDelayMax?: number;
  maxReconnectionAttempts?: number;
  timeout?: number;
}

export interface ConnectionStatus {
  connected: boolean;
  connecting: boolean;
  reconnecting: boolean;
  error?: string;
  reconnectAttempts: number;
  lastConnected?: Date;
}

export interface AuthData {
  token?: string;
  patientId?: string;
  userType: 'patient' | 'staff';
}

export class WebSocketService {
  private socket: Socket | null = null;
  private config: WebSocketConfig;
  private authData: AuthData | null = null;
  private connectionStatus: ConnectionStatus = {
    connected: false,
    connecting: false,
    reconnecting: false,
    reconnectAttempts: 0
  };
  private listeners: Map<string, Function[]> = new Map();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private maxReconnectAttempts: number;
  private reconnectDelay: number;
  private isManualDisconnect = false;

  constructor(config: WebSocketConfig) {
    this.config = {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      ...config
    };
    
    this.maxReconnectAttempts = this.config.reconnectionAttempts || 5;
    this.reconnectDelay = this.config.reconnectionDelay || 1000;
  }

  /**
   * Initialize WebSocket connection with authentication
   */
  async connect(authData: AuthData): Promise<void> {
    try {
      this.authData = authData;
      this.isManualDisconnect = false;
      
      if (this.socket?.connected) {
        console.log('📱 WebSocket already connected');
        return;
      }

      this.updateConnectionStatus({ connecting: true, error: undefined });
      
      console.log('📱 Connecting to WebSocket server...');
      
      // Create socket with authentication and reconnection config
      this.socket = io(this.config.url, {
        auth: {
          token: authData.token,
          patientId: authData.patientId
        },
        autoConnect: this.config.autoConnect,
        reconnection: false, // We'll handle reconnection manually for better control
        timeout: this.config.timeout,
        transports: ['websocket', 'polling'],
        forceNew: true
      });

      this.setupEventHandlers();
      
      // Manual connection if autoConnect is false
      if (!this.config.autoConnect) {
        this.socket.connect();
      }

    } catch (error) {
      console.error('📱 WebSocket connection error:', error);
      this.updateConnectionStatus({ 
        connecting: false, 
        error: error instanceof Error ? error.message : 'Connection failed' 
      });
      this.scheduleReconnect();
    }
  }

  /**
   * Setup event handlers for the socket
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Connection successful
    this.socket.on('connect', () => {
      console.log('📱 WebSocket connected successfully');
      this.updateConnectionStatus({
        connected: true,
        connecting: false,
        reconnecting: false,
        reconnectAttempts: 0,
        lastConnected: new Date(),
        error: undefined
      });
      
      this.startHeartbeat();
      this.emit('connection_status', this.connectionStatus);
    });

    // Authentication successful
    this.socket.on('authenticated', (data) => {
      console.log('📱 WebSocket authenticated:', data);
      this.emit('authenticated', data);
    });

    // Connection error
    this.socket.on('connect_error', (error) => {
      console.error('📱 WebSocket connection error:', error.message);
      this.updateConnectionStatus({
        connected: false,
        connecting: false,
        error: error.message
      });
      
      this.stopHeartbeat();
      
      if (!this.isManualDisconnect) {
        this.scheduleReconnect();
      }
      
      this.emit('connection_error', error);
    });

    // Disconnection
    this.socket.on('disconnect', (reason) => {
      console.log('📱 WebSocket disconnected:', reason);
      this.updateConnectionStatus({
        connected: false,
        connecting: false,
        error: `Disconnected: ${reason}`
      });
      
      this.stopHeartbeat();
      
      // Auto-reconnect unless it was a manual disconnect
      if (!this.isManualDisconnect && reason !== 'io client disconnect') {
        this.scheduleReconnect();
      }
      
      this.emit('disconnect', reason);
    });

    // Reconnection attempt
    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`📱 WebSocket reconnection attempt ${attemptNumber}`);
      this.updateConnectionStatus({ reconnecting: true });
      this.emit('reconnect_attempt', attemptNumber);
    });

    // Reconnection successful
    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`📱 WebSocket reconnected after ${attemptNumber} attempts`);
      this.updateConnectionStatus({
        connected: true,
        reconnecting: false,
        reconnectAttempts: 0,
        lastConnected: new Date(),
        error: undefined
      });
      this.emit('reconnect', attemptNumber);
    });

    // Reconnection failed
    this.socket.on('reconnect_failed', () => {
      console.error('📱 WebSocket reconnection failed');
      this.updateConnectionStatus({
        reconnecting: false,
        error: 'Reconnection failed after maximum attempts'
      });
      this.emit('reconnect_failed');
    });

    // Heartbeat response
    this.socket.on('pong', (data) => {
      console.log('📱 Heartbeat pong received:', data);
      this.emit('heartbeat', data);
    });

    // Queue updates
    this.socket.on('queue_update', (data) => {
      console.log('📱 Queue update received:', data);
      this.emit('queue_update', data);
    });

    // Position updates
    this.socket.on('position_update', (data) => {
      console.log('📱 Position update received:', data);
      this.emit('position_update', data);
    });

    // Notification updates
    this.socket.on('notification', (data) => {
      console.log('📱 Notification received:', data);
      this.emit('notification', data);
    });

    // Room events
    this.socket.on('room-joined', (data) => {
      console.log('📱 Joined room:', data);
      this.emit('room_joined', data);
    });

    this.socket.on('room-left', (data) => {
      console.log('📱 Left room:', data);
      this.emit('room_left', data);
    });

    // Error handling
    this.socket.on('error', (error) => {
      console.error('📱 WebSocket error:', error);
      this.emit('error', error);
    });
  }

  /**
   * Schedule automatic reconnection
   */
  private scheduleReconnect(): void {
    if (this.isManualDisconnect || this.connectionStatus.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('📱 Max reconnection attempts reached or manual disconnect');
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.connectionStatus.reconnectAttempts),
      this.config.reconnectionDelayMax || 5000
    );

    console.log(`📱 Scheduling reconnection in ${delay}ms (attempt ${this.connectionStatus.reconnectAttempts + 1})`);

    this.reconnectTimer = setTimeout(() => {
      this.attemptReconnect();
    }, delay);
  }

  /**
   * Attempt to reconnect
   */
  private async attemptReconnect(): Promise<void> {
    if (this.isManualDisconnect || !this.authData) {
      return;
    }

    this.updateConnectionStatus({
      reconnectAttempts: this.connectionStatus.reconnectAttempts + 1,
      reconnecting: true
    });

    console.log(`📱 Attempting reconnection (${this.connectionStatus.reconnectAttempts}/${this.maxReconnectAttempts})`);

    try {
      // Test network connectivity before attempting reconnection
      if (typeof fetch !== 'undefined') {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          await fetch(this.config.url.replace('/socket.io', '/health'), {
            method: 'HEAD',
            signal: controller.signal,
            cache: 'no-cache'
          });
          
          clearTimeout(timeoutId);
        } catch (networkError) {
          console.log('📱 Network connectivity test failed, will retry later');
          this.scheduleReconnect();
          return;
        }
      }

      // Disconnect existing socket if any
      if (this.socket) {
        this.socket.removeAllListeners();
        this.socket.disconnect();
      }

      // Create new connection
      await this.connect(this.authData);
      
    } catch (error) {
      console.error('📱 Reconnection attempt failed:', error);
      
      if (this.connectionStatus.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      } else {
        this.updateConnectionStatus({
          reconnecting: false,
          error: 'Max reconnection attempts exceeded'
        });
        this.emit('max_reconnect_attempts_exceeded');
      }
    }
  }

  /**
   * Start heartbeat to monitor connection health
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping');
      }
    }, 30000); // Send ping every 30 seconds
  }

  /**
   * Stop heartbeat timer
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Manual disconnect
   */
  disconnect(): void {
    console.log('📱 Manual WebSocket disconnect');
    this.isManualDisconnect = true;
    
    this.stopHeartbeat();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.updateConnectionStatus({
      connected: false,
      connecting: false,
      reconnecting: false,
      reconnectAttempts: 0
    });

    this.emit('manual_disconnect');
  }

  /**
   * Force reconnection
   */
  async forceReconnect(): Promise<void> {
    console.log('📱 Force reconnecting WebSocket');
    
    if (!this.authData) {
      throw new Error('No authentication data available for reconnection');
    }

    this.disconnect();
    this.isManualDisconnect = false;
    
    // Reset reconnection attempts for manual reconnection
    this.updateConnectionStatus({
      reconnectAttempts: 0,
      error: undefined
    });
    
    // Wait a moment before reconnecting
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await this.connect(this.authData);
  }

  /**
   * Join a room
   */
  joinRoom(room: string, patientId?: string): void {
    if (this.socket?.connected) {
      this.socket.emit('join-room', { room, patientId });
    } else {
      console.warn('📱 Cannot join room: WebSocket not connected');
    }
  }

  /**
   * Leave a room
   */
  leaveRoom(room: string): void {
    if (this.socket?.connected) {
      this.socket.emit('leave-room', room);
    } else {
      console.warn('📱 Cannot leave room: WebSocket not connected');
    }
  }

  /**
   * Send message to server
   */
  emit(event: string, data?: any): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn(`📱 Cannot emit ${event}: WebSocket not connected`);
    }
  }

  /**
   * Listen for events
   */
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback?: Function): void {
    if (!this.listeners.has(event)) return;
    
    if (callback) {
      const callbacks = this.listeners.get(event)!;
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    } else {
      this.listeners.delete(event);
    }
  }

  /**
   * Emit event to listeners
   */
  private emit(event: string, data?: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`📱 Error in event callback for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Update connection status
   */
  private updateConnectionStatus(updates: Partial<ConnectionStatus>): void {
    this.connectionStatus = { ...this.connectionStatus, ...updates };
    this.emit('connection_status_changed', this.connectionStatus);
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return { ...this.connectionStatus };
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Get current rooms
   */
  getCurrentRooms(): void {
    if (this.socket?.connected) {
      this.socket.emit('get-rooms');
    }
  }

  /**
   * Check connection health and reconnect if needed
   */
  async checkConnectionHealth(): Promise<boolean> {
    if (!this.socket || !this.authData) {
      return false;
    }

    // If socket thinks it's connected but we haven't received a heartbeat recently
    if (this.socket.connected) {
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.log('📱 Connection health check failed - no pong received');
          if (!this.isManualDisconnect) {
            this.attemptReconnect();
          }
          resolve(false);
        }, 5000);

        const pongHandler = () => {
          clearTimeout(timeout);
          this.socket?.off('pong', pongHandler);
          resolve(true);
        };

        this.socket.on('pong', pongHandler);
        this.socket.emit('ping');
      });
    }

    // Socket is disconnected, attempt reconnection
    if (!this.isManualDisconnect) {
      this.attemptReconnect();
    }
    
    return false;
  }

  /**
   * Store authentication data for reconnection
   */
  async storeAuthData(authData: AuthData): Promise<void> {
    try {
      await AsyncStorage.setItem('websocket_auth', JSON.stringify(authData));
    } catch (error) {
      console.error('📱 Failed to store auth data:', error);
    }
  }

  /**
   * Retrieve stored authentication data
   */
  async getStoredAuthData(): Promise<AuthData | null> {
    try {
      const stored = await AsyncStorage.getItem('websocket_auth');
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('📱 Failed to retrieve auth data:', error);
      return null;
    }
  }

  /**
   * Clear stored authentication data
   */
  async clearStoredAuthData(): Promise<void> {
    try {
      await AsyncStorage.removeItem('websocket_auth');
    } catch (error) {
      console.error('📱 Failed to clear auth data:', error);
    }
  }
}

// Singleton instance
let webSocketService: WebSocketService | null = null;

/**
 * Get WebSocket service instance
 */
export const getWebSocketService = (config?: WebSocketConfig): WebSocketService => {
  if (!webSocketService && config) {
    webSocketService = new WebSocketService(config);
  }
  
  if (!webSocketService) {
    throw new Error('WebSocket service not initialized. Provide config on first call.');
  }
  
  return webSocketService;
};

/**
 * Initialize WebSocket service
 */
export const initializeWebSocketService = (config: WebSocketConfig): WebSocketService => {
  webSocketService = new WebSocketService(config);
  return webSocketService;
};
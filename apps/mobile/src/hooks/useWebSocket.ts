import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { WebSocketService, ConnectionStatus, AuthData, getWebSocketService } from '../services/websocket-service';

export interface UseWebSocketOptions {
  url: string;
  authData: AuthData;
  autoConnect?: boolean;
  reconnectOnAppForeground?: boolean;
  maxReconnectionAttempts?: number;
  reconnectionDelay?: number;
}

export interface UseWebSocketReturn {
  connectionStatus: ConnectionStatus;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  forceReconnect: () => Promise<void>;
  emit: (event: string, data?: any) => void;
  joinRoom: (room: string, patientId?: string) => void;
  leaveRoom: (room: string) => void;
  on: (event: string, callback: Function) => void;
  off: (event: string, callback?: Function) => void;
}

/**
 * React hook for WebSocket connection with automatic reconnection
 */
export const useWebSocket = (options: UseWebSocketOptions): UseWebSocketReturn => {
  const {
    url,
    authData,
    autoConnect = true,
    reconnectOnAppForeground = true,
    maxReconnectionAttempts = 5,
    reconnectionDelay = 1000
  } = options;

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    connecting: false,
    reconnecting: false,
    reconnectAttempts: 0
  });

  const webSocketServiceRef = useRef<WebSocketService | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const eventListenersRef = useRef<Map<string, Function[]>>(new Map());

  // Initialize WebSocket service
  useEffect(() => {
    if (!webSocketServiceRef.current) {
      webSocketServiceRef.current = getWebSocketService({
        url,
        autoConnect,
        reconnectionAttempts: maxReconnectionAttempts,
        reconnectionDelay,
        reconnectionDelayMax: 5000,
        timeout: 20000
      });

      // Set up connection status listener
      webSocketServiceRef.current.on('connection_status_changed', (status: ConnectionStatus) => {
        setConnectionStatus(status);
      });
    }
  }, [url, autoConnect, maxReconnectionAttempts, reconnectionDelay]);

  // Handle app state changes for reconnection
  useEffect(() => {
    if (!reconnectOnAppForeground) return;

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      const previousAppState = appStateRef.current;
      appStateRef.current = nextAppState;

      // App came to foreground from background
      if (previousAppState.match(/inactive|background/) && nextAppState === 'active') {
        console.log('📱 App came to foreground, checking WebSocket connection');
        
        if (webSocketServiceRef.current && !webSocketServiceRef.current.isConnected()) {
          console.log('📱 WebSocket disconnected, attempting to reconnect');
          try {
            await webSocketServiceRef.current.forceReconnect();
          } catch (error) {
            console.error('📱 Failed to reconnect on app foreground:', error);
          }
        }
      }
      
      // App went to background
      if (nextAppState.match(/inactive|background/) && previousAppState === 'active') {
        console.log('📱 App went to background');
        // Optionally disconnect or reduce activity
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
    };
  }, [reconnectOnAppForeground]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect && webSocketServiceRef.current && authData) {
      connect();
    }
  }, [autoConnect, authData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (webSocketServiceRef.current) {
        webSocketServiceRef.current.disconnect();
      }
    };
  }, []);

  const connect = useCallback(async () => {
    if (!webSocketServiceRef.current) {
      throw new Error('WebSocket service not initialized');
    }

    try {
      await webSocketServiceRef.current.connect(authData);
      
      // Store auth data for automatic reconnection
      await webSocketServiceRef.current.storeAuthData(authData);
      
    } catch (error) {
      console.error('📱 Failed to connect WebSocket:', error);
      throw error;
    }
  }, [authData]);

  const disconnect = useCallback(() => {
    if (webSocketServiceRef.current) {
      webSocketServiceRef.current.disconnect();
    }
  }, []);

  const forceReconnect = useCallback(async () => {
    if (!webSocketServiceRef.current) {
      throw new Error('WebSocket service not initialized');
    }

    try {
      await webSocketServiceRef.current.forceReconnect();
    } catch (error) {
      console.error('📱 Failed to force reconnect:', error);
      throw error;
    }
  }, []);

  const emit = useCallback((event: string, data?: any) => {
    if (webSocketServiceRef.current) {
      webSocketServiceRef.current.emit(event, data);
    }
  }, []);

  const joinRoom = useCallback((room: string, patientId?: string) => {
    if (webSocketServiceRef.current) {
      webSocketServiceRef.current.joinRoom(room, patientId);
    }
  }, []);

  const leaveRoom = useCallback((room: string) => {
    if (webSocketServiceRef.current) {
      webSocketServiceRef.current.leaveRoom(room);
    }
  }, []);

  const on = useCallback((event: string, callback: Function) => {
    if (webSocketServiceRef.current) {
      webSocketServiceRef.current.on(event, callback);
      
      // Track listeners for cleanup
      if (!eventListenersRef.current.has(event)) {
        eventListenersRef.current.set(event, []);
      }
      eventListenersRef.current.get(event)!.push(callback);
    }
  }, []);

  const off = useCallback((event: string, callback?: Function) => {
    if (webSocketServiceRef.current) {
      webSocketServiceRef.current.off(event, callback);
      
      // Clean up tracking
      if (callback) {
        const listeners = eventListenersRef.current.get(event);
        if (listeners) {
          const index = listeners.indexOf(callback);
          if (index > -1) {
            listeners.splice(index, 1);
          }
        }
      } else {
        eventListenersRef.current.delete(event);
      }
    }
  }, []);

  return {
    connectionStatus,
    isConnected: connectionStatus.connected,
    connect,
    disconnect,
    forceReconnect,
    emit,
    joinRoom,
    leaveRoom,
    on,
    off
  };
};

/**
 * Hook for queue-specific WebSocket functionality
 */
export const useQueueWebSocket = (patientId: string, apiUrl: string) => {
  const webSocket = useWebSocket({
    url: apiUrl,
    authData: {
      patientId,
      userType: 'patient'
    },
    autoConnect: true,
    reconnectOnAppForeground: true
  });

  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [estimatedWait, setEstimatedWait] = useState<number | null>(null);
  const [queueStatus, setQueueStatus] = useState<string>('waiting');

  useEffect(() => {
    // Listen for queue updates
    const handleQueueUpdate = (data: any) => {
      console.log('📱 Queue update received:', data);
      if (data.patientId === patientId) {
        setQueuePosition(data.position);
        setEstimatedWait(data.estimatedWait);
        setQueueStatus(data.status || 'waiting');
      }
    };

    const handlePositionUpdate = (data: any) => {
      console.log('📱 Position update received:', data);
      setQueuePosition(data.position);
      setEstimatedWait(data.estimatedWait);
    };

    const handleNotification = (data: any) => {
      console.log('📱 Notification received:', data);
      // Handle notifications (could trigger local notifications)
    };

    // Set up event listeners
    webSocket.on('queue_update', handleQueueUpdate);
    webSocket.on('position_update', handlePositionUpdate);
    webSocket.on('notification', handleNotification);

    // Join patient-specific room when connected
    if (webSocket.isConnected) {
      webSocket.joinRoom(`patient_${patientId}`, patientId);
      webSocket.joinRoom('patients');
    }

    // Cleanup listeners
    return () => {
      webSocket.off('queue_update', handleQueueUpdate);
      webSocket.off('position_update', handlePositionUpdate);
      webSocket.off('notification', handleNotification);
    };
  }, [webSocket, patientId]);

  // Auto-join rooms when connection is established
  useEffect(() => {
    const handleConnectionStatusChange = (status: ConnectionStatus) => {
      if (status.connected) {
        webSocket.joinRoom(`patient_${patientId}`, patientId);
        webSocket.joinRoom('patients');
      }
    };

    webSocket.on('connection_status_changed', handleConnectionStatusChange);

    return () => {
      webSocket.off('connection_status_changed', handleConnectionStatusChange);
    };
  }, [webSocket, patientId]);

  return {
    ...webSocket,
    queuePosition,
    estimatedWait,
    queueStatus
  };
};

/**
 * Hook for staff WebSocket functionality
 */
export const useStaffWebSocket = (token: string, apiUrl: string) => {
  const webSocket = useWebSocket({
    url: apiUrl,
    authData: {
      token,
      userType: 'staff'
    },
    autoConnect: true,
    reconnectOnAppForeground: true
  });

  const [queueData, setQueueData] = useState<any[]>([]);

  useEffect(() => {
    // Listen for queue updates
    const handleQueueUpdate = (data: any) => {
      console.log('📱 Staff queue update received:', data);
      setQueueData(data.queue || []);
    };

    // Set up event listeners
    webSocket.on('queue_update', handleQueueUpdate);

    // Join staff room when connected
    if (webSocket.isConnected) {
      webSocket.joinRoom('staff');
    }

    // Cleanup listeners
    return () => {
      webSocket.off('queue_update', handleQueueUpdate);
    };
  }, [webSocket]);

  // Auto-join staff room when connection is established
  useEffect(() => {
    const handleConnectionStatusChange = (status: ConnectionStatus) => {
      if (status.connected) {
        webSocket.joinRoom('staff');
      }
    };

    webSocket.on('connection_status_changed', handleConnectionStatusChange);

    return () => {
      webSocket.off('connection_status_changed', handleConnectionStatusChange);
    };
  }, [webSocket]);

  return {
    ...webSocket,
    queueData
  };
};
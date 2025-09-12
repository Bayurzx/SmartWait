// apps\mobile\src\hooks\useWebSocket.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { getWebSocketService, WebSocketService, QueueUpdate, PositionUpdate } from '../services/websocket';

export interface ConnectionStatus {
  connected: boolean;
  connecting: boolean;
  reconnectAttempts: number;
  authenticated: boolean;
}

export interface AuthData {
  patientId?: string;
  token?: string;
  userType: 'patient' | 'staff';
}

export interface UseWebSocketOptions {
  authData: AuthData;
  autoConnect?: boolean;
  reconnectOnAppForeground?: boolean;
}

export interface UseWebSocketReturn {
  connectionStatus: ConnectionStatus;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  forceReconnect: () => Promise<void>;
  joinRoom: (room: string, patientId?: string) => void;
  leaveRoom: (room: string) => void;
  on: (event: string, callback: Function) => void;
  off: (event: string, callback?: Function) => void;
  removeAllListeners: () => void;
}

/**
 * React hook for WebSocket connection with automatic reconnection
 */
export const useWebSocket = (options: UseWebSocketOptions): UseWebSocketReturn => {
  const {
    authData,
    autoConnect = true,
    reconnectOnAppForeground = true
  } = options;

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    connecting: false,
    reconnectAttempts: 0,
    authenticated: false
  });

  const webSocketServiceRef = useRef<WebSocketService | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const isInitializedRef = useRef(false);

  // Initialize WebSocket service
  useEffect(() => {
    if (!webSocketServiceRef.current) {
      webSocketServiceRef.current = getWebSocketService();
      isInitializedRef.current = true;
    }
  }, []);

  // Update connection status based on service status
  useEffect(() => {
    if (!webSocketServiceRef.current) return;

    const updateStatus = () => {
      if (webSocketServiceRef.current) {
        const status = webSocketServiceRef.current.getConnectionStatus();
        setConnectionStatus(status);
      }
    };

    // Set up event listeners for status changes
    const service = webSocketServiceRef.current;

    service.onConnect(() => {
      console.log('WebSocket connected in hook');
      updateStatus();
    });

    service.onDisconnect(() => {
      console.log('WebSocket disconnected in hook');
      updateStatus();
    });

    service.onConnectionError((error) => {
      console.error('WebSocket connection error in hook:', error);
      updateStatus();
    });

    // Initial status update
    updateStatus();

    // Periodic status polling as fallback
    const statusInterval = setInterval(updateStatus, 1000);

    return () => {
      clearInterval(statusInterval);
    };
  }, []);

  // Handle app state changes for reconnection
  useEffect(() => {
    if (!reconnectOnAppForeground) return;

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      const previousAppState = appStateRef.current;
      appStateRef.current = nextAppState;

      // App came to foreground from background
      if (previousAppState.match(/inactive|background/) && nextAppState === 'active') {
        console.log('App came to foreground, checking WebSocket connection');

        if (webSocketServiceRef.current && !webSocketServiceRef.current.isConnected()) {
          console.log('WebSocket disconnected, attempting to reconnect');
          try {
            await connect();
          } catch (error) {
            console.error('Failed to reconnect on app foreground:', error);
          }
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [reconnectOnAppForeground]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect && webSocketServiceRef.current && authData && isInitializedRef.current) {
      connect().catch(error => {
        console.error('Auto-connect failed:', error);
      });
    }
  }, [autoConnect, authData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (webSocketServiceRef.current) {
        webSocketServiceRef.current.removeAllListeners();
        webSocketServiceRef.current.disconnect();
      }
    };
  }, []);

  const connect = useCallback(async () => {
    if (!webSocketServiceRef.current) {
      throw new Error('WebSocket service not initialized');
    }

    try {
      if (authData.userType === 'patient' && authData.patientId) {
        await webSocketServiceRef.current.connectAsPatient(authData.patientId);
      } else if (authData.userType === 'staff' && authData.token) {
        await webSocketServiceRef.current.connectAsStaff(authData.token);
      } else {
        throw new Error('Invalid authentication data provided');
      }

    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
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
      // Disconnect first, then reconnect
      webSocketServiceRef.current.disconnect();

      // Wait a moment before reconnecting
      await new Promise(resolve => setTimeout(resolve, 500));

      await connect();
    } catch (error) {
      console.error('Failed to force reconnect:', error);
      throw error;
    }
  }, [connect]);

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
    if (!webSocketServiceRef.current) return;

    const service = webSocketServiceRef.current;

    // Map common events to service methods
    switch (event) {
      case 'queue_update':
        service.onQueueUpdate(callback as (update: QueueUpdate) => void);
        break;
      case 'position_update':
        service.onPositionUpdate(callback as (update: PositionUpdate) => void);
        break;
      case 'status_change':
        service.onStatusChange(callback as (update: QueueUpdate) => void);
        break;
      case 'connect':
        service.onConnect(callback as () => void);
        break;
      case 'disconnect':
        service.onDisconnect(callback as () => void);
        break;
      case 'connect_error':
        service.onConnectionError(callback as (error: Error) => void);
        break;
      case 'room-joined':
        service.onRoomJoined(callback as (rooms: string[]) => void);
        break;
      case 'room-left':
        service.onRoomLeft(callback as (rooms: string[]) => void);
        break;
      case 'current-rooms':
        service.onCurrentRooms(callback as (rooms: string[]) => void);
        break;
      default:
        console.warn(`Event ${event} not specifically handled, may not work as expected`);
        break;
    }
  }, []);

  const off = useCallback((event: string, callback?: Function) => {
    if (!webSocketServiceRef.current) return;

    const service = webSocketServiceRef.current;

    // Map common events to service methods
    switch (event) {
      case 'queue_update':
        service.offQueueUpdate(callback as (update: QueueUpdate) => void);
        break;
      case 'position_update':
        service.offPositionUpdate(callback as (update: PositionUpdate) => void);
        break;
      default:
        // For other events, we'd need to extend the service or use a generic off method
        console.warn(`Cannot remove listener for ${event} - not implemented in service`);
        break;
    }
  }, []);

  const removeAllListeners = useCallback(() => {
    if (webSocketServiceRef.current) {
      webSocketServiceRef.current.removeAllListeners();
    }
  }, []);

  return {
    connectionStatus,
    isConnected: connectionStatus.connected,
    connect,
    disconnect,
    forceReconnect,
    joinRoom,
    leaveRoom,
    on,
    off,
    removeAllListeners
  };
};

/**
 * Hook for queue-specific WebSocket functionality
 */
export const useQueueWebSocket = (patientId: string) => {
  const webSocket = useWebSocket({
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
    const handleQueueUpdate = (data: QueueUpdate) => {
      console.log('Queue update received:', data);
      if (data.patientId === patientId) {
        if (data.newPosition !== undefined) {
          setQueuePosition(data.newPosition);
        }
        if (data.estimatedWait !== undefined) {
          setEstimatedWait(data.estimatedWait);
        }
        if (data.status) {
          setQueueStatus(data.status);
        }
      }
    };

    const handlePositionUpdate = (data: PositionUpdate) => {
      console.log('Position update received:', data);
      setQueuePosition(data.position);
      setEstimatedWait(data.estimatedWait);
    };

    const handleStatusChange = (data: QueueUpdate) => {
      console.log('Status change received:', data);
      if (data.patientId === patientId && data.status) {
        setQueueStatus(data.status);
      }
    };

    // Set up event listeners
    webSocket.on('queue_update', handleQueueUpdate);
    webSocket.on('position_update', handlePositionUpdate);
    webSocket.on('status_change', handleStatusChange);

    // Join patient-specific room when connected
    if (webSocket.isConnected) {
      webSocket.joinRoom(`patient_${patientId}`, patientId);
      webSocket.joinRoom('patients');
    }

    // Cleanup listeners
    return () => {
      webSocket.off('queue_update', handleQueueUpdate);
      webSocket.off('position_update', handlePositionUpdate);
      webSocket.off('status_change', handleStatusChange);
    };
  }, [webSocket, patientId]);

  // Auto-join rooms when connection is established
  useEffect(() => {
    if (webSocket.isConnected) {
      webSocket.joinRoom(`patient_${patientId}`, patientId);
      webSocket.joinRoom('patients');
    }
  }, [webSocket.isConnected, patientId]);

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
export const useStaffWebSocket = (token: string) => {
  const webSocket = useWebSocket({
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
    const handleQueueUpdate = (data: QueueUpdate) => {
      console.log('Staff queue update received:', data);
      // Update queue data based on the update
      setQueueData(currentQueue => {
        // This is a simplified update - you might need more complex logic
        // depending on your queue data structure
        return [...currentQueue];
      });
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
    if (webSocket.isConnected) {
      webSocket.joinRoom('staff');
    }
  }, [webSocket.isConnected]);

  return {
    ...webSocket,
    queueData
  };
};
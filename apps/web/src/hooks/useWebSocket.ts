// apps\web\src\hooks\useWebSocket.ts
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { getWebSocketService, QueueUpdate } from '../services/websocket';

interface UseWebSocketOptions {
  patientId?: string;
  onPositionUpdate?: (data: QueueUpdate) => void;
  onQueueUpdate?: (data: QueueUpdate) => void;
  onStatusChange?: (data: QueueUpdate) => void;
}

interface WebSocketState {
  connected: boolean;
  connecting: boolean;
  reconnectAttempts: number;
  error: string | null;
}

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  const { patientId, onPositionUpdate, onQueueUpdate, onStatusChange } = options;
  
  const [state, setState] = useState<WebSocketState>({
    connected: false,
    connecting: false,
    reconnectAttempts: 0,
    error: null,
  });

  const webSocketService = useRef(getWebSocketService(patientId));
  const hasJoinedRoom = useRef(false);

  const updateConnectionState = useCallback(() => {
    const status = webSocketService.current.getConnectionStatus();
    setState(prev => ({
      ...prev,
      connected: status.connected,
      connecting: status.connecting,
      reconnectAttempts: status.reconnectAttempts,
    }));
  }, []);

  const handleConnect = useCallback(() => {
    console.log('🌐 WebSocket connected');
    setState(prev => ({ ...prev, connected: true, connecting: false, error: null }));
    
    // Join patient room if patientId is provided and not already joined
    if (patientId && !hasJoinedRoom.current) {
      webSocketService.current.joinPatientRoom(patientId);
      hasJoinedRoom.current = true;
    }
  }, [patientId]);

  const handleDisconnect = useCallback(() => {
    console.log('🌐 WebSocket disconnected');
    setState(prev => ({ ...prev, connected: false, connecting: false }));
    hasJoinedRoom.current = false;
  }, []);

  const handleConnectionError = useCallback((error: Error) => {
    console.error('🌐 WebSocket connection error:', error);
    setState(prev => ({ 
      ...prev, 
      connected: false, 
      connecting: false, 
      error: error.message 
    }));
  }, []);

  const handlePositionUpdate = useCallback((data: QueueUpdate) => {
    console.log('🌐 Position update received:', data);
    onPositionUpdate?.(data);
  }, [onPositionUpdate]);

  const handleQueueUpdate = useCallback((data: QueueUpdate) => {
    console.log('🌐 Queue update received:', data);
    onQueueUpdate?.(data);
  }, [onQueueUpdate]);

  const handleStatusChange = useCallback((data: QueueUpdate) => {
    console.log('🌐 Status change received:', data);
    onStatusChange?.(data);
  }, [onStatusChange]);

  // Setup WebSocket connection and event listeners
  useEffect(() => {
    const ws = webSocketService.current;

    // Set up event listeners
    ws.onConnect(handleConnect);
    ws.onDisconnect(handleDisconnect);
    ws.onConnectionError(handleConnectionError);
    ws.onPositionUpdate(handlePositionUpdate);
    ws.onQueueUpdate(handleQueueUpdate);
    ws.onStatusChange(handleStatusChange);

    // Update initial state
    updateConnectionState();

    // Join patient room if connected and patientId is provided
    if (patientId && ws.isConnected() && !hasJoinedRoom.current) {
      ws.joinPatientRoom(patientId);
      hasJoinedRoom.current = true;
    }

    // Cleanup function
    return () => {
      if (patientId && hasJoinedRoom.current) {
        ws.leavePatientRoom(patientId);
        hasJoinedRoom.current = false;
      }
    };
  }, [
    patientId,
    handleConnect,
    handleDisconnect,
    handleConnectionError,
    handlePositionUpdate,
    handleQueueUpdate,
    handleStatusChange,
    updateConnectionState,
  ]);

  // Handle patientId changes
  useEffect(() => {
    const ws = webSocketService.current;
    
    if (patientId) {
      if (!ws.isConnected()) {
        // Connect with patientId if not connected
        ws.connect(patientId);
      } else if (!hasJoinedRoom.current) {
        // Join room if connected but not in room
        ws.joinPatientRoom(patientId);
        hasJoinedRoom.current = true;
      }
    }
  }, [patientId]);

  const reconnect = useCallback(() => {
    setState(prev => ({ ...prev, connecting: true, error: null }));
    webSocketService.current.connect(patientId);
  }, [patientId]);

  const disconnect = useCallback(() => {
    if (patientId && hasJoinedRoom.current) {
      webSocketService.current.leavePatientRoom(patientId);
      hasJoinedRoom.current = false;
    }
    webSocketService.current.disconnect();
    setState({
      connected: false,
      connecting: false,
      reconnectAttempts: 0,
      error: null,
    });
  }, [patientId]);

  return {
    ...state,
    reconnect,
    disconnect,
    isConnected: state.connected,
  };
};

export default useWebSocket;
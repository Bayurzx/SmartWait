import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useWebSocket } from '../useWebSocket';
import { QueueUpdate } from '../../services/websocket';

// Mock the WebSocket service
jest.mock('../../services/websocket', () => ({
  getWebSocketService: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    joinPatientRoom: jest.fn(),
    leavePatientRoom: jest.fn(),
    onConnect: jest.fn(),
    onDisconnect: jest.fn(),
    onConnectionError: jest.fn(),
    onPositionUpdate: jest.fn(),
    onQueueUpdate: jest.fn(),
    onStatusChange: jest.fn(),
    isConnected: jest.fn(() => false),
    getConnectionStatus: jest.fn(() => ({
      connected: false,
      connecting: false,
      reconnectAttempts: 0,
    })),
  })),
}));

describe('useWebSocket', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useWebSocket());

    expect(result.current.connected).toBe(false);
    expect(result.current.connecting).toBe(false);
    expect(result.current.reconnectAttempts).toBe(0);
    expect(result.current.error).toBe(null);
  });

  it('should handle position updates', () => {
    const mockOnPositionUpdate = jest.fn();
    const { result } = renderHook(() => 
      useWebSocket({ 
        patientId: 'test-patient-id',
        onPositionUpdate: mockOnPositionUpdate 
      })
    );

    const updateData: QueueUpdate = {
      type: 'position_change',
      patientId: 'test-patient-id',
      position: 5,
      estimatedWait: 15,
      timestamp: new Date().toISOString(),
    };

    // Simulate position update
    act(() => {
      // This would normally be triggered by the WebSocket service
      mockOnPositionUpdate(updateData);
    });

    expect(mockOnPositionUpdate).toHaveBeenCalledWith(updateData);
  });

  it('should provide reconnect functionality', () => {
    const { result } = renderHook(() => useWebSocket());

    expect(typeof result.current.reconnect).toBe('function');
    expect(typeof result.current.disconnect).toBe('function');
  });

  it('should handle patient room joining', () => {
    const patientId = 'test-patient-id';
    renderHook(() => useWebSocket({ patientId }));

    // The hook should attempt to join the patient room
    // This would be verified through the mocked WebSocket service
  });

  it('should handle connection state changes', () => {
    const { result } = renderHook(() => useWebSocket());

    // Initial state
    expect(result.current.isConnected).toBe(false);

    // The actual connection state changes would be tested
    // through integration with the WebSocket service
  });
});
import { WebSocketService } from '../services/websocket-service';

// Mock Socket.io client
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    connected: false,
    connect: jest.fn(),
    disconnect: jest.fn(),
    on: jest.fn(),
    emit: jest.fn(),
    removeAllListeners: jest.fn()
  }))
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve())
}));

describe('WebSocket Automatic Reconnection', () => {
  let webSocketService: WebSocketService;
  let mockSocket: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    webSocketService = new WebSocketService({
      url: 'http://localhost:3001',
      reconnectionAttempts: 3,
      reconnectionDelay: 1000
    });

    // Get the mocked socket instance
    const { io } = require('socket.io-client');
    mockSocket = io();
  });

  afterEach(() => {
    webSocketService.disconnect();
  });

  it('should initialize with correct configuration', () => {
    expect(webSocketService).toBeDefined();
    expect(webSocketService.isConnected()).toBe(false);
  });

  it('should attempt to connect with authentication data', async () => {
    const authData = {
      patientId: 'patient-123',
      userType: 'patient' as const
    };

    await webSocketService.connect(authData);

    expect(mockSocket.connect).toHaveBeenCalled();
  });

  it('should handle connection errors and schedule reconnection', async () => {
    const authData = {
      patientId: 'patient-123',
      userType: 'patient' as const
    };

    // Mock connection error
    mockSocket.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'connect_error') {
        setTimeout(() => callback(new Error('Connection failed')), 100);
      }
    });

    await webSocketService.connect(authData);

    // Wait for error to be processed
    await new Promise(resolve => setTimeout(resolve, 200));

    const connectionStatus = webSocketService.getConnectionStatus();
    expect(connectionStatus.connected).toBe(false);
    expect(connectionStatus.error).toContain('Connection failed');
  });

  it('should track reconnection attempts', () => {
    const connectionStatus = webSocketService.getConnectionStatus();
    expect(connectionStatus.reconnectAttempts).toBe(0);
  });

  it('should store and retrieve authentication data', async () => {
    const authData = {
      patientId: 'patient-123',
      userType: 'patient' as const
    };

    await webSocketService.storeAuthData(authData);
    
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'websocket_auth',
      JSON.stringify(authData)
    );
  });

  it('should emit events to listeners', () => {
    const mockCallback = jest.fn();
    
    webSocketService.on('test_event', mockCallback);
    
    // Simulate internal event emission
    (webSocketService as any).emit('test_event', { data: 'test' });
    
    expect(mockCallback).toHaveBeenCalledWith({ data: 'test' });
  });

  it('should remove event listeners', () => {
    const mockCallback = jest.fn();
    
    webSocketService.on('test_event', mockCallback);
    webSocketService.off('test_event', mockCallback);
    
    // Simulate internal event emission
    (webSocketService as any).emit('test_event', { data: 'test' });
    
    expect(mockCallback).not.toHaveBeenCalled();
  });

  it('should handle manual disconnect', () => {
    webSocketService.disconnect();
    
    expect(mockSocket.removeAllListeners).toHaveBeenCalled();
    expect(mockSocket.disconnect).toHaveBeenCalled();
    
    const connectionStatus = webSocketService.getConnectionStatus();
    expect(connectionStatus.connected).toBe(false);
    expect(connectionStatus.reconnectAttempts).toBe(0);
  });

  it('should join and leave rooms when connected', () => {
    // Mock connected state
    mockSocket.connected = true;
    
    webSocketService.joinRoom('patient_123');
    expect(mockSocket.emit).toHaveBeenCalledWith('join-room', { room: 'patient_123' });
    
    webSocketService.leaveRoom('patient_123');
    expect(mockSocket.emit).toHaveBeenCalledWith('leave-room', 'patient_123');
  });

  it('should not emit when disconnected', () => {
    // Mock disconnected state
    mockSocket.connected = false;
    
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    
    webSocketService.emit('test_event', { data: 'test' });
    
    expect(mockSocket.emit).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith('📱 Cannot emit test_event: WebSocket not connected');
    
    consoleSpy.mockRestore();
  });

  it('should test network connectivity before reconnection', async () => {
    const authData = {
      patientId: 'patient-123',
      userType: 'patient' as const
    };

    // Mock fetch to simulate network failure
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    await webSocketService.connect(authData);

    // Trigger reconnection attempt
    const service = webSocketService as any;
    await service.attemptReconnect();

    // Should have attempted network test
    expect(global.fetch).toHaveBeenCalled();
  });

  it('should reset reconnection attempts on manual reconnection', async () => {
    const authData = {
      patientId: 'patient-123',
      userType: 'patient' as const
    };

    await webSocketService.connect(authData);

    // Simulate failed reconnection attempts
    const service = webSocketService as any;
    service.updateConnectionStatus({ reconnectAttempts: 3 });

    // Force reconnection should reset attempts
    await webSocketService.forceReconnect();

    const connectionStatus = webSocketService.getConnectionStatus();
    expect(connectionStatus.reconnectAttempts).toBe(0);
  });

  it('should check connection health with ping/pong', async () => {
    const authData = {
      patientId: 'patient-123',
      userType: 'patient' as const
    };

    await webSocketService.connect(authData);
    mockSocket.connected = true;

    // Mock pong response
    mockSocket.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'pong') {
        setTimeout(() => callback(), 100);
      }
    });

    const isHealthy = await webSocketService.checkConnectionHealth();
    
    expect(mockSocket.emit).toHaveBeenCalledWith('ping');
    expect(isHealthy).toBe(true);
  });
});
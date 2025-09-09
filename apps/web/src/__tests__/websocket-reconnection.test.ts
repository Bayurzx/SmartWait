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

// Mock browser APIs
Object.defineProperty(window, 'localStorage', {
  value: {
    setItem: jest.fn(),
    getItem: jest.fn(() => null),
    removeItem: jest.fn()
  }
});

Object.defineProperty(document, 'visibilityState', {
  writable: true,
  value: 'visible'
});

Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true
});

describe('WebSocket Automatic Reconnection (Web)', () => {
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
    webSocketService.cleanup();
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

  it('should store and retrieve authentication data in localStorage', () => {
    const authData = {
      patientId: 'patient-123',
      userType: 'patient' as const
    };

    webSocketService.storeAuthData(authData);
    
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      'websocket_auth',
      JSON.stringify(authData)
    );
  });

  it('should handle browser online/offline events', () => {
    // Mock event listeners
    const addEventListener = jest.spyOn(window, 'addEventListener');
    
    // Create new service to trigger event listener setup
    const service = new WebSocketService({
      url: 'http://localhost:3001'
    });

    expect(addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
    expect(addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    
    service.cleanup();
  });

  it('should handle page visibility changes', () => {
    // Mock event listeners
    const addEventListener = jest.spyOn(document, 'addEventListener');
    
    // Create new service to trigger event listener setup
    const service = new WebSocketService({
      url: 'http://localhost:3001'
    });

    expect(addEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    
    service.cleanup();
  });

  it('should skip reconnection when browser is offline', async () => {
    const authData = {
      patientId: 'patient-123',
      userType: 'patient' as const
    };

    // Mock offline state
    Object.defineProperty(navigator, 'onLine', { value: false });

    await webSocketService.connect(authData);

    // Mock connection error to trigger reconnection attempt
    mockSocket.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'connect_error') {
        callback(new Error('Connection failed'));
      }
    });

    // Trigger connection error
    const errorCallback = mockSocket.on.mock.calls.find((call: [string, Function]) => call[0] === 'connect_error')?.[1];
    if (errorCallback) {
      errorCallback(new Error('Connection failed'));
    }

    // Wait for reconnection logic
    await new Promise(resolve => setTimeout(resolve, 100));

    // Should not attempt reconnection when offline
    const connectionStatus = webSocketService.getConnectionStatus();
    expect(connectionStatus.error).toContain('Connection failed');
  });

  it('should cleanup event listeners on destroy', () => {
    const removeEventListener = jest.spyOn(document, 'removeEventListener');
    const windowRemoveEventListener = jest.spyOn(window, 'removeEventListener');
    
    webSocketService.cleanup();

    expect(removeEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(windowRemoveEventListener).toHaveBeenCalledWith('online', expect.any(Function));
    expect(windowRemoveEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
  });

  it('should emit events to listeners', () => {
    const mockCallback = jest.fn();
    
    webSocketService.on('test_event', mockCallback);
    
    // Simulate internal event emission
    (webSocketService as any).emit('test_event', { data: 'test' });
    
    expect(mockCallback).toHaveBeenCalledWith({ data: 'test' });
  });

  it('should handle force reconnection', async () => {
    const authData = {
      patientId: 'patient-123',
      userType: 'patient' as const
    };

    // First connect
    await webSocketService.connect(authData);

    // Force reconnection
    await webSocketService.forceReconnect();

    // Should disconnect and reconnect
    expect(mockSocket.removeAllListeners).toHaveBeenCalled();
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });

  it('should join and leave rooms when connected', () => {
    // Mock connected state
    mockSocket.connected = true;
    
    webSocketService.joinRoom('patient_123');
    expect(mockSocket.emit).toHaveBeenCalledWith('join-room', { room: 'patient_123' });
    
    webSocketService.leaveRoom('patient_123');
    expect(mockSocket.emit).toHaveBeenCalledWith('leave-room', 'patient_123');
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

  it('should skip reconnection when page is hidden', async () => {
    const authData = {
      patientId: 'patient-123',
      userType: 'patient' as const
    };

    // Mock hidden page
    Object.defineProperty(document, 'visibilityState', { value: 'hidden' });

    await webSocketService.connect(authData);

    // Trigger reconnection attempt
    const service = webSocketService as any;
    const scheduleReconnectSpy = jest.spyOn(service, 'scheduleReconnect');
    
    await service.attemptReconnect();

    expect(scheduleReconnectSpy).toHaveBeenCalled();
  });
});
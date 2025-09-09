import { apiService } from '../api';
import { webSocketService } from '../websocket';
import { configService } from '../config';

// Mock fetch for API tests
global.fetch = jest.fn();

// Mock socket.io-client
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    connected: false,
  })),
}));

describe('Service Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('API Service', () => {
    it('should use configuration service for base URL', () => {
      const expectedUrl = configService.getApiUrl();
      expect(apiService['baseUrl']).toBe(expectedUrl);
    });

    it('should handle check-in requests', async () => {
      const mockResponse = {
        success: true,
        data: {
          patientId: 'test-id',
          position: 1,
          estimatedWait: 15,
        },
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const checkInData = {
        name: 'John Doe',
        phone: '(555) 123-4567',
        appointmentTime: '2:30 PM',
      };

      const result = await apiService.checkIn(checkInData);
      
      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        `${configService.getApiUrl()}/api/checkin`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(checkInData),
        })
      );
    });

    it('should handle queue status requests', async () => {
      const mockResponse = {
        success: true,
        data: {
          patientId: 'test-id',
          position: 3,
          estimatedWait: 45,
          status: 'waiting' as const,
        },
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await apiService.getQueueStatus('test-id');
      
      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        `${configService.getApiUrl()}/api/position/test-id`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should handle network errors gracefully', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new TypeError('Network request failed'));

      await expect(apiService.checkIn({
        name: 'John Doe',
        phone: '(555) 123-4567',
        appointmentTime: '2:30 PM',
      })).rejects.toThrow('Unable to connect to the server. Please check your internet connection.');
    });
  });

  describe('WebSocket Service', () => {
    it('should use configuration service for WebSocket URL', () => {
      const expectedUrl = configService.getWebSocketUrl();
      expect(webSocketService['baseUrl']).toBe(expectedUrl);
    });

    it('should provide connection status', () => {
      const status = webSocketService.getConnectionStatus();
      expect(['connected', 'connecting', 'disconnected']).toContain(status);
    });

    it('should handle patient room operations', () => {
      webSocketService.joinPatientRoom('test-patient-id');
      webSocketService.leavePatientRoom('test-patient-id');
      
      // These should not throw errors
      expect(true).toBe(true);
    });
  });

  describe('Configuration Service', () => {
    it('should provide default configuration values', () => {
      const config = configService.getConfig();
      
      expect(config.apiUrl).toBeDefined();
      expect(config.websocketUrl).toBeDefined();
      expect(config.environment).toBeDefined();
      expect(typeof config.enableWebSocket).toBe('boolean');
      expect(typeof config.pollingInterval).toBe('number');
      expect(typeof config.fallbackPollingInterval).toBe('number');
    });

    it('should provide individual configuration values', () => {
      expect(typeof configService.getApiUrl()).toBe('string');
      expect(typeof configService.getWebSocketUrl()).toBe('string');
      expect(typeof configService.isWebSocketEnabled()).toBe('boolean');
      expect(typeof configService.getPollingInterval()).toBe('number');
      expect(typeof configService.getFallbackPollingInterval()).toBe('number');
    });
  });
});
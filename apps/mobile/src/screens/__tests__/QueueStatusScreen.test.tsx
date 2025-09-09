import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import QueueStatusScreen from '../QueueStatusScreen';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock API service
jest.mock('../../services/api', () => ({
  apiService: {
    getQueueStatus: jest.fn(),
  },
}));

// Mock WebSocket service
jest.mock('../../services/websocket', () => ({
  webSocketService: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    joinPatientRoom: jest.fn(),
    leavePatientRoom: jest.fn(),
    onQueueUpdate: jest.fn(),
    onPositionUpdate: jest.fn(),
    offQueueUpdate: jest.fn(),
    offPositionUpdate: jest.fn(),
    isConnected: jest.fn(() => false),
    getConnectionStatus: jest.fn(() => 'disconnected'),
  },
}));

// Mock config service
jest.mock('../../services/config', () => ({
  configService: {
    getApiUrl: jest.fn(() => 'http://localhost:3001'),
    getWebSocketUrl: jest.fn(() => 'http://localhost:3001'),
    getFallbackPollingInterval: jest.fn(() => 10000),
    getPollingInterval: jest.fn(() => 30000),
  },
}));

import { apiService } from '../../services/api';

describe('QueueStatusScreen', () => {
  const mockOnBackToCheckIn = jest.fn();
  const mockPatientId = 'test-patient-id';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state initially', () => {
    const { getByText } = render(
      <QueueStatusScreen
        patientId={mockPatientId}
        onBackToCheckIn={mockOnBackToCheckIn}
      />
    );

    expect(getByText('Loading your queue status...')).toBeTruthy();
  });

  it('displays queue status when loaded', async () => {
    const mockQueueData = {
      success: true,
      data: {
        patientId: mockPatientId,
        position: 3,
        estimatedWait: 45,
        status: 'waiting' as const,
      },
    };

    (apiService.getQueueStatus as jest.Mock).mockResolvedValueOnce(mockQueueData);

    const { getByText } = render(
      <QueueStatusScreen
        patientId={mockPatientId}
        onBackToCheckIn={mockOnBackToCheckIn}
      />
    );

    await waitFor(() => {
      expect(getByText('You are #3 in line')).toBeTruthy();
      expect(getByText('Estimated wait: 45 minutes')).toBeTruthy();
    });
  });

  it('displays called status correctly', async () => {
    const mockQueueData = {
      success: true,
      data: {
        patientId: mockPatientId,
        position: 0,
        estimatedWait: 0,
        status: 'called' as const,
      },
    };

    (apiService.getQueueStatus as jest.Mock).mockResolvedValueOnce(mockQueueData);

    const { getByText } = render(
      <QueueStatusScreen
        patientId={mockPatientId}
        onBackToCheckIn={mockOnBackToCheckIn}
      />
    );

    await waitFor(() => {
      expect(getByText('You have been called! Please proceed to the front desk.')).toBeTruthy();
      expect(getByText('Please head to the facility now!')).toBeTruthy();
    });
  });

  it('displays completed status correctly', async () => {
    const mockQueueData = {
      success: true,
      data: {
        patientId: mockPatientId,
        position: 0,
        estimatedWait: 0,
        status: 'completed' as const,
      },
    };

    (apiService.getQueueStatus as jest.Mock).mockResolvedValueOnce(mockQueueData);

    const { getByText } = render(
      <QueueStatusScreen
        patientId={mockPatientId}
        onBackToCheckIn={mockOnBackToCheckIn}
      />
    );

    await waitFor(() => {
      expect(getByText('Your visit is complete. Thank you!')).toBeTruthy();
    });
  });

  it('formats wait time correctly for hours and minutes', async () => {
    const mockQueueData = {
      success: true,
      data: {
        patientId: mockPatientId,
        position: 8,
        estimatedWait: 125, // 2 hours 5 minutes
        status: 'waiting' as const,
      },
    };

    (apiService.getQueueStatus as jest.Mock).mockResolvedValueOnce(mockQueueData);

    const { getByText } = render(
      <QueueStatusScreen
        patientId={mockPatientId}
        onBackToCheckIn={mockOnBackToCheckIn}
      />
    );

    await waitFor(() => {
      expect(getByText('Estimated wait: 2h 5m')).toBeTruthy();
    });
  });

  it('calls API service with correct patient ID', async () => {
    const mockQueueData = {
      success: true,
      data: {
        patientId: mockPatientId,
        position: 1,
        estimatedWait: 15,
        status: 'waiting' as const,
      },
    };

    (apiService.getQueueStatus as jest.Mock).mockResolvedValueOnce(mockQueueData);

    render(
      <QueueStatusScreen
        patientId={mockPatientId}
        onBackToCheckIn={mockOnBackToCheckIn}
        apiUrl="http://test-api.com"
      />
    );

    await waitFor(() => {
      expect(apiService.getQueueStatus).toHaveBeenCalledWith(mockPatientId);
    });
  });
});
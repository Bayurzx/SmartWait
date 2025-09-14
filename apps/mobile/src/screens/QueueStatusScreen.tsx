// apps\mobile\src\screens\QueueStatusScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueueStatus, ApiResponse } from '../types';
import { apiService } from '../services/api';
import { webSocketService, QueueUpdate, PositionUpdate } from '../services/websocket';
import { configService } from '../services/config';

interface QueueStatusScreenProps {
  patientId: string;
  onBackToCheckIn: () => void;
  apiUrl?: string;
}

export const QueueStatusScreen: React.FC<QueueStatusScreenProps> = ({
  patientId,
  onBackToCheckIn,
  apiUrl = 'http://localhost:3001'
}) => {
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [patientName, setPatientName] = useState<string>('');
  const [patientPhone, setPatientPhone] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [timeSinceLastUpdate, setTimeSinceLastUpdate] = useState<string>('0 seconds ago');

  useEffect(() => {
    // CRITICAL FIX: Validate patientId before proceeding
    if (!patientId || patientId === 'undefined' || patientId.trim() === '') {
      console.error('Invalid patientId received:', patientId);
      Alert.alert(
        'Invalid Patient ID',
        'No valid patient ID found. Please check in again.',
        [
          { text: 'Back to Check-in', onPress: onBackToCheckIn },
        ]
      );
      return;
    }

    console.log('QueueStatusScreen initialized with patientId:', patientId);
    loadPatientInfo();
    initializeServices();

    return () => {
      cleanupServices();
    };
  }, [patientId]);

  // Add useEffect to update timeSinceLastUpdate every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeSinceLastUpdate(formatTimeSinceLastUpdate());
    }, 1000);

    return () => clearInterval(interval);
  }, [lastUpdate]);

  const formatTimeSinceLastUpdate = (): string => {
    const now = new Date();
    const diffMs = now.getTime() - lastUpdate.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);

    if (diffSeconds < 60) {
      return `${diffSeconds} second${diffSeconds !== 1 ? 's' : ''} ago`;
    } else if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    } else {
      const diffHours = Math.floor(diffMinutes / 60);
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    }
  };

  const initializeServices = async () => {
    // Configure API service
    if (apiUrl) {
      apiService['baseUrl'] = apiUrl;
    }

    // CRITICAL FIX: Validate patientId before WebSocket connection
    console.log('Attempting WebSocket connection with patientId:', patientId);

    // Initialize WebSocket connection
    try {
      await webSocketService.connectAsPatient(patientId);
      webSocketService.joinPatientRoom(patientId);
      setConnectionStatus('connected');

      // Set up real-time event listeners
      webSocketService.onQueueUpdate(handleQueueUpdate);
      webSocketService.onPositionUpdate(handlePositionUpdate);

      console.log('WebSocket services initialized');
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
      setConnectionStatus('disconnected');
    }

    // Fetch initial queue status
    await fetchQueueStatus();

    // Set up polling as fallback using configuration
    const pollInterval = webSocketService.isConnected()
      ? configService.getPollingInterval()
      : configService.getFallbackPollingInterval();

    const interval = setInterval(() => {
      if (!webSocketService.isConnected()) {
        fetchQueueStatus();
      }
    }, pollInterval);

    return () => clearInterval(interval);
  };

  const cleanupServices = () => {
    webSocketService.leavePatientRoom(patientId);
    webSocketService.offQueueUpdate(handleQueueUpdate);
    webSocketService.offPositionUpdate(handlePositionUpdate);
    webSocketService.disconnect();
  };

  const handleQueueUpdate = useCallback((update: QueueUpdate) => {
    console.log('Received queue update:', update);

    if (update.patientId === patientId) {
      setQueueStatus(prevStatus => {
        if (!prevStatus) return prevStatus;

        return {
          ...prevStatus,
          position: update.newPosition ?? prevStatus.position,
          estimatedWaitMinutes: update.estimatedWaitMinutes ?? prevStatus.estimatedWaitMinutes,
          status: update.status ?? prevStatus.status,
        };
      });

      // Show notification for important updates
      if (update.type === 'patient_called' && update.status === 'called') {
        Alert.alert(
          'You\'ve Been Called!',
          'It\'s your turn! Please proceed to the front desk now.',
          [{ text: 'OK' }]
        );
      }
    }
  }, [patientId]);

  const handlePositionUpdate = useCallback((update: PositionUpdate) => {
    console.log('Received position update:', update);

    setQueueStatus(prevStatus => {
      if (!prevStatus) return prevStatus;

      return {
        ...prevStatus,
        position: update.position,
        estimatedWaitMinutes: update.estimatedWaitMinutes,
      };
    });
  }, []);

  // Monitor WebSocket connection status
  useEffect(() => {
    const checkConnectionStatus = () => {
      const status = webSocketService.getConnectionStatus();

      // Convert the status object to the string type expected by the state
      if (status.connected) {
        setConnectionStatus('connected');
      } else if (status.connecting) {
        setConnectionStatus('connecting');
      } else {
        setConnectionStatus('disconnected');
      }
    };

    const statusInterval = setInterval(checkConnectionStatus, 5000);
    return () => clearInterval(statusInterval);
  }, []);

  const loadPatientInfo = async () => {
    try {
      const name = await AsyncStorage.getItem('patientName');
      const phone = await AsyncStorage.getItem('patientPhone');

      if (name) setPatientName(name);
      if (phone) setPatientPhone(phone);
    } catch (error) {
      console.error('Error loading patient info:', error);
    }
  };

  const fetchQueueStatus = async (showLoading = false, updateTimestamp = false) => {
    try {
      if (showLoading) setLoading(true);

      // CRITICAL FIX: Handle both direct QueueStatus and wrapped ApiResponse
      console.log('Fetching queue status for patientId:', patientId);
      const response = await apiService.getQueueStatus(patientId);
      console.log("API response:", response);

      // Check if response is wrapped in ApiResponse format
      let queueData: QueueStatus;
      if (response && typeof response === 'object') {
        if ('success' in response && 'data' in response) {
          // Response is wrapped in ApiResponse
          const apiResponse = response as ApiResponse<QueueStatus>;
          if (apiResponse.success && apiResponse.data) {
            queueData = apiResponse.data;
          } else {
            throw new Error(apiResponse.message || 'Failed to fetch queue status');
          }
        } else if ('patientId' in response && 'status' in response) {
          // Response is direct QueueStatus
          queueData = response as QueueStatus;
        } else {
          throw new Error('Unexpected response format');
        }
      } else {
        throw new Error('Invalid response format');
      }

      setQueueStatus(queueData);

      // Only update lastUpdate if explicitly requested
      if (updateTimestamp) {
        const newUpdateTime = new Date();
        setLastUpdate(newUpdateTime);
        setTimeSinceLastUpdate('0 seconds ago'); // Reset counter immediately
      }
    } catch (error) {
      console.error('Queue status error:', error);

      if (!queueStatus) {
        // Only show error if we don't have any previous data
        Alert.alert(
          'Connection Error',
          'Unable to get your queue status. Please check your internet connection.',
          [
            { text: 'Retry', onPress: () => fetchQueueStatus(true) },
            { text: 'Back to Check-in', onPress: onBackToCheckIn },
          ]
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchQueueStatus(false, false); // Don't update timestamp on pull-to-refresh
  };

  const handleRefreshButtonClick = () => {
    fetchQueueStatus(true, true); // Update timestamp when refresh button is clicked
  };

  const handleNewCheckIn = async () => {
    console.log('New Check-in button pressed');

    try {
      Alert.alert(
        'New Check-in',
        'This will clear your current queue position and start a new check-in. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Yes, New Check-in',
            style: 'destructive',
            onPress: async () => {
              console.log('User confirmed new check-in, clearing data...');
              try {
                await AsyncStorage.multiRemove(['patientId', 'patientName', 'patientPhone']);
                console.log('AsyncStorage cleared, calling onBackToCheckIn...');
                onBackToCheckIn();
              } catch (error) {
                console.error('Error clearing AsyncStorage:', error);
                // Still navigate even if clearing fails
                onBackToCheckIn();
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error showing alert:', error);
      // Fallback: directly navigate without confirmation
      try {
        await AsyncStorage.multiRemove(['patientId', 'patientName', 'patientPhone']);
        onBackToCheckIn();
      } catch (storageError) {
        console.error('Error in fallback navigation:', storageError);
        onBackToCheckIn();
      }
    }
  };

  const getStatusMessage = () => {
    if (!queueStatus) return 'Loading your queue status...';
    console.log("queueStatus in getStatusMessage:", queueStatus);

    switch (queueStatus.status) {
      case 'waiting':
        return `You are #${queueStatus.position} in line`;
      case 'called':
        return 'You have been called! Please proceed to the front desk.';
      case 'completed':
        return 'Your visit is complete. Thank you!';
      default:
        return 'Checking your status...';
    }
  };

  const getEstimatedWaitText = () => {
    if (!queueStatus || queueStatus.status !== 'waiting') return null;

    const minutes = queueStatus.estimatedWaitMinutes;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours > 0) {
      return `Estimated wait: ${hours}h ${remainingMinutes}m`;
    }
    return `Estimated wait: ${minutes} minutes`;
  };

  const getStatusColor = () => {
    if (!queueStatus) return '#6B7280';

    switch (queueStatus.status) {
      case 'waiting':
        return '#2563EB';
      case 'called':
        return '#059669';
      case 'completed':
        return '#6B7280';
      default:
        return '#6B7280';
    }
  };

  const getConnectionColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return '#10B981'; // Green
      case 'connecting':
        return '#F59E0B'; // Yellow
      case 'disconnected':
        return '#EF4444'; // Red
      default:
        return '#6B7280'; // Gray
    }
  };

  const getConnectionText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Real-time updates active';
      case 'connecting':
        return 'Connecting to real-time updates...';
      case 'disconnected':
        return `Using periodic updates (every ${configService.getFallbackPollingInterval() / 1000} seconds)`;
      default:
        return 'Checking connection...';
    }
  };

  if (loading && !queueStatus) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading your queue status...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.content}>
        <Text style={styles.title}>Queue Status</Text>

        {/* Main Status Card */}
        <View style={[styles.statusCard, { borderLeftColor: getStatusColor() }]}>
          <Text style={[styles.statusMessage, { color: getStatusColor() }]}>
            {getStatusMessage()}
          </Text>

          {queueStatus && queueStatus.status === 'waiting' && (
            <>
              <Text style={styles.estimatedWaitMinutes}>
                {getEstimatedWaitText()}
              </Text>
              <Text style={styles.helpText}>
                We'll notify you when it's almost your turn!
              </Text>
            </>
          )}

          {queueStatus && queueStatus.status === 'called' && (
            <Text style={styles.urgentText}>
              Please head to the facility now!
            </Text>
          )}
        </View>

        {/* Connection Status */}
        <View style={styles.connectionCard}>
          <View style={styles.connectionHeader}>
            <Text style={styles.connectionTitle}>Connection Status</Text>
            <View style={[
              styles.connectionIndicator,
              { backgroundColor: getConnectionColor() }
            ]} />
          </View>
          <Text style={styles.connectionText}>
            {getConnectionText()}
          </Text>
          <Text style={styles.lastUpdateText}>
            Last updated: {timeSinceLastUpdate}
          </Text>
        </View>

        {/* Patient Information */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Your Information</Text>
          {patientName && (
            <Text style={styles.infoText}>Name: {patientName}</Text>
          )}
          {patientPhone && (
            <Text style={styles.infoText}>Phone: {patientPhone}</Text>
          )}
          <Text style={styles.infoText}>Patient ID: {patientId}</Text>
          {queueStatus && (
            <>
              <Text style={styles.infoText}>Status: {queueStatus.status}</Text>
              {queueStatus.position && (
                <Text style={styles.infoText}>Position: #{queueStatus.position}</Text>
              )}
            </>
          )}
        </View>

        {/* Instructions */}
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>Instructions</Text>
          <Text style={styles.instructionsText}>
            • Pull down to refresh your queue status
          </Text>
          <Text style={styles.instructionsText}>
            • {connectionStatus === 'connected'
              ? 'Your position updates automatically in real-time'
              : `Your position updates automatically every ${configService.getFallbackPollingInterval() / 1000} seconds`}
          </Text>
          <Text style={styles.instructionsText}>
            • You can wait anywhere and return when it's your turn
          </Text>
          <Text style={styles.instructionsText}>
            • Keep your phone nearby for notifications
          </Text>
          {connectionStatus === 'connected' && (
            <Text style={styles.instructionsText}>
              • You'll receive instant alerts when called
            </Text>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleRefreshButtonClick}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#2563EB" size="small" />
            ) : (
              <Text style={styles.refreshButtonText}>Refresh Status</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.newCheckInButton}
            onPress={handleNewCheckIn}
          >
            <Text style={styles.newCheckInButtonText}>New Check-in</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  statusCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginVertical: 8,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusMessage: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  estimatedWaitMinutes: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  urgentText: {
    fontSize: 16,
    color: '#059669',
    textAlign: 'center',
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  instructionsCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: '#1E40AF',
    marginBottom: 4,
  },
  buttonContainer: {
    marginTop: 16,
    gap: 12,
  },
  refreshButton: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#2563EB',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  refreshButtonText: {
    color: '#2563EB',
    fontSize: 16,
    fontWeight: '600',
  },
  newCheckInButton: {
    backgroundColor: '#6B7280',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  newCheckInButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  connectionCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  connectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  connectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  connectionIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  connectionText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  lastUpdateText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
});

export default QueueStatusScreen;
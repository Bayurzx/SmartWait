import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { useQueueWebSocket } from '../hooks/useWebSocket';
import ConnectionStatus from './ConnectionStatus';

interface QueueStatusScreenProps {
  patientId: string;
  apiUrl: string;
}

export const QueueStatusScreen: React.FC<QueueStatusScreenProps> = ({
  patientId,
  apiUrl
}) => {
  const [refreshing, setRefreshing] = useState(false);
  
  const {
    connectionStatus,
    isConnected,
    queuePosition,
    estimatedWait,
    queueStatus,
    forceReconnect,
    on,
    off
  } = useQueueWebSocket(patientId, apiUrl);

  useEffect(() => {
    // Listen for connection events
    const handleConnectionError = (error: any) => {
      console.error('📱 Connection error:', error);
      Alert.alert(
        'Connection Error',
        'Unable to connect to the server. Your position will be updated when connection is restored.',
        [{ text: 'OK' }]
      );
    };

    const handleMaxReconnectAttempts = () => {
      Alert.alert(
        'Connection Failed',
        'Unable to reconnect to the server after multiple attempts. Please check your internet connection and try again.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: handleForceReconnect }
        ]
      );
    };

    const handleReconnect = () => {
      Alert.alert(
        'Reconnected',
        'Connection restored! Your queue position is now up to date.',
        [{ text: 'OK' }]
      );
    };

    // Set up event listeners
    on('connection_error', handleConnectionError);
    on('max_reconnect_attempts_exceeded', handleMaxReconnectAttempts);
    on('reconnect', handleReconnect);

    // Cleanup listeners
    return () => {
      off('connection_error', handleConnectionError);
      off('max_reconnect_attempts_exceeded', handleMaxReconnectAttempts);
      off('reconnect', handleReconnect);
    };
  }, [on, off]);

  const handleForceReconnect = async () => {
    try {
      setRefreshing(true);
      await forceReconnect();
    } catch (error) {
      console.error('📱 Force reconnect failed:', error);
      Alert.alert(
        'Reconnection Failed',
        'Unable to reconnect. Please check your internet connection.',
        [{ text: 'OK' }]
      );
    } finally {
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    if (!isConnected) {
      await handleForceReconnect();
    } else {
      setRefreshing(true);
      // Simulate refresh delay
      setTimeout(() => setRefreshing(false), 1000);
    }
  };

  const getStatusMessage = () => {
    if (!isConnected) {
      return 'Connecting to server...';
    }
    
    switch (queueStatus) {
      case 'waiting':
        return queuePosition ? `You are #${queuePosition} in line` : 'Checking your position...';
      case 'called':
        return 'You have been called! Please proceed to the front desk.';
      case 'completed':
        return 'Your visit is complete. Thank you!';
      default:
        return 'Checking your status...';
    }
  };

  const getEstimatedWaitText = () => {
    if (!estimatedWait || queueStatus !== 'waiting') return null;
    
    const hours = Math.floor(estimatedWait / 60);
    const minutes = estimatedWait % 60;
    
    if (hours > 0) {
      return `Estimated wait: ${hours}h ${minutes}m`;
    }
    return `Estimated wait: ${minutes} minutes`;
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.content}>
        <Text style={styles.title}>Queue Status</Text>
        
        {/* Connection Status */}
        <ConnectionStatus
          connectionStatus={connectionStatus}
          onReconnect={handleForceReconnect}
          showDetails={!isConnected}
        />

        {/* Queue Information */}
        <View style={styles.queueCard}>
          <Text style={styles.statusMessage}>
            {getStatusMessage()}
          </Text>
          
          {estimatedWait && queueStatus === 'waiting' && (
            <Text style={styles.estimatedWait}>
              {getEstimatedWaitText()}
            </Text>
          )}
          
          {queueStatus === 'waiting' && (
            <Text style={styles.helpText}>
              We'll notify you when it's almost your turn!
            </Text>
          )}
        </View>

        {/* Patient Information */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Your Information</Text>
          <Text style={styles.infoText}>Patient ID: {patientId}</Text>
          <Text style={styles.infoText}>Status: {queueStatus}</Text>
          {queuePosition && (
            <Text style={styles.infoText}>Position: #{queuePosition}</Text>
          )}
        </View>

        {/* Instructions */}
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>Instructions</Text>
          <Text style={styles.instructionsText}>
            • Keep this app open to receive real-time updates
          </Text>
          <Text style={styles.instructionsText}>
            • You'll receive notifications when it's almost your turn
          </Text>
          <Text style={styles.instructionsText}>
            • Pull down to refresh if connection is lost
          </Text>
          <Text style={styles.instructionsText}>
            • The app will automatically reconnect when possible
          </Text>
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
  queueCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusMessage: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  estimatedWait: {
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
});

export default QueueStatusScreen;
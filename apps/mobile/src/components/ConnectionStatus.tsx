import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ConnectionStatus as ConnectionStatusType } from '../services/websocket-service';

interface ConnectionStatusProps {
  connectionStatus: ConnectionStatusType;
  onReconnect?: () => void;
  showDetails?: boolean;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  connectionStatus,
  onReconnect,
  showDetails = false
}) => {
  const getStatusColor = () => {
    if (connectionStatus.connected) return '#10B981'; // green
    if (connectionStatus.connecting || connectionStatus.reconnecting) return '#F59E0B'; // yellow
    return '#EF4444'; // red
  };

  const getStatusText = () => {
    if (connectionStatus.connected) return 'Connected';
    if (connectionStatus.connecting) return 'Connecting...';
    if (connectionStatus.reconnecting) {
      return `Reconnecting... (${connectionStatus.reconnectAttempts})`;
    }
    return 'Disconnected';
  };

  const getStatusIcon = () => {
    if (connectionStatus.connected) return '🟢';
    if (connectionStatus.connecting || connectionStatus.reconnecting) return '🟡';
    return '🔴';
  };

  return (
    <View style={styles.container}>
      <View style={styles.statusRow}>
        <Text style={styles.statusIcon}>{getStatusIcon()}</Text>
        <Text style={[styles.statusText, { color: getStatusColor() }]}>
          {getStatusText()}
        </Text>
        
        {!connectionStatus.connected && !connectionStatus.connecting && !connectionStatus.reconnecting && onReconnect && (
          <TouchableOpacity style={styles.reconnectButton} onPress={onReconnect}>
            <Text style={styles.reconnectButtonText}>Reconnect</Text>
          </TouchableOpacity>
        )}
      </View>

      {showDetails && (
        <View style={styles.detailsContainer}>
          {connectionStatus.error && (
            <Text style={styles.errorText}>
              Error: {connectionStatus.error}
            </Text>
          )}
          
          {connectionStatus.lastConnected && (
            <Text style={styles.detailText}>
              Last connected: {connectionStatus.lastConnected.toLocaleTimeString()}
            </Text>
          )}
          
          {connectionStatus.reconnectAttempts > 0 && (
            <Text style={styles.detailText}>
              Reconnect attempts: {connectionStatus.reconnectAttempts}
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  statusText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  reconnectButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  reconnectButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  detailsContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginBottom: 4,
  },
  detailText: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
});

export default ConnectionStatus;
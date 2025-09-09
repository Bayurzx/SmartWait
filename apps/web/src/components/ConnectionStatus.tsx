'use client';

import React from 'react';
import { ConnectionStatus as ConnectionStatusType } from '../services/websocket-service';

interface ConnectionStatusProps {
  connectionStatus: ConnectionStatusType;
  onReconnect?: () => void;
  showDetails?: boolean;
  className?: string;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  connectionStatus,
  onReconnect,
  showDetails = false,
  className = ''
}) => {
  const getStatusColor = () => {
    if (connectionStatus.connected) return 'text-green-600';
    if (connectionStatus.connecting || connectionStatus.reconnecting) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusBgColor = () => {
    if (connectionStatus.connected) return 'bg-green-50 border-green-200';
    if (connectionStatus.connecting || connectionStatus.reconnecting) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
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
    <div className={`rounded-lg border p-3 ${getStatusBgColor()} ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-sm">{getStatusIcon()}</span>
          <span className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>
        
        {!connectionStatus.connected && 
         !connectionStatus.connecting && 
         !connectionStatus.reconnecting && 
         onReconnect && (
          <button
            onClick={onReconnect}
            className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          >
            Reconnect
          </button>
        )}
      </div>

      {showDetails && (
        <div className="mt-2 pt-2 border-t border-gray-200">
          {connectionStatus.error && (
            <p className="text-xs text-red-600 mb-1">
              Error: {connectionStatus.error}
            </p>
          )}
          
          {connectionStatus.lastConnected && (
            <p className="text-xs text-gray-500 mb-1">
              Last connected: {connectionStatus.lastConnected.toLocaleTimeString()}
            </p>
          )}
          
          {connectionStatus.reconnectAttempts > 0 && (
            <p className="text-xs text-gray-500">
              Reconnect attempts: {connectionStatus.reconnectAttempts}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ConnectionStatus;
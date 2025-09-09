'use client';

import React, { useEffect, useState } from 'react';
import { useQueueWebSocket } from '../hooks/useWebSocket';
import ConnectionStatus from './ConnectionStatus';

interface QueueStatusPageProps {
  patientId: string;
  apiUrl: string;
}

export const QueueStatusPage: React.FC<QueueStatusPageProps> = ({
  patientId,
  apiUrl
}) => {
  const [showNotificationPermission, setShowNotificationPermission] = useState(false);
  
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
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      setShowNotificationPermission(true);
    }
  }, []);

  useEffect(() => {
    // Listen for connection events
    const handleConnectionError = (error: any) => {
      console.error('🌐 Connection error:', error);
    };

    const handleMaxReconnectAttempts = () => {
      console.error('🌐 Max reconnection attempts exceeded');
    };

    const handleReconnect = () => {
      console.log('🌐 Reconnected successfully');
      // Show browser notification if permission granted
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('SmartWait - Reconnected', {
          body: 'Connection restored! Your queue position is now up to date.',
          icon: '/favicon.ico'
        });
      }
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
      await forceReconnect();
    } catch (error) {
      console.error('🌐 Force reconnect failed:', error);
    }
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setShowNotificationPermission(false);
        new Notification('SmartWait - Notifications Enabled', {
          body: 'You will now receive queue updates as browser notifications.',
          icon: '/favicon.ico'
        });
      }
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

  const getStatusColor = () => {
    switch (queueStatus) {
      case 'waiting':
        return 'text-blue-600';
      case 'called':
        return 'text-green-600';
      case 'completed':
        return 'text-gray-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 text-center mb-8">
          Queue Status
        </h1>
        
        {/* Notification Permission Banner */}
        {showNotificationPermission && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-blue-800">
                  Enable Notifications
                </h3>
                <p className="text-sm text-blue-600 mt-1">
                  Get notified when it's almost your turn, even when this tab isn't active.
                </p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowNotificationPermission(false)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Later
                </button>
                <button
                  onClick={requestNotificationPermission}
                  className="px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
                >
                  Enable
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Connection Status */}
        <ConnectionStatus
          connectionStatus={connectionStatus}
          onReconnect={handleForceReconnect}
          showDetails={!isConnected}
          className="mb-6"
        />

        {/* Queue Information */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="text-center">
            <h2 className={`text-2xl font-semibold mb-2 ${getStatusColor()}`}>
              {getStatusMessage()}
            </h2>
            
            {estimatedWait && queueStatus === 'waiting' && (
              <p className="text-lg text-gray-600 mb-2">
                {getEstimatedWaitText()}
              </p>
            )}
            
            {queueStatus === 'waiting' && (
              <p className="text-sm text-gray-500 italic">
                We'll notify you when it's almost your turn!
              </p>
            )}
          </div>
        </div>

        {/* Patient Information */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Your Information
          </h3>
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Patient ID:</span> {patientId}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-medium">Status:</span> {queueStatus}
            </p>
            {queuePosition && (
              <p className="text-sm text-gray-600">
                <span className="font-medium">Position:</span> #{queuePosition}
              </p>
            )}
            <p className="text-sm text-gray-600">
              <span className="font-medium">Connection:</span>{' '}
              <span className={isConnected ? 'text-green-600' : 'text-red-600'}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </p>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">
            Instructions
          </h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              Keep this page open to receive real-time updates
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              You'll receive notifications when it's almost your turn
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              The page will automatically reconnect if connection is lost
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              Refresh the page if you experience persistent connection issues
            </li>
          </ul>
        </div>

        {/* Debug Information (only show in development) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-6 bg-gray-100 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">
              Debug Information
            </h4>
            <pre className="text-xs text-gray-600 overflow-auto">
              {JSON.stringify(connectionStatus, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default QueueStatusPage;
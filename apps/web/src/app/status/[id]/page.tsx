'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { QueueStatus } from '../../../types';
import { apiService } from '../../../services/api';
import { useWebSocket } from '../../../hooks/useWebSocket';
import { QueueUpdate } from '../../../services/websocket';

export default function StatusPage() {
  const params = useParams();
  const router = useRouter();
  const patientId = params.id as string;

  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [updateAnimation, setUpdateAnimation] = useState(false);

  // Trigger update animation
  const triggerUpdateAnimation = useCallback(() => {
    setUpdateAnimation(true);
    setTimeout(() => setUpdateAnimation(false), 1000);
  }, []);

  // Handle WebSocket updates
  const handlePositionUpdate = useCallback((data: QueueUpdate) => {
    if (data.patientId === patientId) {
      setQueueStatus(prev => prev ? {
        ...prev,
        position: data.position || prev.position,
        estimatedWaitMinutes: data.estimatedWait || prev.estimatedWaitMinutes,
        status: (data.status as any) || prev.status,
      } : null);
      setLastUpdated(new Date());
      setError(null);
      triggerUpdateAnimation();
    }
  }, [patientId, triggerUpdateAnimation]);

  const handleStatusChange = useCallback((data: QueueUpdate) => {
    if (data.patientId === patientId) {
      setQueueStatus(prev => prev ? {
        ...prev,
        status: (data.status as any) || prev.status,
        position: data.position || prev.position,
        estimatedWaitMinutes: data.estimatedWait || prev.estimatedWaitMinutes,
      } : null);
      setLastUpdated(new Date());
      setError(null);
      triggerUpdateAnimation();
    }
  }, [patientId, triggerUpdateAnimation]);

  // Initialize WebSocket connection
  const webSocket = useWebSocket({
    patientId,
    onPositionUpdate: handlePositionUpdate,
    onStatusChange: handleStatusChange,
  });

  useEffect(() => {
    if (!patientId) {
      router.push('/checkin');
      return;
    }

    fetchQueueStatus();

    // Set up polling as fallback (less frequent when WebSocket is connected)
    const pollInterval = webSocket.connected ? 30000 : 10000; // 30s if WS connected, 10s if not
    const interval = setInterval(fetchQueueStatus, pollInterval);

    return () => clearInterval(interval);
  }, [patientId, router, webSocket.connected]);

  const fetchQueueStatus = async () => {
    try {
      console.log('Fetching queue status for patient:', patientId);
      const data = await apiService.getQueueStatus(patientId);
      console.log('Queue status received:', data);
      setQueueStatus(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error('Failed to fetch queue status:', err);
      setError('Unable to fetch queue status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchQueueStatus();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting':
        return 'text-blue-600';
      case 'called':
        return 'text-green-600';
      case 'completed':
        return 'text-gray-600';
      case 'no_show':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusMessage = (status: string) => {
    switch (status) {
      case 'waiting':
        return 'You are in the queue';
      case 'called':
        return 'Please come to the front desk now!';
      case 'completed':
        return 'Your visit is complete';
      case 'no_show':
        return 'Marked as no-show';
      default:
        console.log('Unknown status received:', status);
        return `Status: ${status}`;
    }
  };

  if (loading && !queueStatus) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your queue status...</p>
        </div>
      </div>
    );
  }

  if (error && !queueStatus) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="text-red-500 mb-4">
              <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Status</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <div className="space-y-2">
              <button
                onClick={handleRefresh}
                className="w-full btn btn-primary"
              >
                Try Again
              </button>
              <a
                href="/checkin"
                className="block w-full btn btn-secondary"
              >
                New Check-In
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">SmartWait</h1>
          <p className="mt-2 text-gray-600">Queue Status</p>
        </div>

        {/* Connection Status */}
        <div className="mb-4">
          <div className={`flex items-center justify-center space-x-2 text-sm ${webSocket.connected ? 'text-green-600' :
              webSocket.connecting ? 'text-yellow-600' : 'text-red-600'
            }`}>
            <div className={`w-2 h-2 rounded-full ${webSocket.connected ? 'bg-green-500' :
                webSocket.connecting ? 'bg-yellow-500' : 'bg-red-500'
              }`}></div>
            <span>
              {webSocket.connected ? 'Real-time Connected' :
                webSocket.connecting ? 'Connecting...' : 'Disconnected'}
            </span>
            {webSocket.reconnectAttempts > 0 && (
              <span className="text-xs text-gray-500">
                (Attempt {webSocket.reconnectAttempts})
              </span>
            )}
          </div>
          {lastUpdated && (
            <div className="text-center text-xs text-gray-500 mt-1">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </div>
          )}
        </div>

        {/* Queue Status Card */}
        {queueStatus && (
          <div className={`bg-white rounded-lg shadow-md p-6 mb-6 transition-all duration-500 ${updateAnimation ? 'ring-2 ring-blue-500 ring-opacity-50 scale-105' : ''
            }`}>
            <div className="text-center">
              <div className={`text-6xl font-bold mb-4 transition-all duration-300 ${getStatusColor(queueStatus.status)
                } ${updateAnimation ? 'scale-110' : ''}`}>
                {queueStatus.position}
              </div>

              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Your Position in Queue
              </h2>

              <p className={`text-lg mb-4 ${getStatusColor(queueStatus.status)}`}>
                {getStatusMessage(queueStatus.status)}
              </p>

              {queueStatus.status === 'waiting' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-blue-800 font-medium">
                    Estimated wait time: {queueStatus.estimatedWaitMinutes} minutes
                  </p>
                  <p className="text-blue-600 text-sm mt-1">
                    We'll notify you when it's almost your turn
                  </p>
                </div>
              )}

              {queueStatus.status === 'called' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <p className="text-green-800 font-medium">
                    It's your turn! Please come to the front desk now.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="w-full btn btn-primary"
          >
            {loading ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Refreshing...</span>
              </div>
            ) : (
              'Refresh Status'
            )}
          </button>

          {!webSocket.connected && (
            <button
              onClick={webSocket.reconnect}
              disabled={webSocket.connecting}
              className="w-full btn btn-secondary"
            >
              {webSocket.connecting ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                  <span>Reconnecting...</span>
                </div>
              ) : (
                'Reconnect Real-time'
              )}
            </button>
          )}

          <a
            href="/checkin"
            className="block w-full btn btn-secondary text-center"
          >
            New Check-In
          </a>

          <a
            href="/checkin/saved"
            className="block w-full text-center text-sm text-gray-500 hover:text-gray-700 py-2"
          >
            View Saved Check-ins
          </a>
        </div>

        {/* Help Information */}
        <div className="mt-8 bg-gray-100 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Need Help?</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Your position updates automatically</li>
            <li>• You can leave and return when it's your turn</li>
            <li>• Bookmark this page to check your status anytime</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useStaffAuth } from '../../../hooks/useStaffAuth';
import { useWebSocket } from '../../../hooks/useWebSocket';
import { QueueTable } from '../../../components/QueueTable';
import { staffApiService } from '../../../services/staff-api';
import { QueuePatient } from '../../../types/staff';
import { QueueUpdate } from '../../../services/websocket';

export default function StaffDashboardPage() {
  const router = useRouter();
  const { isAuthenticated, username, logout, loading: authLoading, requireAuth } = useStaffAuth();
  const [patients, setPatients] = useState<QueuePatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [callingPatient, setCallingPatient] = useState<string | null>(null);
  const [completingPatient, setCompletingPatient] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Handle WebSocket updates for staff
  const handleQueueUpdate = useCallback((data: QueueUpdate) => {
    // Refresh queue data when updates are received
    fetchQueue();
    setLastUpdated(new Date());
  }, []);

  // Initialize WebSocket connection for staff updates
  const webSocket = useWebSocket({
    onQueueUpdate: handleQueueUpdate,
  });

  // Require authentication
  useEffect(() => {
    requireAuth();
  }, [requireAuth]);

  // Fetch queue data
  const fetchQueue = async () => {
    try {
      const queueData = await staffApiService.getQueue();
      setPatients(queueData);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch queue:', err);
      setError('Failed to load queue data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Initial data load and periodic refresh
  useEffect(() => {
    if (isAuthenticated) {
      fetchQueue();
      
      // Set up polling as fallback (less frequent when WebSocket is connected)
      const pollInterval = webSocket.connected ? 30000 : 10000; // 30s if WS connected, 10s if not
      const interval = setInterval(fetchQueue, pollInterval);

      return () => clearInterval(interval);
    }
  }, [isAuthenticated, webSocket.connected]);

  const handleCallNext = async () => {
    const waitingPatients = patients.filter(p => p.status === 'waiting');
    if (waitingPatients.length === 0) return;

    const nextPatient = waitingPatients[0];
    setCallingPatient(nextPatient.patientId);

    try {
      const result = await staffApiService.callNextPatient();
      
      if (result.success) {
        // Refresh queue to get updated data
        await fetchQueue();
      } else {
        setError(result.error?.message || 'Failed to call next patient');
      }
    } catch (err) {
      console.error('Call next patient error:', err);
      setError('Failed to call next patient. Please try again.');
    } finally {
      setCallingPatient(null);
    }
  };

  const handleCompletePatient = async (patientId: string) => {
    setCompletingPatient(patientId);

    try {
      const result = await staffApiService.completePatient(patientId);
      
      if (result.success) {
        // Refresh queue to get updated data
        await fetchQueue();
      } else {
        setError(result.error?.message || 'Failed to complete patient');
      }
    } catch (err) {
      console.error('Complete patient error:', err);
      setError('Failed to complete patient. Please try again.');
    } finally {
      setCompletingPatient(null);
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchQueue();
  };

  // Show loading screen while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return null; // The requireAuth hook will handle the redirect
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">SmartWait Staff Dashboard</h1>
              <p className="text-sm text-gray-600">Welcome back, {username}</p>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Connection Status */}
              <div className={`flex items-center space-x-2 text-sm ${
                webSocket.connected ? 'text-green-600' : 
                webSocket.connecting ? 'text-yellow-600' : 'text-red-600'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  webSocket.connected ? 'bg-green-500' : 
                  webSocket.connecting ? 'bg-yellow-500' : 'bg-red-500'
                }`}></div>
                <span>
                  {webSocket.connected ? 'Real-time Connected' : 
                   webSocket.connecting ? 'Connecting...' : 'Disconnected'}
                </span>
              </div>

              {/* Refresh Button */}
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 focus:outline-none"
                title="Refresh Queue"
              >
                <svg className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>

              {/* Logout Button */}
              <button
                onClick={logout}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
              </div>
              <div className="ml-auto pl-3">
                <button
                  onClick={() => setError(null)}
                  className="text-red-400 hover:text-red-600"
                >
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Queue Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Waiting</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {patients.filter(p => p.status === 'waiting').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-md flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Called</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {patients.filter(p => p.status === 'called').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-gray-100 rounded-md flex items-center justify-center">
                  <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Completed Today</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {patients.filter(p => p.status === 'completed').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Queue Table */}
        <QueueTable
          patients={patients}
          onCallNext={handleCallNext}
          onCompletePatient={handleCompletePatient}
          loading={loading}
          callingPatient={callingPatient}
          completingPatient={completingPatient}
        />

        {/* Last Updated */}
        {lastUpdated && (
          <div className="mt-4 text-center text-sm text-gray-500">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </div>
        )}
      </main>
    </div>
  );
}
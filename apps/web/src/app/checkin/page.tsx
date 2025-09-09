'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckInForm } from '../../components/CheckInForm';
import { CheckInData } from '../../types';
import { apiService } from '../../services/api';

export default function CheckInPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckIn = async (data: CheckInData): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiService.checkIn(data);
      
      if (result.success) {
        // Store patient ID in localStorage for status checking
        localStorage.setItem('patientId', result.data.patientId);
        
        // Navigate to status page
        router.push(`/status/${result.data.patientId}`);
      } else {
        throw new Error('Check-in failed');
      }
    } catch (err) {
      console.error('Check-in error:', err);
      setError(err instanceof Error ? err.message : 'Check-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">SmartWait</h1>
          <p className="mt-2 text-gray-600">Virtual Queue Management</p>
        </div>

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
                <h3 className="text-sm font-medium text-red-800">Check-in Error</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Check-in Form */}
        <CheckInForm onSubmit={handleCheckIn} loading={loading} />

        {/* Navigation Links */}
        <div className="mt-8 text-center space-y-2">
          <div>
            <a 
              href="/" 
              className="text-sm text-primary-600 hover:text-primary-500"
            >
              ← Back to Home
            </a>
          </div>
          <div>
            <a 
              href="/staff" 
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Staff Dashboard
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
// apps\web\src\app\checkin\saved\page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { checkinHistoryService, SavedCheckin } from '../../../services/checkin-history';

export default function SavedCheckinsPage() {
  const router = useRouter();
  const [savedCheckins, setSavedCheckins] = useState<SavedCheckin[]>([]);
  const [loading, setLoading] = useState(true);
  const [validatingCheckins, setValidatingCheckins] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSavedCheckins();
  }, []);

  const loadSavedCheckins = async () => {
    try {
      setLoading(true);
      const checkins = await checkinHistoryService.getSavedCheckins();
      setSavedCheckins(checkins);
      setError(null);
    } catch (err) {
      console.error('Failed to load saved check-ins:', err);
      setError('Failed to load saved check-ins. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckinSelect = async (checkin: SavedCheckin) => {
    try {
      setValidatingCheckins(prev => new Set(prev).add(checkin.patientId));
      
      // Validate if the check-in is still active
      const validation = await checkinHistoryService.validateSavedCheckin(checkin.patientId);
      
      if (validation.isValid) {
        // Redirect to status page
        router.push(`/status/${checkin.patientId}`);
      } else {
        // Check-in is no longer valid, ask user if they want to remove it
        const shouldRemove = confirm(
          'This check-in is no longer active. Would you like to remove it from your saved check-ins?'
        );
        
        if (shouldRemove) {
          await handleRemoveCheckin(checkin.patientId);
        }
      }
    } catch (error) {
      console.error('Error validating check-in:', error);
      alert('Unable to validate check-in. Please try again.');
    } finally {
      setValidatingCheckins(prev => {
        const newSet = new Set(prev);
        newSet.delete(checkin.patientId);
        return newSet;
      });
    }
  };

  const handleRemoveCheckin = async (patientId: string) => {
    try {
      const success = await checkinHistoryService.removeSavedCheckin(patientId);
      
      if (success) {
        setSavedCheckins(prev => prev.filter(c => c.patientId !== patientId));
      } else {
        alert('Failed to remove check-in. Please try again.');
      }
    } catch (error) {
      console.error('Error removing check-in:', error);
      alert('Failed to remove check-in. Please try again.');
    }
  };

  const handleClearAll = async () => {
    const confirmed = confirm(
      'Are you sure you want to remove all saved check-ins? This action cannot be undone.'
    );
    
    if (!confirmed) return;

    try {
      setLoading(true);
      const success = await checkinHistoryService.clearAllSavedCheckins();
      
      if (success) {
        setSavedCheckins([]);
      } else {
        alert('Failed to clear all check-ins. Please try again.');
      }
    } catch (error) {
      console.error('Error clearing all check-ins:', error);
      alert('Failed to clear all check-ins. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your saved check-ins...</p>
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
          <p className="mt-2 text-gray-600">Your Saved Check-ins</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Saved Check-ins List */}
        {savedCheckins.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="text-gray-400 mb-4">
              <svg className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Saved Check-ins</h3>
            <p className="text-gray-600 mb-4">
              You haven't saved any check-ins yet. When you check in, you'll have the option to save it for easy access later.
            </p>
            <a
              href="/checkin"
              className="btn btn-primary"
            >
              Start New Check-in
            </a>
          </div>
        ) : (
          <>
            <div className="space-y-4 mb-6">
              {savedCheckins.map((checkin) => {
                const isValidating = validatingCheckins.has(checkin.patientId);
                
                return (
                  <div
                    key={checkin.id}
                    className="bg-white rounded-lg shadow-md p-4 border border-gray-200 hover:border-primary-300 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="font-medium text-gray-900">
                            {checkin.patientName || 'Anonymous Patient'}
                          </h3>
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-1">
                          {checkin.facilityName || 'SmartWait Clinic'}
                        </p>
                        
                        <p className="text-xs text-gray-500">
                          Checked in {checkinHistoryService.formatCheckinTime(checkin.checkinTime)}
                        </p>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleCheckinSelect(checkin)}
                          disabled={isValidating}
                          className="btn btn-primary btn-sm"
                        >
                          {isValidating ? (
                            <div className="flex items-center space-x-1">
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                              <span>Checking...</span>
                            </div>
                          ) : (
                            'View Status'
                          )}
                        </button>
                        
                        <button
                          onClick={() => handleRemoveCheckin(checkin.patientId)}
                          className="text-gray-400 hover:text-red-600 transition-colors"
                          title="Remove saved check-in"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Clear All Button */}
            {savedCheckins.length > 1 && (
              <div className="text-center mb-6">
                <button
                  onClick={handleClearAll}
                  className="text-sm text-red-600 hover:text-red-800 transition-colors"
                >
                  Clear All Saved Check-ins
                </button>
              </div>
            )}
          </>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <a
            href="/checkin"
            className="block w-full btn btn-primary text-center"
          >
            New Check-In
          </a>
          
          <button
            onClick={() => router.back()}
            className="w-full btn btn-secondary"
          >
            Back
          </button>
        </div>

        {/* Help Information */}
        <div className="mt-8 bg-gray-100 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-2">About Saved Check-ins</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Saved check-ins are stored locally on your device</li>
            <li>• Easily return to your queue status without remembering IDs</li>
            <li>• Old or completed check-ins are automatically cleaned up</li>
            <li>• Your privacy is protected - no personal data is stored on our servers</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
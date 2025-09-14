// apps\mobile\src\screens\CheckInScreen.tsx
import React, { useState } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CheckInForm from '../components/CheckInForm';
import MessageBanner from '../components/MessageBanner';
import { CheckInData, CheckInResponse } from '../types';
import { apiService } from '../services/api';
import { checkinHistoryService } from '../services/checkin-history';

interface CheckInScreenProps {
  onCheckInSuccess: (patientId: string) => void;
  onShowSavedCheckins?: () => void;
  apiUrl?: string;
}

export const CheckInScreen: React.FC<CheckInScreenProps> = ({
  onCheckInSuccess,
  onShowSavedCheckins,
  apiUrl = 'http://localhost:3001' // Default API URL
}) => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error' | 'info' | 'warning';
    text: string;
  } | null>(null);

  const handleCheckIn = async (formData: CheckInData): Promise<void> => {
    setLoading(true);

    try {
      // Configure API service with the provided URL
      if (apiUrl) {
        apiService['baseUrl'] = apiUrl;
      }

      // Make API call to check in using the service
      const checkInResponse = await apiService.checkIn(formData);

      if (checkInResponse.success) {
        // Store patient ID for future reference
        await AsyncStorage.setItem('patientId', checkInResponse.patientId);
        await AsyncStorage.setItem('patientName', formData.name);
        await AsyncStorage.setItem('patientPhone', formData.phone);

        // Store check-in in history service
        await checkinHistoryService.storeCheckinLocally({
          patientId: checkInResponse.patientId,
          patientName: formData.name,
          patientPhone: formData.phone,
          position: checkInResponse.position,
          estimatedWait: checkInResponse.estimatedWait,
        });

        // Save to server history if available
        try {
          await checkinHistoryService.saveCheckin({
            patientId: checkInResponse.patientId,
            deviceId: await checkinHistoryService.getDeviceId(),
            patientName: formData.name,
            facilityName: 'Healthcare Facility', // Could be dynamic
          });
        } catch (historyError) {
          console.warn('Failed to save to server history:', historyError);
          // Don't fail the check-in if history save fails
        }

        // Show success message
        setMessage({
          type: 'success',
          text: `Check-in successful! You are #${checkInResponse.position} in line. Estimated wait: ${checkInResponse.estimatedWait} minutes.`
        });

        // Auto-redirect after 3 seconds
        setTimeout(() => {
          onCheckInSuccess(checkInResponse.patientId);
        }, 3000);
      } else {
        throw new Error('Check-in failed');
      }
    } catch (error) {
      console.error('Check-in error:', error);

      let errorMessage = 'Unable to check in at this time. Please try again.';

      if (error instanceof Error) {
        if (error.message.includes('Unable to connect to the server')) {
          errorMessage = error.message;
        } else if (error.message.includes('already in the queue') || error.message.includes('duplicate')) {
          errorMessage = 'You have already checked in. Please wait for your turn or contact staff if you need assistance.';
        } else if (error.message.includes('Patient with this phone number is already in the queue')) {
          errorMessage = 'A patient with this phone number is already in the queue. Please check your queue status or contact staff for assistance.';
        } else if (error.message) {
          errorMessage = error.message;
        }
      }

      setMessage({
        type: 'error',
        text: errorMessage
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {message && (
        <View style={styles.messageContainer}>
          <MessageBanner
            type={message.type}
            message={message.text}
            onDismiss={() => setMessage(null)}
            visible={!!message}
          />
        </View>
      )}

      <View style={styles.content}>
        <CheckInForm onSubmit={handleCheckIn} loading={loading} />

        {onShowSavedCheckins && (
          <View style={styles.savedCheckinsSection}>
            <Text style={styles.sectionTitle}>Previous Check-ins</Text>
            <Text style={styles.sectionDescription}>
              Have you checked in before? Access your saved check-ins to quickly view their status.
            </Text>

            <TouchableOpacity
              style={styles.savedCheckinsButton}
              onPress={onShowSavedCheckins}
            >
              <Text style={styles.savedCheckinsButtonText}>
                View Saved Check-ins
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  messageContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    zIndex: 1000,
  },
  content: {
    flex: 1,
  },
  savedCheckinsSection: {
    margin: 20,
    marginTop: 40,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  savedCheckinsButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  savedCheckinsButtonText: {
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default CheckInScreen;
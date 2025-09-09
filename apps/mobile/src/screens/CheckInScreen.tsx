import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CheckInForm from '../components/CheckInForm';
import { CheckInData, CheckInResponse } from '../types';
import { apiService } from '../services/api';

interface CheckInScreenProps {
  onCheckInSuccess: (patientId: string) => void;
  apiUrl?: string;
}

export const CheckInScreen: React.FC<CheckInScreenProps> = ({ 
  onCheckInSuccess,
  apiUrl = 'http://localhost:3001' // Default API URL
}) => {
  const [loading, setLoading] = useState(false);

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
        await AsyncStorage.setItem('patientId', checkInResponse.data.patientId);
        await AsyncStorage.setItem('patientName', formData.name);
        await AsyncStorage.setItem('patientPhone', formData.phone);
        
        // Show success message
        Alert.alert(
          'Check-in Successful!',
          `You are #${checkInResponse.data.position} in line.\nEstimated wait: ${checkInResponse.data.estimatedWait} minutes.`,
          [
            {
              text: 'View Queue Status',
              onPress: () => onCheckInSuccess(checkInResponse.data.patientId),
            },
          ]
        );
      } else {
        throw new Error('Check-in failed');
      }
    } catch (error) {
      console.error('Check-in error:', error);
      
      let errorMessage = 'Unable to check in at this time. Please try again.';
      
      if (error instanceof Error) {
        if (error.message.includes('Unable to connect to the server')) {
          errorMessage = error.message;
        } else if (error.message.includes('duplicate')) {
          errorMessage = 'You have already checked in. Please wait for your turn or contact staff if you need assistance.';
        } else if (error.message) {
          errorMessage = error.message;
        }
      }
      
      Alert.alert(
        'Check-in Failed',
        errorMessage,
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <CheckInForm onSubmit={handleCheckIn} loading={loading} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
});

export default CheckInScreen;
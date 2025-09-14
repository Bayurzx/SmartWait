// apps\mobile\App.tsx
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import CheckInScreen from './src/screens/CheckInScreen';
import QueueStatusScreen from './src/screens/QueueStatusScreen';
import SavedCheckinsScreen from './src/screens/SavedCheckinsScreen';

type AppScreen = 'loading' | 'checkin' | 'queue' | 'saved-checkins';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('loading');
  const [patientId, setPatientId] = useState<string>('');

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Check if we have a stored patient ID
      const storedPatientId = await AsyncStorage.getItem('patientId');

      console.log('App initializing with stored patientId:', storedPatientId);

      if (storedPatientId && storedPatientId !== 'undefined' && storedPatientId.trim() !== '') {
        // We have a valid patient ID, go to queue screen
        setPatientId(storedPatientId);
        setCurrentScreen('queue');
      } else {
        // No patient ID, go to check-in screen
        setCurrentScreen('checkin');
      }
    } catch (error) {
      console.error('Error initializing app:', error);
      // Fallback to check-in screen
      setCurrentScreen('checkin');
    }
  };

  const handleCheckInSuccess = async (newPatientId: string) => {
    console.log('Check-in successful, patientId:', newPatientId);

    // Validate the patient ID before setting it
    if (!newPatientId || newPatientId === 'undefined' || newPatientId.trim() === '') {
      console.error('Invalid patient ID received from check-in:', newPatientId);
      return;
    }

    setPatientId(newPatientId);
    setCurrentScreen('queue');
  };

  const handleBackToCheckIn = async () => {
    try {
      // Clear stored patient data
      await AsyncStorage.multiRemove(['patientId', 'patientName', 'patientPhone']);
      console.log('Cleared patient data, navigating back to check-in');

      setPatientId('');
      setCurrentScreen('checkin');
    } catch (error) {
      console.error('Error clearing patient data:', error);
      // Still navigate back even if clear fails
      setPatientId('');
      setCurrentScreen('checkin');
    }
  };

  const handleShowSavedCheckins = () => {
    console.log('Navigating to saved check-ins');
    setCurrentScreen('saved-checkins');
  };

  const handleSelectSavedCheckin = async (savedPatientId: string) => {
    console.log('Selected saved check-in with patientId:', savedPatientId);

    // Validate the patient ID
    if (!savedPatientId || savedPatientId === 'undefined' || savedPatientId.trim() === '') {
      console.error('Invalid patient ID from saved check-in:', savedPatientId);
      return;
    }

    setPatientId(savedPatientId);
    setCurrentScreen('queue');
  };

  if (currentScreen === 'loading') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading SmartWait...</Text>
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />

      {currentScreen === 'checkin' && (
        <CheckInScreen
          onCheckInSuccess={handleCheckInSuccess}
          onShowSavedCheckins={handleShowSavedCheckins}
        />
      )}

      {currentScreen === 'queue' && patientId && (
        <QueueStatusScreen
          patientId={patientId}
          onBackToCheckIn={handleBackToCheckIn}
        />
      )}

      {currentScreen === 'saved-checkins' && (
        <SavedCheckinsScreen
          onSelectCheckin={handleSelectSavedCheckin}
          onBackToCheckIn={handleBackToCheckIn}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
});
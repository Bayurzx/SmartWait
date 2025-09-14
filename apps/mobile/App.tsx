// apps\mobile\App.tsx
import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import CheckInScreen from './src/screens/CheckInScreen';
import QueueStatusScreen from './src/screens/QueueStatusScreen';
import { SavedCheckinsScreen } from './src/screens/SavedCheckinsScreen';
import { navigationService, AppScreen } from './src/services/navigation';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('loading');
  const [patientId, setPatientId] = useState<string | undefined>();

  useEffect(() => {
    // Initialize navigation and listen for changes
    const unsubscribe = navigationService.subscribe((state) => {
      setCurrentScreen(state.currentScreen);
      setPatientId(state.patientId);
    });

    // Initialize the app
    navigationService.initializeNavigation();

    return unsubscribe;
  }, []);

  const handleCheckInSuccess = (newPatientId: string) => {
    navigationService.navigateToQueue(newPatientId);
  };

  const handleBackToCheckIn = () => {
    navigationService.navigateToCheckIn();
  };

  const handleShowSavedCheckins = () => {
    navigationService.navigateToSavedCheckins();
  };

  const handleSelectSavedCheckin = (savedPatientId: string) => {
    navigationService.navigateToQueue(savedPatientId);
  };

  const renderCurrentScreen = () => {
    switch (currentScreen) {
      case 'checkin':
        return (
          <CheckInScreen
            onCheckInSuccess={handleCheckInSuccess}
            onShowSavedCheckins={handleShowSavedCheckins}
          />
        );

      case 'queue':
        return patientId ? (
          <QueueStatusScreen
            patientId={patientId}
            onBackToCheckIn={handleBackToCheckIn}
          />
        ) : null;

      case 'saved-checkins':
        return (
          <SavedCheckinsScreen
            onSelectCheckin={handleSelectSavedCheckin}
            onBackToCheckIn={handleBackToCheckIn}
          />
        );

      case 'loading':
      default:
        return (
          <View style={styles.loadingContainer}>
            {/* Loading indicator would go here */}
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      {renderCurrentScreen()}
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
  },
});
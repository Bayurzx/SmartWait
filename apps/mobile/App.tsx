// apps\mobile\App.tsx
import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';

import { CheckInScreen } from './src/screens/CheckInScreen';
import { QueueStatusScreen } from './src/screens/QueueStatusScreen';
import { navigationService, NavigationState } from './src/services/navigation';
import { configService } from './src/services/config';

export default function App() {
  const [navigationState, setNavigationState] = useState<NavigationState>({ currentScreen: 'loading' });

  useEffect(() => {
    // Subscribe to navigation changes
    const unsubscribe = navigationService.subscribe(setNavigationState);
    
    // Initialize navigation
    navigationService.initializeNavigation();
    
    return unsubscribe;
  }, []);

  const handleCheckInSuccess = (newPatientId: string) => {
    navigationService.navigateToQueue(newPatientId);
  };

  const handleBackToCheckIn = () => {
    navigationService.navigateToCheckIn();
  };

  const renderCurrentScreen = () => {
    switch (navigationState.currentScreen) {
      case 'checkin':
        return (
          <CheckInScreen 
            onCheckInSuccess={handleCheckInSuccess}
            apiUrl={configService.getApiUrl()}
          />
        );
      
      case 'queue':
        return (
          <QueueStatusScreen
            patientId={navigationState.patientId || ''}
            onBackToCheckIn={handleBackToCheckIn}
            apiUrl={configService.getApiUrl()}
          />
        );
      
      case 'loading':
      default:
        return (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>Loading SmartWait...</Text>
          </View>
        );
    }
  };

  return (
    <SafeAreaProvider>
      <PaperProvider>
        <SafeAreaView style={styles.container}>
          {renderCurrentScreen()}
          <StatusBar style="auto" />
        </SafeAreaView>
      </PaperProvider>
    </SafeAreaProvider>
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
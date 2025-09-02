---
inclusion: fileMatch
fileMatchPattern: "apps/mobile/**/*"
---

# Mobile App Standards

## React Native Development Standards

### Project Structure
```
apps/mobile/
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── forms/       # Form-specific components
│   │   ├── navigation/  # Navigation components
│   │   └── ui/          # Base UI components
│   ├── screens/         # Screen components
│   ├── navigation/      # Navigation configuration
│   ├── services/        # API services and business logic
│   ├── hooks/           # Custom React hooks
│   ├── utils/           # Utility functions
│   ├── constants/       # App constants
│   ├── types/           # TypeScript type definitions
│   └── assets/          # Images, fonts, etc.
├── __tests__/           # Test files
├── android/             # Android-specific code
├── ios/                 # iOS-specific code
└── index.js            # App entry point
```

### Component Architecture
```typescript
// Component structure pattern
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface QueueStatusProps {
  position: number;
  estimatedWait: number;
  onRefresh?: () => void;
}

export const QueueStatus: React.FC<QueueStatusProps> = ({
  position,
  estimatedWait,
  onRefresh
}) => {
  const { colors, spacing } = useTheme();
  
  const styles = createStyles(colors, spacing);
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Position</Text>
      <Text style={styles.position}>{position}</Text>
      <Text style={styles.subtitle}>
        Estimated wait: {estimatedWait} minutes
      </Text>
    </View>
  );
};

const createStyles = (colors: any, spacing: any) => StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    padding: spacing.large,
    borderRadius: 8,
    margin: spacing.medium
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onSurface,
    textAlign: 'center'
  },
  position: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.primary,
    textAlign: 'center',
    marginVertical: spacing.medium
  },
  subtitle: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    textAlign: 'center'
  }
});
```

## Platform-Specific Guidelines

### iOS Guidelines
- Follow iOS Human Interface Guidelines
- Use native iOS navigation patterns
- Implement iOS-specific features (FaceID, TouchID, Shortcuts)
- Support iOS accessibility features (VoiceOver, Dynamic Type)
- Handle iOS app lifecycle properly

### iOS Implementation Patterns
```typescript
// iOS-specific implementations
import { Platform } from 'react-native';
import TouchID from 'react-native-touch-id';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';

class IOSFeatures {
  // Biometric authentication
  static async authenticateWithBiometrics(): Promise<boolean> {
    if (Platform.OS !== 'ios') return false;
    
    try {
      const biometryType = await TouchID.isSupported();
      if (biometryType) {
        await TouchID.authenticate('Authenticate to access your queue', {
          fallbackLabel: 'Use Passcode',
          unifiedErrors: false,
          passcodeFallback: true
        });
        return true;
      }
    } catch (error) {
      console.error('Biometric authentication failed:', error);
    }
    
    return false;
  }
  
  // Location permissions for iOS
  static async requestLocationPermission(): Promise<boolean> {
    const permission = PERMISSIONS.IOS.LOCATION_WHEN_IN_USE;
    const result = await check(permission);
    
    if (result === RESULTS.GRANTED) {
      return true;
    }
    
    if (result === RESULTS.DENIED) {
      const requestResult = await request(permission);
      return requestResult === RESULTS.GRANTED;
    }
    
    return false;
  }
}
```

### Android Guidelines
- Follow Material Design principles
- Implement Android-specific features (Adaptive Icons, Shortcuts)
- Handle Android permissions properly
- Support Android accessibility (TalkBack)
- Optimize for different screen sizes and densities

### Android Implementation Patterns
```typescript
// Android-specific implementations
import { Platform, PermissionsAndroid } from 'react-native';
import ReactNativeBiometrics from 'react-native-biometrics';

class AndroidFeatures {
  // Biometric authentication for Android
  static async authenticateWithBiometrics(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    
    try {
      const rnBiometrics = new ReactNativeBiometrics();
      const { available } = await rnBiometrics.isSensorAvailable();
      
      if (available) {
        const { success } = await rnBiometrics.simplePrompt({
          promptMessage: 'Authenticate to access your queue',
          cancelButtonText: 'Cancel'
        });
        return success;
      }
    } catch (error) {
      console.error('Biometric authentication failed:', error);
    }
    
    return false;
  }
  
  // Location permissions for Android
  static async requestLocationPermission(): Promise<boolean> {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'This app needs location access to provide accurate wait times.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK'
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (error) {
      console.error('Location permission request failed:', error);
      return false;
    }
  }
}
```

## State Management

### React Query for Server State
```typescript
// API query hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QueueService } from '../services/queue-service';

export const useQueuePosition = (patientId: string) => {
  return useQuery({
    queryKey: ['queue', 'position', patientId],
    queryFn: () => QueueService.getPosition(patientId),
    refetchInterval: 5000, // Poll every 5 seconds
    enabled: !!patientId,
    staleTime: 0 // Always refetch
  });
};

export const useJoinQueue = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: QueueService.joinQueue,
    onSuccess: (data) => {
      // Invalidate and refetch queue data
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      
      // Optimistically update queue position
      queryClient.setQueryData(
        ['queue', 'position', data.patientId],
        data.position
      );
    },
    onError: (error) => {
      console.error('Failed to join queue:', error);
    }
  });
};
```

### Context for Global State
```typescript
// App context for global state
import React, { createContext, useContext, useReducer } from 'react';

interface AppState {
  user: User | null;
  theme: 'light' | 'dark' | 'system';
  notifications: NotificationSettings;
  currentQueue?: QueuePosition;
}

type AppAction =
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_THEME'; payload: 'light' | 'dark' | 'system' }
  | { type: 'UPDATE_QUEUE_POSITION'; payload: QueuePosition }
  | { type: 'CLEAR_QUEUE' };

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | null>(null);

const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_THEME':
      return { ...state, theme: action.payload };
    case 'UPDATE_QUEUE_POSITION':
      return { ...state, currentQueue: action.payload };
    case 'CLEAR_QUEUE':
      return { ...state, currentQueue: undefined };
    default:
      return state;
  }
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, {
    user: null,
    theme: 'system',
    notifications: {
      push: true,
      sms: false,
      email: true
    }
  });

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
};
```

## Navigation Patterns

### React Navigation Setup
```typescript
// Navigation configuration
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { HomeScreen } from '../screens/HomeScreen';
import { QueueScreen } from '../screens/QueueScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { CheckInScreen } from '../screens/CheckInScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const TabNavigator = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      tabBarIcon: ({ focused, color, size }) => {
        let iconName: string;
        
        switch (route.name) {
          case 'Home':
            iconName = 'home';
            break;
          case 'Queue':
            iconName = 'queue';
            break;
          case 'Profile':
            iconName = 'person';
            break;
          default:
            iconName = 'help';
        }
        
        return <Icon name={iconName} size={size} color={color} />;
      },
      tabBarActiveTintColor: '#007AFF',
      tabBarInactiveTintColor: 'gray',
    })}
  >
    <Tab.Screen name="Home" component={HomeScreen} />
    <Tab.Screen name="Queue" component={QueueScreen} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);

export const AppNavigator = () => (
  <NavigationContainer>
    <Stack.Navigator initialRouteName="Tabs">
      <Stack.Screen 
        name="Tabs" 
        component={TabNavigator} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="CheckIn" 
        component={CheckInScreen}
        options={{ 
          title: 'Check In',
          presentation: 'modal' 
        }}
      />
    </Stack.Navigator>
  </NavigationContainer>
);
```

## Offline Support

### Offline Data Management
```typescript
// Offline storage and sync
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

class OfflineManager {
  private static instance: OfflineManager;
  private isOnline = true;
  private pendingActions: QueuedAction[] = [];
  
  static getInstance(): OfflineManager {
    if (!OfflineManager.instance) {
      OfflineManager.instance = new OfflineManager();
    }
    return OfflineManager.instance;
  }
  
  async initialize(): Promise<void> {
    // Monitor network connectivity
    NetInfo.addEventListener(state => {
      this.isOnline = state.isConnected ?? false;
      
      if (this.isOnline) {
        this.processPendingActions();
      }
    });
    
    // Load pending actions from storage
    await this.loadPendingActions();
  }
  
  async cacheData(key: string, data: any): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Failed to cache data:', error);
    }
  }
  
  async getCachedData(key: string, maxAge: number = 300000): Promise<any | null> {
    try {
      const cached = await AsyncStorage.getItem(key);
      if (!cached) return null;
      
      const { data, timestamp } = JSON.parse(cached);
      
      if (Date.now() - timestamp > maxAge) {
        return null; // Data too old
      }
      
      return data;
    } catch (error) {
      console.error('Failed to get cached data:', error);
      return null;
    }
  }
  
  async queueAction(action: QueuedAction): Promise<void> {
    this.pendingActions.push(action);
    await this.savePendingActions();
    
    if (this.isOnline) {
      await this.processPendingActions();
    }
  }
  
  private async processPendingActions(): Promise<void> {
    while (this.pendingActions.length > 0 && this.isOnline) {
      const action = this.pendingActions.shift()!;
      
      try {
        await this.executeAction(action);
      } catch (error) {
        console.error('Failed to execute queued action:', error);
        // Re-queue the action for later
        this.pendingActions.unshift(action);
        break;
      }
    }
    
    await this.savePendingActions();
  }
}
```

## Push Notifications

### Push Notification Setup
```typescript
// Push notification service
import PushNotification from 'react-native-push-notification';
import { Platform } from 'react-native';

class PushNotificationService {
  constructor() {
    this.configure();
  }
  
  configure(): void {
    PushNotification.configure({
      onRegister: (token) => {
        console.log('FCM Token:', token);
        this.sendTokenToServer(token.token);
      },
      
      onNotification: (notification) => {
        console.log('Notification received:', notification);
        
        if (notification.userInteraction) {
          // User tapped on notification
          this.handleNotificationTap(notification);
        } else {
          // Notification received while app is foreground
          this.showForegroundNotification(notification);
        }
      },
      
      onAction: (notification) => {
        console.log('Notification action:', notification);
      },
      
      onRegistrationError: (err) => {
        console.error('Push notification registration error:', err);
      },
      
      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },
      
      popInitialNotification: true,
      requestPermissions: Platform.OS === 'ios',
    });
  }
  
  async sendTokenToServer(token: string): Promise<void> {
    try {
      await fetch('/api/v1/push-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        },
        body: JSON.stringify({
          token,
          platform: Platform.OS
        })
      });
    } catch (error) {
      console.error('Failed to send token to server:', error);
    }
  }
  
  showForegroundNotification(notification: any): void {
    PushNotification.localNotification({
      title: notification.title,
      message: notification.message || notification.body,
      playSound: true,
      soundName: 'default',
      actions: ['View'],
      category: 'queue-update'
    });
  }
  
  handleNotificationTap(notification: any): void {
    const { data } = notification;
    
    switch (data?.type) {
      case 'queue_position_update':
        // Navigate to queue screen
        this.navigateToQueue(data.queueId);
        break;
      case 'appointment_reminder':
        // Navigate to appointment details
        this.navigateToAppointment(data.appointmentId);
        break;
    }
  }
}
```

## Performance Optimization

### Memory Management
```typescript
// Memory optimization patterns
import { useCallback, useMemo, useRef, useEffect } from 'react';

const OptimizedQueueList: React.FC<{ queueData: QueueItem[] }> = ({ queueData }) => {
  // Memoize expensive calculations
  const sortedQueue = useMemo(() => {
    return queueData.sort((a, b) => a.position - b.position);
  }, [queueData]);
  
  // Memoize callbacks to prevent unnecessary re-renders
  const handleItemPress = useCallback((item: QueueItem) => {
    console.log('Queue item pressed:', item.id);
  }, []);
  
  // Use refs for values that don't trigger re-renders
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Cleanup subscriptions and timers
  useEffect(() => {
    const interval = setInterval(() => {
      // Periodic update logic
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <FlatList
      ref={scrollViewRef}
      data={sortedQueue}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <QueueListItem 
          item={item} 
          onPress={handleItemPress}
        />
      )}
      removeClippedSubviews={true} // Memory optimization
      maxToRenderPerBatch={10}    // Render optimization
      windowSize={10}             // Memory window
      initialNumToRender={5}      // Initial render count
    />
  );
};
```

### Image Optimization
```typescript
// Image loading and caching
import FastImage from 'react-native-fast-image';

const OptimizedImage: React.FC<{
  source: { uri: string };
  style?: any;
  placeholder?: string;
}> = ({ source, style, placeholder }) => {
  return (
    <FastImage
      style={style}
      source={{
        uri: source.uri,
        priority: FastImage.priority.normal,
        cache: FastImage.cacheControl.immutable
      }}
      resizeMode={FastImage.resizeMode.cover}
      fallback={!!placeholder}
    />
  );
};
```

## Testing Standards

### Component Testing
```typescript
// Component testing with React Native Testing Library
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueueStatus } from '../QueueStatus';

const mockProps = {
  position: 5,
  estimatedWait: 15,
  onRefresh: jest.fn()
};

describe('QueueStatus Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('displays queue information correctly', () => {
    const { getByText } = render(<QueueStatus {...mockProps} />);
    
    expect(getByText('5')).toBeTruthy();
    expect(getByText('Estimated wait: 15 minutes')).toBeTruthy();
  });
  
  it('calls onRefresh when refresh button is pressed', async () => {
    const { getByTestId } = render(<QueueStatus {...mockProps} />);
    
    const refreshButton = getByTestId('refresh-button');
    fireEvent.press(refreshButton);
    
    await waitFor(() => {
      expect(mockProps.onRefresh).toHaveBeenCalledTimes(1);
    });
  });
});
```

### E2E Testing with Detox
```typescript
// Detox E2E testing configuration
const config = {
  testRunner: 'jest',
  runnerConfig: 'e2e/config.json',
  configurations: {
    'ios.sim.debug': {
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/HealthcareQueue.app',
      type: 'ios.simulator',
      device: {
        type: 'iPhone 12'
      }
    },
    'android.emu.debug': {
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      type: 'android.emulator',
      device: {
        avdName: 'Pixel_3_API_29'
      }
    }
  }
};
```

## Accessibility Standards

### Accessibility Implementation
```typescript
// Accessibility-compliant component
const AccessibleQueueStatus: React.FC<QueueStatusProps> = ({ position, estimatedWait }) => {
  return (
    <View 
      accessible={true}
      accessibilityRole="summary"
      accessibilityLabel={`You are number ${position} in queue. Estimated wait time is ${estimatedWait} minutes.`}
    >
      <Text 
        style={styles.position}
        accessible={true}
        accessibilityLabel={`Position ${position}`}
        accessibilityRole="text"
      >
        {position}
      </Text>
      <Text 
        style={styles.waitTime}
        accessible={true}
        accessibilityLabel={`Estimated wait ${estimatedWait} minutes`}
        accessibilityRole="text"
      >
        Estimated wait: {estimatedWait} minutes
      </Text>
      <TouchableOpacity
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="Refresh queue position"
        accessibilityHint="Double tap to update your position in queue"
        onPress={onRefresh}
      >
        <Text>Refresh</Text>
      </TouchableOpacity>
    </View>
  );
};
```
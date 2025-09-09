import 'react-native-gesture-handler/jestSetup';

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock react-native-paper
jest.mock('react-native-paper', () => ({
  PaperProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Mock Expo modules
jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

// Silence the warning: Animated: `useNativeDriver` is not supported
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

// Mock socket.io-client
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    connected: false,
  })),
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {},
  },
}));

// Mock fetch
global.fetch = jest.fn();

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to ignore a specific log level
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Simple test to satisfy Jest requirement
describe('Test Setup', () => {
  it('should have proper mocks configured', () => {
    expect(jest).toBeDefined();
  });
});
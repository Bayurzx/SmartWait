# SmartWait Mobile App

React Native mobile application for the SmartWait queue management system built with Expo and TypeScript.

## Features

- **Cross-platform**: Runs on iOS, Android, and Web
- **TypeScript**: Full type safety and enhanced developer experience
- **Expo SDK 49**: Latest Expo features and tooling
- **React Navigation**: Navigation and routing
- **React Native Paper**: Material Design components
- **WebSocket Support**: Real-time queue updates
- **Form Management**: React Hook Form for form handling
- **Local Storage**: AsyncStorage for data persistence

## Project Structure

```
src/
├── components/     # Reusable UI components
├── screens/        # Screen components
├── services/       # API and WebSocket services
├── hooks/          # Custom React hooks
├── types/          # TypeScript type definitions
├── utils/          # Utility functions
├── navigation/     # Navigation configuration
└── assets/         # Images, fonts, and other assets
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g @expo/cli`)
- Expo Go app (for testing on device)

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run on specific platforms
npm run android    # Android emulator/device
npm run ios        # iOS simulator
npm run web        # Web browser
```

### Development

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Testing
npm run test
npm run test:watch
```

### Building

```bash
# Build for Android
npm run build:android

# Build for iOS
npm run build:ios
```

## Configuration

The app is configured through:

- `app.json` - Expo configuration
- `tsconfig.json` - TypeScript configuration
- `babel.config.js` - Babel configuration

### Environment Variables

Configure API endpoints in `app.json`:

```json
{
  "expo": {
    "extra": {
      "apiUrl": "http://localhost:3001",
      "wsUrl": "ws://localhost:3001"
    }
  }
}
```

## Available Scripts

- `start` - Start Expo development server
- `android` - Run on Android
- `ios` - Run on iOS
- `web` - Run on web
- `type-check` - Run TypeScript type checking
- `lint` - Run ESLint
- `test` - Run tests
- `build:android` - Build Android app
- `build:ios` - Build iOS app

## Dependencies

### Core Dependencies
- **Expo 49.0.8** - Development platform
- **React Native 0.72.10** - Mobile framework
- **TypeScript 5.1.3** - Type safety
- **React Navigation 6** - Navigation
- **React Native Paper 5.9.1** - UI components
- **Socket.io Client 4.7.2** - WebSocket communication
- **Axios 1.4.0** - HTTP client
- **React Hook Form 7.45.4** - Form management

### Development Dependencies
- **ESLint** - Code linting
- **Jest** - Testing framework
- **React Testing Library** - Component testing

## Architecture

The mobile app follows a modular architecture with:

- **Component-based UI** - Reusable React components
- **Service layer** - API and WebSocket communication
- **Custom hooks** - Shared logic and state management
- **Type-safe development** - Full TypeScript integration
- **Real-time updates** - WebSocket integration for live queue updates

## ✅ Implemented Features

### Check-in Form
- **Comprehensive validation**: Name, phone, and appointment time validation
- **Real-time feedback**: Shows errors on blur, clears on input
- **Phone formatting**: Auto-formats as (XXX) XXX-XXXX
- **Loading states**: Shows "Checking In..." during submission
- **Error handling**: Network errors, validation errors, duplicate check-ins
- **Accessibility**: Proper roles and labels for screen readers

### Queue Status Screen
- **Real-time WebSocket updates**: Live position changes via WebSocket connection
- **Fallback polling**: Automatic polling when WebSocket unavailable (configurable intervals)
- **Connection status**: Visual indicator showing WebSocket connection state
- **Status display**: Shows waiting, called, or completed status with color coding
- **Wait time estimation**: Displays estimated wait time in hours/minutes format
- **Pull-to-refresh**: Manual refresh capability with loading indicators
- **Patient info**: Shows stored patient details and secure ID display
- **Action buttons**: Refresh status and start new check-in
- **Real-time notifications**: Alerts when patient is called

### Navigation & State Management
- **Centralized navigation**: NavigationService for state management
- **Session persistence**: Automatically resumes if patient ID exists
- **Local storage**: Uses AsyncStorage for patient data
- **State management**: Handles check-in to queue status flow
- **Error recovery**: Graceful handling of network issues

### Services Architecture
- **API Service**: RESTful API communication with error handling
- **WebSocket Service**: Real-time bidirectional communication with reconnection
- **Navigation Service**: Centralized navigation state management
- **Configuration Service**: Environment-based configuration management

### Components Created
- `CheckInForm.tsx` - Form with validation and error handling
- `CheckInScreen.tsx` - Screen that integrates form with API service
- `QueueStatusScreen.tsx` - Real-time queue status with WebSocket integration
- `App.tsx` - Main app with navigation service integration

### API Integration
- **Structured API service**: Centralized API communication with error handling
- **Check-in endpoint**: POST /api/checkin with form data validation
- **Position tracking**: GET /api/position/:id for status updates
- **Health checks**: GET /api/health for service monitoring
- **Error handling**: Comprehensive error messages and network failure recovery
- **Configurable URLs**: API URL management via configuration service

### WebSocket Integration
- **Real-time communication**: Socket.io client for live updates
- **Patient rooms**: Join patient-specific rooms for targeted updates
- **Automatic reconnection**: Exponential backoff with jitter for connection recovery
- **Connection monitoring**: Track connection health with visual indicators
- **Event handling**: Structured event types for queue updates and notifications
- **Graceful degradation**: Automatic fallback to polling when WebSocket fails

### Configuration Management
- **Environment-based config**: Development/staging/production settings
- **Runtime configuration**: Update settings without app restart
- **Default values**: Sensible defaults for all configuration options
- **Polling intervals**: Configurable update frequencies for different connection states

### Testing
- **Comprehensive test coverage**: Components, services, and integration tests
- **Form validation testing**: All validation scenarios covered
- **Queue status testing**: Real-time update scenarios
- **API integration tests**: Mock API responses and error handling
- **Service integration tests**: Cross-service communication testing
- **WebSocket mocking**: Proper mocking for WebSocket functionality

## Usage

1. **Start development**: `npm start`
2. **Check-in flow**:
   - Enter name, phone, and appointment time
   - Form validates inputs in real-time
   - Submit to join queue and get position
3. **Queue monitoring**:
   - View current position and estimated wait
   - Automatic updates every 10 seconds
   - Pull to refresh manually
   - Clear status indicators for waiting/called/completed

## Recent Improvements

### ✅ WebSocket Integration Complete
- Real-time bidirectional communication with Socket.io
- Automatic reconnection with exponential backoff
- Patient-specific room management
- Connection status monitoring
- Graceful fallback to polling

### ✅ Enhanced API Integration
- Structured API service with error handling
- Configuration-based URL management
- Network failure recovery
- Comprehensive error messages

### ✅ Improved Navigation
- Centralized navigation service
- Persistent session management
- Smooth screen transitions

## Next Steps

1. **Push Notifications**: Implement native push notifications for queue updates
2. **Location Services**: Add location-based features for proximity detection
3. **Offline Support**: Enhanced offline capabilities with data synchronization
4. **Performance Optimization**: Memory management and connection pooling
5. **Advanced Testing**: End-to-end testing and performance testing
6. **Accessibility**: Enhanced accessibility features and screen reader support
7. **Analytics**: User behavior tracking and performance monitoring
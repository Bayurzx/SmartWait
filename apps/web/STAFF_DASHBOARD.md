# SmartWait Staff Dashboard

## Overview

The SmartWait Staff Dashboard is a comprehensive web-based interface for healthcare staff to manage patient queues efficiently. Built with Next.js 13+ and TypeScript, it provides real-time queue management capabilities with a professional healthcare interface.

## Features

### 🔐 **Authentication System**
- Secure username/password login
- Session management with automatic expiration
- Token-based authentication with localStorage
- Automatic logout after 8 hours of inactivity

### 📊 **Queue Management Dashboard**
- Real-time patient queue display
- Queue statistics (waiting, called, completed patients)
- Patient information table with sortable columns
- One-click patient operations

### 🔄 **Real-Time Updates**
- WebSocket integration for live queue updates
- Automatic refresh when patients check in or are processed
- Connection status indicator
- Fallback polling when WebSocket is disconnected

### 👥 **Patient Operations**
- **Call Next Patient**: Automatically calls the next waiting patient and sends SMS notification
- **Mark Complete**: One-click patient completion with queue advancement
- **Patient Details**: View name, phone, check-in time, and wait duration

### 🎨 **Professional Interface**
- Healthcare-focused design with clean, intuitive layout
- Responsive design that works on desktop and tablet
- Loading states and error handling
- Professional color scheme and typography

## Pages and Components

### 1. Staff Login (`/staff/login`)
- **Purpose**: Secure authentication for staff members
- **Features**:
  - Username/password form with validation
  - Error handling for failed login attempts
  - Demo credentials display for testing
  - Automatic redirect if already authenticated

### 2. Staff Dashboard (`/staff/dashboard`)
- **Purpose**: Main queue management interface
- **Features**:
  - Queue statistics cards (waiting, called, completed)
  - Real-time patient table
  - Call next patient functionality
  - Patient completion operations
  - Connection status monitoring

### 3. Queue Table Component
- **Purpose**: Display and manage patient queue
- **Features**:
  - Sortable patient information
  - Status badges (waiting, called, completed)
  - Formatted phone numbers and timestamps
  - Action buttons for patient operations
  - Loading states for operations

## Technical Implementation

### Authentication Flow
```typescript
// Login process
1. User enters credentials
2. API validates against staff database
3. JWT token generated and stored in localStorage
4. User redirected to dashboard
5. Token validated on each API request
6. Automatic logout on token expiration
```

### Real-Time Updates
```typescript
// WebSocket integration
1. Dashboard connects to WebSocket server
2. Joins 'staff' room for queue updates
3. Receives real-time notifications when:
   - Patients check in
   - Patients are called
   - Patients are completed
   - Queue positions change
4. Automatically refreshes queue data
```

### Queue Operations
```typescript
// Call Next Patient
1. Identifies next waiting patient
2. Updates patient status to 'called'
3. Sends SMS notification to patient
4. Broadcasts update to all connected clients
5. Refreshes dashboard queue display

// Complete Patient
1. Updates patient status to 'completed'
2. Advances remaining patients' positions
3. Broadcasts queue updates
4. Removes patient from active queue
```

## API Integration

### Staff Authentication Endpoints
- `POST /api/staff/login` - Staff login with credentials
- `GET /api/staff/profile` - Get current staff profile
- `POST /api/staff/logout` - Staff logout

### Queue Management Endpoints
- `GET /api/staff/queue` - Get current queue with patient details
- `POST /api/staff/call-next` - Call next patient in queue
- `POST /api/staff/complete` - Mark patient as completed

### WebSocket Events
- `queue_update` - Real-time queue changes
- `patient_called` - Patient status change to called
- `patient_completed` - Patient completion notification

## Usage Guide

### Getting Started
1. Navigate to `/staff/login`
2. Enter staff credentials (demo: username: `staff`, password: `password123`)
3. Click "Sign In" to access the dashboard

### Managing the Queue
1. **View Queue**: See all patients with their positions, status, and wait times
2. **Call Next Patient**: Click the green "Call Next Patient" button to call the next waiting patient
3. **Complete Patient**: Click "Mark Complete" next to called patients to finish their visit
4. **Monitor Status**: Watch real-time updates as patients check in and are processed

### Dashboard Features
- **Statistics Cards**: Quick overview of queue status
- **Connection Indicator**: Shows WebSocket connection status
- **Refresh Button**: Manual refresh option
- **Auto-Logout**: Secure session management

## Error Handling

### Network Errors
- Graceful handling of API failures
- User-friendly error messages
- Retry mechanisms for failed operations
- Fallback to polling when WebSocket fails

### Authentication Errors
- Automatic redirect to login on session expiration
- Clear error messages for invalid credentials
- Session validation on page load

### Queue Operation Errors
- Validation before calling next patient
- Error feedback for failed operations
- Optimistic UI updates with rollback on failure

## Security Features

### Authentication Security
- JWT token-based authentication
- Secure token storage in localStorage
- Automatic token expiration (8 hours)
- Session validation on each request

### Data Protection
- HTTPS-only communication
- Input validation and sanitization
- XSS protection with proper escaping
- CSRF protection with token validation

### Access Control
- Staff-only access to dashboard
- Role-based permissions (future enhancement)
- Audit logging for patient operations

## Performance Optimizations

### Real-Time Performance
- Efficient WebSocket connection management
- Debounced queue updates to prevent spam
- Optimistic UI updates for better responsiveness
- Connection pooling and reconnection logic

### UI Performance
- React component memoization
- Efficient re-rendering with proper key props
- Loading states to improve perceived performance
- Responsive design for various screen sizes

## Testing

### Component Tests
- QueueTable component functionality
- Authentication flow testing
- Error handling scenarios
- Real-time update behavior

### Integration Tests
- Complete staff workflow testing
- API integration validation
- WebSocket connection testing
- Authentication and authorization

## Deployment

### Production Considerations
- Environment variable configuration
- SSL certificate setup
- Database connection security
- WebSocket server configuration

### Monitoring
- Connection status monitoring
- Error rate tracking
- Performance metrics
- User session analytics

## Future Enhancements

### Planned Features
- Advanced staff roles and permissions
- Queue analytics and reporting
- Patient search and filtering
- Bulk queue operations
- Mobile staff app

### Technical Improvements
- Enhanced error recovery
- Offline mode support
- Advanced caching strategies
- Performance monitoring dashboard

## Demo Credentials

For testing purposes, use these demo credentials:
- **Username**: `staff`
- **Password**: `password123`

## Support

For technical support or feature requests, please refer to the main SmartWait documentation or contact the development team.
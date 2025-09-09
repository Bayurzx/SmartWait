# WebSocket Authentication and Room Management

## Overview

This document describes the WebSocket authentication and room management system implemented for the SmartWait MVP. The system provides secure, real-time communication between patients, staff, and the queue management system.

## Authentication Methods

### Staff Authentication

Staff members authenticate using session tokens obtained from the HTTP authentication system:

```typescript
// Client-side connection
const socket = io('http://localhost:3001', {
  auth: {
    token: 'staff-session-token-here'
  }
});
```

**Authentication Flow:**
1. Staff logs in via HTTP API and receives session token
2. WebSocket connection includes token in auth object
3. Server validates token using AuthService.validateSession()
4. On success, staff is auto-joined to 'staff' room
5. Staff receives 'authenticated' event with user details

### Patient Authentication

Patients authenticate using their patient ID from the check-in process:

```typescript
// Client-side connection
const socket = io('http://localhost:3001', {
  auth: {
    patientId: 'patient-uuid-here'
  }
});
```

**Authentication Flow:**
1. Patient checks in and receives patient ID
2. WebSocket connection includes patientId in auth object
3. Server validates patient ID format and existence
4. On success, patient is auto-joined to 'patients' and 'patient_{id}' rooms
5. Patient receives 'authenticated' event with details

## Room Management

### Automatic Room Assignment

Upon successful authentication, users are automatically assigned to appropriate rooms:

**Staff Users:**
- `staff` - All authenticated staff members
- Can manually join any room (with permissions)

**Patient Users:**
- `patients` - All authenticated patients (for general announcements)
- `patient_{patientId}` - Individual patient room for personal notifications

### Manual Room Operations

Authenticated users can perform room operations:

#### Join Room
```typescript
socket.emit('join-room', { 
  room: 'room-name',
  patientId: 'optional-patient-id' // for staff accessing patient rooms
});

// Response
socket.on('room-joined', (data) => {
  console.log(`Joined room: ${data.room}`);
});
```

#### Leave Room
```typescript
socket.emit('leave-room', 'room-name');

// Response
socket.on('room-left', (data) => {
  console.log(`Left room: ${data.room}`);
});
```

#### Get Current Rooms
```typescript
socket.emit('get-rooms');

// Response
socket.on('current-rooms', (data) => {
  console.log('Current rooms:', data.rooms);
});
```

## Permission System

### Room Access Rules

**Staff Permissions:**
- ✅ Can access `staff` room
- ✅ Can access any `patient_{id}` room
- ✅ Can access `patients` room
- ❌ Cannot access `admin` room (unless role is 'admin')

**Patient Permissions:**
- ✅ Can access `patients` room
- ✅ Can access own `patient_{id}` room
- ❌ Cannot access `staff` room
- ❌ Cannot access other patients' rooms

**Admin Permissions:**
- ✅ All staff permissions
- ✅ Can access `admin` room

### Permission Validation

```typescript
// Server-side permission check
const validateRoomAccess = async (socket, room, patientId) => {
  const userType = socket.userType;
  const userId = socket.userId;
  const role = socket.role;

  // Implementation details in config/socket.ts
  // Returns { allowed: boolean, reason?: string }
};
```

## Connection Tracking

### User Tracking

The system tracks all connected users:

```typescript
// Get connected users info
const connectedUsers = getConnectedUsers();
// Returns: { total, staff, patients, users: [...] }

// Check if specific user is connected
const isConnected = isUserConnected('user-id');

// Send message to specific user
const sent = sendToUser('user-id', 'event-name', data);
```

### Room Information

```typescript
// Get specific room info
const roomInfo = await getRoomInfo('room-name');
// Returns: { room, memberCount, members: [...] }

// Get all rooms info
const allRooms = await getRoomInfo();
// Returns: { rooms: [...] }
```

## Event Types

### Authentication Events

```typescript
// Successful authentication
socket.on('authenticated', (data) => {
  // data: { userType, username?, patientId?, role?, rooms, message }
});

// Authentication error
socket.on('connect_error', (error) => {
  // error.message contains reason
});
```

### Room Events

```typescript
// Successfully joined room
socket.on('room-joined', (data) => {
  // data: { room, message, timestamp }
});

// Successfully left room
socket.on('room-left', (data) => {
  // data: { room, message, timestamp }
});

// Current rooms list
socket.on('current-rooms', (data) => {
  // data: { rooms: [...], timestamp }
});
```

### Queue Events

```typescript
// Position update for specific patient
socket.on('position_update', (data) => {
  // data: { type, position, estimatedWait, timestamp }
});

// Patient being called
socket.on('patient_called', (data) => {
  // data: { type, message, timestamp }
});

// Get ready notification
socket.on('get_ready', (data) => {
  // data: { type, message, estimatedWait, timestamp }
});

// General queue updates
socket.on('queue_update', (data) => {
  // data: { type, patientId?, newPosition?, estimatedWait?, timestamp, data? }
});
```

### Utility Events

```typescript
// Heartbeat
socket.emit('ping');
socket.on('pong', (data) => {
  // data: { timestamp }
});

// Error handling
socket.on('error', (error) => {
  // error: { message }
});
```

## Security Features

### Authentication Requirements

- All WebSocket connections MUST be authenticated
- Unauthenticated connections are immediately rejected
- Invalid tokens/credentials result in connection rejection

### Token Validation

- Staff tokens validated against active sessions in database
- Expired sessions automatically rejected
- Patient IDs validated for format and basic existence

### Room Access Control

- Strict permission checking for all room operations
- Users cannot access unauthorized rooms
- Failed permission checks logged and reported

### Connection Security

- CORS configuration restricts allowed origins
- Transport security with WebSocket over HTTPS in production
- Rate limiting and connection monitoring

## Error Handling

### Common Error Scenarios

1. **Authentication Failure**
   ```typescript
   // Client receives connect_error
   socket.on('connect_error', (error) => {
     if (error.message.includes('Authentication')) {
       // Handle auth failure - redirect to login
     }
   });
   ```

2. **Room Access Denied**
   ```typescript
   socket.on('error', (error) => {
     if (error.message.includes('Access denied')) {
       // Handle permission error
     }
   });
   ```

3. **Connection Lost**
   ```typescript
   socket.on('disconnect', (reason) => {
     if (reason === 'io server disconnect') {
       // Server disconnected client - likely auth issue
     } else {
       // Network issue - attempt reconnection
     }
   });
   ```

### Graceful Degradation

- Connection failures fall back to HTTP polling
- Authentication errors redirect to login
- Room access failures provide clear error messages
- Network issues trigger automatic reconnection

## Implementation Details

### Server Configuration

```typescript
// Socket.io server setup with authentication
io.use(authenticateSocket); // Authentication middleware
io.on('connection', handleConnection); // Connection handler
```

### Client Connection Examples

**Staff Dashboard:**
```typescript
const socket = io(API_URL, {
  auth: { token: localStorage.getItem('staffToken') },
  transports: ['websocket', 'polling']
});

socket.on('authenticated', (data) => {
  console.log('Staff authenticated:', data.username);
  // Initialize dashboard
});
```

**Patient Mobile App:**
```typescript
const socket = io(API_URL, {
  auth: { patientId: AsyncStorage.getItem('patientId') },
  transports: ['websocket', 'polling']
});

socket.on('authenticated', (data) => {
  console.log('Patient authenticated:', data.patientId);
  // Start listening for queue updates
});
```

## Testing

### Unit Tests

Run WebSocket authentication tests:
```bash
npm test -- websocket-auth.test.ts
```

### Integration Tests

Run full WebSocket integration test:
```bash
npm run test:websocket-auth
```

### Manual Testing

Use the test script for manual verification:
```bash
ts-node src/scripts/test-websocket-auth.ts
```

## Monitoring and Debugging

### Health Checks

```typescript
// Get WebSocket server health
const health = getSocketIOHealth();
// Returns connection counts, Redis status, etc.

// Get connected users
const users = getConnectedUsers();
// Returns user counts and details

// Get room information
const rooms = await getRoomInfo();
// Returns all room membership info
```

### Logging

The system logs all authentication attempts, room operations, and errors:

- Authentication success/failure
- Room join/leave operations
- Permission violations
- Connection/disconnection events
- Error conditions

### Debug Mode

Enable debug logging:
```bash
DEBUG=socket.io* npm start
```

## Best Practices

### Client Implementation

1. **Always handle authentication events**
2. **Implement reconnection logic**
3. **Validate server responses**
4. **Handle permission errors gracefully**
5. **Use heartbeat for connection monitoring**

### Security Considerations

1. **Never expose sensitive tokens in logs**
2. **Validate all user inputs**
3. **Implement proper error handling**
4. **Monitor for suspicious activity**
5. **Regular token rotation for staff**

### Performance Optimization

1. **Use appropriate room granularity**
2. **Limit message frequency**
3. **Implement client-side caching**
4. **Monitor connection counts**
5. **Use Redis adapter for scaling**

## Troubleshooting

### Common Issues

1. **Connection Rejected**
   - Check authentication credentials
   - Verify token validity
   - Check server logs for details

2. **Room Access Denied**
   - Verify user permissions
   - Check room name spelling
   - Confirm user type and role

3. **Messages Not Received**
   - Check room membership
   - Verify event names
   - Test connection status

4. **Performance Issues**
   - Monitor connection counts
   - Check Redis adapter status
   - Review message frequency

### Debug Steps

1. Check server health endpoint
2. Verify authentication tokens
3. Test with minimal client
4. Review server logs
5. Check Redis connection
6. Monitor network traffic

This WebSocket authentication and room management system provides secure, scalable real-time communication for the SmartWait MVP while maintaining strict access controls and comprehensive monitoring capabilities.
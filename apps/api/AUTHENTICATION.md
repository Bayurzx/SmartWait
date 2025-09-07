# Staff Authentication System

## Overview

The SmartWait MVP includes a simple but secure staff authentication system with username/password authentication and session management.

## Features

- **Username/Password Authentication**: Simple login with hardcoded credentials for MVP
- **Session Management**: Database-backed session tokens with expiration
- **Password Hashing**: bcrypt with 12 salt rounds for secure password storage
- **Role-Based Access**: Support for 'staff' and 'admin' roles
- **Session Cleanup**: Automatic cleanup of expired sessions

## Default Credentials

For the MVP, the following credentials are available:

### Staff Account
- **Username**: `staff`
- **Password**: `smartwait2024`
- **Role**: `staff`

### Admin Account
- **Username**: `admin`
- **Password**: `admin2024`
- **Role**: `admin`

## API Endpoints

### Authentication Endpoints

#### POST /api/staff/login
Authenticate staff member and create session.

**Request:**
```json
{
  "username": "staff",
  "password": "smartwait2024"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "staff_1234567890_abcdef123456",
    "user": {
      "id": "staff-1",
      "username": "staff",
      "role": "staff"
    },
    "expiresAt": "2024-01-01T16:00:00.000Z",
    "expiresIn": "8h"
  },
  "message": "Login successful"
}
```

#### POST /api/staff/logout
Logout staff member and invalidate session.

**Headers:**
```
Authorization: Bearer staff_1234567890_abcdef123456
```

**Response:**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

#### GET /api/staff/me
Get current user information.

**Headers:**
```
Authorization: Bearer staff_1234567890_abcdef123456
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "staff-1",
      "username": "staff",
      "role": "staff"
    },
    "sessionId": "session-uuid"
  }
}
```

### Protected Endpoints

All other staff endpoints require authentication:

- `GET /api/staff/queue` - Get full queue
- `POST /api/staff/call-next` - Call next patient
- `POST /api/staff/complete` - Mark patient completed
- `GET /api/staff/stats` - Get queue statistics

### Admin-Only Endpoints

These endpoints require admin role:

- `GET /api/staff/sessions` - View active sessions
- `POST /api/staff/cleanup-sessions` - Clean up expired sessions

## Authentication Flow

1. **Login**: Staff member provides username/password
2. **Validation**: System validates credentials against hardcoded users
3. **Session Creation**: System creates session token and stores in database
4. **Token Usage**: Client includes token in Authorization header for protected requests
5. **Token Validation**: System validates token and checks expiration on each request
6. **Logout**: System invalidates session token

## Security Features

### Password Security
- Passwords are hashed using bcrypt with 12 salt rounds
- Original passwords are never stored in plain text
- Password comparison is done using bcrypt.compare()

### Session Security
- Session tokens are randomly generated with timestamp and random components
- Sessions expire after 8 hours
- Expired sessions are automatically cleaned up
- Sessions are stored in PostgreSQL database

### Request Security
- All authentication endpoints validate input data
- Bearer token format is enforced
- Proper HTTP status codes are returned for different error scenarios
- Error messages don't leak sensitive information

## Middleware

### authenticateStaff
Validates session token and adds user information to request object.

```typescript
app.get('/protected-endpoint', authenticateStaff, (req, res) => {
  // req.user contains authenticated user info
  // req.sessionId contains session ID
});
```

### requireAdmin
Requires admin role in addition to authentication.

```typescript
app.get('/admin-endpoint', authenticateStaff, requireAdmin, (req, res) => {
  // Only admin users can access this endpoint
});
```

### optionalAuth
Adds user info to request if token is provided, but doesn't fail if missing.

```typescript
app.get('/public-endpoint', optionalAuth, (req, res) => {
  // req.user is available if authenticated, undefined otherwise
});
```

## Database Schema

### staff_sessions Table
```sql
CREATE TABLE staff_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) NOT NULL,
    session_token VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Error Codes

- `VALIDATION_ERROR`: Missing or invalid input data
- `INVALID_CREDENTIALS`: Wrong username or password
- `UNAUTHORIZED`: Missing or invalid authentication token
- `FORBIDDEN`: Insufficient permissions (admin required)
- `INTERNAL_ERROR`: Server error during authentication

## Testing

The authentication system includes comprehensive tests:

- Unit tests for password hashing and validation logic
- Integration tests for all authentication endpoints
- Error scenario testing
- Full authentication flow testing

Run tests with:
```bash
npm test -- auth-service.test.ts
npm test -- staff-auth-integration.test.ts
```

## Production Considerations

For production deployment, consider:

1. **User Management**: Replace hardcoded credentials with database-backed user management
2. **JWT Tokens**: Consider using JWT tokens instead of random session tokens
3. **Password Policies**: Implement password complexity requirements
4. **Rate Limiting**: Add rate limiting to prevent brute force attacks
5. **Audit Logging**: Log all authentication attempts and session activities
6. **Multi-Factor Authentication**: Add MFA for enhanced security
7. **Session Management**: Implement session timeout warnings and refresh tokens

## Environment Variables

No additional environment variables are required for the basic authentication system. The system uses the existing DATABASE_URL for session storage.
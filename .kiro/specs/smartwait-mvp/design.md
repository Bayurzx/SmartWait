# SmartWait MVP Design Document

## Overview

The SmartWait MVP is designed as a simplified but functional virtual queue management system that can be built in 10 days. The architecture prioritizes speed of development while maintaining the core functionality needed to validate the product concept with a real healthcare facility.

## Architecture

### High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Mobile App    │    │   Web Portal    │    │ Staff Dashboard │
│  (React Native) │    │   (Next.js)     │    │   (Next.js)     │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │      API Gateway         │
                    │    (Express.js)          │
                    └─────────────┬─────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
    ┌─────▼─────┐      ┌─────────▼─────────┐      ┌─────▼─────┐
    │PostgreSQL │      │     Redis         │      │  Twilio   │
    │(Queue Data)│      │(Real-time Cache) │      │   (SMS)   │
    └───────────┘      └───────────────────┘      └───────────┘
```

### Technology Stack

**Backend Services:**
- **API Server:** Node.js 18+ with Express.js and TypeScript
- **Database:** PostgreSQL 14+ for persistent data
- **Cache/Real-time:** Redis 6+ for caching and pub/sub
- **SMS Service:** Twilio for notifications

**Frontend Applications:**
- **Mobile App:** React Native with Expo SDK 49+
- **Web Portal:** Next.js 13+ with TypeScript
- **Staff Dashboard:** Next.js 13+ with TypeScript

**Development Tools:**
- **Language:** TypeScript for type safety
- **Testing:** Jest for unit tests
- **Deployment:** Docker containers
- **Real-time:** Socket.io for WebSocket connections

## Components and Interfaces

### 1. API Server (Express.js)

#### Core Services

**QueueService**
```typescript
interface QueueService {
  // Patient operations
  checkIn(patientData: CheckInRequest): Promise<QueuePosition>
  getPosition(patientId: string): Promise<QueueStatus>
  
  // Staff operations
  getQueue(): Promise<QueuePosition[]>
  callNextPatient(): Promise<PatientCallResult>
  markPatientCompleted(patientId: string): Promise<void>
  
  // Real-time updates
  subscribeToUpdates(callback: (update: QueueUpdate) => void): void
}
```

**NotificationService**
```typescript
interface NotificationService {
  sendSMS(phoneNumber: string, message: string): Promise<SMSResult>
  sendQueueUpdate(patientId: string, position: number, waitTime: number): Promise<void>
  sendReadyNotification(patientId: string): Promise<void>
}
```

**RealtimeService**
```typescript
interface RealtimeService {
  broadcastQueueUpdate(update: QueueUpdate): void
  notifyPatient(patientId: string, message: any): void
  notifyStaff(message: any): void
}
```

#### API Endpoints

```typescript
// Patient endpoints
POST   /api/checkin           // Check in to queue
GET    /api/position/:id      // Get current position
GET    /api/status/:id        // Get queue status

// Staff endpoints  
GET    /api/staff/queue       // Get full queue
POST   /api/staff/call-next   // Call next patient
POST   /api/staff/complete    // Mark patient completed
POST   /api/staff/login       // Staff authentication

// WebSocket endpoint
WS     /socket.io             // Real-time updates
```

### 2. Database Schema (PostgreSQL)

```sql
-- Patients table
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Queue positions table
CREATE TABLE queue_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id),
    position INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'waiting', -- waiting, called, completed, no_show
    check_in_time TIMESTAMP DEFAULT NOW(),
    estimated_wait_minutes INTEGER,
    called_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    UNIQUE(position) WHERE status IN ('waiting', 'called')
);

-- Staff sessions (simple auth)
CREATE TABLE staff_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) NOT NULL,
    session_token VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- SMS notifications log
CREATE TABLE sms_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id),
    phone_number VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, sent, delivered, failed
    sent_at TIMESTAMP DEFAULT NOW(),
    twilio_sid VARCHAR(100)
);
```

### 3. Mobile App (React Native + Expo)

#### App Structure
```
src/
├── components/
│   ├── CheckInForm.tsx
│   ├── QueueStatus.tsx
│   └── LoadingSpinner.tsx
├── screens/
│   ├── CheckInScreen.tsx
│   ├── QueueScreen.tsx
│   └── StatusScreen.tsx
├── services/
│   ├── api.ts
│   ├── websocket.ts
│   └── storage.ts
├── types/
│   └── index.ts
└── App.tsx
```

#### Key Components

**CheckInForm Component**
```typescript
interface CheckInFormProps {
  onSubmit: (data: CheckInData) => void;
  loading: boolean;
}

interface CheckInData {
  name: string;
  phone: string;
  appointmentTime: string;
}
```

**QueueStatus Component**
```typescript
interface QueueStatusProps {
  position: number;
  estimatedWait: number;
  status: 'waiting' | 'called' | 'ready';
  onRefresh: () => void;
}
```

### 4. Web Portal (Next.js)

#### Page Structure
```
pages/
├── index.tsx              // Check-in form
├── status/[id].tsx        // Queue status page
└── api/
    └── health.ts          // Health check
```

#### Key Features
- Server-side rendering for fast initial load
- Responsive design for mobile and desktop
- Real-time updates via WebSocket
- Simple form validation

### 5. Staff Dashboard (Next.js)

#### Dashboard Structure
```
pages/
├── dashboard/
│   ├── index.tsx          // Main queue view
│   ├── login.tsx          // Staff authentication
│   └── components/
│       ├── QueueTable.tsx
│       ├── PatientCard.tsx
│       └── CallButton.tsx
```

#### Key Features
- Real-time queue display
- One-click patient calling
- Simple patient status management
- Basic authentication

## Data Models

### Core Data Types

```typescript
// Patient data model
interface Patient {
  id: string;
  name: string;
  phone: string;
  createdAt: Date;
}

// Queue position model
interface QueuePosition {
  id: string;
  patientId: string;
  patient: Patient;
  position: number;
  status: 'waiting' | 'called' | 'completed' | 'no_show';
  checkInTime: Date;
  estimatedWaitMinutes: number;
  calledAt?: Date;
  completedAt?: Date;
}

// Real-time update model
interface QueueUpdate {
  type: 'position_change' | 'patient_called' | 'patient_completed';
  patientId: string;
  newPosition?: number;
  estimatedWait?: number;
  timestamp: Date;
}

// API request/response models
interface CheckInRequest {
  name: string;
  phone: string;
  appointmentTime: string;
}

interface CheckInResponse {
  success: boolean;
  data: {
    patientId: string;
    position: number;
    estimatedWait: number;
  };
}
```

## Error Handling

### Error Categories

1. **Validation Errors:** Invalid input data
2. **Service Errors:** Database or external service failures
3. **Network Errors:** Connection issues
4. **Business Logic Errors:** Queue capacity, duplicate check-ins

### Error Response Format

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

// Example error codes
const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  QUEUE_FULL: 'QUEUE_FULL',
  PATIENT_NOT_FOUND: 'PATIENT_NOT_FOUND',
  DUPLICATE_CHECKIN: 'DUPLICATE_CHECKIN',
  SMS_FAILED: 'SMS_FAILED',
  DATABASE_ERROR: 'DATABASE_ERROR'
};
```

### Graceful Degradation

- **SMS Failures:** Continue queue operations, log failures
- **Real-time Failures:** Fall back to polling every 30 seconds
- **Database Errors:** Return cached data when possible
- **External Service Errors:** Provide manual alternatives

## Testing Strategy

### Unit Testing (Jest)

**Critical Components to Test:**
- Queue position calculation logic
- SMS notification formatting
- Real-time update broadcasting
- Patient check-in validation
- Staff authentication

**Example Test Structure:**
```typescript
describe('QueueService', () => {
  describe('checkIn', () => {
    it('should assign correct position to new patient', async () => {
      // Test implementation
    });
    
    it('should reject duplicate phone numbers', async () => {
      // Test implementation
    });
  });
});
```

### Integration Testing

**Key Workflows to Test:**
1. Complete patient check-in flow
2. Staff calling next patient
3. Real-time position updates
4. SMS notification delivery

### Manual Testing Scenarios

1. **Happy Path:** Patient checks in → receives SMS → gets called → completes
2. **Multiple Patients:** Several patients check in simultaneously
3. **Staff Operations:** Staff manages queue during busy period
4. **Error Scenarios:** Network failures, invalid inputs, SMS failures

## Performance Considerations

### Database Optimization

- **Indexes:** Position queries, patient lookups
- **Connection Pooling:** Limit concurrent connections
- **Query Optimization:** Use prepared statements

### Caching Strategy

- **Redis Caching:** Current queue state, patient positions
- **Cache Invalidation:** On position changes, completions
- **TTL Settings:** 5 minutes for queue data

### Real-time Performance

- **Socket.io Rooms:** Separate rooms for patients and staff
- **Message Throttling:** Limit update frequency to prevent spam
- **Connection Management:** Handle disconnections gracefully

## Security Implementation

### Basic Security Measures

1. **Input Validation:** Sanitize all user inputs
2. **SQL Injection Prevention:** Use parameterized queries
3. **XSS Prevention:** Escape output data
4. **Rate Limiting:** Prevent API abuse
5. **HTTPS Only:** Encrypt all communications

### Authentication

**Staff Authentication:**
- Simple username/password with session tokens
- Session expiration after 8 hours
- Basic role checking (staff vs. patient)

**Patient Authentication:**
- Phone number + check-in time verification
- No persistent sessions for patients

### Data Protection

- **Minimal Data Collection:** Only name and phone number
- **Data Retention:** Automatic cleanup after 24 hours
- **Logging:** Basic access logs without sensitive data

## Deployment Architecture

### Single Server Deployment

```
┌─────────────────────────────────────┐
│           Production Server          │
├─────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐   │
│  │   Node.js   │  │   Next.js   │   │
│  │  API Server │  │  Web Apps   │   │
│  └─────────────┘  └─────────────┘   │
├─────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐   │
│  │ PostgreSQL  │  │    Redis    │   │
│  │  Database   │  │    Cache    │   │
│  └─────────────┘  └─────────────┘   │
└─────────────────────────────────────┘
```

### Docker Configuration

**docker-compose.yml:**
```yaml
version: '3.8'
services:
  api:
    build: ./api
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/smartwait
      - REDIS_URL=redis://redis:6379
      - TWILIO_ACCOUNT_SID=${TWILIO_ACCOUNT_SID}
      - TWILIO_AUTH_TOKEN=${TWILIO_AUTH_TOKEN}
    depends_on:
      - db
      - redis

  web:
    build: ./web
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://api:3001

  db:
    image: postgres:14
    environment:
      - POSTGRES_DB=smartwait
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:6-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

## Monitoring and Observability

### Basic Monitoring

1. **Health Checks:** Simple HTTP endpoints for service status
2. **Error Logging:** Console logs with structured format
3. **Performance Metrics:** Response times, queue sizes
4. **SMS Delivery Tracking:** Success/failure rates

### Alerting (Basic)

- **Database Connection Failures**
- **High Error Rates (>5%)**
- **SMS Delivery Failures**
- **Queue Processing Delays**

## Scalability Considerations

### Immediate Limitations (MVP)

- **Single Server:** No horizontal scaling
- **Single Database:** No read replicas
- **Memory-based Sessions:** No distributed sessions
- **Local File Storage:** No CDN or distributed storage

### Future Scaling Path

1. **Load Balancer:** Add nginx for multiple API instances
2. **Database Scaling:** Read replicas, connection pooling
3. **Caching Layer:** Distributed Redis cluster
4. **Microservices:** Split into focused services
5. **Message Queue:** Add proper message broker

## Risk Mitigation

### Technical Risks

1. **SMS Delivery Failures**
   - Mitigation: Retry logic, delivery confirmations, fallback to app notifications

2. **Real-time Update Delays**
   - Mitigation: Polling fallback, connection health monitoring

3. **Database Performance**
   - Mitigation: Query optimization, connection pooling, basic indexing

4. **Concurrent User Issues**
   - Mitigation: Database transactions, optimistic locking

### Operational Risks

1. **Single Point of Failure**
   - Mitigation: Basic backup procedures, quick restart capabilities

2. **Data Loss**
   - Mitigation: Daily database backups, transaction logging

3. **Security Vulnerabilities**
   - Mitigation: Input validation, basic security headers, HTTPS

## Success Metrics

### Technical Performance
- **API Response Time:** <500ms for 95% of requests
- **Real-time Update Latency:** <10 seconds
- **SMS Delivery Rate:** >95% success rate
- **System Uptime:** >99% during business hours

### User Experience
- **Check-in Completion Rate:** >95% success rate
- **Staff Dashboard Usability:** <5 minutes training time
- **Patient Satisfaction:** Positive feedback on queue visibility

This design provides a solid foundation for the MVP while maintaining simplicity and focusing on core functionality that can be built within the 10-day constraint.
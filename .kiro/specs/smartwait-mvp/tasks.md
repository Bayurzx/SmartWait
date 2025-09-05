# SmartWait MVP Implementation Tasks

## Overview

This implementation plan breaks down the SmartWait MVP into 10 days of focused development tasks. Each task builds incrementally on previous work and focuses on delivering working code that can be tested immediately.

**Timeline:** 10 days
**Approach:** Test-driven development with working features each day
**Priority:** Core functionality first, polish later

---

## Day 1: Project Foundation and Database Setup

### Task 1.1: Project Structure and Database Schema
**Priority:** P0 | **Estimate:** 1 day | **Status:** Not Started

**Description:** Set up the complete project structure with database schema and basic API foundation.

**Acceptance Criteria:**
- [ ] Create monorepo structure with api/, web/, and mobile/ directories
- [ ] Set up PostgreSQL database with complete schema (patients, queue_positions, staff_sessions, sms_notifications)
- [ ] Create Docker Compose configuration for local development
- [ ] Set up TypeScript configuration for all projects
- [ ] Create basic Express.js API server with health check endpoint
- [ ] Set up Redis for caching and real-time features
- [ ] Create database migration scripts and seed data
- [ ] Set up environment configuration for all services

**Technical Implementation:**
```typescript
// Database schema implementation
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE queue_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id),
    position INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'waiting',
    check_in_time TIMESTAMP DEFAULT NOW(),
    estimated_wait_minutes INTEGER,
    called_at TIMESTAMP,
    completed_at TIMESTAMP,
    UNIQUE(position) WHERE status IN ('waiting', 'called')
);
```

**Deliverables:**
- Working Docker Compose environment
- Database with all tables created
- Basic API server responding to health checks
- TypeScript compilation working for all projects

**Requirements:** _Requirements 1-6 (Foundation for all features)_

---

## Day 2: Core Queue Service and API Endpoints

### Task 2.1: Queue Management Service Implementation
**Priority:** P0 | **Estimate:** 1 day | **Status:** Not Started

**Description:** Implement the core queue management service with patient check-in and position tracking.

**Acceptance Criteria:**
- [ ] Create QueueService class with check-in, position tracking, and queue management methods
- [ ] Implement POST /api/checkin endpoint with input validation
- [ ] Implement GET /api/position/:id endpoint for position queries
- [ ] Create automatic position assignment logic (sequential numbering)
- [ ] Implement basic wait time estimation (position × 15 minutes average)
- [ ] Add input validation for patient data (name, phone, appointment time)
- [ ] Create error handling for duplicate check-ins and invalid data
- [ ] Write unit tests for queue service core logic

**Technical Implementation:**
```typescript
// Core queue service
export class QueueService {
  async checkIn(data: CheckInRequest): Promise<QueuePosition> {
    // Validate input data
    // Check for duplicate phone numbers
    // Create patient record
    // Assign next available position
    // Calculate estimated wait time
    // Return queue position data
  }

  async getPosition(patientId: string): Promise<QueueStatus> {
    // Find patient in queue
    // Calculate current wait time
    // Return position and status
  }
}
```

**Deliverables:**
- Working check-in API endpoint
- Position tracking API endpoint
- Queue service with unit tests
- Basic error handling and validation

**Requirements:** _Requirement 1 (Basic Patient Check-In), Requirement 3 (Real-Time Queue Management)_

---

## Day 3: Staff Dashboard API and Authentication

### Task 3.1: Staff Dashboard Backend Implementation
**Priority:** P0 | **Estimate:** 1 day | **Status:** Not Started

**Description:** Build staff-facing API endpoints for queue management and basic authentication.

**Acceptance Criteria:**
- [ ] Create staff authentication system with simple username/password
- [ ] Implement POST /api/staff/login endpoint with session token generation
- [ ] Implement GET /api/staff/queue endpoint to retrieve full queue
- [ ] Implement POST /api/staff/call-next endpoint to call next patient
- [ ] Implement POST /api/staff/complete endpoint to mark patient as completed
- [ ] Add middleware for staff authentication on protected endpoints
- [ ] Create automatic position recalculation when patients are processed
- [ ] Implement queue position advancement logic (remove gaps)

**Technical Implementation:**
```typescript
// Staff endpoints
app.post('/api/staff/login', async (req, res) => {
  // Validate credentials
  // Generate session token
  // Return authentication response
});

app.get('/api/staff/queue', authenticateStaff, async (req, res) => {
  // Get all active queue positions
  // Include patient details
  // Return sorted by position
});

app.post('/api/staff/call-next', authenticateStaff, async (req, res) => {
  // Find next patient in queue
  // Mark as 'called'
  // Trigger notifications
  // Return patient details
});
```

**Deliverables:**
- Staff authentication system
- Complete staff API endpoints
- Queue management functionality
- Position advancement logic

**Requirements:** _Requirement 4 (Basic Staff Dashboard)_

---

## Day 4: SMS Notification Service

### Task 4.1: Twilio SMS Integration and Notification Logic
**Priority:** P0 | **Estimate:** 1 day | **Status:** Not Started

**Description:** Integrate Twilio SMS service and implement all notification scenarios.

**Acceptance Criteria:**
- [ ] Set up Twilio SDK integration with account credentials
- [ ] Create NotificationService class for SMS operations
- [ ] Implement check-in confirmation SMS (sent immediately after check-in)
- [ ] Implement "get ready" SMS (sent when patient is 2 positions away)
- [ ] Implement "come in now" SMS (sent when patient is called)
- [ ] Add SMS delivery tracking and error handling
- [ ] Create SMS message templates with queue position and wait time
- [ ] Implement retry logic for failed SMS deliveries
- [ ] Add SMS notification logging to database

**Technical Implementation:**
```typescript
// SMS notification service
export class NotificationService {
  async sendCheckInConfirmation(patient: Patient, position: number): Promise<void> {
    const message = `Hello ${patient.name}! You're checked in at position ${position}. Estimated wait: ${position * 15} minutes. We'll text you when it's almost your turn.`;
    await this.sendSMS(patient.phone, message);
  }

  async sendGetReadySMS(patient: Patient): Promise<void> {
    const message = `${patient.name}, you're next! Please head to the facility now. We'll call you in about 15 minutes.`;
    await this.sendSMS(patient.phone, message);
  }

  async sendCallNowSMS(patient: Patient): Promise<void> {
    const message = `${patient.name}, it's your turn! Please come to the front desk now.`;
    await this.sendSMS(patient.phone, message);
  }
}
```

**Deliverables:**
- Working Twilio SMS integration
- All SMS notification scenarios implemented
- SMS delivery tracking and logging
- Error handling for SMS failures

**Requirements:** _Requirement 5 (SMS Notifications)_

---

## Day 5: Real-Time Updates with WebSocket

### Task 5.1: Socket.io Real-Time Communication
**Priority:** P0 | **Estimate:** 1 day | **Status:** Not Started

**Description:** Implement WebSocket-based real-time updates for queue position changes.

**Acceptance Criteria:**
- [ ] Set up Socket.io server with Redis adapter for scaling
- [ ] Create patient and staff WebSocket rooms for targeted updates
- [ ] Implement real-time position updates when queue changes
- [ ] Create RealtimeService to broadcast queue updates
- [ ] Integrate real-time updates with queue operations (check-in, call, complete)
- [ ] Add WebSocket authentication and room management
- [ ] Implement automatic reconnection handling
- [ ] Create real-time update event types and data structures

**Technical Implementation:**
```typescript
// Real-time service
export class RealtimeService {
  constructor(private io: Server) {}

  broadcastQueueUpdate(update: QueueUpdate): void {
    // Broadcast to all patients in queue
    this.io.to('patients').emit('queue_update', update);
    
    // Broadcast to staff dashboard
    this.io.to('staff').emit('queue_update', update);
  }

  notifyPatientPositionChange(patientId: string, newPosition: number, waitTime: number): void {
    this.io.to(`patient_${patientId}`).emit('position_update', {
      position: newPosition,
      estimatedWait: waitTime,
      timestamp: new Date()
    });
  }
}
```

**Deliverables:**
- Working Socket.io server with Redis
- Real-time queue update broadcasting
- Patient and staff WebSocket rooms
- Integration with queue operations

**Requirements:** _Requirement 6 (Real-Time Position Updates)_

---

## Day 6: React Native Mobile App

### Task 6.1: Mobile App with Check-In and Queue Status
**Priority:** P0 | **Estimate:** 1 day | **Status:** Not Started

**Description:** Build React Native mobile app with Expo for patient check-in and queue tracking.

**Acceptance Criteria:**
- [ ] Create Expo React Native app with TypeScript
- [ ] Build check-in form with name, phone, and appointment time inputs
- [ ] Implement form validation and error handling
- [ ] Create queue status screen showing position and estimated wait time
- [ ] Integrate with API endpoints for check-in and position tracking
- [ ] Add WebSocket integration for real-time position updates
- [ ] Implement navigation between check-in and status screens
- [ ] Add loading states and error handling for network requests
- [ ] Store patient ID locally for status checking

**Technical Implementation:**
```typescript
// Check-in screen component
export const CheckInScreen: React.FC = () => {
  const [formData, setFormData] = useState<CheckInData>({
    name: '',
    phone: '',
    appointmentTime: ''
  });

  const handleCheckIn = async () => {
    try {
      const response = await api.checkIn(formData);
      // Store patient ID
      await AsyncStorage.setItem('patientId', response.data.patientId);
      // Navigate to queue status
      navigation.navigate('QueueStatus');
    } catch (error) {
      // Handle error
    }
  };

  return (
    <View>
      <TextInput 
        placeholder="Full Name"
        value={formData.name}
        onChangeText={(text) => setFormData({...formData, name: text})}
      />
      {/* Other form fields */}
      <Button title="Check In" onPress={handleCheckIn} />
    </View>
  );
};
```

**Deliverables:**
- Working React Native app with Expo
- Check-in form with validation
- Queue status screen with real-time updates
- API integration and WebSocket connection

**Requirements:** _Requirement 1 (Basic Patient Check-In), Requirement 6 (Real-Time Position Updates)_

---

## Day 7: Next.js Web Portal

### Task 7.1: Web Portal for Browser-Based Check-In
**Priority:** P0 | **Estimate:** 1 day | **Status:** Not Started

**Description:** Create Next.js web portal as alternative to mobile app for patient check-in.

**Acceptance Criteria:**
- [ ] Set up Next.js 13+ application with TypeScript and Tailwind CSS
- [ ] Create responsive check-in form matching mobile app functionality
- [ ] Implement server-side rendering for fast initial page load
- [ ] Build queue status page with real-time updates via WebSocket
- [ ] Add form validation and error handling
- [ ] Implement URL-based patient status checking (shareable links)
- [ ] Create responsive design that works on mobile and desktop
- [ ] Add loading states and error boundaries

**Technical Implementation:**
```typescript
// Check-in page component
export default function CheckInPage() {
  const [formData, setFormData] = useState<CheckInData>({
    name: '',
    phone: '',
    appointmentTime: ''
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        const data = await response.json();
        router.push(`/status/${data.patientId}`);
      }
    } catch (error) {
      setError('Check-in failed. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto p-6">
      <input 
        type="text"
        placeholder="Full Name"
        value={formData.name}
        onChange={(e) => setFormData({...formData, name: e.target.value})}
        className="w-full p-3 border rounded mb-4"
        required
      />
      {/* Other form fields */}
      <button type="submit" className="w-full bg-blue-500 text-white p-3 rounded">
        Check In
      </button>
    </form>
  );
}
```

**Deliverables:**
- Working Next.js web portal
- Responsive check-in form
- Queue status page with real-time updates
- Server-side rendering for performance

**Requirements:** _Requirement 2 (Web-Based Check-In Alternative)_

---

## Day 8: Staff Dashboard Frontend

### Task 8.1: Next.js Staff Dashboard Interface
**Priority:** P0 | **Estimate:** 1 day | **Status:** Not Started

**Description:** Build staff dashboard interface for queue management and patient operations.

**Acceptance Criteria:**
- [ ] Create Next.js staff dashboard application with authentication
- [ ] Build login page with username/password form
- [ ] Create main dashboard showing queue table with patient information
- [ ] Implement "Call Next Patient" button with confirmation
- [ ] Add patient completion functionality with one-click operation
- [ ] Display real-time queue updates without page refresh
- [ ] Show patient details (name, phone, check-in time, wait duration)
- [ ] Add basic styling for professional healthcare interface
- [ ] Implement session management and automatic logout

**Technical Implementation:**
```typescript
// Staff dashboard component
export const StaffDashboard: React.FC = () => {
  const [queue, setQueue] = useState<QueuePosition[]>([]);
  const [loading, setLoading] = useState(false);

  const callNextPatient = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/staff/call-next', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        // Update queue state
        // Show success message
      }
    } catch (error) {
      // Handle error
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Patient Queue</h1>
        <button 
          onClick={callNextPatient}
          disabled={loading || queue.length === 0}
          className="bg-green-500 text-white px-4 py-2 rounded"
        >
          Call Next Patient
        </button>
      </div>
      
      <table className="w-full border-collapse border">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2">Position</th>
            <th className="border p-2">Name</th>
            <th className="border p-2">Phone</th>
            <th className="border p-2">Wait Time</th>
            <th className="border p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {queue.map((patient) => (
            <PatientRow key={patient.id} patient={patient} />
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

**Deliverables:**
- Working staff dashboard with authentication
- Queue management interface
- Real-time updates integration
- Patient operation buttons (call, complete)

**Requirements:** _Requirement 4 (Basic Staff Dashboard)_

---

## Day 9: Integration Testing and Bug Fixes

### Task 9.1: End-to-End Integration and Testing
**Priority:** P0 | **Estimate:** 1 day | **Status:** Not Started

**Description:** Test complete system integration and fix critical bugs found during testing.

**Acceptance Criteria:**
- [ ] Test complete patient journey: check-in → SMS → position updates → called → completed
- [ ] Test staff workflow: view queue → call patient → mark completed
- [ ] Verify real-time updates work across mobile app, web portal, and staff dashboard
- [ ] Test SMS notifications for all scenarios (check-in, get ready, call now)
- [ ] Test error scenarios: invalid inputs, network failures, duplicate check-ins
- [ ] Verify WebSocket reconnection after connection loss
- [ ] Test concurrent users (multiple patients checking in simultaneously)
- [ ] Fix any critical bugs found during testing
- [ ] Create basic unit tests for core queue logic

**Testing Scenarios:**
```typescript
// Integration test example
describe('Complete Patient Journey', () => {
  it('should handle patient from check-in to completion', async () => {
    // 1. Patient checks in via mobile app
    const checkInResponse = await request(app)
      .post('/api/checkin')
      .send({
        name: 'John Doe',
        phone: '+1234567890',
        appointmentTime: '2:00 PM'
      });
    
    expect(checkInResponse.status).toBe(201);
    expect(checkInResponse.body.data.position).toBe(1);
    
    // 2. Verify SMS was sent
    // 3. Staff calls next patient
    // 4. Verify patient receives call SMS
    // 5. Staff marks patient as completed
    // 6. Verify patient is removed from queue
  });
});
```

**Deliverables:**
- Fully tested end-to-end workflows
- Critical bug fixes implemented
- Basic test suite for core functionality
- System ready for pilot deployment

**Requirements:** _All requirements (1-6) integration testing_

---

## Day 10: Deployment and Documentation

### Task 10.1: Production Deployment and Documentation
**Priority:** P0 | **Estimate:** 1 day | **Status:** Not Started

**Description:** Deploy MVP to production environment and create essential documentation.

**Acceptance Criteria:**
- [ ] Set up production server with Docker Compose
- [ ] Configure production environment variables and secrets
- [ ] Deploy all services (API, web portal, staff dashboard) to production
- [ ] Set up production database with proper backups
- [ ] Configure Twilio SMS service for production
- [ ] Test production deployment with real SMS and queue operations
- [ ] Create deployment documentation and runbook
- [ ] Create user guides for patients and staff
- [ ] Set up basic monitoring and health checks
- [ ] Create troubleshooting guide for common issues

**Production Deployment:**
```bash
# Production deployment script
#!/bin/bash

# Pull latest code
git pull origin main

# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy with zero downtime
docker-compose -f docker-compose.prod.yml up -d

# Run database migrations
docker-compose exec api npm run migrate

# Verify deployment
curl -f http://localhost:3001/health || exit 1
curl -f http://localhost:3000/health || exit 1
```

**Documentation Deliverables:**
- Production deployment guide
- Patient user guide (how to check in and track status)
- Staff user guide (how to manage queue)
- Troubleshooting and FAQ document
- API documentation for future integrations

**Requirements:** _All requirements (1-6) production ready_

---

## Success Criteria

### Technical Completion
- [ ] All 6 requirements fully implemented and tested
- [ ] Mobile app, web portal, and staff dashboard working
- [ ] SMS notifications working for all scenarios
- [ ] Real-time updates functioning across all interfaces
- [ ] Production deployment successful and stable

### Performance Targets
- [ ] Check-in completion time: <15 seconds
- [ ] Real-time update propagation: <10 seconds
- [ ] SMS delivery: <30 seconds
- [ ] Staff dashboard response: <2 seconds
- [ ] System handles 20 concurrent users without issues

### User Experience Validation
- [ ] Patients can check in with <3 taps/clicks
- [ ] Staff can manage queue with minimal training
- [ ] SMS messages are clear and actionable
- [ ] Real-time updates work reliably
- [ ] Error messages are helpful and clear

### Business Readiness
- [ ] System can run for full business day (8 hours) without crashes
- [ ] Basic monitoring and health checks in place
- [ ] Documentation sufficient for facility staff training
- [ ] Troubleshooting procedures documented
- [ ] Ready for pilot deployment at healthcare facility

## Risk Mitigation

### Critical Risks and Mitigation
1. **SMS Delivery Failures:** Test Twilio thoroughly, implement retry logic
2. **Real-time Update Issues:** Implement polling fallback, test WebSocket reliability
3. **Database Performance:** Use proper indexes, test with realistic data volumes
4. **Mobile App Issues:** Use Expo for faster development, test on multiple devices
5. **Timeline Pressure:** Focus on core functionality, defer nice-to-have features

### Contingency Plans
- **If SMS fails:** Continue with app-only notifications
- **If real-time fails:** Use 30-second polling as backup
- **If mobile app issues:** Focus on web portal as primary interface
- **If deployment issues:** Use local development environment for demo

## Daily Deliverables Summary

- **Day 1:** Working database and API foundation
- **Day 2:** Patient check-in and queue management APIs
- **Day 3:** Staff dashboard APIs and authentication
- **Day 4:** SMS notifications for all scenarios
- **Day 5:** Real-time WebSocket updates
- **Day 6:** React Native mobile app
- **Day 7:** Next.js web portal
- **Day 8:** Staff dashboard interface
- **Day 9:** Integration testing and bug fixes
- **Day 10:** Production deployment and documentation

Each day builds on the previous day's work, ensuring continuous progress toward a working MVP that can be demonstrated and deployed to a real healthcare facility.
# SmartWait MVP Requirements

## Introduction

This MVP focuses on delivering the core value proposition of SmartWait: eliminating physical waiting through virtual queue management. The MVP will demonstrate essential functionality that can be built in 10 days with 100 usage credits while providing immediate value to healthcare facilities.

## MVP Scope Constraints

- **Timeline:** 10 days maximum
- **Budget:** 100 usage credits
- **Team:** 1 developer (AI-assisted)
- **Focus:** Core queue management functionality only
- **Deployment:** Single facility pilot ready

## Requirements

### Requirement 1: Basic Patient Check-In

**User Story:** As a patient, I want to check in for my appointment using my mobile phone so that I can avoid waiting in crowded reception areas.

#### Acceptance Criteria

1. WHEN a patient opens the mobile app THEN the system SHALL display a simple check-in form requiring name, phone number, and appointment time
2. WHEN a patient submits check-in information THEN the system SHALL validate the data and add them to the queue
3. WHEN a patient successfully checks in THEN the system SHALL display their queue position and estimated wait time
4. WHEN a patient checks in THEN the system SHALL send them a confirmation SMS with their queue number

### Requirement 2: Web-Based Check-In Alternative

**User Story:** As a patient without the mobile app, I want to check in using a web browser so that I have an alternative check-in method.

#### Acceptance Criteria

1. WHEN a patient visits the check-in web portal THEN the system SHALL display the same check-in form as the mobile app
2. WHEN a patient completes web check-in THEN the system SHALL provide the same queue position and wait time information
3. WHEN a patient bookmarks the web portal THEN the system SHALL allow them to check their queue status later

### Requirement 3: Real-Time Queue Management

**User Story:** As a healthcare facility, I want patients to be automatically managed in a virtual queue so that I can process them efficiently without manual intervention.

#### Acceptance Criteria

1. WHEN patients check in THEN the system SHALL automatically assign them sequential queue positions
2. WHEN a patient is processed THEN the system SHALL automatically advance all remaining patients' positions
3. WHEN queue positions change THEN the system SHALL update all patients within 10 seconds
4. WHEN a patient's turn approaches THEN the system SHALL send them a "ready soon" notification

### Requirement 4: Basic Staff Dashboard

**User Story:** As reception staff, I want a simple dashboard to manage the patient queue so that I can call patients and track their status.

#### Acceptance Criteria

1. WHEN staff access the dashboard THEN the system SHALL display all patients in queue order with their information
2. WHEN staff click "Call Next Patient" THEN the system SHALL identify the next patient and send them a notification
3. WHEN staff mark a patient as "completed" THEN the system SHALL remove them from the queue and advance others
4. WHEN staff need to see patient details THEN the system SHALL display name, phone, check-in time, and wait duration

### Requirement 5: SMS Notifications

**User Story:** As a patient, I want to receive text message updates about my queue status so that I stay informed without constantly checking the app.

#### Acceptance Criteria

1. WHEN a patient checks in THEN the system SHALL send an SMS confirmation with queue position
2. WHEN a patient is 2 positions away from being called THEN the system SHALL send a "get ready" SMS
3. WHEN it's a patient's turn THEN the system SHALL send an immediate "come in now" SMS
4. WHEN a patient doesn't respond within 10 minutes THEN the system SHALL send a follow-up SMS

### Requirement 6: Real-Time Position Updates

**User Story:** As a patient, I want to see my current queue position update automatically so that I know my status without refreshing.

#### Acceptance Criteria

1. WHEN a patient views their queue status THEN the system SHALL display real-time position updates
2. WHEN other patients are processed THEN the system SHALL automatically update the patient's position
3. WHEN the estimated wait time changes THEN the system SHALL display the updated time within 30 seconds
4. WHEN the app loses connection THEN the system SHALL show connection status and retry automatically

## Non-Functional Requirements

### Performance Requirements
- Check-in completion: Maximum 15 seconds
- Real-time updates: Maximum 10 seconds propagation
- Dashboard response: Maximum 2 seconds
- SMS delivery: Maximum 30 seconds

### Scalability Requirements
- Support 100 patients per day (MVP scale)
- Handle 20 concurrent users
- Support 1 healthcare facility

### Security Requirements
- Basic data encryption in transit (HTTPS)
- Simple authentication for staff dashboard
- No PHI storage (names and phone numbers only)
- Basic input validation and sanitization

### Usability Requirements
- Mobile app: Maximum 3 taps to check in
- Web portal: Works on all modern browsers
- Staff dashboard: Intuitive interface requiring minimal training
- SMS: Clear, concise messages under 160 characters

## Out of Scope for MVP

The following features are explicitly excluded from the MVP to maintain focus and timeline:

- Insurance card scanning
- EHR/PMS integration
- Advanced analytics and reporting
- Location-based services
- Multiple facility support
- Advanced security features (HIPAA compliance)
- Voice assistance
- Digital signage
- Advanced notification preferences
- Payment processing
- Appointment scheduling integration
- Multi-language support
- Accessibility features beyond basic compliance
- Advanced queue optimization algorithms
- Machine learning predictions
- Detailed audit logging
- Advanced staff roles and permissions

## Success Criteria

### MVP Success Metrics
- **Functional Completeness:** All 6 requirements fully implemented and tested
- **Performance:** Meets all non-functional requirements
- **Usability:** Staff can use dashboard with <10 minutes training
- **Reliability:** System runs for 8 hours without crashes
- **User Experience:** Patients can check in and receive updates successfully

### Business Validation Metrics
- **Check-in Success Rate:** >95% of attempts successful
- **Staff Adoption:** Reception staff prefer dashboard over manual tracking
- **Patient Satisfaction:** Positive feedback on queue visibility and updates
- **Time Savings:** Measurable reduction in manual queue management time

## Technical Constraints

### Technology Stack (Simplified for MVP)
- **Backend:** Node.js with Express (single service)
- **Database:** PostgreSQL (single database)
- **Cache:** Redis (for real-time updates)
- **Mobile:** React Native with Expo (faster development)
- **Web:** Next.js (SSR for performance)
- **Notifications:** Twilio SMS (simple integration)
- **Real-time:** Socket.io (simpler than Kafka)
- **Deployment:** Single server deployment (not distributed)

### Development Constraints
- **No microservices:** Single API service for simplicity
- **Minimal external integrations:** Only Twilio for SMS
- **Basic UI/UX:** Functional but not polished design
- **Limited error handling:** Basic error scenarios only
- **No advanced testing:** Unit tests for critical paths only
- **Simple deployment:** Manual deployment acceptable for MVP

## Risk Mitigation

### High-Risk Items
1. **SMS delivery reliability:** Use Twilio with delivery confirmations
2. **Real-time update performance:** Use Redis pub/sub with Socket.io
3. **Mobile app complexity:** Use Expo for faster development
4. **Timeline pressure:** Focus on core functionality only

### Contingency Plans
1. **If SMS fails:** Fall back to app-only notifications
2. **If real-time fails:** Use polling as backup
3. **If mobile app issues:** Focus on web portal
4. **If timeline slips:** Remove SMS notifications to save time

## Acceptance Testing Scenarios

### Scenario 1: Happy Path Patient Journey
1. Patient opens mobile app
2. Patient enters name, phone, appointment time
3. Patient receives queue position and SMS confirmation
4. Patient receives "get ready" SMS when 2nd in line
5. Patient receives "come in now" SMS when called
6. Staff marks patient as completed

### Scenario 2: Staff Dashboard Usage
1. Staff opens dashboard and sees patient queue
2. Staff clicks "Call Next Patient"
3. System sends SMS to next patient
4. Staff marks patient as completed when done
5. Queue automatically updates for remaining patients

### Scenario 3: Real-Time Updates
1. Multiple patients check in simultaneously
2. All patients see their correct positions
3. When one patient is processed, others see position updates
4. Wait times adjust automatically based on queue movement

## Definition of Done

The MVP is considered complete when:

1. **All 6 requirements are implemented** and pass acceptance criteria
2. **Basic testing is completed** for happy path scenarios
3. **Performance requirements are met** under light load
4. **SMS notifications work reliably** for all queue events
5. **Staff dashboard is functional** and intuitive
6. **Real-time updates work** across mobile and web
7. **System can run continuously** for a full business day
8. **Documentation exists** for deployment and basic usage

This MVP provides the foundation for validating the core SmartWait concept while staying within the 10-day, 100-credit constraint.
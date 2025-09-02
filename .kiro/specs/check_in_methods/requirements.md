# Check-In Methods Requirements

## User Stories and Acceptance Criteria

### Epic: Multi-Channel Patient Check-In System
As a healthcare facility, we want to provide multiple convenient check-in methods so that patients can join queues efficiently while reducing physical crowding and improving patient satisfaction.

---

## Story 1: Mobile App Check-In

### User Story
As a patient, I want to check in for my appointment using a mobile app so that I can avoid waiting in crowded reception areas and manage my visit remotely.

### Acceptance Criteria (EARS Notation)

**WHEN** a patient opens the mobile app THE SYSTEM SHALL display their upcoming appointments for the current day

**WHEN** a patient selects an appointment to check in THE SYSTEM SHALL verify the appointment exists and is within the check-in window (2 hours before to 30 minutes after scheduled time)

**WHEN** a patient confirms check-in THE SYSTEM SHALL add them to the appropriate queue and display their queue position and estimated wait time

**WHEN** a patient checks in successfully THE SYSTEM SHALL send a confirmation notification with queue details and next steps

**WHEN** a patient attempts to check in outside the allowed time window THE SYSTEM SHALL display an appropriate error message and suggest alternative actions

**WHEN** a patient has multiple appointments on the same day THE SYSTEM SHALL display all eligible appointments with clear distinction between them

**WHEN** a patient checks in THE SYSTEM SHALL update their status in the EHR/PMS system if integration is available

---

## Story 2: QR Code Check-In

### User Story
As a patient, I want to scan a QR code to quickly check in so that I can use any smartphone without downloading an app.

### Acceptance Criteria (EARS Notation)

**WHEN** a patient scans a facility QR code THE SYSTEM SHALL redirect them to a secure web-based check-in portal

**WHEN** a patient enters their identification information (MRN, DOB, or phone number) THE SYSTEM SHALL validate the information and retrieve their appointment details

**WHEN** patient information is validated THE SYSTEM SHALL display their appointment(s) available for check-in

**WHEN** a patient confirms check-in via QR code portal THE SYSTEM SHALL add them to the queue and display their unique queue tracking number

**WHEN** a patient bookmarks or saves the QR code check-in link THE SYSTEM SHALL maintain session security while allowing quick re-access

**WHEN** multiple patients scan the same QR code simultaneously THE SYSTEM SHALL handle concurrent check-ins without conflicts

**WHEN** a patient scans an invalid or expired QR code THE SYSTEM SHALL display clear instructions for obtaining a valid code

---

## Story 3: Self-Service Kiosk Check-In

### User Story
As a patient, I want to use a self-service kiosk in the facility lobby so that I can check in without interacting with reception staff when preferred.

### Acceptance Criteria (EARS Notation)

**WHEN** a patient approaches a kiosk THE SYSTEM SHALL display a welcome screen with clear check-in instructions in multiple languages

**WHEN** a patient selects their preferred language THE SYSTEM SHALL update all interface elements to the selected language

**WHEN** a patient enters their identification method (scan insurance card, enter MRN, or phone lookup) THE SYSTEM SHALL validate and retrieve appointment information

**WHEN** identification is successful THE SYSTEM SHALL display appointment details and check-in options with large, accessible buttons

**WHEN** a patient confirms check-in THE SYSTEM SHALL print a queue ticket with their number, estimated wait time, and instructions

**WHEN** a patient needs assistance at the kiosk THE SYSTEM SHALL provide a help button that alerts nearby staff

**WHEN** a patient session expires on the kiosk THE SYSTEM SHALL automatically return to the welcome screen and clear all personal information

**WHEN** multiple appointments exist for the same patient THE SYSTEM SHALL display all options with clear appointment details (time, provider, department)

---

## Story 4: Web Portal Check-In

### User Story
As a patient, I want to check in using a web browser on my computer or mobile device so that I have flexibility in how I access the check-in system.

### Acceptance Criteria (EARS Notation)

**WHEN** a patient visits the check-in web portal THE SYSTEM SHALL display a responsive interface optimized for their device type

**WHEN** a patient enters their login credentials or guest check-in information THE SYSTEM SHALL authenticate securely and retrieve appointment data

**WHEN** authentication is successful THE SYSTEM SHALL display a dashboard with upcoming appointments and check-in status

**WHEN** a patient initiates check-in THE SYSTEM SHALL validate appointment eligibility and guide them through the check-in process

**WHEN** a patient completes web portal check-in THE SYSTEM SHALL provide confirmation details and queue tracking information

**WHEN** a patient loses internet connection during check-in THE SYSTEM SHALL save progress locally and resume when connection is restored

**WHEN** a patient accesses the portal on a shared computer THE SYSTEM SHALL provide clear security warnings and auto-logout functionality

---

## Story 5: Voice-Assisted Check-In

### User Story
As a patient with accessibility needs, I want to check in using voice commands so that I can use the system regardless of visual or motor limitations.

### Acceptance Criteria (EARS Notation)

**WHEN** a patient activates voice check-in THE SYSTEM SHALL provide clear audio prompts in the patient's preferred language

**WHEN** a patient speaks their identification information THE SYSTEM SHALL use speech recognition to capture and validate the data

**WHEN** voice recognition is unclear THE SYSTEM SHALL ask for clarification using natural language prompts

**WHEN** patient identification is confirmed THE SYSTEM SHALL read aloud appointment details and check-in options

**WHEN** a patient confirms check-in via voice THE SYSTEM SHALL provide audio confirmation with queue details and next steps

**WHEN** a patient requests help during voice check-in THE SYSTEM SHALL connect them to staff assistance or provide additional guidance

**WHEN** background noise interferes with voice recognition THE SYSTEM SHALL adjust sensitivity and provide alternative input methods

---

## Story 6: Insurance Card Integration

### User Story
As a patient, I want to scan my insurance card during check-in so that my coverage can be verified automatically and my information updated.

### Acceptance Criteria (EARS Notation)

**WHEN** a patient initiates insurance card scanning THE SYSTEM SHALL activate the camera with appropriate guidance for card positioning

**WHEN** an insurance card is successfully scanned THE SYSTEM SHALL extract relevant information using OCR and validate format

**WHEN** card information is extracted THE SYSTEM SHALL verify insurance eligibility in real-time with the patient's insurance provider

**WHEN** insurance verification is successful THE SYSTEM SHALL update patient records and display coverage details

**WHEN** insurance verification fails THE SYSTEM SHALL display clear error messages and suggest next steps (contact insurance, pay out-of-pocket, etc.)

**WHEN** a patient's insurance information has changed THE SYSTEM SHALL prompt for confirmation and update records accordingly

**WHEN** card scanning fails due to poor image quality THE SYSTEM SHALL provide guidance for better positioning and lighting

---

## Story 7: Walk-In Patient Check-In

### User Story
As a walk-in patient without an appointment, I want to check in and join a queue so that I can be seen based on availability and urgency.

### Acceptance Criteria (EARS Notation)

**WHEN** a walk-in patient initiates check-in THE SYSTEM SHALL display available departments and providers accepting walk-ins

**WHEN** a walk-in patient selects a department THE SYSTEM SHALL show current wait times and availability

**WHEN** a walk-in patient provides their information THE SYSTEM SHALL create a temporary appointment slot and add them to the appropriate queue

**WHEN** a walk-in patient joins the queue THE SYSTEM SHALL assign them a priority based on urgency and arrival time

**WHEN** urgent symptoms are indicated THE SYSTEM SHALL escalate the patient appropriately and alert clinical staff

**WHEN** a walk-in patient checks in THE SYSTEM SHALL estimate wait time based on current queue length and provider availability

**WHEN** no walk-in slots are available THE SYSTEM SHALL offer alternative options (schedule future appointment, different location, etc.)

---

## Story 8: Group/Family Check-In

### User Story
As a patient bringing family members, I want to check in multiple people at once so that we can coordinate our visits efficiently.

### Acceptance Criteria (EARS Notation)

**WHEN** a patient initiates group check-in THE SYSTEM SHALL allow selection of multiple appointments under the same account

**WHEN** multiple appointments are selected THE SYSTEM SHALL validate each appointment and check for conflicts

**WHEN** group check-in is confirmed THE SYSTEM SHALL add all patients to their respective queues simultaneously

**WHEN** family members have appointments at different times THE SYSTEM SHALL coordinate notifications to minimize waiting room time

**WHEN** one appointment in a group is delayed THE SYSTEM SHALL notify the group and adjust other appointment expectations

**WHEN** appointments are in different departments THE SYSTEM SHALL provide clear wayfinding information for each location

**WHEN** minors are included in group check-in THE SYSTEM SHALL ensure appropriate consent and guardian information is captured

---

## Story 9: Check-In Status Updates

### User Story
As a patient, I want to receive real-time updates about my check-in status so that I stay informed about any changes to my queue position or wait time.

### Acceptance Criteria (EARS Notation)

**WHEN** a patient's queue position changes THE SYSTEM SHALL send an updated notification with new position and estimated wait time

**WHEN** delays occur that affect wait times THE SYSTEM SHALL proactively notify affected patients with updated estimates

**WHEN** a patient's turn is approaching THE SYSTEM SHALL send advance notice (15 minutes before) to allow travel time

**WHEN** it's time for a patient's appointment THE SYSTEM SHALL send immediate notification with room number and instructions

**WHEN** a patient misses their notification THE SYSTEM SHALL implement escalating alerts (push, SMS, voice call if configured)

**WHEN** appointment cancellations affect queue timing THE SYSTEM SHALL recalculate and update all affected patients' wait times

**WHEN** emergency situations prioritize other patients THE SYSTEM SHALL explain delays respectfully and provide updated estimates

---

## Story 10: Administrative Check-In Management

### User Story
As reception staff, I want to manually manage patient check-ins so that I can assist patients who need help or handle special circumstances.

### Acceptance Criteria (EARS Notation)

**WHEN** staff accesses the check-in management interface THE SYSTEM SHALL display all patients eligible for check-in with their appointment details

**WHEN** staff manually checks in a patient THE SYSTEM SHALL add them to the queue and send appropriate notifications

**WHEN** staff needs to modify a check-in THE SYSTEM SHALL allow authorized changes with audit logging

**WHEN** patients require special accommodations THE SYSTEM SHALL allow staff to add notes and priority flags

**WHEN** technical issues prevent self-service check-in THE SYSTEM SHALL provide staff with backup check-in procedures

**WHEN** staff assists with check-in THE SYSTEM SHALL log the interaction for quality and training purposes

**WHEN** patients have complex scheduling needs THE SYSTEM SHALL allow staff to coordinate multiple appointments and services

---

## Non-Functional Requirements

### Performance Requirements
- Check-in completion time: Maximum 30 seconds for 95% of transactions
- System response time: Maximum 2 seconds for check-in operations
- Concurrent user support: Minimum 500 simultaneous check-ins
- Offline capability: Mobile app functions without internet for basic operations

### Security Requirements
- All check-in data encrypted in transit and at rest
- Patient authentication required for personal information access
- Session timeout after 10 minutes of inactivity
- Audit logging for all check-in activities

### Accessibility Requirements
- WCAG 2.1 AA compliance for all check-in interfaces
- Screen reader compatibility
- Voice command support
- Large text and high contrast options
- Multi-language support (minimum 5 languages)

### Integration Requirements
- Real-time synchronization with EHR/PMS systems
- Insurance verification within 30 seconds
- Fallback procedures when external systems are unavailable
- Data consistency across all integrated systems
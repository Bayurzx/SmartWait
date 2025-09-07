# QueueService Documentation

## Overview

The `QueueService` class is the core service for managing patient queues in the SmartWait system. It provides comprehensive functionality for patient check-in, position tracking, and queue management operations.

## Features

### ✅ Patient Check-in
- Validates patient information (name, phone, appointment time)
- Prevents duplicate check-ins with the same phone number
- Automatically assigns sequential queue positions
- Calculates estimated wait times based on position

### ✅ Position Tracking
- Real-time position queries for patients
- Automatic position recalculation when queue changes
- Status tracking (waiting, called, completed, no_show)

### ✅ Queue Management
- Retrieve full queue for staff dashboard
- Call next patient functionality
- Mark patients as completed
- Automatic position advancement when patients are processed

### ✅ Statistics and Analytics
- Queue statistics (waiting, called, completed counts)
- Average and longest wait time calculations
- Real-time queue metrics

## API Methods

### `checkIn(data: CheckInRequest): Promise<QueuePosition>`
Checks in a new patient to the queue.

**Parameters:**
- `data.name` (string): Patient's full name (1-100 characters)
- `data.phone` (string): Patient's phone number (10-20 characters, various formats supported)
- `data.appointmentTime` (string): Appointment time description

**Returns:** Queue position information including patient ID, position, and estimated wait time

**Throws:** Validation errors, duplicate phone number errors

### `getPosition(patientId: string): Promise<QueueStatus>`
Retrieves current position and status for a patient.

**Parameters:**
- `patientId` (string): UUID of the patient

**Returns:** Current queue status with position, estimated wait time, and timestamps

**Throws:** Patient not found errors

### `getQueue(): Promise<QueuePosition[]>`
Gets the full queue with all active patients (waiting and called).

**Returns:** Array of queue positions ordered by position number

### `callNextPatient(): Promise<PatientCallResult>`
Calls the next patient in the queue (changes status from 'waiting' to 'called').

**Returns:** Information about the called patient or failure message if no patients waiting

### `markPatientCompleted(patientId: string): Promise<void>`
Marks a patient as completed and removes them from the active queue.

**Parameters:**
- `patientId` (string): UUID of the patient to mark as completed

**Side Effects:** Recalculates positions for remaining patients

### `getQueueStats(): Promise<QueueStats>`
Retrieves comprehensive queue statistics.

**Returns:** Statistics including counts by status and wait time metrics

## Input Validation

The service uses Joi schema validation for all inputs:

- **Name:** Required, 1-100 characters, trimmed
- **Phone:** Required, 10-20 characters, supports formats like:
  - `+1234567890`
  - `(123) 456-7890`
  - `123-456-7890`
  - `123 456 7890`
- **Appointment Time:** Required, 1-50 characters

## Error Handling

The service provides comprehensive error handling:

- **Validation Errors:** Invalid input data format
- **Business Logic Errors:** Duplicate check-ins, patient not found
- **Database Errors:** Connection issues, constraint violations

All errors include descriptive messages for proper API response handling.

## Wait Time Calculation

The service calculates estimated wait times using a simple algorithm:
- **Formula:** `(position - 1) × 15 minutes`
- **First position:** 0 minutes wait
- **Second position:** 15 minutes wait
- **Third position:** 30 minutes wait

This can be enhanced with historical data and machine learning in future versions.

## Database Integration

The service uses Prisma ORM for database operations:
- **Transactions:** Used for atomic operations (patient creation + queue position)
- **Constraints:** Enforces unique position constraints for active patients
- **Relationships:** Proper foreign key relationships between patients and queue positions

## Testing

The service includes comprehensive unit tests covering:
- ✅ Input validation scenarios
- ✅ Happy path operations
- ✅ Error conditions
- ✅ Edge cases (empty queue, duplicate patients)
- ✅ Position calculation logic

Run tests with: `npm test -- --testPathPattern=queue-service.test.ts`

## Usage Example

```typescript
import { QueueService } from './queue-service';

const queueService = new QueueService();

// Check in a patient
const queuePosition = await queueService.checkIn({
  name: 'John Doe',
  phone: '+1234567890',
  appointmentTime: '2:00 PM'
});

// Get patient's current position
const status = await queueService.getPosition(queuePosition.patientId);

// Call next patient (staff operation)
const result = await queueService.callNextPatient();

// Mark patient as completed
await queueService.markPatientCompleted(queuePosition.patientId);
```

## Performance Considerations

- **Database Indexes:** Ensure proper indexing on `position`, `status`, and `patientId` fields
- **Connection Pooling:** Uses Prisma's built-in connection pooling
- **Query Optimization:** Efficient queries with proper WHERE clauses and ordering
- **Transaction Usage:** Minimal transaction scope for better performance

## Future Enhancements

- **Smart Wait Time Prediction:** Machine learning-based wait time estimation
- **Priority Queues:** Support for different appointment types and priorities
- **Queue Capacity Management:** Maximum queue size limits
- **Historical Analytics:** Detailed reporting and trend analysis
- **Real-time Notifications:** Integration with notification service for automatic updates
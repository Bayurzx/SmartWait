---
inclusion: always
---

# Integration Patterns

## Healthcare System Integration Standards

### Electronic Health Record (EHR) Integration

#### HL7 FHIR Standards
All EHR integrations must follow HL7 FHIR R4 standards:
- **Patient Resource**: Standard patient demographics and identifiers
- **Appointment Resource**: Scheduled and walk-in appointment data
- **Encounter Resource**: Patient visit tracking and status
- **Practitioner Resource**: Healthcare provider information
- **Organization Resource**: Facility and department data

```typescript
// FHIR Patient Resource mapping
interface FHIRPatient {
  resourceType: 'Patient';
  id: string;
  identifier: PatientIdentifier[];
  name: HumanName[];
  telecom: ContactPoint[];
  gender: 'male' | 'female' | 'other' | 'unknown';
  birthDate: string; // YYYY-MM-DD format
  address: Address[];
}

// Queue system patient mapping
const mapFHIRToQueuePatient = (fhirPatient: FHIRPatient): QueuePatient => ({
  id: fhirPatient.id,
  mrn: fhirPatient.identifier.find(id => id.type?.coding?.[0]?.code === 'MR')?.value,
  firstName: fhirPatient.name[0]?.given?.[0],
  lastName: fhirPatient.name[0]?.family,
  phone: fhirPatient.telecom.find(t => t.system === 'phone')?.value,
  email: fhirPatient.telecom.find(t => t.system === 'email')?.value
});
```

#### EHR Integration Patterns
- **Real-time Sync**: Use webhooks for immediate updates
- **Batch Processing**: Scheduled synchronization for bulk data
- **Event-driven**: React to appointment changes and updates
- **Fallback Mechanisms**: Handle EHR downtime gracefully

### Practice Management System (PMS) Integration

#### Appointment Synchronization
```typescript
// PMS appointment sync pattern
interface PMSAppointment {
  appointmentId: string;
  patientId: string;
  providerId: string;
  scheduledTime: string;
  duration: number; // minutes
  appointmentType: string;
  status: 'scheduled' | 'confirmed' | 'checked-in' | 'in-progress' | 'completed' | 'cancelled';
  department: string;
}

// Sync workflow
const syncAppointments = async () => {
  const appointments = await pmsClient.getAppointments(today);
  
  for (const apt of appointments) {
    await queueService.upsertAppointment({
      ...apt,
      estimatedWaitTime: calculateWaitTime(apt),
      queuePosition: calculatePosition(apt)
    });
  }
};
```

#### Billing Integration
- **Insurance Verification**: Real-time eligibility checks
- **Co-pay Collection**: Integrate with payment processors
- **Claim Submission**: Automatic claim generation post-visit
- **Revenue Reporting**: Financial impact tracking

## Third-Party Service Integration

### Communication Services

#### SMS Gateway Integration
```typescript
// SMS service abstraction
interface SMSProvider {
  sendMessage(to: string, message: string): Promise<SMSResult>;
  getDeliveryStatus(messageId: string): Promise<DeliveryStatus>;
  validatePhoneNumber(phone: string): boolean;
}

class TwilioSMSProvider implements SMSProvider {
  async sendMessage(to: string, message: string): Promise<SMSResult> {
    // HIPAA-compliant SMS sending
    const result = await this.client.messages.create({
      to: this.formatPhoneNumber(to),
      body: this.sanitizeMessage(message),
      from: this.fromNumber
    });
    
    return { messageId: result.sid, status: 'sent' };
  }
}
```

#### Email Service Integration
- **Transactional Emails**: Appointment confirmations, queue updates
- **Template Management**: Branded, compliant email templates
- **Delivery Tracking**: Monitor email delivery and engagement
- **Unsubscribe Management**: Honor patient communication preferences

#### Push Notification Services
- **iOS**: Apple Push Notification Service (APNs)
- **Android**: Firebase Cloud Messaging (FCM)
- **Web**: Web Push API for PWA notifications
- **Fallback**: SMS backup for failed push notifications

### Payment Processing Integration

#### Payment Gateway Standards
```typescript
// PCI-compliant payment processing
interface PaymentProcessor {
  processPayment(amount: number, paymentMethod: string): Promise<PaymentResult>;
  refundPayment(transactionId: string, amount?: number): Promise<RefundResult>;
  savePaymentMethod(customerId: string, paymentMethod: string): Promise<string>;
}

// Tokenization for PCI compliance
const tokenizePaymentMethod = async (paymentData: PaymentData): Promise<string> => {
  // Never store raw payment data - use tokenization
  return await paymentGateway.tokenize(paymentData);
};
```

## API Integration Architecture

### Integration Layer Design

#### Service Abstraction Pattern
```typescript
// Abstract service interfaces for swappable integrations
abstract class EHRService {
  abstract getPatient(id: string): Promise<Patient>;
  abstract updatePatient(patient: Patient): Promise<void>;
  abstract getAppointments(date: Date): Promise<Appointment[]>;
}

class EpicEHRService extends EHRService {
  // Epic-specific implementation
}

class CernerEHRService extends EHRService {
  // Cerner-specific implementation
}

// Dependency injection for flexibility
const ehrService = container.get<EHRService>('EHRService');
```

#### Circuit Breaker Pattern
```typescript
// Protect against external service failures
class CircuitBreaker {
  private failureCount = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private nextAttempt = Date.now();

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is open');
      }
      this.state = 'half-open';
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
}
```

### Data Synchronization Patterns

#### Event-Driven Architecture
```typescript
// Event-based integration for real-time updates
interface IntegrationEvent {
  eventType: string;
  entityType: string;
  entityId: string;
  timestamp: string;
  data: Record<string, any>;
  source: string;
}

// Event handlers for different systems
const eventHandlers = {
  'patient.updated': handlePatientUpdate,
  'appointment.scheduled': handleAppointmentScheduled,
  'appointment.cancelled': handleAppointmentCancelled,
  'provider.unavailable': handleProviderUnavailable
};
```

#### Conflict Resolution
- **Last Write Wins**: For non-critical data updates
- **Merge Strategies**: For complex data structures
- **Manual Resolution**: For critical conflicts requiring human intervention
- **Audit Trail**: Track all conflict resolutions

## Integration Security

### Authentication Patterns

#### OAuth 2.0 for Healthcare APIs
```typescript
// OAuth client configuration for healthcare APIs
const oauthConfig = {
  clientId: process.env.EHR_CLIENT_ID,
  clientSecret: process.env.EHR_CLIENT_SECRET,
  scope: 'patient/read appointment/read appointment/write',
  tokenEndpoint: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token',
  authEndpoint: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize'
};
```

#### API Key Management
- **Rotation Policy**: Quarterly key rotation for all external services
- **Environment Separation**: Different keys for dev/staging/production
- **Secret Management**: Use AWS Secrets Manager or Azure Key Vault
- **Access Logging**: Log all API key usage and access

### Data Validation and Sanitization

#### Input Validation
```typescript
// Strict validation for external data
const validateEHRPatient = (data: any): ValidationResult => {
  const schema = joi.object({
    id: joi.string().required(),
    mrn: joi.string().pattern(/^[A-Z0-9]{6,12}$/).required(),
    firstName: joi.string().min(1).max(50).required(),
    lastName: joi.string().min(1).max(50).required(),
    birthDate: joi.date().iso().required(),
    phone: joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).optional(),
    email: joi.string().email().optional()
  });

  return schema.validate(data);
};
```

#### Output Sanitization
- **PHI Filtering**: Remove sensitive data for external APIs
- **Data Masking**: Partial masking for non-essential integrations
- **Field Encryption**: Encrypt sensitive fields in transit
- **Audit Logging**: Log all data transformations

## Error Handling and Resilience

### Retry Strategies
```typescript
// Exponential backoff with jitter
const retryWithBackoff = async <T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 0.1 * delay;
      await new Promise(resolve => setTimeout(resolve, delay + jitter));
    }
  }
};
```

### Graceful Degradation
- **EHR Unavailable**: Use cached patient data with warnings
- **PMS Down**: Allow manual queue management
- **SMS Failed**: Fallback to push notifications or email
- **Payment Issues**: Queue hold with payment retry options

### Integration Monitoring
```typescript
// Health check endpoints for all integrations
interface IntegrationHealth {
  service: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTime: number;
  lastChecked: string;
  errorCount: number;
  uptime: number;
}

const monitorIntegrations = async (): Promise<IntegrationHealth[]> => {
  return Promise.all([
    checkEHRHealth(),
    checkPMSHealth(),
    checkSMSHealth(),
    checkPaymentHealth()
  ]);
};
```

## Integration Testing

### Test Strategies
- **Contract Testing**: Verify API contracts with Pact or similar
- **Integration Tests**: End-to-end workflow testing
- **Load Testing**: Verify integration performance under load
- **Chaos Engineering**: Test resilience to integration failures

### Mock Services
```typescript
// Mock EHR service for testing
class MockEHRService extends EHRService {
  private patients = new Map<string, Patient>();

  async getPatient(id: string): Promise<Patient> {
    const patient = this.patients.get(id);
    if (!patient) throw new Error('Patient not found');
    return patient;
  }

  // Simulate network delays and failures for testing
  private async simulateNetworkDelay(): Promise<void> {
    if (Math.random() < 0.1) { // 10% failure rate
      throw new Error('Network timeout');
    }
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
  }
}
```

---

*Integration patterns are reviewed monthly and updated based on new healthcare standards and system requirements.*
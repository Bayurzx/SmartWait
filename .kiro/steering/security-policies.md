---
inclusion: always
---

# Security Policies

## HIPAA Compliance Requirements

### Protected Health Information (PHI)
All patient data must be handled according to HIPAA regulations:
- **Encryption at Rest**: All PHI stored in databases must be encrypted using AES-256
- **Encryption in Transit**: All data transmission must use TLS 1.3 or higher
- **Access Logging**: All access to PHI must be logged with user identification
- **Data Minimization**: Only collect and store necessary patient information
- **Retention Policies**: Implement automatic data purging based on retention requirements

### PHI Data Categories
- Personal identifiers (name, SSN, medical record number)
- Demographic information (address, phone, email)
- Medical information (conditions, treatments, appointments)
- Insurance information (policy numbers, coverage details)
- Biometric data (if collected for identification)

### Access Controls
```typescript
// Example RBAC implementation
const PERMISSIONS = {
  PATIENT_READ: 'patient:read',
  PATIENT_WRITE: 'patient:write',
  QUEUE_MANAGE: 'queue:manage',
  PHI_ACCESS: 'phi:access',
  ADMIN_FULL: 'admin:full'
};

const ROLES = {
  PATIENT: [PERMISSIONS.PATIENT_READ],
  STAFF: [PERMISSIONS.PATIENT_READ, PERMISSIONS.QUEUE_MANAGE],
  NURSE: [PERMISSIONS.PATIENT_READ, PERMISSIONS.PATIENT_WRITE, PERMISSIONS.PHI_ACCESS],
  ADMIN: [PERMISSIONS.ADMIN_FULL]
};
```

## Authentication Security

### Password Requirements
- Minimum 12 characters length
- Must include uppercase, lowercase, numbers, and special characters
- No common passwords or dictionary words
- Password history: prevent reuse of last 12 passwords
- Maximum password age: 90 days for staff, 180 days for patients

### Multi-Factor Authentication (MFA)
- **Required for staff accounts**: SMS, authenticator app, or hardware token
- **Optional for patients**: Available but not mandatory
- **Admin accounts**: Hardware token or authenticator app required
- **Emergency access codes**: One-time use backup codes

### Session Management
```typescript
// Session configuration
const SESSION_CONFIG = {
  maxAge: 8 * 60 * 60 * 1000, // 8 hours for staff
  patientMaxAge: 24 * 60 * 60 * 1000, // 24 hours for patients
  secure: true, // HTTPS only
  httpOnly: true, // Prevent XSS
  sameSite: 'strict' // CSRF protection
};
```

## Data Protection

### Encryption Standards
- **Database Encryption**: AES-256 encryption for all PHI columns
- **File Encryption**: AES-256 for uploaded documents
- **API Communication**: TLS 1.3 with perfect forward secrecy
- **Mobile Storage**: iOS Keychain / Android Keystore for sensitive data

### Data Classification
```typescript
// Data sensitivity levels
enum DataClassification {
  PUBLIC = 'public',           // Marketing materials, public documentation
  INTERNAL = 'internal',       // Staff directories, internal communications
  CONFIDENTIAL = 'confidential', // Business plans, financial data
  RESTRICTED = 'restricted'    // PHI, authentication credentials
}

// Data handling rules per classification
const DATA_HANDLING = {
  [DataClassification.RESTRICTED]: {
    encryption: 'AES-256',
    accessLogging: true,
    retentionDays: 2555, // 7 years for medical records
    backupEncryption: true,
    transmissionSecurity: 'TLS 1.3'
  }
};
```

### Data Anonymization
- **Queue Analytics**: Remove direct patient identifiers for reporting
- **Performance Metrics**: Use hashed IDs for patient flow analysis
- **Research Data**: Full de-identification for any research purposes
- **Audit Logs**: Retain audit capability while protecting patient identity

## Network Security

### API Security
- **Rate Limiting**: 100 requests per minute per authenticated user
- **Input Validation**: Strict validation for all API inputs
- **SQL Injection Prevention**: Parameterized queries only
- **XSS Protection**: Content Security Policy headers
- **CORS Configuration**: Restrict to approved domains only

### Network Architecture
```typescript
// API security middleware stack
const SECURITY_MIDDLEWARE = [
  'helmet', // Security headers
  'express-rate-limit', // Rate limiting
  'express-validator', // Input validation
  'express-mongo-sanitize', // NoSQL injection prevention
  'hpp' // HTTP Parameter Pollution prevention
];
```

### Firewall Rules
- **Database Access**: Only from application servers
- **API Endpoints**: Whitelist approved IP ranges
- **Admin Access**: VPN required for administrative functions
- **Monitoring**: Real-time intrusion detection
- **DDoS Protection**: CloudFlare or equivalent protection

## Mobile Application Security

### iOS Security
- **Keychain Storage**: All sensitive data stored in iOS Keychain
- **Certificate Pinning**: Pin SSL certificates to prevent MITM attacks
- **App Transport Security**: Enforce HTTPS for all network calls
- **Biometric Authentication**: Touch ID/Face ID for app access
- **Background Protection**: Hide sensitive content when app backgrounds

### Android Security
- **Android Keystore**: Hardware-backed key storage when available
- **Certificate Pinning**: SSL certificate validation
- **Network Security Config**: Restrict HTTP traffic
- **Screen Recording Protection**: Prevent screenshots of sensitive screens
- **Root Detection**: Block app usage on rooted devices

### Mobile Data Protection
```typescript
// Mobile encryption patterns
const MOBILE_SECURITY = {
  encryptionKey: 'derived-from-user-pin-and-device-id',
  storage: {
    sensitive: 'keychain-only', // Credentials, tokens
    cached: 'encrypted-sqlite', // Queue data, preferences
    temporary: 'memory-only' // Session data
  }
};
```

## Incident Response

### Security Incident Classification
- **Level 1 (Critical)**: PHI breach, system compromise, ransomware
- **Level 2 (High)**: Unauthorized access attempt, data integrity issue
- **Level 3 (Medium)**: Policy violation, suspicious activity
- **Level 4 (Low)**: Failed login attempts, minor configuration issues

### Response Procedures
1. **Immediate Response** (0-4 hours)
   - Contain the incident and prevent further damage
   - Assess scope and impact
   - Notify incident response team
   - Document all actions taken

2. **Investigation** (4-24 hours)
   - Forensic analysis of affected systems
   - Determine root cause and attack vector
   - Assess data compromise extent
   - Legal and compliance notification if required

3. **Recovery** (24-72 hours)
   - Implement fixes and patches
   - Restore affected systems
   - Verify system integrity
   - Update security controls

4. **Post-Incident** (1-2 weeks)
   - Comprehensive incident report
   - Lessons learned documentation
   - Security control improvements
   - Staff training updates

### Breach Notification Requirements
- **HIPAA Breach**: Report to HHS within 60 days
- **State Requirements**: Follow state-specific notification laws
- **Patient Notification**: Within 60 days of discovery
- **Business Associates**: Immediate notification to covered entities

## Audit and Compliance

### Audit Logging Requirements
All system activities must be logged with:
- **User Identity**: Who performed the action
- **Timestamp**: When the action occurred (UTC)
- **Action Type**: What was done (create, read, update, delete)
- **Resource**: What was accessed or modified
- **IP Address**: Source of the request
- **Result**: Success or failure with error details

### Log Retention
- **Security Logs**: 7 years retention
- **Access Logs**: 6 years retention
- **Application Logs**: 3 years retention
- **Debug Logs**: 30 days retention

### Compliance Monitoring
```typescript
// Audit logging structure
interface AuditEvent {
  timestamp: string; // ISO 8601 UTC
  userId: string;
  userRole: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress: string;
  userAgent: string;
  result: 'success' | 'failure';
  errorCode?: string;
  phi_accessed: boolean;
}
```

## Security Testing

### Penetration Testing
- **Frequency**: Quarterly for external testing, monthly for internal
- **Scope**: Web application, mobile apps, API endpoints, infrastructure
- **Methodology**: OWASP Top 10, SANS Top 25, healthcare-specific vectors
- **Reporting**: Detailed findings with remediation timelines

### Vulnerability Management
- **Dependency Scanning**: Automated scanning of all third-party libraries
- **Static Analysis**: Code security scanning in CI/CD pipeline
- **Dynamic Testing**: Runtime security testing
- **Container Scanning**: Security scanning of Docker images

### Security Code Review
```typescript
// Required security checkpoints in code review
const SECURITY_CHECKLIST = [
  'input_validation',
  'output_encoding',
  'authentication_checks',
  'authorization_verification',
  'error_handling',
  'logging_implementation',
  'encryption_usage',
  'sql_injection_prevention'
];
```

## Emergency Procedures

### System Compromise Response
1. **Immediate Actions**
   - Isolate affected systems
   - Preserve forensic evidence
   - Activate incident response team
   - Document timeline of events

2. **Communication Protocol**
   - Internal: CTO, Legal, Compliance within 1 hour
   - External: Law enforcement if criminal activity suspected
   - Patients: If PHI potentially compromised
   - Partners: Business associates if their data affected

### Business Continuity
- **Backup Systems**: Hot standby with <15 minute RTO
- **Data Recovery**: Point-in-time recovery capability
- **Communication**: Alternative channels for patient notifications
- **Manual Procedures**: Paper-based fallback for critical operations

## Training and Awareness

### Staff Security Training
- **Initial Training**: 8-hour security awareness course
- **Annual Refresher**: 4-hour update training
- **Role-Specific**: Additional training for admin users
- **Incident Response**: Quarterly simulation exercises

### Training Topics
- HIPAA compliance requirements
- Password and authentication best practices
- Phishing and social engineering recognition
- Incident reporting procedures
- Mobile device security
- Remote work security guidelines

### Compliance Verification
- **Security Assessments**: Annual third-party assessments
- **Internal Audits**: Quarterly compliance reviews
- **Penetration Testing**: Bi-annual external testing
- **Risk Assessments**: Annual comprehensive risk analysis

## Security Standards Enforcement

### Development Security
- **Secure SDLC**: Security integrated into development lifecycle
- **Code Reviews**: Mandatory security-focused code reviews
- **Static Analysis**: Automated security scanning in CI/CD
- **Dependency Management**: Regular updates and vulnerability patching

### Infrastructure Security
- **Network Segmentation**: Isolated networks for different system tiers
- **Monitoring**: 24/7 security monitoring and alerting
- **Patch Management**: Regular security updates and patches
- **Backup Security**: Encrypted, tested, and verified backups

---

*This document is reviewed quarterly and updated as needed to maintain current security standards and compliance requirements.*
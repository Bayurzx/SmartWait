---
inclusion: fileMatch
fileMatchPattern: "**/*.{test,spec}.{js,ts,tsx}"
---

# Testing Standards

## Testing Strategy

### Testing Pyramid
1. **Unit Tests** (70%): Fast, isolated component and function tests
2. **Integration Tests** (20%): API endpoints, database interactions, service integration
3. **End-to-End Tests** (10%): Complete user workflows across the entire system

### Test Categories
- **Unit Tests**: Individual functions, components, and services
- **Integration Tests**: API endpoints, database operations, external service integration
- **Contract Tests**: API contract validation between services
- **Performance Tests**: Load testing and performance benchmarks
- **Security Tests**: Vulnerability scanning and penetration testing
- **Accessibility Tests**: WCAG compliance and screen reader compatibility

## Unit Testing

### Testing Framework
- **Jest**: Primary testing framework for JavaScript/TypeScript
- **React Testing Library**: Component testing for React applications
- **React Native Testing Library**: Mobile component testing
- **Supertest**: HTTP assertion library for API testing

### Unit Test Structure
```typescript
// Example unit test structure
describe('QueueService', () => {
  let service: QueueService;
  let mockRepository: jest.Mocked<QueueRepository>;
  
  beforeEach(() => {
    mockRepository = createMockQueueRepository();
    service = new QueueService(mockRepository);
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('joinQueue', () => {
    it('should add patient to queue successfully', async () => {
      // Arrange
      const patientData = createMockPatient();
      const expectedPosition = 5;
      mockRepository.addToQueue.mockResolvedValue(expectedPosition);
      
      // Act
      const result = await service.joinQueue(patientData);
      
      // Assert
      expect(result.position).toBe(expectedPosition);
      expect(mockRepository.addToQueue).toHaveBeenCalledWith(patientData);
    });
    
    it('should throw error when queue is full', async () => {
      // Arrange
      const patientData = createMockPatient();
      mockRepository.addToQueue.mockRejectedValue(new QueueFullError());
      
      // Act & Assert
      await expect(service.joinQueue(patientData)).rejects.toThrow(QueueFullError);
    });
  });
});
```

### Component Testing Patterns
```typescript
// React component testing example
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueueStatus } from '../QueueStatus';

const mockProps = {
  patientId: 'patient-123',
  position: 5,
  estimatedWait: 15,
  onRefresh: jest.fn()
};

describe('QueueStatus Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('displays queue position correctly', () => {
    render(<QueueStatus {...mockProps} />);
    
    expect(screen.getByText('Position: 5')).toBeInTheDocument();
    expect(screen.getByText('Estimated wait: 15 minutes')).toBeInTheDocument();
  });
  
  it('calls onRefresh when refresh button is clicked', async () => {
    render(<QueueStatus {...mockProps} />);
    
    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    fireEvent.click(refreshButton);
    
    await waitFor(() => {
      expect(mockProps.onRefresh).toHaveBeenCalledTimes(1);
    });
  });
  
  it('shows loading state during refresh', async () => {
    render(<QueueStatus {...mockProps} />);
    
    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    fireEvent.click(refreshButton);
    
    expect(screen.getByText('Updating...')).toBeInTheDocument();
  });
});
```

### Mock Patterns
```typescript
// Service mocking
export const createMockQueueService = (): jest.Mocked<QueueService> => ({
  joinQueue: jest.fn(),
  getPosition: jest.fn(),
  leaveQueue: jest.fn(),
  updatePosition: jest.fn()
});

// External API mocking
jest.mock('../services/notification-service', () => ({
  NotificationService: {
    sendSMS: jest.fn().mockResolvedValue(true),
    sendPush: jest.fn().mockResolvedValue(true),
    sendEmail: jest.fn().mockResolvedValue(true)
  }
}));

// React Query mocking
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false }
  }
});

const renderWithQueryClient = (component: ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};
```

## Integration Testing

### API Integration Tests
```typescript
// API endpoint testing
import request from 'supertest';
import { app } from '../app';
import { setupTestDatabase, cleanupTestDatabase } from '../test-utils';

describe('Queue API', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });
  
  afterAll(async () => {
    await cleanupTestDatabase();
  });
  
  describe('POST /api/v1/queues/join', () => {
    it('should allow patient to join queue', async () => {
      const patientData = {
        name: 'John Doe',
        email: 'john@example.com',
        appointmentType: 'consultation'
      };
      
      const response = await request(app)
        .post('/api/v1/queues/join')
        .send(patientData)
        .expect(201);
        
      expect(response.body.data).toHaveProperty('position');
      expect(response.body.data).toHaveProperty('queueId');
    });
    
    it('should return validation error for invalid data', async () => {
      const invalidData = {
        name: '', // Empty name should fail validation
        email: 'invalid-email'
      };
      
      const response = await request(app)
        .post('/api/v1/queues/join')
        .send(invalidData)
        .expect(400);
        
      expect(response.body.errors).toHaveLength(2);
      expect(response.body.errors[0].field).toBe('name');
    });
  });
});
```

### Database Integration Tests
```typescript
// Database testing
import { DatabaseService } from '../services/database-service';
import { Patient } from '../models/patient';

describe('Patient Database Operations', () => {
  let db: DatabaseService;
  
  beforeAll(async () => {
    db = new DatabaseService(process.env.TEST_DATABASE_URL);
    await db.migrate();
  });
  
  afterAll(async () => {
    await db.close();
  });
  
  beforeEach(async () => {
    await db.clear();
  });
  
  it('should create and retrieve patient', async () => {
    const patientData = {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890'
    };
    
    const createdPatient = await Patient.create(patientData);
    const retrievedPatient = await Patient.findById(createdPatient.id);
    
    expect(retrievedPatient).toBeDefined();
    expect(retrievedPatient?.name).toBe(patientData.name);
  });
});
```

## End-to-End Testing

### E2E Testing Framework
- **Cypress**: Primary E2E testing framework
- **Detox**: React Native E2E testing
- **Playwright**: Alternative for complex scenarios

### E2E Test Structure
```typescript
// Cypress E2E test example
describe('Patient Queue Journey', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.setupTestData();
  });
  
  it('should allow patient to join queue and track position', () => {
    // Patient check-in
    cy.get('[data-testid="check-in-button"]').click();
    cy.get('[data-testid="patient-name"]').type('John Doe');
    cy.get('[data-testid="patient-email"]').type('john@example.com');
    cy.get('[data-testid="submit-checkin"]').click();
    
    // Verify queue position
    cy.get('[data-testid="queue-position"]').should('contain', 'Position:');
    cy.get('[data-testid="estimated-wait"]').should('contain', 'minutes');
    
    // Wait for position update
    cy.get('[data-testid="queue-position"]').should('not.contain', 'Position: 1');
    
    // Test notifications
    cy.get('[data-testid="notification"]').should('be.visible');
  });
  
  it('should handle queue management from staff dashboard', () => {
    // Staff login
    cy.login('staff@facility.com', 'password123');
    cy.visit('/staff/dashboard');
    
    // View queue
    cy.get('[data-testid="queue-list"]').should('be.visible');
    cy.get('[data-testid="patient-row"]').should('have.length.at.least', 1);
    
    // Call next patient
    cy.get('[data-testid="call-next-button"]').click();
    cy.get('[data-testid="confirm-call"]').click();
    
    // Verify queue updated
    cy.get('[data-testid="queue-list"]').should('be.updated');
  });
});
```

### Mobile E2E Testing (Detox)
```typescript
// Detox E2E test for React Native
import { by, device, element, expect } from 'detox';

describe('Mobile App Queue Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
  });
  
  beforeEach(async () => {
    await device.reloadReactNative();
  });
  
  it('should complete check-in flow', async () => {
    // Navigate to check-in
    await element(by.id('checkInButton')).tap();
    
    // Fill patient information
    await element(by.id('patientNameInput')).typeText('John Doe');
    await element(by.id('patientEmailInput')).typeText('john@example.com');
    await element(by.id('submitButton')).tap();
    
    // Verify success message
    await expect(element(by.id('successMessage'))).toBeVisible();
    await expect(element(by.id('queuePosition'))).toHaveText('Position: 1');
  });
  
  it('should receive push notifications', async () => {
    // Setup notification listening
    await device.sendUserNotification({
      trigger: {
        type: 'push',
      },
      title: 'Queue Update',
      body: 'Your position has changed to 2',
    });
    
    // Verify notification handling
    await expect(element(by.id('notificationBanner'))).toBeVisible();
  });
});
```

## Performance Testing

### Load Testing Setup
```typescript
// K6 load testing script
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up
    { duration: '5m', target: 100 }, // Sustained load
    { duration: '2m', target: 200 }, // Spike test
    { duration: '5m', target: 200 }, // Sustained spike
    { duration: '2m', target: 0 },   // Ramp down
  ],
};

export default function() {
  let response = http.post('https://api.example.com/v1/queues/join', {
    name: 'Load Test Patient',
    email: `patient${__VU}@example.com`,
    facilityId: 'facility-123'
  });
  
  check(response, {
    'status is 201': (r) => r.status === 201,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  sleep(1);
}
```

### Performance Benchmarks
```typescript
// Performance test configuration
const PERFORMANCE_BENCHMARKS = {
  api: {
    responseTime: 200, // ms
    throughput: 1000,  // requests/second
    errorRate: 0.01    // 1% error rate
  },
  database: {
    queryTime: 50,     // ms
    connectionPool: 20 // connections
  },
  mobile: {
    startup: 2000,     // ms
    navigation: 300,   // ms
    rendering: 16      // ms (60fps)
  }
};
```

## Test Data Management

### Test Data Factory
```typescript
// Test data factory patterns
export class TestDataFactory {
  static createPatient(overrides?: Partial<Patient>): Patient {
    return {
      id: `patient-${Math.random().toString(36).substr(2, 9)}`,
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      dateOfBirth: '1985-06-15',
      ...overrides
    };
  }
  
  static createQueue(overrides?: Partial<Queue>): Queue {
    return {
      id: `queue-${Math.random().toString(36).substr(2, 9)}`,
      facilityId: 'facility-123',
      status: 'active',
      maxCapacity: 50,
      currentSize: 0,
      ...overrides
    };
  }
  
  static createQueuePosition(overrides?: Partial<QueuePosition>): QueuePosition {
    return {
      id: `position-${Math.random().toString(36).substr(2, 9)}`,
      patientId: TestDataFactory.createPatient().id,
      queueId: TestDataFactory.createQueue().id,
      position: 1,
      joinedAt: new Date(),
      estimatedWaitMinutes: 15,
      ...overrides
    };
  }
}
```

### Database Seeding
```typescript
// Test database setup
export class TestDatabaseSetup {
  static async seedTestData(): Promise<void> {
    // Create test facilities
    const facility = await Facility.create({
      name: 'Test Medical Center',
      address: '123 Test St',
      phone: '+1234567890'
    });
    
    // Create test staff users
    await User.create({
      email: 'staff@test.com',
      password: await bcrypt.hash('password123', 10),
      role: 'staff',
      facilityId: facility.id
    });
    
    // Create test patients
    for (let i = 0; i < 10; i++) {
      await Patient.create(TestDataFactory.createPatient({
        email: `patient${i}@test.com`
      }));
    }
  }
  
  static async cleanupTestData(): Promise<void> {
    await QueuePosition.deleteAll();
    await Queue.deleteAll();
    await Patient.deleteAll();
    await User.deleteAll();
    await Facility.deleteAll();
  }
}
```

## Test Coverage & Quality

### Coverage Requirements
- **Unit Tests**: 80% code coverage minimum
- **Integration Tests**: All API endpoints covered
- **E2E Tests**: Critical user journeys covered
- **Security Tests**: All authentication/authorization paths

### Code Coverage Configuration
```javascript
// Jest coverage configuration
module.exports = {
  collectCoverageFrom: [
    'src/**/*.{js,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,ts,tsx}',
    '!src/**/index.{js,ts}'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './src/services/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  }
};
```

## CI/CD Integration

### Test Pipeline
```yaml
# GitHub Actions test pipeline
name: Test Pipeline

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:unit -- --coverage
      - uses: codecov/codecov-action@v3
  
  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:integration
  
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: cypress-io/github-action@v5
        with:
          start: npm run start
          wait-on: 'http://localhost:3000'
```

### Quality Gates
- All tests must pass before merge
- Code coverage must meet minimum thresholds
- No high-severity security vulnerabilities
- Performance tests must meet benchmarks
- Accessibility tests must pass WCAG 2.1 AA standards
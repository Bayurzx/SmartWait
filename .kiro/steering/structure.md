---
inclusion: always
---

# Project Structure

## Monorepo Organization

```
healthcare-queue-system/
├── .kiro/                          # Kiro specifications and steering
│   ├── specs/                      # Feature specifications
│   └── steering/                   # Project knowledge files
├── apps/
│   ├── mobile/                     # React Native mobile app
│   ├── web/                        # Next.js web applications
│   │   ├── patient-portal/         # Patient web interface
│   │   └── staff-dashboard/        # Staff management interface
│   └── api/                        # Backend services
│       ├── gateway/                # API gateway service
│       ├── queue-service/          # Queue management microservice
│       ├── notification-service/   # Communication service
│       ├── location-service/       # Location tracking service
│       ├── analytics-service/      # Analytics and reporting
│       └── integration-service/    # Healthcare system integrations
├── packages/
│   ├── shared/                     # Shared utilities and types
│   ├── ui/                         # Shared UI components
│   ├── api-client/                 # API client libraries
│   └── config/                     # Shared configuration
├── infrastructure/
│   ├── docker/                     # Docker configurations
│   ├── kubernetes/                 # K8s deployment configs
│   ├── terraform/                  # Infrastructure as code
│   └── scripts/                    # Deployment and utility scripts
├── docs/                           # Documentation
└── tools/                          # Development tools and scripts
```

## File Naming Conventions

### General Rules
- Use **kebab-case** for directories and file names
- Use **PascalCase** for React components
- Use **camelCase** for JavaScript/TypeScript functions and variables
- Use **UPPER_SNAKE_CASE** for constants and environment variables

### Specific Patterns
- React components: `UserProfile.tsx`, `QueueStatus.tsx`
- Hooks: `useQueue.ts`, `useNotification.ts`
- Services: `queue-service.ts`, `notification-service.ts`
- Types: `types.ts`, `queue-types.ts`, `user-types.ts`
- Utils: `date-utils.ts`, `validation-utils.ts`
- Constants: `constants.ts`, `api-constants.ts`
- Tests: `UserProfile.test.tsx`, `queue-service.test.ts`

## React Component Structure

### Component Organization
```
components/
├── ui/                     # Reusable UI components
│   ├── Button/
│   │   ├── Button.tsx
│   │   ├── Button.test.tsx
│   │   ├── Button.stories.tsx
│   │   └── index.ts
│   └── Input/
├── forms/                  # Form-specific components
├── layout/                 # Layout components
├── features/              # Feature-specific components
│   ├── queue/
│   ├── checkin/
│   └── notifications/
└── screens/               # Screen/page components (mobile)
```

### Component File Pattern
```typescript
// Button.tsx
import React from 'react';
import { ButtonProps } from './types';

const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', ...props }) => {
  return (
    <button className={`btn btn-${variant}`} {...props}>
      {children}
    </button>
  );
};

export default Button;
```

### Component Index Pattern
```typescript
// index.ts
export { default } from './Button';
export type { ButtonProps } from './types';
```

## API Service Structure

### Service Organization
```
api/
├── src/
│   ├── controllers/        # Request handlers
│   ├── services/          # Business logic
│   ├── models/            # Data models
│   ├── middleware/        # Express middleware
│   ├── routes/            # Route definitions
│   ├── utils/             # Utility functions
│   ├── types/             # TypeScript types
│   ├── config/            # Configuration
│   └── __tests__/         # Test files
├── docker-compose.yml
├── Dockerfile
└── package.json
```

### Controller Pattern
```typescript
// controllers/queue-controller.ts
import { Request, Response } from 'express';
import { QueueService } from '../services/queue-service';

export class QueueController {
  constructor(private queueService: QueueService) {}

  async joinQueue(req: Request, res: Response) {
    try {
      const result = await this.queueService.joinQueue(req.body);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}
```

### Service Pattern
```typescript
// services/queue-service.ts
import { QueueRepository } from '../repositories/queue-repository';
import { JoinQueueDto, QueuePosition } from '../types';

export class QueueService {
  constructor(private queueRepository: QueueRepository) {}

  async joinQueue(data: JoinQueueDto): Promise<QueuePosition> {
    // Business logic here
    return this.queueRepository.create(data);
  }
}
```

## Import Patterns

### Import Order
1. React and React Native imports
2. Third-party library imports
3. Internal shared package imports
4. Relative imports (components, utils, etc.)
5. Type-only imports at the end

```typescript
// Example import order
import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

import { Button } from '@/packages/ui';
import { QueueService } from '@/packages/shared';

import { QueueStatus } from './components/QueueStatus';
import { useQueue } from './hooks/useQueue';
import { formatTime } from '../utils/date-utils';

import type { QueuePosition, Patient } from './types';
```

### Path Aliases
```json
{
  "baseUrl": ".",
  "paths": {
    "@/*": ["./src/*"],
    "@/components/*": ["./src/components/*"],
    "@/services/*": ["./src/services/*"],
    "@/utils/*": ["./src/utils/*"],
    "@/types/*": ["./src/types/*"],
    "@/hooks/*": ["./src/hooks/*"]
  }
}
```

## State Management Patterns

### React Query for Server State
```typescript
// hooks/useQueue.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QueueService } from '../services/queue-service';

export const useQueue = (patientId: string) => {
  return useQuery({
    queryKey: ['queue', patientId],
    queryFn: () => QueueService.getPosition(patientId),
    refetchInterval: 5000, // Refetch every 5 seconds
  });
};
```

### Context for Global State
```typescript
// context/AppContext.tsx
import React, { createContext, useContext, useReducer } from 'react';

interface AppState {
  user: User | null;
  theme: 'light' | 'dark';
}

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<any>;
} | null>(null);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
};
```

## Error Handling Patterns

### API Error Boundaries
```typescript
// components/ErrorBoundary.tsx
import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error }>;
}

export class ErrorBoundary extends React.Component<Props, { hasError: boolean; error?: Error }> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      const Fallback = this.props.fallback || DefaultErrorFallback;
      return <Fallback error={this.state.error!} />;
    }

    return this.props.children;
  }
}
```

## Testing Patterns

### Unit Test Structure
```typescript
// __tests__/queue-service.test.ts
import { QueueService } from '../queue-service';
import { MockQueueRepository } from '../__mocks__/queue-repository';

describe('QueueService', () => {
  let service: QueueService;
  let mockRepository: MockQueueRepository;

  beforeEach(() => {
    mockRepository = new MockQueueRepository();
    service = new QueueService(mockRepository);
  });

  describe('joinQueue', () => {
    it('should add patient to queue successfully', async () => {
      // Test implementation
    });
  });
});
```

### Component Test Pattern
```typescript
// components/__tests__/QueueStatus.test.tsx
import { render, screen } from '@testing-library/react';
import { QueueStatus } from '../QueueStatus';

const mockProps = {
  position: 5,
  estimatedWait: 15,
};

describe('QueueStatus', () => {
  it('displays queue position correctly', () => {
    render(<QueueStatus {...mockProps} />);
    expect(screen.getByText('Position: 5')).toBeInTheDocument();
  });
});
```

## Environment Configuration

### Environment Variables Pattern
```typescript
// config/env.ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  TWILIO_ACCOUNT_SID: z.string(),
  TWILIO_AUTH_TOKEN: z.string(),
});

export const env = envSchema.parse(process.env);
```

## Documentation Standards

### Component Documentation
- Use JSDoc comments for all public interfaces
- Include Storybook stories for UI components
- Provide usage examples in README files
- Document props using TypeScript interfaces

### API Documentation
- Use OpenAPI 3.0 specifications
- Include request/response examples
- Document error codes and messages
- Maintain Postman collections for testing

## Git Workflow

### Branch Naming
- Feature branches: `feature/queue-management`
- Bug fixes: `fix/notification-timing`
- Hotfixes: `hotfix/security-patch`
- Release branches: `release/v1.2.0`

### Commit Messages
Follow Conventional Commits specification:
- `feat:` new features
- `fix:` bug fixes
- `docs:` documentation changes
- `style:` formatting changes
- `refactor:` code refactoring
- `test:` test additions/modifications
- `chore:` maintenance tasks
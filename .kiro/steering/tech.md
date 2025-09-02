---
inclusion: always
---

# Technology Stack

## Frontend Technologies

### Mobile Applications
- **React Native 0.72+**: Cross-platform mobile development for iOS and Android
- **TypeScript**: Type safety and enhanced developer experience
- **React Navigation 6**: Navigation and routing for mobile apps
- **React Native Paper**: Material Design components
- **React Query**: Data fetching and caching
- **React Hook Form**: Form management and validation
- **Expo SDK 49+**: Development toolchain and services
- **React Native Maps**: Location and mapping functionality
- **React Native Push Notifications**: Cross-platform push notification handling

### Web Applications
- **React 18**: Frontend library for staff dashboard and patient web portal
- **TypeScript**: Type-safe JavaScript development
- **Next.js 13**: Full-stack React framework with App Router
- **Tailwind CSS 3**: Utility-first CSS framework
- **Headless UI**: Accessible, unstyled UI components
- **React Hook Form**: Form state management
- **React Query**: Server state management
- **Chart.js**: Data visualization for analytics
- **Socket.io Client**: Real-time communication

## Backend Technologies

### Core Services
- **Node.js 18+**: Runtime environment
- **TypeScript**: Type-safe backend development
- **Express.js**: Web application framework
- **Fastify**: Alternative high-performance framework for API services
- **Socket.io**: Real-time bidirectional communication
- **Bull Queue**: Job queue processing with Redis

### Microservices Architecture
- **Docker**: Containerization
- **Kubernetes**: Container orchestration
- **NGINX**: Load balancing and reverse proxy
- **API Gateway**: Kong or AWS API Gateway for request routing

### Database & Storage
- **PostgreSQL 14+**: Primary relational database
- **Redis 6+**: Caching and session storage
- **Amazon S3**: File storage for documents and media
- **Amazon RDS**: Managed PostgreSQL hosting
- **Amazon ElastiCache**: Managed Redis hosting

### Message Queue & Streaming
- **Apache Kafka**: Event streaming and real-time data pipelines
- **Redis Bull**: Job queue management
- **Amazon SQS**: Message queuing service
- **Amazon SNS**: Push notification service

## Cloud Infrastructure

### Primary Cloud Provider
- **Amazon Web Services (AWS)**: Primary cloud infrastructure
- **AWS ECS/EKS**: Container orchestration
- **AWS Lambda**: Serverless functions for event processing
- **AWS CloudFront**: Content delivery network
- **AWS Route 53**: DNS management

### Monitoring & Observability
- **New Relic**: Application performance monitoring
- **AWS CloudWatch**: Infrastructure monitoring and logging
- **Sentry**: Error tracking and performance monitoring
- **Datadog**: Infrastructure and application monitoring alternative

## External Services & APIs

### Communication Services
- **Twilio**: SMS messaging service
- **SendGrid**: Email delivery service
- **Firebase Cloud Messaging**: Push notifications
- **Amazon SES**: Email service alternative

### Location Services
- **Google Maps API**: Mapping and geocoding
- **Google Places API**: Location search and details
- **Here Maps**: Alternative mapping service for enterprise

### Payment Processing
- **Stripe**: Payment processing for copays and fees
- **Square**: Alternative payment processing

### Healthcare Integrations
- **HL7 FHIR R4**: Healthcare data exchange standard
- **Epic MyChart API**: Epic EHR integration
- **Cerner APIs**: Cerner EHR integration
- **Allscripts API**: Healthcare system integration

## Development Tools

### Code Quality & Testing
- **ESLint**: JavaScript/TypeScript linting
- **Prettier**: Code formatting
- **Jest**: Unit testing framework
- **React Testing Library**: Component testing
- **Cypress**: End-to-end testing
- **Detox**: Mobile app testing
- **SonarQube**: Code quality analysis

### Development Workflow
- **Git**: Version control
- **GitHub**: Repository hosting and collaboration
- **GitHub Actions**: CI/CD pipeline
- **Husky**: Git hooks for pre-commit checks
- **Conventional Commits**: Standardized commit messages

### Documentation
- **Storybook**: Component documentation and testing
- **OpenAPI 3.0**: API documentation
- **Swagger UI**: Interactive API documentation
- **Docusaurus**: Technical documentation site

## Security & Compliance

### Authentication & Authorization
- **Auth0**: Identity and access management
- **JWT**: JSON Web Tokens for authentication
- **OAuth 2.0**: Third-party authentication
- **RBAC**: Role-based access control

### Security Tools
- **AWS WAF**: Web application firewall
- **AWS Shield**: DDoS protection
- **Let's Encrypt**: SSL/TLS certificates
- **OWASP ZAP**: Security testing
- **Snyk**: Dependency vulnerability scanning

### Compliance & Encryption
- **AWS KMS**: Key management service
- **HashiCorp Vault**: Secrets management
- **bcrypt**: Password hashing
- **crypto-js**: Client-side encryption

## Preferred Libraries & Patterns

### State Management
- **Redux Toolkit**: Complex state management (when needed)
- **Zustand**: Lightweight state management alternative
- **React Context**: Simple state sharing

### Utility Libraries
- **Lodash**: Utility functions
- **date-fns**: Date manipulation
- **Yup**: Schema validation
- **Axios**: HTTP client
- **uuid**: Unique identifier generation

### UI/UX Libraries
- **React Native Elements**: Mobile UI components
- **NativeBase**: Alternative mobile UI library
- **Lottie**: Animation library
- **React Native Gesture Handler**: Gesture recognition

## Performance Considerations
- **React.memo**: Component memoization
- **React.lazy**: Code splitting
- **Service Workers**: Caching strategies
- **Image optimization**: WebP format, lazy loading
- **Database indexing**: Optimized query performance
- **CDN usage**: Global content distribution

## Development Environment
- **Node.js 18+**: Required runtime
- **npm/yarn**: Package management
- **VS Code**: Recommended IDE
- **React DevTools**: Debugging extension
- **Redux DevTools**: State debugging
- **Flipper**: React Native debugging
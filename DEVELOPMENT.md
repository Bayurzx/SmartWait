# SmartWait MVP Development Guide

## Prerequisites

- Node.js 18+ 
- npm 8+
- Docker and Docker Compose
- Git

## Project Structure

This is a monorepo containing:

### Applications (`apps/`)
- **api**: Express.js backend API server
- **web**: Next.js web applications (patient portal & staff dashboard)
- **mobile**: React Native mobile app with Expo

### Packages (`packages/`)
- **shared**: Common utilities and types
- **ui**: Shared UI components
- **api-client**: API client libraries
- **config**: Configuration utilities

## Quick Start

### 1. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
# At minimum, set TWILIO credentials for SMS functionality
```

### 2. Install Dependencies

```bash
# Install all dependencies for monorepo
npm run install:all
```

### 3. Development with Docker (Recommended)

```bash
# Start all services in development mode
npm run docker:dev

# This will start:
# - PostgreSQL database on port 5432
# - Redis cache on port 6379
# - API server on port 3001 (with hot reload)
# - Web application on port 3000 (with hot reload)
```

### 4. Development without Docker

```bash
# Start database services only
docker-compose -f docker-compose.dev.yml up postgres redis -d

# Build shared packages
npm run build:packages

# Start development servers
npm run dev
```

## TypeScript Configuration

### Root Configuration
- `tsconfig.json`: Base configuration for all projects
- Uses project references for efficient builds
- Shared compiler options across all packages

### Project-Specific Configurations
- Each app and package extends the root configuration
- Customized paths and settings per project
- Consistent TypeScript settings across the monorepo

### Building TypeScript

```bash
# Build all TypeScript projects
npm run typecheck

# Build specific packages
npm run build:packages

# Build specific apps
npm run build:apps
```

## Docker Configuration

### Development (`docker-compose.dev.yml`)
- Hot reload for API and Web applications
- Volume mounts for live code changes
- Debug port exposed for Node.js debugging (9229)
- Separate development database

### Production (`docker-compose.yml`)
- Optimized production builds
- Multi-stage Dockerfiles for smaller images
- Production-ready configurations

### Docker Commands

```bash
# Development environment
npm run docker:dev          # Start all services
npm run docker:dev:down     # Stop all services

# Production environment
npm run docker:prod         # Start production build
npm run docker:prod:down    # Stop production services

# Cleanup
npm run docker:clean        # Remove containers and volumes
```

## Available Scripts

### Root Level Scripts

```bash
# Development
npm run dev                 # Start all development servers
npm run dev:api            # Start API server only
npm run dev:web            # Start web application only
npm run dev:mobile         # Start mobile app only

# Building
npm run build              # Build all packages and apps
npm run build:packages     # Build shared packages only
npm run build:apps         # Build applications only

# Testing
npm run test               # Run all tests
npm run test:packages      # Test shared packages
npm run test:apps          # Test applications

# Linting
npm run lint               # Lint all code
npm run typecheck          # TypeScript type checking

# Maintenance
npm run clean              # Clean all build artifacts
npm run install:all        # Install all dependencies
```

## Database Setup

### Local Development

The Docker Compose configuration automatically sets up:
- PostgreSQL 14 database
- Initial schema from `infrastructure/docker/postgres/init.sql`
- Development data seeding

### Manual Database Setup

```bash
# Connect to database
psql -h localhost -p 5432 -U smartwait_user -d smartwait

# Run migrations (when implemented)
cd apps/api && npm run migrate
```

## Environment Variables

### Required Variables

```bash
# Database
DATABASE_URL=postgresql://smartwait_user:smartwait_password@localhost:5432/smartwait

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key-min-32-characters

# Twilio (for SMS notifications)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

### Optional Variables

```bash
# Development
NODE_ENV=development
LOG_LEVEL=debug
ENABLE_CORS=true

# Staff Authentication
STAFF_DEFAULT_USERNAME=admin
STAFF_DEFAULT_PASSWORD=secure-password
```

## Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure ports 3000, 3001, 5432, 6379 are available
2. **Docker issues**: Run `npm run docker:clean` to reset containers
3. **TypeScript errors**: Run `npm run typecheck` to verify configurations
4. **Dependency issues**: Run `npm run clean && npm run install:all`

### Debug Mode

```bash
# Start API with debugger
cd apps/api && npm run dev:debug

# Connect debugger to port 9229
# In VS Code: Run and Debug -> Attach to Node.js
```

### Logs

```bash
# View Docker logs
docker-compose -f docker-compose.dev.yml logs -f api
docker-compose -f docker-compose.dev.yml logs -f web

# View all logs
docker-compose -f docker-compose.dev.yml logs -f
```

## Next Steps

1. **Database Schema**: Implement database migrations in `apps/api`
2. **API Endpoints**: Develop queue management APIs
3. **Frontend Components**: Build patient and staff interfaces
4. **Mobile App**: Implement React Native screens
5. **Testing**: Add comprehensive test suites

## Architecture Notes

- **Monorepo**: Shared code in packages, applications in apps
- **TypeScript**: Strict type checking across all projects
- **Docker**: Containerized development and production environments
- **Hot Reload**: Live code changes in development mode
- **Project References**: Efficient TypeScript builds with dependencies
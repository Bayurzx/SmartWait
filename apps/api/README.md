# SmartWait API Server

This is the backend API server for the SmartWait healthcare queue management system.

## Features

- ✅ **Express.js API Server** with TypeScript
- ✅ **Health Check Endpoints** for monitoring
- ✅ **PostgreSQL Database** with Prisma ORM
- ✅ **Redis Cache** for real-time features and caching
- ✅ **Database Migrations** and seed data
- ✅ **Environment Configuration** for all services
- ✅ **Comprehensive Setup Scripts** for easy deployment

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- Docker (optional, for containerized services)

### Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up services (Database + Redis):**
   ```bash
   npm run services:setup
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Test the health endpoints:**
   ```bash
   # Basic health check
   curl http://localhost:3001/health
   
   # Detailed health check with statistics
   curl http://localhost:3001/health/detailed
   ```

### Using Docker

Start all services with Docker Compose:

```bash
# Development environment
docker-compose -f docker-compose.dev.yml up -d

# Production environment  
docker-compose up -d
```

## API Endpoints

### Health Monitoring

- `GET /health` - Basic health check (database + Redis status)
- `GET /health/detailed` - Detailed health with statistics and memory usage

### Core API (Coming in next tasks)

- `POST /api/checkin` - Patient check-in
- `GET /api/position/:id` - Get queue position
- `GET /api/staff/queue` - Staff queue management
- `POST /api/staff/call-next` - Call next patient

## Services

### Database (PostgreSQL)

- **Schema:** Defined in `prisma/schema.prisma`
- **Migrations:** Located in `prisma/migrations/`
- **Seed Data:** Sample data in `prisma/seed.ts`

Tables:
- `patients` - Patient information
- `queue_positions` - Queue management
- `staff_sessions` - Staff authentication
- `sms_notifications` - SMS tracking

### Redis Cache

- **Configuration:** `src/config/redis.ts`
- **Service:** `src/services/redis-service.ts`

Features:
- Queue position caching
- Session storage
- Real-time pub/sub
- Rate limiting
- Temporary data storage

## Scripts

### Development

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm run start` - Start production server

### Database

- `npm run migrate` - Run database migrations
- `npm run db:seed` - Seed database with sample data
- `npm run db:setup` - Complete database setup
- `npm run db:reset` - Reset database (⚠️ destructive)
- `npm run db:studio` - Open Prisma Studio

### Services

- `npm run services:setup` - Setup all services (DB + Redis)
- `npm run test:health` - Test service health
- `npm run services:setup:test` - Setup test environment

### Testing

- `npm test` - Run unit tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:db` - Setup test DB and run tests

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Server Configuration
PORT=3001
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:19006

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/smartwait
REDIS_URL=redis://localhost:6379

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=8h

# Twilio SMS Configuration
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Staff Authentication
STAFF_USERNAME=admin
STAFF_PASSWORD=change-this-password
```

## Architecture

```
src/
├── config/          # Configuration files
│   ├── database.ts  # Prisma client setup
│   └── redis.ts     # Redis client setup
├── routes/          # API route handlers
│   └── health.ts    # Health check endpoints
├── services/        # Business logic services
│   └── redis-service.ts  # Redis operations
├── utils/           # Utility functions
│   └── database.ts  # Database utilities
└── index.ts         # Main server file
```

## Health Check Response

### Basic Health Check (`/health`)

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 3600,
  "database": {
    "status": "healthy",
    "responseTime": 5,
    "timestamp": "2024-01-01T12:00:00.000Z"
  },
  "redis": {
    "status": "healthy", 
    "responseTime": 2,
    "timestamp": "2024-01-01T12:00:00.000Z"
  },
  "version": "1.0.0"
}
```

### Detailed Health Check (`/health/detailed`)

Includes additional statistics:
- Memory usage
- Database record counts
- Active sessions
- SMS notification counts

## Development Status

### ✅ Completed (Task 1.1)

- [x] Express.js API server with health check endpoint
- [x] Redis setup for caching and real-time features  
- [x] Database migration scripts and seed data
- [x] Environment configuration for all services

### 🔄 Next Tasks

- [ ] Queue management service implementation
- [ ] Staff dashboard API endpoints
- [ ] SMS notification service
- [ ] Real-time WebSocket updates
- [ ] Mobile and web applications

## Troubleshooting

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker-compose -f docker-compose.dev.yml up -d postgres

# Verify connection
npm run test:health
```

### Redis Connection Issues

```bash
# Check if Redis is running
docker-compose -f docker-compose.dev.yml up -d redis

# Test Redis connection
npm run test:health
```

### Port Conflicts

If port 3001 is in use, update the `PORT` environment variable in `.env`.

## Contributing

1. Follow the existing code structure
2. Add tests for new features
3. Update documentation
4. Ensure health checks pass before committing
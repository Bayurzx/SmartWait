# SmartWait Database Setup

This document describes the database setup for the SmartWait MVP application.

## Database Schema

The SmartWait MVP uses PostgreSQL with the following tables:

### Tables

1. **patients** - Store patient information
   - `id` (UUID, Primary Key)
   - `name` (VARCHAR(100))
   - `phone` (VARCHAR(20))
   - `created_at` (TIMESTAMP)

2. **queue_positions** - Track patient positions in the queue
   - `id` (UUID, Primary Key)
   - `patient_id` (UUID, Foreign Key to patients)
   - `position` (INTEGER, Unique for active statuses)
   - `status` (VARCHAR(20): waiting, called, completed, no_show)
   - `check_in_time` (TIMESTAMP)
   - `estimated_wait_minutes` (INTEGER)
   - `called_at` (TIMESTAMP)
   - `completed_at` (TIMESTAMP)

3. **staff_sessions** - Simple staff authentication
   - `id` (UUID, Primary Key)
   - `username` (VARCHAR(50))
   - `session_token` (VARCHAR(255))
   - `expires_at` (TIMESTAMP)
   - `created_at` (TIMESTAMP)

4. **sms_notifications** - SMS notification log
   - `id` (UUID, Primary Key)
   - `patient_id` (UUID, Foreign Key to patients)
   - `phone_number` (VARCHAR(20))
   - `message` (TEXT)
   - `status` (VARCHAR(20): pending, sent, delivered, failed)
   - `sent_at` (TIMESTAMP)
   - `twilio_sid` (VARCHAR(100))

## Quick Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ (or Docker)
- Redis 6+ (for caching and real-time features)

### Option 1: Using Docker (Recommended for Development)

1. Start the database services:
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

2. Verify the database setup:
   ```bash
   npm run db:verify
   ```

3. Set up the database:
   ```bash
   npm run db:setup
   ```

### Option 2: Using Local PostgreSQL

1. Install PostgreSQL locally and create a database named `smartwait`

2. Update the `DATABASE_URL` in your `.env` file:
   ```
   DATABASE_URL=postgresql://username:password@localhost:5432/smartwait
   ```

3. Set up the database:
   ```bash
   npm run db:setup
   ```

## Available Scripts

- `npm run db:verify` - Verify database setup without requiring connection
- `npm run db:setup` - Complete database setup (generate client, migrate, seed)
- `npm run migrate` - Run database migrations
- `npm run db:seed` - Seed database with sample data
- `npm run db:reset` - Reset database (WARNING: Deletes all data)
- `npm run db:studio` - Open Prisma Studio for database management

## Environment Variables

Required environment variables for database connection:

```env
# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/smartwait

# Optional: Redis for caching
REDIS_URL=redis://localhost:6379
```

## Database Health Check

The application includes database health monitoring:

```typescript
import { getDatabaseHealth } from './src/utils/database';

const health = await getDatabaseHealth();
console.log(health);
// Output: { status: 'healthy', responseTime: 15, timestamp: '...' }
```

## Prisma Client Usage

The Prisma client is configured and ready to use:

```typescript
import { prisma } from './src/config/database';

// Example: Create a new patient
const patient = await prisma.patient.create({
  data: {
    name: 'John Doe',
    phone: '+1234567890',
  },
});

// Example: Get queue positions
const queue = await prisma.queuePosition.findMany({
  where: { status: 'waiting' },
  include: { patient: true },
  orderBy: { position: 'asc' },
});
```

## Troubleshooting

### Connection Issues
- Ensure PostgreSQL is running on port 5432
- Check DATABASE_URL format and credentials
- Verify network connectivity to database

### Migration Issues
- Run `npx prisma migrate reset` to reset migrations (WARNING: Deletes data)
- Check database permissions for the user
- Ensure PostgreSQL version compatibility (14+)

### Performance
- The database includes proper indexes for queue operations
- Consider connection pooling for production deployments
- Monitor query performance with Prisma's logging

## Production Considerations

For production deployment:

1. Use connection pooling (PgBouncer recommended)
2. Set up database backups
3. Configure proper user permissions
4. Enable SSL connections
5. Monitor database performance
6. Set up log rotation

## Sample Data

The seed script creates sample data for development:
- 3 sample patients
- 3 queue positions
- 2 SMS notification records

This data helps with testing the queue management functionality during development.
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';

// Load environment variables
dotenv.config();

// Import database, Redis, Socket.io, and routes
import { testDatabaseConnection, cleanupExpiredSessions } from './utils/database';
import { connectRedis, testRedisConnection } from './config/redis';
import { initializeSocketIO, getSocketIOHealth } from './config/socket';
import healthRoutes from './routes/health';
import queueRoutes from './routes/queue';
import staffRoutes from './routes/staff';
import checkinHistoryRoutes from './routes/checkin-history';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/health', healthRoutes);
app.use('/api', queueRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/v1/checkin-history', checkinHistoryRoutes);

// Basic route
app.get('/', (_req, res) => {
  res.json({
    message: 'SmartWait API Server',
    version: '1.0.0',
    status: 'running',
    database: 'PostgreSQL with Prisma ORM',
    features: [
      'Patient check-in',
      'Queue management',
      'SMS notifications',
      'Staff dashboard',
      'Real-time updates'
    ]
  });
});

// Initialize database, Redis, and start server
async function startServer() {
  try {
    // Test database connection
    console.log('🔌 Testing database connection...');
    const isDatabaseConnected = await testDatabaseConnection();
    
    if (!isDatabaseConnected) {
      console.error('❌ Failed to connect to database. Please check your DATABASE_URL.');
      process.exit(1);
    }

    // Connect to Redis
    console.log('🔌 Connecting to Redis...');
    await connectRedis();
    
    const isRedisConnected = await testRedisConnection();
    if (!isRedisConnected) {
      console.error('❌ Failed to connect to Redis. Please check your REDIS_URL.');
      process.exit(1);
    }

    // Clean up expired sessions on startup
    await cleanupExpiredSessions();

    // Initialize Socket.io with Redis adapter
    console.log('🔌 Initializing Socket.io server...');
    await initializeSocketIO(httpServer);

    // Start the server
    httpServer.listen(PORT, () => {
      console.log(`🚀 SmartWait API server running on port ${PORT}`);
      console.log(`📊 Health check available at http://localhost:${PORT}/health`);
      console.log(`📊 Detailed health check at http://localhost:${PORT}/health/detailed`);
      console.log(`🗄️  Database: Connected and ready`);
      console.log(`🔄 Redis: Connected and ready`);
      console.log(`⚡ Socket.io: Real-time updates enabled with Redis scaling`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

export default app;
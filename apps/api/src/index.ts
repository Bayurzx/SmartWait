import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import database and routes
import { testDatabaseConnection, cleanupExpiredSessions } from './utils/database';
import healthRoutes from './routes/health';

const app = express();
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

// Initialize database and start server
async function startServer() {
  try {
    // Test database connection
    console.log('🔌 Testing database connection...');
    const isConnected = await testDatabaseConnection();
    
    if (!isConnected) {
      console.error('❌ Failed to connect to database. Please check your DATABASE_URL.');
      process.exit(1);
    }

    // Clean up expired sessions on startup
    await cleanupExpiredSessions();

    // Start the server
    app.listen(PORT, () => {
      console.log(`🚀 SmartWait API server running on port ${PORT}`);
      console.log(`📊 Health check available at http://localhost:${PORT}/health`);
      console.log(`📊 Detailed health check at http://localhost:${PORT}/health/detailed`);
      console.log(`🗄️  Database: Connected and ready`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

// Start server
app.listen(PORT, () => {
  console.log(`🚀 SmartWait API server running on port ${PORT}`);
  console.log(`📊 Health check available at http://localhost:${PORT}/health`);
});

export default app;
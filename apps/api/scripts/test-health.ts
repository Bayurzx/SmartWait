#!/usr/bin/env ts-node

import { testDatabaseConnection } from '../src/utils/database';
import { connectRedis, testRedisConnection } from '../src/config/redis';

async function testHealthEndpoints() {
  console.log('🧪 Testing SmartWait API health endpoints...\n');

  try {
    // Test database connection
    console.log('🔌 Testing database connection...');
    const isDatabaseConnected = await testDatabaseConnection();
    
    if (isDatabaseConnected) {
      console.log('✅ Database: Connected and healthy');
    } else {
      console.log('❌ Database: Connection failed');
      return false;
    }

    // Test Redis connection
    console.log('🔌 Testing Redis connection...');
    await connectRedis();
    const isRedisConnected = await testRedisConnection();
    
    if (isRedisConnected) {
      console.log('✅ Redis: Connected and healthy');
    } else {
      console.log('❌ Redis: Connection failed');
      return false;
    }

    console.log('\n🎉 All health checks passed!');
    console.log('📋 Services Status:');
    console.log('  ✅ PostgreSQL: Ready');
    console.log('  ✅ Redis: Ready');
    console.log('  ✅ API Server: Ready to start');
    
    console.log('\n📋 Next steps:');
    console.log('  1. Start the API server: npm run dev');
    console.log('  2. Test health endpoint: curl http://localhost:3001/health');
    console.log('  3. Test detailed health: curl http://localhost:3001/health/detailed');

    return true;

  } catch (error) {
    console.error('❌ Health check failed:', error);
    return false;
  }
}

// Run test if this script is executed directly
if (require.main === module) {
  testHealthEndpoints().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export { testHealthEndpoints };
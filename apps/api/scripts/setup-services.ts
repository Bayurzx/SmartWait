#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import { testDatabaseConnection } from '../src/utils/database';
import { connectRedis, testRedisConnection } from '../src/config/redis';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../.env.test' });

interface SetupOptions {
  environment?: 'development' | 'test';
  skipSeed?: boolean;
  skipRedis?: boolean;
}

async function setupServices(options: SetupOptions = {}) {
  const { environment = 'development', skipSeed = false, skipRedis = false } = options;
  
  console.log(`🚀 Setting up SmartWait ${environment} services...\n`);

  try {
    // Step 1: Generate Prisma client
    console.log('📦 Generating Prisma client...');
    execSync('npx prisma generate', { stdio: 'inherit', cwd: process.cwd() });
    console.log('✅ Prisma client generated\n');

    // Step 2: Test database connection
    console.log('🔌 Testing database connection...');
    const isDatabaseConnected = await testDatabaseConnection();
    
    if (!isDatabaseConnected) {
      console.log('❌ Database connection failed. Please ensure PostgreSQL is running.');
      console.log('💡 You can start the database with: docker-compose -f docker-compose.dev.yml up -d postgres');
      
      if (environment === 'test') {
        console.log('💡 For testing, ensure you have a separate test database configured');
      }
      
      process.exit(1);
    }
    console.log('✅ Database connection successful\n');

    // Step 3: Test Redis connection (unless skipped)
    if (!skipRedis) {
      console.log('🔌 Testing Redis connection...');
      try {
        await connectRedis();
        const isRedisConnected = await testRedisConnection();
        
        if (!isRedisConnected) {
          console.log('❌ Redis connection failed. Please ensure Redis is running.');
          console.log('💡 You can start Redis with: docker-compose -f docker-compose.dev.yml up -d redis');
          process.exit(1);
        }
        console.log('✅ Redis connection successful\n');
      } catch (error) {
        console.log('❌ Redis connection failed:', error);
        console.log('💡 You can start Redis with: docker-compose -f docker-compose.dev.yml up -d redis');
        process.exit(1);
      }
    } else {
      console.log('⏭️  Skipping Redis connection test\n');
    }

    // Step 4: Run migrations
    console.log('🔄 Running database migrations...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit', cwd: process.cwd() });
    console.log('✅ Database migrations completed\n');

    // Step 5: Seed database (optional, skip for test environment by default)
    if (!skipSeed && environment !== 'test') {
      console.log('🌱 Seeding database with sample data...');
      try {
        execSync('npx prisma db seed', { stdio: 'inherit', cwd: process.cwd() });
        console.log('✅ Database seeded successfully\n');
      } catch (error) {
        console.log('⚠️  Database seeding failed (this is optional)');
        console.log('You can run seeding manually with: npm run db:seed\n');
      }
    } else if (environment === 'test') {
      console.log('⏭️  Skipping seed for test environment\n');
    }

    console.log(`🎉 ${environment} services setup completed successfully!`);
    
    if (environment === 'development') {
      console.log('\n📋 Services Status:');
      console.log('✅ PostgreSQL: Connected and migrated');
      if (!skipRedis) {
        console.log('✅ Redis: Connected and ready');
      }
      console.log('✅ API Server: Ready to start');
      
      console.log('\n📋 Next steps:');
      console.log('1. Copy .env.example to .env and update configuration if needed');
      console.log('2. Start the API server with: npm run dev');
      console.log('3. Check health status at: http://localhost:3001/health');
      console.log('4. The services are ready for SmartWait MVP development!');
    } else {
      console.log('\n📋 Test services are ready for running tests!');
    }

  } catch (error) {
    console.error(`❌ ${environment} services setup failed:`, error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: SetupOptions = {};

args.forEach(arg => {
  if (arg === '--environment=test') {
    options.environment = 'test';
  } else if (arg === '--skip-seed') {
    options.skipSeed = true;
  } else if (arg === '--skip-redis') {
    options.skipRedis = true;
  }
});

// Run setup if this script is executed directly
if (require.main === module) {
  setupServices(options);
}

export { setupServices };
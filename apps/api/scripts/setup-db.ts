#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import { testDatabaseConnection } from '../src/utils/database';

interface SetupOptions {
  environment?: 'development' | 'test';
  skipSeed?: boolean;
}

async function setupDatabase(options: SetupOptions = {}) {
  const { environment = 'development', skipSeed = false } = options;
  
  console.log(`🚀 Setting up SmartWait ${environment} database...\n`);

  try {
    // Step 1: Generate Prisma client
    console.log('📦 Generating Prisma client...');
    execSync('npx prisma generate', { stdio: 'inherit', cwd: process.cwd() });
    console.log('✅ Prisma client generated\n');

    // Step 2: Test database connection
    console.log('🔌 Testing database connection...');
    const isConnected = await testDatabaseConnection();
    
    if (!isConnected) {
      console.log('❌ Database connection failed. Please ensure PostgreSQL is running.');
      console.log('💡 You can start the database with: docker-compose -f docker-compose.dev.yml up -d postgres');
      
      if (environment === 'test') {
        console.log('💡 For testing, ensure you have a separate test database configured');
      }
      
      process.exit(1);
    }
    console.log('✅ Database connection successful\n');

    // Step 3: Run migrations
    console.log('🔄 Running database migrations...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit', cwd: process.cwd() });
    console.log('✅ Database migrations completed\n');

    // Step 4: Seed database (optional, skip for test environment by default)
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

    console.log(`🎉 ${environment} database setup completed successfully!`);
    
    if (environment === 'development') {
      console.log('\n📋 Next steps:');
      console.log('1. Copy .env.example to .env and update DATABASE_URL if needed');
      console.log('2. Start the API server with: npm run dev');
      console.log('3. The database is ready for SmartWait MVP development!');
    } else {
      console.log('\n📋 Test database is ready for running tests!');
    }

  } catch (error) {
    console.error(`❌ ${environment} database setup failed:`, error);
    process.exit(1);
  }
}

// Run setup if this script is executed directly
if (require.main === module) {
  setupDatabase();
}

export { setupDatabase };
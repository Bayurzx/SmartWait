#!/usr/bin/env ts-node

/**
 * Database Setup Verification Script
 * 
 * This script verifies that all database components are properly configured
 * for the SmartWait MVP without requiring an active database connection.
 */

import * as fs from 'fs';
import * as path from 'path';

interface VerificationResult {
  component: string;
  status: 'pass' | 'fail';
  message: string;
}

function verifyDatabaseSetup(): VerificationResult[] {
  const results: VerificationResult[] = [];

  // Check 1: Prisma schema exists and has required models
  try {
    const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
    
    const requiredModels = ['Patient', 'QueuePosition', 'StaffSession', 'SmsNotification'];
    const missingModels = requiredModels.filter(model => !schemaContent.includes(`model ${model}`));
    
    if (missingModels.length === 0) {
      results.push({
        component: 'Prisma Schema',
        status: 'pass',
        message: 'All required models (Patient, QueuePosition, StaffSession, SmsNotification) are defined'
      });
    } else {
      results.push({
        component: 'Prisma Schema',
        status: 'fail',
        message: `Missing models: ${missingModels.join(', ')}`
      });
    }
  } catch (error) {
    results.push({
      component: 'Prisma Schema',
      status: 'fail',
      message: 'Schema file not found or unreadable'
    });
  }

  // Check 2: Initial migration exists
  try {
    const migrationDir = path.join(__dirname, '../prisma/migrations');
    const migrations = fs.readdirSync(migrationDir).filter(dir => dir !== 'migration_lock.toml');
    
    if (migrations.length > 0) {
      const initMigration = migrations.find(m => m.includes('init'));
      if (initMigration) {
        const migrationSql = fs.readFileSync(
          path.join(migrationDir, initMigration, 'migration.sql'),
          'utf-8'
        );
        
        const requiredTables = ['patients', 'queue_positions', 'staff_sessions', 'sms_notifications'];
        const missingTables = requiredTables.filter(table => !migrationSql.includes(`CREATE TABLE "${table}"`));
        
        if (missingTables.length === 0) {
          results.push({
            component: 'Database Migration',
            status: 'pass',
            message: 'Initial migration contains all required tables'
          });
        } else {
          results.push({
            component: 'Database Migration',
            status: 'fail',
            message: `Migration missing tables: ${missingTables.join(', ')}`
          });
        }
      } else {
        results.push({
          component: 'Database Migration',
          status: 'fail',
          message: 'No initial migration found'
        });
      }
    } else {
      results.push({
        component: 'Database Migration',
        status: 'fail',
        message: 'No migrations found'
      });
    }
  } catch (error) {
    results.push({
      component: 'Database Migration',
      status: 'fail',
      message: 'Migration directory not accessible'
    });
  }

  // Check 3: Seed file exists and is properly configured
  try {
    const seedPath = path.join(__dirname, '../prisma/seed.ts');
    const seedContent = fs.readFileSync(seedPath, 'utf-8');
    
    const requiredOperations = ['patient.create', 'queuePosition.create', 'smsNotification.create'];
    const missingOperations = requiredOperations.filter(op => !seedContent.includes(op));
    
    if (missingOperations.length === 0) {
      results.push({
        component: 'Database Seed',
        status: 'pass',
        message: 'Seed file contains sample data for all entities'
      });
    } else {
      results.push({
        component: 'Database Seed',
        status: 'fail',
        message: `Seed missing operations: ${missingOperations.join(', ')}`
      });
    }
  } catch (error) {
    results.push({
      component: 'Database Seed',
      status: 'fail',
      message: 'Seed file not found or unreadable'
    });
  }

  // Check 4: Docker Compose configuration
  try {
    const dockerComposePath = path.join(__dirname, '../docker-compose.dev.yml');
    const dockerContent = fs.readFileSync(dockerComposePath, 'utf-8');
    
    const requiredServices = ['postgres', 'redis'];
    const missingServices = requiredServices.filter(service => !dockerContent.includes(`${service}:`));
    
    if (missingServices.length === 0 && dockerContent.includes('POSTGRES_DB: smartwait')) {
      results.push({
        component: 'Docker Configuration',
        status: 'pass',
        message: 'Docker Compose configured with PostgreSQL and Redis services'
      });
    } else {
      results.push({
        component: 'Docker Configuration',
        status: 'fail',
        message: `Docker Compose issues: ${missingServices.length > 0 ? `missing services: ${missingServices.join(', ')}` : 'database name not configured'}`
      });
    }
  } catch (error) {
    results.push({
      component: 'Docker Configuration',
      status: 'fail',
      message: 'Docker Compose file not found or unreadable'
    });
  }

  // Check 5: Database utilities exist
  try {
    const utilsPath = path.join(__dirname, '../src/utils/database.ts');
    const utilsContent = fs.readFileSync(utilsPath, 'utf-8');
    
    const requiredFunctions = ['testDatabaseConnection', 'getDatabaseHealth', 'getDatabaseStats'];
    const missingFunctions = requiredFunctions.filter(fn => !utilsContent.includes(`export async function ${fn}`));
    
    if (missingFunctions.length === 0) {
      results.push({
        component: 'Database Utilities',
        status: 'pass',
        message: 'All database utility functions are implemented'
      });
    } else {
      results.push({
        component: 'Database Utilities',
        status: 'fail',
        message: `Missing utility functions: ${missingFunctions.join(', ')}`
      });
    }
  } catch (error) {
    results.push({
      component: 'Database Utilities',
      status: 'fail',
      message: 'Database utilities file not found or unreadable'
    });
  }

  // Check 6: Package.json scripts
  try {
    const packagePath = path.join(__dirname, '../package.json');
    const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
    
    const requiredScripts = ['db:setup', 'db:seed', 'migrate', 'db:reset'];
    const missingScripts = requiredScripts.filter(script => !packageContent.scripts[script]);
    
    if (missingScripts.length === 0) {
      results.push({
        component: 'NPM Scripts',
        status: 'pass',
        message: 'All required database scripts are configured'
      });
    } else {
      results.push({
        component: 'NPM Scripts',
        status: 'fail',
        message: `Missing scripts: ${missingScripts.join(', ')}`
      });
    }
  } catch (error) {
    results.push({
      component: 'NPM Scripts',
      status: 'fail',
      message: 'Package.json not found or invalid'
    });
  }

  return results;
}

function printResults(results: VerificationResult[]) {
  console.log('🔍 SmartWait Database Setup Verification\n');
  
  let passCount = 0;
  let failCount = 0;
  
  results.forEach(result => {
    const icon = result.status === 'pass' ? '✅' : '❌';
    console.log(`${icon} ${result.component}: ${result.message}`);
    
    if (result.status === 'pass') {
      passCount++;
    } else {
      failCount++;
    }
  });
  
  console.log(`\n📊 Summary: ${passCount} passed, ${failCount} failed`);
  
  if (failCount === 0) {
    console.log('\n🎉 Database setup verification completed successfully!');
    console.log('✨ All components are properly configured for SmartWait MVP');
    console.log('\n📋 Next steps:');
    console.log('1. Start PostgreSQL and Redis: docker-compose -f docker-compose.dev.yml up -d');
    console.log('2. Set up the database: npm run db:setup');
    console.log('3. Start the API server: npm run dev');
  } else {
    console.log('\n⚠️  Some components need attention before proceeding');
    process.exit(1);
  }
}

// Run verification if this script is executed directly
if (require.main === module) {
  const results = verifyDatabaseSetup();
  printResults(results);
}

export { verifyDatabaseSetup };
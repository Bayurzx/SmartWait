#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating SmartWait MVP Setup...\n');

// Check if required files exist
const requiredFiles = [
  'tsconfig.json',
  'docker-compose.yml',
  'docker-compose.dev.yml',
  '.env.example',
  'package.json',
  'apps/api/tsconfig.json',
  'apps/web/tsconfig.json',
  'apps/mobile/tsconfig.json',
  'packages/shared/tsconfig.json',
  'packages/ui/tsconfig.json',
  'packages/api-client/tsconfig.json',
  'packages/config/tsconfig.json'
];

let allFilesExist = true;

console.log('📁 Checking required files:');
requiredFiles.forEach(file => {
  const exists = fs.existsSync(file);
  console.log(`  ${exists ? '✅' : '❌'} ${file}`);
  if (!exists) allFilesExist = false;
});

// Check TypeScript configurations
console.log('\n🔧 Validating TypeScript configurations:');

const tsConfigs = [
  'tsconfig.json',
  'apps/api/tsconfig.json',
  'apps/web/tsconfig.json',
  'apps/mobile/tsconfig.json',
  'packages/shared/tsconfig.json',
  'packages/ui/tsconfig.json',
  'packages/api-client/tsconfig.json',
  'packages/config/tsconfig.json'
];

let allTsConfigsValid = true;

tsConfigs.forEach(configPath => {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const hasCompilerOptions = config.compilerOptions !== undefined;
    console.log(`  ${hasCompilerOptions ? '✅' : '❌'} ${configPath} - ${hasCompilerOptions ? 'Valid' : 'Missing compilerOptions'}`);
    if (!hasCompilerOptions) allTsConfigsValid = false;
  } catch (error) {
    console.log(`  ❌ ${configPath} - Invalid JSON: ${error.message}`);
    allTsConfigsValid = false;
  }
});

// Check package.json scripts
console.log('\n📦 Checking package.json scripts:');

try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const requiredScripts = [
    'dev',
    'build',
    'test',
    'typecheck',
    'docker:dev',
    'docker:prod'
  ];

  let allScriptsExist = true;
  requiredScripts.forEach(script => {
    const exists = packageJson.scripts && packageJson.scripts[script];
    console.log(`  ${exists ? '✅' : '❌'} ${script}`);
    if (!exists) allScriptsExist = false;
  });

  if (!allScriptsExist) {
    console.log('  ⚠️  Some required scripts are missing');
  }
} catch (error) {
  console.log(`  ❌ Error reading package.json: ${error.message}`);
  allTsConfigsValid = false;
}

// Check Docker Compose files
console.log('\n🐳 Validating Docker Compose files:');

const dockerFiles = ['docker-compose.yml', 'docker-compose.dev.yml'];
dockerFiles.forEach(file => {
  try {
    const content = fs.readFileSync(file, 'utf8');
    const hasServices = content.includes('services:');
    const hasPostgres = content.includes('postgres:');
    const hasRedis = content.includes('redis:');
    const hasApi = content.includes('api:');
    
    console.log(`  ${hasServices ? '✅' : '❌'} ${file} - Services section`);
    console.log(`  ${hasPostgres ? '✅' : '❌'} ${file} - PostgreSQL service`);
    console.log(`  ${hasRedis ? '✅' : '❌'} ${file} - Redis service`);
    console.log(`  ${hasApi ? '✅' : '❌'} ${file} - API service`);
  } catch (error) {
    console.log(`  ❌ ${file} - Error reading file: ${error.message}`);
  }
});

// Summary
console.log('\n📋 Setup Validation Summary:');
console.log(`  Files: ${allFilesExist ? '✅ All required files exist' : '❌ Some files are missing'}`);
console.log(`  TypeScript: ${allTsConfigsValid ? '✅ All configurations valid' : '❌ Some configurations invalid'}`);

if (allFilesExist && allTsConfigsValid) {
  console.log('\n🎉 Setup validation completed successfully!');
  console.log('\n📚 Next steps:');
  console.log('  1. Copy .env.example to .env and configure your environment');
  console.log('  2. Run "npm run install:all" to install dependencies');
  console.log('  3. Run "npm run docker:dev" to start development environment');
  console.log('  4. Visit http://localhost:3000 for web app and http://localhost:3001 for API');
} else {
  console.log('\n❌ Setup validation failed. Please fix the issues above.');
  process.exit(1);
}
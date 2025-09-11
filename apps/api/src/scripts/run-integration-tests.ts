#!/usr/bin/env ts-node

/**
 * Integration Test Runner Script
 * Runs comprehensive integration tests for SmartWait MVP
 */

import IntegrationTestRunner from '../__tests__/integration/test-runner';

async function main() {
  const runner = new IntegrationTestRunner();
  
  try {
    console.log('🚀 SmartWait MVP Integration Test Suite');
    console.log('Testing all critical system components...\n');

    // Run critical path tests first
    const criticalPathPassed = await runner.runCriticalPath();
    
    if (!criticalPathPassed) {
      console.error('\n❌ Critical path tests failed. Aborting full test suite.');
      process.exit(1);
    }

    console.log('\n✅ Critical path tests passed. Running full test suite...\n');

    // Run full integration test suite
    const summary = await runner.runAllTests();

    // Exit with appropriate code
    process.exit(summary.overallStatus === 'PASS' ? 0 : 1);
  } catch (error) {
    console.error('\n💥 Integration test runner failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export default main;
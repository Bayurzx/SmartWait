#!/usr/bin/env ts-node

/**
 * Test script for WebSocket authentication and room management
 * 
 * This script tests:
 * 1. WebSocket authentication for staff and patients
 * 2. Room joining and leaving functionality
 * 3. Permission-based room access
 * 4. Connection tracking and management
 */

import { io as Client, Socket } from 'socket.io-client';
import { AuthService } from '../services/auth-service';

// Test configuration
const API_URL = process.env.API_URL || 'http://localhost:3001';
const TEST_TIMEOUT = 30000; // 30 seconds

interface TestResult {
  name: string;
  success: boolean;
  message: string;
  duration: number;
}

class WebSocketAuthTester {
  private authService: AuthService;
  private results: TestResult[] = [];

  constructor() {
    this.authService = new AuthService();
  }

  /**
   * Run all WebSocket authentication tests
   */
  async runAllTests(): Promise<void> {
    console.log('🧪 Starting WebSocket Authentication Tests...\n');

    try {
      // Test 1: Staff authentication
      await this.testStaffAuthentication();

      // Test 2: Patient authentication
      await this.testPatientAuthentication();

      // Test 3: Unauthenticated connection rejection
      await this.testUnauthenticatedRejection();

      // Test 4: Room access permissions
      await this.testRoomPermissions();

      // Test 5: Room management operations
      await this.testRoomManagement();

      // Test 6: Connection tracking
      await this.testConnectionTracking();

      // Test 7: Invalid token handling
      await this.testInvalidTokenHandling();

    } catch (error) {
      console.error('❌ Test suite failed:', error);
    }

    this.printResults();
  }

  /**
   * Test staff authentication via WebSocket
   */
  private async testStaffAuthentication(): Promise<void> {
    const testName = 'Staff WebSocket Authentication';
    const startTime = Date.now();

    try {
      // First, get a valid staff token
      const authResult = await this.authService.authenticateStaff('staff', 'password123');
      
      if (!authResult.success || !authResult.data) {
        throw new Error('Failed to get staff authentication token');
      }

      const token = authResult.data.token;

      // Connect with staff token
      const socket = Client(API_URL, {
        auth: { token },
        transports: ['websocket']
      });

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          socket.disconnect();
          reject(new Error('Authentication timeout'));
        }, 5000);

        socket.on('authenticated', (data) => {
          clearTimeout(timeout);
          
          if (data.userType === 'staff' && data.username === 'staff') {
            console.log('✅ Staff authenticated successfully:', data);
            socket.disconnect();
            resolve();
          } else {
            socket.disconnect();
            reject(new Error('Invalid staff authentication response'));
          }
        });

        socket.on('connect_error', (error) => {
          clearTimeout(timeout);
          socket.disconnect();
          reject(error);
        });
      });

      this.addResult(testName, true, 'Staff authentication successful', Date.now() - startTime);

    } catch (error) {
      this.addResult(testName, false, `Staff authentication failed: ${this.getErrorMessage(error)}`, Date.now() - startTime);
    }
  }

  /**
   * Test patient authentication via WebSocket
   */
  private async testPatientAuthentication(): Promise<void> {
    const testName = 'Patient WebSocket Authentication';
    const startTime = Date.now();

    try {
      const patientId = 'test-patient-123';

      // Connect with patient ID
      const socket = Client(API_URL, {
        auth: { patientId },
        transports: ['websocket']
      });

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          socket.disconnect();
          reject(new Error('Authentication timeout'));
        }, 5000);

        socket.on('authenticated', (data) => {
          clearTimeout(timeout);
          
          if (data.userType === 'patient' && data.patientId === patientId) {
            console.log('✅ Patient authenticated successfully:', data);
            socket.disconnect();
            resolve();
          } else {
            socket.disconnect();
            reject(new Error('Invalid patient authentication response'));
          }
        });

        socket.on('connect_error', (error) => {
          clearTimeout(timeout);
          socket.disconnect();
          reject(error);
        });
      });

      this.addResult(testName, true, 'Patient authentication successful', Date.now() - startTime);

    } catch (error) {
      this.addResult(testName, false, `Patient authentication failed: ${this.getErrorMessage(error)}`, Date.now() - startTime);
    }
  }

  /**
   * Test that unauthenticated connections are rejected
   */
  private async testUnauthenticatedRejection(): Promise<void> {
    const testName = 'Unauthenticated Connection Rejection';
    const startTime = Date.now();

    try {
      // Connect without authentication
      const socket = Client(API_URL, {
        transports: ['websocket']
      });

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          socket.disconnect();
          reject(new Error('Connection should have been rejected'));
        }, 5000);

        socket.on('connect_error', (error) => {
          clearTimeout(timeout);
          socket.disconnect();
          
          if (error.message.includes('Authentication')) {
            console.log('✅ Unauthenticated connection properly rejected:', error.message);
            resolve();
          } else {
            reject(new Error('Unexpected connection error'));
          }
        });

        socket.on('connect', () => {
          clearTimeout(timeout);
          socket.disconnect();
          reject(new Error('Unauthenticated connection was allowed'));
        });
      });

      this.addResult(testName, true, 'Unauthenticated connections properly rejected', Date.now() - startTime);

    } catch (error) {
      this.addResult(testName, false, `Rejection test failed: ${this.getErrorMessage(error)}`, Date.now() - startTime);
    }
  }

  /**
   * Test room access permissions
   */
  private async testRoomPermissions(): Promise<void> {
    const testName = 'Room Access Permissions';
    const startTime = Date.now();

    try {
      // Get staff token
      const authResult = await this.authService.authenticateStaff('staff', 'password123');
      const staffToken = authResult.data?.token;

      if (!staffToken) {
        throw new Error('Failed to get staff token');
      }

      // Test staff room access
      const staffSocket = Client(API_URL, {
        auth: { token: staffToken },
        transports: ['websocket']
      });

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          staffSocket.disconnect();
          reject(new Error('Staff room access test timeout'));
        }, 5000);

        staffSocket.on('authenticated', () => {
          // Try to join patient room (should be allowed for staff)
          staffSocket.emit('join-room', { room: 'patient_test123' });
        });

        staffSocket.on('room-joined', (data) => {
          if (data.room === 'patient_test123') {
            console.log('✅ Staff can access patient rooms:', data);
            clearTimeout(timeout);
            staffSocket.disconnect();
            resolve();
          }
        });

        staffSocket.on('error', (error) => {
          clearTimeout(timeout);
          staffSocket.disconnect();
          reject(error);
        });

        staffSocket.on('connect_error', (error) => {
          clearTimeout(timeout);
          staffSocket.disconnect();
          reject(error);
        });
      });

      // Test patient room restrictions
      const patientSocket = Client(API_URL, {
        auth: { patientId: 'test-patient-456' },
        transports: ['websocket']
      });

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          patientSocket.disconnect();
          reject(new Error('Patient room restriction test timeout'));
        }, 5000);

        patientSocket.on('authenticated', () => {
          // Try to join staff room (should be denied for patients)
          patientSocket.emit('join-room', { room: 'staff' });
        });

        patientSocket.on('error', (error) => {
          if (error.message.includes('Access denied')) {
            console.log('✅ Patient properly denied staff room access:', error);
            clearTimeout(timeout);
            patientSocket.disconnect();
            resolve();
          } else {
            clearTimeout(timeout);
            patientSocket.disconnect();
            reject(new Error('Unexpected error response'));
          }
        });

        patientSocket.on('room-joined', (data) => {
          if (data.room === 'staff') {
            clearTimeout(timeout);
            patientSocket.disconnect();
            reject(new Error('Patient was allowed to join staff room'));
          }
        });

        patientSocket.on('connect_error', (error) => {
          clearTimeout(timeout);
          patientSocket.disconnect();
          reject(error);
        });
      });

      this.addResult(testName, true, 'Room permissions working correctly', Date.now() - startTime);

    } catch (error) {
      this.addResult(testName, false, `Room permissions test failed: ${this.getErrorMessage(error)}`, Date.now() - startTime);
    }
  }

  /**
   * Test room management operations
   */
  private async testRoomManagement(): Promise<void> {
    const testName = 'Room Management Operations';
    const startTime = Date.now();

    try {
      const patientId = 'test-patient-789';

      const socket = Client(API_URL, {
        auth: { patientId },
        transports: ['websocket']
      });

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          socket.disconnect();
          reject(new Error('Room management test timeout'));
        }, 10000);

        let roomsReceived = false;
        let roomLeft = false;

        socket.on('authenticated', () => {
          // Get current rooms
          socket.emit('get-rooms');
        });

        socket.on('current-rooms', (data) => {
          console.log('✅ Current rooms received:', data);
          roomsReceived = true;
          
          // Try to leave the patients room
          socket.emit('leave-room', 'patients');
        });

        socket.on('room-left', (data) => {
          if (data.room === 'patients') {
            console.log('✅ Successfully left room:', data);
            roomLeft = true;
            
            if (roomsReceived && roomLeft) {
              clearTimeout(timeout);
              socket.disconnect();
              resolve();
            }
          }
        });

        socket.on('error', (error) => {
          clearTimeout(timeout);
          socket.disconnect();
          reject(error);
        });

        socket.on('connect_error', (error) => {
          clearTimeout(timeout);
          socket.disconnect();
          reject(error);
        });
      });

      this.addResult(testName, true, 'Room management operations successful', Date.now() - startTime);

    } catch (error) {
      this.addResult(testName, false, `Room management test failed: ${this.getErrorMessage(error)}`, Date.now() - startTime);
    }
  }

  /**
   * Test connection tracking functionality
   */
  private async testConnectionTracking(): Promise<void> {
    const testName = 'Connection Tracking';
    const startTime = Date.now();

    try {
      const patientId = 'test-patient-tracking';

      const socket = Client(API_URL, {
        auth: { patientId },
        transports: ['websocket']
      });

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          socket.disconnect();
          reject(new Error('Connection tracking test timeout'));
        }, 5000);

        socket.on('authenticated', () => {
          // Send ping to test heartbeat
          socket.emit('ping');
        });

        socket.on('pong', (data) => {
          console.log('✅ Heartbeat working:', data);
          clearTimeout(timeout);
          socket.disconnect();
          resolve();
        });

        socket.on('error', (error) => {
          clearTimeout(timeout);
          socket.disconnect();
          reject(error);
        });

        socket.on('connect_error', (error) => {
          clearTimeout(timeout);
          socket.disconnect();
          reject(error);
        });
      });

      this.addResult(testName, true, 'Connection tracking successful', Date.now() - startTime);

    } catch (error) {
      this.addResult(testName, false, `Connection tracking test failed: ${this.getErrorMessage(error)}`, Date.now() - startTime);
    }
  }

  /**
   * Test invalid token handling
   */
  private async testInvalidTokenHandling(): Promise<void> {
    const testName = 'Invalid Token Handling';
    const startTime = Date.now();

    try {
      // Connect with invalid token
      const socket = Client(API_URL, {
        auth: { token: 'invalid-token-123' },
        transports: ['websocket']
      });

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          socket.disconnect();
          reject(new Error('Invalid token should have been rejected'));
        }, 5000);

        socket.on('connect_error', (error) => {
          clearTimeout(timeout);
          socket.disconnect();
          
          if (error.message.includes('Authentication') || error.message.includes('Invalid')) {
            console.log('✅ Invalid token properly rejected:', error.message);
            resolve();
          } else {
            reject(new Error('Unexpected error for invalid token'));
          }
        });

        socket.on('connect', () => {
          clearTimeout(timeout);
          socket.disconnect();
          reject(new Error('Invalid token was accepted'));
        });
      });

      this.addResult(testName, true, 'Invalid tokens properly rejected', Date.now() - startTime);

    } catch (error) {
      this.addResult(testName, false, `Invalid token test failed: ${this.getErrorMessage(error)}`, Date.now() - startTime);
    }
  }

  /**
   * Safely extract error message from unknown error type
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    } else if (typeof error === 'string') {
      return error;
    } else {
      return 'Unknown error occurred';
    }
  }

  /**
   * Add test result
   */
  private addResult(name: string, success: boolean, message: string, duration: number): void {
    this.results.push({ name, success, message, duration });
    
    const status = success ? '✅' : '❌';
    console.log(`${status} ${name}: ${message} (${duration}ms)\n`);
  }

  /**
   * Print final test results
   */
  private printResults(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 WebSocket Authentication Test Results');
    console.log('='.repeat(60));

    const passed = this.results.filter(r => r.success).length;
    const total = this.results.length;
    const totalTime = this.results.reduce((sum, r) => sum + r.duration, 0);

    console.log(`\nTests: ${passed}/${total} passed`);
    console.log(`Total time: ${totalTime}ms`);
    console.log(`Success rate: ${((passed / total) * 100).toFixed(1)}%`);

    if (passed === total) {
      console.log('\n🎉 All WebSocket authentication tests passed!');
    } else {
      console.log('\n❌ Some tests failed. Check the logs above for details.');
      
      const failed = this.results.filter(r => !r.success);
      console.log('\nFailed tests:');
      failed.forEach(test => {
        console.log(`  - ${test.name}: ${test.message}`);
      });
    }

    console.log('\n' + '='.repeat(60));
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  const tester = new WebSocketAuthTester();
  
  tester.runAllTests()
    .then(() => {
      console.log('\n✅ WebSocket authentication test suite completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test suite failed:', error);
      process.exit(1);
    });
}

export { WebSocketAuthTester };
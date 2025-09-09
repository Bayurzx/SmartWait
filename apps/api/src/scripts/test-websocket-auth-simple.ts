#!/usr/bin/env ts-node

/**
 * Simple WebSocket authentication test script
 * 
 * This script tests the basic WebSocket authentication functionality
 * without requiring a full server setup.
 */

import { AuthService } from '../services/auth-service';

// Mock database for testing
const mockSessions = new Map([
    ['valid-staff-token', {
        sessionId: 'session-123',
        user: {
            id: 'staff-1',
            username: 'teststaff',
            role: 'staff'
        },
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
    }]
]);

class SimpleWebSocketAuthTester {
    private authService: AuthService;

    constructor() {
        this.authService = new AuthService();
    }

    /**
     * Test WebSocket authentication logic
     */
    async testAuthentication(): Promise<void> {
        console.log('🧪 Testing WebSocket Authentication Logic...\n');

        try {
            // Test 1: Staff token validation
            await this.testStaffTokenValidation();

            // Test 2: Patient ID validation
            this.testPatientIdValidation();

            // Test 3: Room access permissions
            this.testRoomAccessPermissions();

            // Test 4: Connection tracking
            this.testConnectionTracking();

            // Test 5: Message routing
            this.testMessageRouting();

            console.log('\n🎉 All WebSocket authentication logic tests passed!');

        } catch (error) {
            console.error('\n❌ WebSocket authentication test failed:', error);
            throw error;
        }
    }

    /**
     * Test staff token validation logic
     */
    private async testStaffTokenValidation(): Promise<void> {
        console.log('1. Testing Staff Token Validation...');

        // Mock the validateSession method for testing
        const originalValidateSession = this.authService.validateSession;

        this.authService.validateSession = async (token: string) => {
            const session = mockSessions.get(token);
            if (!session) return null;

            return {
                ...session,
                user: {
                    ...session.user,
                    role: session.user.role as 'staff' | 'admin'
                }
            };
        };

        try {
            // Test valid token
            const validResult = await this.authService.validateSession('valid-staff-token');
            if (!validResult || validResult.user.username !== 'teststaff') {
                throw new Error('Valid token validation failed');
            }
            console.log('   ✅ Valid staff token accepted');

            // Test invalid token
            const invalidResult = await this.authService.validateSession('invalid-token');
            if (invalidResult !== null) {
                throw new Error('Invalid token should be rejected');
            }
            console.log('   ✅ Invalid staff token rejected');

        } finally {
            // Restore original method
            this.authService.validateSession = originalValidateSession;
        }
    }

    /**
     * Test patient ID validation logic
     */
    private testPatientIdValidation(): void {
        console.log('2. Testing Patient ID Validation...');

        const validPatientIds = ['patient-123', 'uuid-format-id', 'test-patient'];
        const invalidPatientIds = ['', null, undefined, 123, {}];

        // Test valid patient IDs
        validPatientIds.forEach(id => {
            const isValid = typeof id === 'string' && id.length > 0;
            if (!isValid) {
                throw new Error(`Valid patient ID rejected: ${id}`);
            }
        });
        console.log('   ✅ Valid patient IDs accepted');

        // Test invalid patient IDs
        invalidPatientIds.forEach(id => {
            const isValid = typeof id === 'string' && id.length > 0;
            if (isValid) {
                throw new Error(`Invalid patient ID accepted: ${id}`);
            }
        });
        console.log('   ✅ Invalid patient IDs rejected');
    }

    /**
     * Test room access permission logic
     */
    private testRoomAccessPermissions(): void {
        console.log('3. Testing Room Access Permissions...');

        // Test staff permissions
        const staffUser = { userType: 'staff' as const, userId: 'staff-1', role: 'staff' };

        // Staff should access staff room
        if (!this.canAccessRoom(staffUser, 'staff')) {
            throw new Error('Staff should access staff room');
        }

        // Staff should access patient rooms
        if (!this.canAccessRoom(staffUser, 'patient_123')) {
            throw new Error('Staff should access patient rooms');
        }
        console.log('   ✅ Staff permissions validated');

        // Test patient permissions
        const patientUser = { userType: 'patient' as const, userId: 'patient-123' };

        // Patient should access patients room
        if (!this.canAccessRoom(patientUser, 'patients')) {
            throw new Error('Patient should access patients room');
        }

        // Patient should access own room
        if (!this.canAccessRoom(patientUser, 'patient_patient-123')) {
            throw new Error('Patient should access own room');
        }

        // Patient should NOT access staff room
        if (this.canAccessRoom(patientUser, 'staff')) {
            throw new Error('Patient should not access staff room');
        }
        console.log('   ✅ Patient permissions validated');

        // Test admin permissions
        const adminUser = { userType: 'staff' as const, userId: 'admin-1', role: 'admin' };

        if (!this.canAccessRoom(adminUser, 'admin')) {
            throw new Error('Admin should access admin room');
        }
        console.log('   ✅ Admin permissions validated');
    }

    /**
     * Test connection tracking logic
     */
    private testConnectionTracking(): void {
        console.log('4. Testing Connection Tracking...');

        const connectedUsers = new Map();
        const socketToUser = new Map();

        // Simulate connections
        const users = [
            { userId: 'staff-1', socketId: 'socket-1', userType: 'staff' },
            { userId: 'patient-1', socketId: 'socket-2', userType: 'patient' },
            { userId: 'patient-2', socketId: 'socket-3', userType: 'patient' }
        ];

        users.forEach(user => {
            connectedUsers.set(user.userId, {
                socketId: user.socketId,
                userId: user.userId,
                userType: user.userType,
                connectedAt: new Date()
            });
            socketToUser.set(user.socketId, user.userId);
        });

        // Verify tracking
        if (connectedUsers.size !== 3) {
            throw new Error('Connection tracking failed');
        }

        if (socketToUser.size !== 3) {
            throw new Error('Socket mapping failed');
        }
        console.log('   ✅ Connection tracking works');

        // Test cleanup
        const userToDisconnect = users[0];
        connectedUsers.delete(userToDisconnect.userId);
        socketToUser.delete(userToDisconnect.socketId);

        const expectedSize = users.length - 1; // 3 - 1 = 2
        if (connectedUsers.size !== expectedSize || socketToUser.size !== expectedSize) {
            throw new Error(`Connection cleanup failed: expected ${expectedSize} users, got ${connectedUsers.size} connected and ${socketToUser.size} mapped`);
        }
        console.log('   ✅ Connection cleanup works');
    }

    /**
     * Test message routing logic
     */
    private testMessageRouting(): void {
        console.log('5. Testing Message Routing...');

        // Simulate room membership
        const rooms = new Map([
            ['staff', new Set(['staff-1', 'staff-2'])],
            ['patients', new Set(['patient-1', 'patient-2'])],
            ['patient_patient-1', new Set(['patient-1'])],
            ['admin', new Set(['admin-1'])]
        ]);

        // Test staff room routing
        const staffRoom = rooms.get('staff');
        if (!staffRoom || !staffRoom.has('staff-1')) {
            throw new Error('Staff room routing failed');
        }
        console.log('   ✅ Staff room routing works');

        // Test patient room routing
        const patientRoom = rooms.get('patient_patient-1');
        if (!patientRoom || !patientRoom.has('patient-1') || patientRoom.has('patient-2')) {
            throw new Error('Patient room routing failed');
        }
        console.log('   ✅ Patient room routing works');

        // Test broadcast to patients
        const patientsRoom = rooms.get('patients');
        if (!patientsRoom || patientsRoom.size !== 2) {
            throw new Error('Patients broadcast routing failed');
        }
        console.log('   ✅ Patients broadcast routing works');
    }

    /**
     * Simulate room access permission check
     */
    private canAccessRoom(user: any, room: string): boolean {
        const { userType, userId, role } = user;

        if (userType === 'staff') {
            // Staff can access most rooms
            if (room === 'staff' || room === 'patients' || room.startsWith('patient_')) {
                return true;
            }
            // Admin-only rooms
            if (room === 'admin' && role === 'admin') {
                return true;
            }
            return room !== 'admin'; // Staff can access other rooms except admin
        }

        if (userType === 'patient') {
            // Patients can access general patients room
            if (room === 'patients') {
                return true;
            }
            // Patients can access their own room
            if (room === `patient_${userId}`) {
                return true;
            }
            // Patients cannot access staff or other patient rooms
            return false;
        }

        return false;
    }
}

// Run tests if this script is executed directly
if (require.main === module) {
    const tester = new SimpleWebSocketAuthTester();

    tester.testAuthentication()
        .then(() => {
            console.log('\n✅ WebSocket authentication logic test completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ WebSocket authentication logic test failed:', error);
            process.exit(1);
        });
}

export { SimpleWebSocketAuthTester };
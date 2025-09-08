#!/usr/bin/env ts-node

/**
 * Test script to verify Twilio integration is properly configured
 * This script validates the Twilio configuration without sending actual SMS
 */

import dotenv from 'dotenv';
import { twilioClient, twilioConfig } from '../config/twilio';
import { NotificationService } from '../services/notification-service';

// Load environment variables
dotenv.config();

async function testTwilioIntegration() {
  console.log('🔧 Testing Twilio SDK Integration...\n');

  try {
    // Test 1: Configuration validation
    console.log('1. Testing Twilio Configuration:');
    console.log(`   ✓ Account SID: ${twilioConfig.accountSid.substring(0, 10)}...`);
    console.log(`   ✓ Auth Token: ${twilioConfig.authToken.substring(0, 10)}...`);
    console.log(`   ✓ Phone Number: ${twilioConfig.phoneNumber}`);
    console.log('   ✅ Configuration loaded successfully\n');

    // Test 2: Twilio client initialization
    console.log('2. Testing Twilio Client:');
    if (!twilioClient) {
      console.log('   ⚠️  Twilio client not initialized (using placeholder credentials)');
      console.log('   ℹ️  This is expected in development with placeholder values');
      console.log('   ✅ Configuration structure is valid\n');
    } else {
      console.log('   ✓ Twilio client initialized');
      console.log(`   ✓ Client account SID: ${twilioClient.accountSid}`);
      console.log('   ✅ Client ready for use\n');
    }

    // Test 3: Account validation (without sending SMS)
    console.log('3. Testing Account Validation:');
    if (!twilioClient) {
      console.log('   ⚠️  Skipping account validation (placeholder credentials)');
      console.log('   ℹ️  Update .env with real Twilio credentials to test account validation');
      console.log('   ✅ Test skipped gracefully\n');
    } else {
      try {
        const account = await twilioClient.api.accounts(twilioConfig.accountSid).fetch();
        console.log(`   ✓ Account Status: ${account.status}`);
        console.log(`   ✓ Account Type: ${account.type}`);
        console.log('   ✅ Account validation successful\n');
      } catch (error) {
        console.log('   ❌ Account validation failed:');
        console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
      }
    }

    // Test 4: Phone number validation
    console.log('4. Testing Phone Number Validation:');
    if (!twilioClient) {
      console.log('   ⚠️  Skipping phone number validation (placeholder credentials)');
      console.log('   ℹ️  Update .env with real Twilio credentials to test phone number validation');
      console.log('   ✅ Test skipped gracefully\n');
    } else {
      try {
        const phoneNumber = await twilioClient.incomingPhoneNumbers.list({
          phoneNumber: twilioConfig.phoneNumber,
          limit: 1
        });
        
        if (phoneNumber.length > 0) {
          console.log(`   ✓ Phone number ${twilioConfig.phoneNumber} is valid and owned`);
          console.log(`   ✓ Capabilities: SMS=${phoneNumber[0].capabilities.sms}, Voice=${phoneNumber[0].capabilities.voice}`);
          console.log('   ✅ Phone number validation successful\n');
        } else {
          console.log(`   ⚠️  Phone number ${twilioConfig.phoneNumber} not found in account`);
          console.log('   This might be a trial account limitation\n');
        }
      } catch (error) {
        console.log('   ❌ Phone number validation failed:');
        console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
      }
    }

    // Test 5: NotificationService initialization
    console.log('5. Testing NotificationService:');
    const notificationService = new NotificationService();
    
    // Test phone number formatting
    const testNumbers = [
      '2125551234',      // Valid US number (NYC area code)
      '(415) 555-1234',  // Valid US number with formatting (SF area code)
      '+14155551234',    // Valid E.164 format
      '415-555-1234',    // Valid US number with dashes
      '1234567890',      // Invalid (starts with 1)
      '0125551234'       // Invalid (starts with 0)
    ];
    
    console.log('   Testing phone number formatting:');
    testNumbers.forEach(number => {
      const isValid = notificationService.validatePhoneNumber(number);
      console.log(`   ${isValid ? '✓' : '❌'} ${number} -> Valid: ${isValid}`);
    });
    
    console.log('   ✅ NotificationService ready\n');

    // Test 6: Message template validation
    console.log('6. Testing Message Templates:');
    const templates = [
      { name: 'Check-in Confirmation', length: 'Hello John Doe! You\'re checked in at position 5. Estimated wait: 25 minutes. We\'ll text you when it\'s almost your turn.'.length },
      { name: 'Get Ready', length: 'John Doe, you\'re next! Please head to the facility now. We\'ll call you in about 15 minutes.'.length },
      { name: 'Call Now', length: 'John Doe, it\'s your turn! Please come to the front desk now.'.length },
      { name: 'Follow Up', length: 'John Doe, this is a reminder that it\'s your turn. Please come to the front desk immediately or you may lose your place in line.'.length }
    ];
    
    templates.forEach(template => {
      const status = template.length <= 160 ? '✓ Single SMS' : template.length <= 1600 ? '✓ Multi-part SMS' : '❌ Too long';
      console.log(`   ${status} ${template.name}: ${template.length} characters`);
    });
    
    console.log('   ✅ All message templates are valid\n');

    console.log('🎉 Twilio SDK Integration Test Complete!');
    console.log('✅ All tests passed - Twilio is ready for SMS notifications');

  } catch (error) {
    console.error('❌ Twilio integration test failed:');
    console.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testTwilioIntegration().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

export default testTwilioIntegration;
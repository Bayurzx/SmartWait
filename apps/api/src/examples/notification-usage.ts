/**
 * Example usage of the NotificationService with Twilio integration
 * This file demonstrates how to use the notification service in the application
 */

import { notificationService } from '../services/notification-service';
import { NotificationMessageType } from '../types/notification';

// Example: Send check-in confirmation
export async function sendCheckInExample() {
  try {
    const result = await notificationService.sendCheckInConfirmation(
      'John Doe',
      '+1234567890',
      5,
      25
    );
    
    if (result.status === 'sent') {
      console.log(`✅ Check-in confirmation sent successfully. Message ID: ${result.messageId}`);
      
      // Optionally, you can check delivery status later
      setTimeout(async () => {
        const deliveryStatus = await notificationService.getDeliveryStatus(result.messageId);
        console.log(`📱 Delivery status: ${deliveryStatus.status}`);
      }, 5000);
      
    } else {
      console.error(`❌ Failed to send check-in confirmation: ${result.error}`);
    }
  } catch (error) {
    console.error('Error sending check-in confirmation:', error);
  }
}

// Example: Send get ready notification
export async function sendGetReadyExample() {
  try {
    const result = await notificationService.sendGetReadySMS('Jane Smith', '+1987654321');
    
    if (result.status === 'sent') {
      console.log(`✅ Get ready SMS sent successfully. Message ID: ${result.messageId}`);
    } else {
      console.error(`❌ Failed to send get ready SMS: ${result.error}`);
    }
  } catch (error) {
    console.error('Error sending get ready SMS:', error);
  }
}

// Example: Send call now notification
export async function sendCallNowExample() {
  try {
    const result = await notificationService.sendCallNowSMS('Bob Johnson', '+1555123456');
    
    if (result.status === 'sent') {
      console.log(`✅ Call now SMS sent successfully. Message ID: ${result.messageId}`);
    } else {
      console.error(`❌ Failed to send call now SMS: ${result.error}`);
    }
  } catch (error) {
    console.error('Error sending call now SMS:', error);
  }
}

// Example: Validate phone numbers before sending
export function validatePhoneNumberExample() {
  const phoneNumbers = [
    '+1234567890',
    '(234) 567-8901',
    '234-567-8901',
    '2345678901',
    '1234567890', // Invalid - starts with 1
    '0234567890'  // Invalid - starts with 0
  ];
  
  console.log('📞 Phone number validation results:');
  phoneNumbers.forEach(phone => {
    const isValid = notificationService.validatePhoneNumber(phone);
    console.log(`${isValid ? '✅' : '❌'} ${phone} - ${isValid ? 'Valid' : 'Invalid'}`);
  });
}

// Example: Queue workflow with notifications
export async function queueWorkflowExample() {
  console.log('🏥 Simulating complete queue workflow with notifications...\n');
  
  const patient = {
    name: 'Alice Cooper',
    phone: '+1555987654',
    position: 3,
    estimatedWait: 45
  };
  
  try {
    // Step 1: Patient checks in
    console.log('1. Patient checks in...');
    const checkInResult = await notificationService.sendCheckInConfirmation(
      patient.name,
      patient.phone,
      patient.position,
      patient.estimatedWait
    );
    
    if (checkInResult.status === 'sent') {
      console.log(`   ✅ Check-in confirmation sent (ID: ${checkInResult.messageId})`);
    }
    
    // Simulate time passing and position changes
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 2: Patient is 2 positions away (get ready)
    console.log('2. Patient is next in line...');
    const getReadyResult = await notificationService.sendGetReadySMS(patient.name, patient.phone);
    
    if (getReadyResult.status === 'sent') {
      console.log(`   ✅ Get ready SMS sent (ID: ${getReadyResult.messageId})`);
    }
    
    // Simulate more time passing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 3: Patient is called
    console.log('3. Patient is called...');
    const callNowResult = await notificationService.sendCallNowSMS(patient.name, patient.phone);
    
    if (callNowResult.status === 'sent') {
      console.log(`   ✅ Call now SMS sent (ID: ${callNowResult.messageId})`);
    }
    
    console.log('\n🎉 Queue workflow completed successfully!');
    
  } catch (error) {
    console.error('❌ Queue workflow failed:', error);
  }
}

// Example: Error handling and retry logic
export async function errorHandlingExample() {
  console.log('🔧 Testing error handling...\n');
  
  try {
    // Test with invalid phone number
    const invalidResult = await notificationService.sendSMS('invalid-phone', 'Test message');
    console.log('Invalid phone result:', invalidResult);
    
    // Test with message too long
    const longMessage = 'a'.repeat(1601);
    const longResult = await notificationService.sendSMS('+1234567890', longMessage);
    console.log('Long message result:', longResult);
    
  } catch (error) {
    console.error('Error handling test failed:', error);
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  console.log('🚀 Running NotificationService examples...\n');
  
  // Run validation example first
  validatePhoneNumberExample();
  console.log('');
  
  // Run workflow example
  queueWorkflowExample().then(() => {
    console.log('\n📋 All examples completed!');
  }).catch(error => {
    console.error('Examples failed:', error);
  });
}
import { Twilio } from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

// Twilio configuration interface
export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
}

// Validate Twilio environment variables
const validateTwilioConfig = (): TwilioConfig => {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;

  if (!TWILIO_ACCOUNT_SID) {
    throw new Error('TWILIO_ACCOUNT_SID environment variable is required');
  }

  if (!TWILIO_AUTH_TOKEN) {
    throw new Error('TWILIO_AUTH_TOKEN environment variable is required');
  }

  if (!TWILIO_PHONE_NUMBER) {
    throw new Error('TWILIO_PHONE_NUMBER environment variable is required');
  }

  // Validate Twilio Account SID format
  if (!TWILIO_ACCOUNT_SID.startsWith('AC') && TWILIO_ACCOUNT_SID !== 'your-twilio-account-sid') {
    throw new Error('TWILIO_ACCOUNT_SID must start with "AC" (e.g., XX1234567890xxxxxx1234567890abcdef)');
  }

  // Validate Auth Token format (should be 32 characters)
  if (TWILIO_AUTH_TOKEN.length !== 32 && TWILIO_AUTH_TOKEN !== 'your-twilio-auth-token') {
    throw new Error('TWILIO_AUTH_TOKEN must be 32 characters long');
  }

  // Validate phone number format
  if (!TWILIO_PHONE_NUMBER.startsWith('+') && TWILIO_PHONE_NUMBER !== '+1234567890') {
    throw new Error('TWILIO_PHONE_NUMBER must be in E.164 format (e.g., +1234567890)');
  }

  return {
    accountSid: TWILIO_ACCOUNT_SID,
    authToken: TWILIO_AUTH_TOKEN,
    phoneNumber: TWILIO_PHONE_NUMBER
  };
};

// Get validated Twilio configuration
export const twilioConfig = validateTwilioConfig();

// Create and export Twilio client instance (only if not using placeholder values)
export const twilioClient = (() => {
  // Check if we're using placeholder/example values
  if (twilioConfig.accountSid === 'your-twilio-account-sid' || 
      twilioConfig.authToken === 'your-twilio-auth-token') {
    console.warn('⚠️  Using placeholder Twilio credentials. Please update .env with real Twilio credentials for SMS functionality.');
    // Return a mock client for development
    return null as any;
  }
  
  return new Twilio(twilioConfig.accountSid, twilioConfig.authToken);
})();

// Export configuration for testing and other uses
export default twilioConfig;
# Twilio SMS Integration Setup Guide

## Overview

This guide walks you through setting up Twilio SMS integration for the SmartWait MVP. The integration enables automated SMS notifications for queue updates, check-in confirmations, and patient alerts.

## Prerequisites

1. **Twilio Account**: Sign up at [twilio.com](https://www.twilio.com)
2. **Phone Number**: Purchase a Twilio phone number for SMS sending
3. **Node.js 18+**: Required for the API server

## Step 1: Create Twilio Account

1. Go to [twilio.com](https://www.twilio.com) and sign up for a free account
2. Verify your email and phone number
3. Complete the account setup process

## Step 2: Get Twilio Credentials

1. **Account SID**: Found on your Twilio Console Dashboard
   - Format: `XX1234567890xxxxxx1234567890abcdef`
   - Starts with "AC" followed by 32 characters

2. **Auth Token**: Found on your Twilio Console Dashboard
   - Click the "Show" button to reveal the token
   - 32-character string

3. **Phone Number**: Purchase a phone number from Twilio
   - Go to Phone Numbers > Manage > Buy a number
   - Choose a number with SMS capabilities
   - Format: `+1234567890` (E.164 format)

## Step 3: Configure Environment Variables

Update your `.env` file with your Twilio credentials:

```bash
# Twilio SMS Configuration
TWILIO_ACCOUNT_SID=ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
TWILIO_AUTH_TOKEN=your_32_character_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

### Environment Variable Details

- **TWILIO_ACCOUNT_SID**: Your unique Twilio Account SID
- **TWILIO_AUTH_TOKEN**: Your Twilio Auth Token (keep this secret!)
- **TWILIO_PHONE_NUMBER**: Your Twilio phone number in E.164 format

## Step 4: Test the Integration

Run the Twilio integration test to verify everything is working:

```bash
cd apps/api
npm run test:twilio
```

Expected output:
```
🔧 Testing Twilio SDK Integration...

1. Testing Twilio Configuration:
   ✓ Account SID: AC10956405...
   ✓ Auth Token: f5c1daf478...
   ✓ Phone Number: +15551234567
   ✅ Configuration loaded successfully

2. Testing Twilio Client:
   ✓ Twilio client initialized
   ✓ Client account SID: XX1234567890xxxxxx1234567890abcdef
   ✅ Client ready for use

3. Testing Account Validation:
   ✓ Account Status: active
   ✓ Account Type: Trial
   ✅ Account validation successful

🎉 Twilio SDK Integration Test Complete!
✅ All tests passed - Twilio is ready for SMS notifications
```

## Step 5: Test SMS Sending (Optional)

To test actual SMS sending, you can use the notification service directly:

```typescript
import { NotificationService } from './src/services/notification-service';

const notificationService = new NotificationService();

// Test SMS (replace with your phone number)
const result = await notificationService.sendSMS(
  '+1234567890', 
  'Test message from SmartWait!'
);

console.log('SMS Result:', result);
```

## SMS Message Templates

The system includes pre-built message templates:

### 1. Check-in Confirmation
```
Hello John Doe! You're checked in at position 5. Estimated wait: 25 minutes. We'll text you when it's almost your turn.
```

### 2. Get Ready Notification
```
John Doe, you're next! Please head to the facility now. We'll call you in about 15 minutes.
```

### 3. Call Now Notification
```
John Doe, it's your turn! Please come to the front desk now.
```

### 4. Follow-up Reminder
```
John Doe, this is a reminder that it's your turn. Please come to the front desk immediately or you may lose your place in line.
```

## Phone Number Validation

The system validates phone numbers and supports multiple formats:

**Supported Formats:**
- `2125551234` (10-digit US number)
- `(212) 555-1234` (formatted US number)
- `+12125551234` (E.164 format)
- `212-555-1234` (dashed format)

**Invalid Formats:**
- Numbers starting with 0 or 1
- Numbers shorter than 10 digits
- International numbers without country code

## Error Handling

The integration includes comprehensive error handling:

### Common Errors

1. **Invalid Credentials**
   ```
   Error: TWILIO_ACCOUNT_SID environment variable is required
   ```
   **Solution**: Check your .env file has the correct Account SID

2. **Authentication Failed**
   ```
   Error: The provided token is not valid for this account
   ```
   **Solution**: Verify your Auth Token is correct and not expired

3. **Invalid Phone Number**
   ```
   Error: The 'From' number +1234567890 is not a valid phone number
   ```
   **Solution**: Ensure you're using a Twilio phone number you own

4. **Message Too Long**
   ```
   Error: Message too long. Maximum 1600 characters allowed.
   ```
   **Solution**: SMS messages are limited to 1600 characters

### Graceful Degradation

If Twilio is unavailable, the system will:
- Log the error for debugging
- Continue queue operations without SMS
- Return mock success responses in development
- Allow manual notification as fallback

## Trial Account Limitations

Twilio trial accounts have restrictions:
- Can only send SMS to verified phone numbers
- Messages include "Sent from your Twilio trial account" prefix
- Limited to $15.50 in free credits
- Some features may be restricted

**To remove limitations**: Upgrade to a paid Twilio account

## Production Considerations

### Security
- Store credentials in secure environment variables
- Use different credentials for development/staging/production
- Rotate Auth Tokens regularly
- Monitor usage for unusual activity

### Monitoring
- Set up Twilio webhooks for delivery status
- Monitor SMS delivery rates
- Track failed messages for retry logic
- Set up alerts for high failure rates

### Compliance
- Ensure TCPA compliance for SMS marketing
- Provide opt-out mechanisms (STOP keyword)
- Respect patient communication preferences
- Log all SMS communications for audit

## Troubleshooting

### Test Connection Issues

1. **Check Network Connectivity**
   ```bash
   curl -X GET "https://api.twilio.com/2010-04-01/Accounts.json" \
     -u "AC123:your_auth_token"
   ```

2. **Verify Credentials Format**
   - Account SID: Must start with "AC" and be 34 characters
   - Auth Token: Must be exactly 32 characters
   - Phone Number: Must be in E.164 format (+1234567890)

3. **Check Account Status**
   - Log into Twilio Console
   - Verify account is active
   - Check account balance (for paid accounts)

### Common Integration Issues

1. **Module Not Found Error**
   ```bash
   npm install twilio
   ```

2. **TypeScript Errors**
   ```bash
   npm install @types/twilio --save-dev
   ```

3. **Environment Variables Not Loading**
   - Ensure `.env` file is in the correct location
   - Restart the application after changing .env
   - Check for typos in variable names

## Support

- **Twilio Documentation**: [twilio.com/docs](https://www.twilio.com/docs)
- **Twilio Support**: Available through Twilio Console
- **SmartWait Issues**: Create an issue in the project repository

## Next Steps

After setting up Twilio:
1. Test the complete patient journey with SMS notifications
2. Configure webhook endpoints for delivery status tracking
3. Set up monitoring and alerting for SMS failures
4. Implement opt-out handling for patient preferences
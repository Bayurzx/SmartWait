# SmartWait Staff User Guide

## Overview

SmartWait is a virtual queue management system that helps healthcare staff efficiently manage patient flow while providing patients with the flexibility to wait remotely. This guide covers all staff dashboard features and daily operations.

## Getting Started

### Accessing the Staff Dashboard

1. **Web Browser**: Navigate to [yourdomain.com/staff](https://yourdomain.com/staff)
2. **Direct Link**: [staff.yourdomain.com](https://staff.yourdomain.com) (if configured)
3. **From Main Site**: Click "Staff Dashboard" on the main page

### Login Credentials

- **Username**: Provided by your system administrator
- **Password**: Provided by your system administrator
- **Session Duration**: 8 hours (automatic logout for security)

### Initial Setup

When logging in for the first time:
1. Enter your username and password
2. You'll be redirected to the main dashboard
3. Bookmark the dashboard page for quick access
4. Change your password if using a temporary one

## Dashboard Overview

### Main Dashboard Features

The staff dashboard displays:
- **Queue Statistics**: Number of waiting, called, and completed patients
- **Patient Queue Table**: Real-time list of all patients
- **Action Buttons**: Call next patient, mark complete, refresh
- **Connection Status**: Real-time update connection indicator
- **Last Updated**: Timestamp of last data refresh

### Queue Statistics Cards

- **Waiting**: Patients currently in queue waiting to be called
- **Called**: Patients who have been called but not yet completed
- **Completed Today**: Total patients completed today

## Daily Operations

### 1. Managing the Patient Queue

#### Viewing the Queue
The main table shows all active patients with:
- **Position**: Patient's current position in line
- **Name**: Patient's full name
- **Phone**: Patient's phone number (formatted)
- **Check-in Time**: When the patient checked in
- **Wait Time**: How long the patient has been waiting
- **Status**: Current status (Waiting, Called, Completed)
- **Actions**: Available actions for each patient

#### Queue Status Indicators
- 🔵 **Waiting**: Patient is in queue waiting to be called
- 🟢 **Called**: Patient has been called and should be arriving
- ⚪ **Completed**: Patient visit is finished

### 2. Calling the Next Patient

#### Using "Call Next Patient" Button
1. Click the green "Call Next Patient" button
2. The system automatically:
   - Identifies the next waiting patient (position #1)
   - Changes their status to "Called"
   - Sends them an SMS notification
   - Updates the queue positions for remaining patients

#### What Happens When You Call a Patient
- **SMS Sent**: Patient receives "It's your turn! Please come to the front desk now."
- **Status Updated**: Patient status changes from "Waiting" to "Called"
- **Queue Advanced**: Other patients move up one position
- **Real-time Update**: All connected devices see the change immediately

#### If No Patients Are Waiting
- The "Call Next Patient" button will be disabled
- You'll see "No patients waiting" message
- The button becomes active again when patients check in

### 3. Completing Patient Visits

#### Marking Patients as Complete
1. Find the patient with "Called" status in the table
2. Click "Mark Complete" in their Actions column
3. The system automatically:
   - Removes the patient from the active queue
   - Updates statistics
   - Advances remaining patients' positions

#### When to Mark Complete
- ✅ Patient has finished their appointment
- ✅ Patient has left the facility
- ✅ All necessary paperwork is completed

#### What Happens When You Complete a Patient
- **Queue Updated**: Patient is removed from active queue
- **Positions Advanced**: Remaining patients move up
- **Statistics Updated**: Completed count increases
- **Real-time Update**: Changes appear immediately on all devices

### 4. Real-Time Updates

#### Connection Status Indicator
- 🟢 **Connected**: Real-time updates are working
- 🟡 **Connecting**: Attempting to reconnect
- 🔴 **Disconnected**: No real-time updates (using polling backup)

#### Automatic Updates
The dashboard automatically updates when:
- New patients check in
- Patients are called or completed
- Queue positions change
- Connection status changes

#### Manual Refresh
- Click the refresh button (🔄) to manually update data
- Use this if you suspect data is out of sync
- The page will show a loading indicator during refresh

## Advanced Features

### 1. Queue Management

#### Handling Special Situations

**Patient Doesn't Show Up After Being Called:**
1. Wait 10-15 minutes for the patient to arrive
2. If they don't show, you can:
   - Call the next patient
   - Mark the no-show patient as complete
   - Contact the patient directly if needed

**Patient Arrives Late:**
1. Check if they're still in the queue
2. If yes, you can still call them when ready
3. If they've been removed, they may need to check in again

**Emergency or Urgent Patient:**
1. Handle the emergency patient immediately
2. Continue with the regular queue afterward
3. The queue will automatically adjust

#### Multiple Staff Members
- Multiple staff can use the dashboard simultaneously
- Changes made by one staff member appear for all others
- Only one staff member should call patients to avoid confusion

### 2. Patient Information

#### Viewing Patient Details
Each patient row shows:
- **Full Name**: As entered during check-in
- **Phone Number**: Formatted for easy reading
- **Check-in Time**: When they joined the queue
- **Wait Time**: Live calculation of waiting duration
- **Position**: Current position in line

#### Patient Privacy
- Only necessary information is displayed
- Phone numbers are partially masked for privacy
- No medical information is stored or displayed

### 3. Queue Statistics

#### Understanding the Numbers
- **Waiting**: Patients currently in queue
- **Called**: Patients notified but not yet completed
- **Completed Today**: Total finished appointments today

#### Using Statistics for Planning
- Monitor queue length to manage patient expectations
- Track completion rate to identify bottlenecks
- Use wait times to improve scheduling

## Troubleshooting

### Common Issues and Solutions

#### Dashboard Not Loading
**Symptoms**: Page won't load or shows error
**Solutions**:
1. Check internet connection
2. Try refreshing the page (Ctrl+F5 or Cmd+Shift+R)
3. Clear browser cache and cookies
4. Try a different browser
5. Contact IT support if problem persists

#### Real-Time Updates Not Working
**Symptoms**: Red connection indicator, data not updating
**Solutions**:
1. Check the connection status indicator
2. Click the manual refresh button
3. Check internet connection
4. Try logging out and back in
5. Contact technical support

#### Can't Call Next Patient
**Symptoms**: "Call Next Patient" button is disabled
**Possible Causes**:
- No patients are waiting in queue
- System is processing a previous action
- Connection issue
**Solutions**:
1. Check if there are waiting patients
2. Wait a moment and try again
3. Refresh the page
4. Check connection status

#### Patient Not Receiving SMS
**Symptoms**: Patient says they didn't get notification
**Solutions**:
1. Verify the patient's phone number in the system
2. Ask patient to check spam/blocked messages
3. Try calling the patient directly
4. Check if SMS service is working (contact IT)

#### Wrong Patient Information
**Symptoms**: Patient name or phone number is incorrect
**Solutions**:
1. Patient may need to check in again with correct information
2. Contact system administrator for data corrections
3. Use manual communication as backup

### Error Messages

#### "Session Expired"
- **Cause**: You've been logged in for more than 8 hours
- **Solution**: Log in again with your credentials

#### "Unauthorized Access"
- **Cause**: Login session is invalid
- **Solution**: Return to login page and sign in again

#### "Network Error"
- **Cause**: Connection to server lost
- **Solution**: Check internet connection and refresh page

#### "Patient Not Found"
- **Cause**: Patient data may have been removed or corrupted
- **Solution**: Ask patient to check in again

## Best Practices

### Daily Workflow

#### Starting Your Shift
1. Log into the staff dashboard
2. Review current queue status
3. Check connection indicator is green
4. Familiarize yourself with waiting patients

#### During Operations
1. Call patients promptly when ready
2. Mark patients complete immediately after their visit
3. Monitor queue length and wait times
4. Keep the dashboard open and visible

#### End of Shift
1. Ensure all called patients are marked complete
2. Review any remaining patients in queue
3. Log out of the dashboard
4. Communicate queue status to next shift

### Communication Tips

#### With Patients
- Let patients know about SmartWait when they arrive
- Explain they'll receive text message updates
- Remind them to keep their phone with them
- Help patients who need assistance with check-in

#### With Colleagues
- Communicate any queue issues to other staff
- Share login credentials securely
- Report technical problems promptly
- Coordinate patient flow during busy periods

### Security Best Practices

#### Password Security
- Never share your login credentials
- Use a strong, unique password
- Log out when leaving your workstation
- Report any security concerns immediately

#### Patient Privacy
- Don't discuss patient information unnecessarily
- Keep the dashboard screen private from patients
- Follow HIPAA guidelines for patient information
- Report any privacy concerns

## Training and Support

### Getting Help

#### Technical Issues
- **IT Support**: Contact your facility's IT department
- **System Administrator**: For account issues or permissions
- **User Manual**: Refer to this guide for common questions

#### Training Resources
- **Initial Training**: Required for all new staff
- **Refresher Training**: Available upon request
- **Quick Reference**: Keep this guide handy
- **Peer Support**: Ask experienced colleagues for help

### Feedback and Improvements

#### Reporting Issues
When reporting problems, include:
- What you were trying to do
- What happened instead
- Any error messages you saw
- Your browser and operating system

#### Suggesting Improvements
We welcome feedback on:
- Features that would be helpful
- Workflow improvements
- User interface suggestions
- Training needs

Send feedback to: [feedback@yourdomain.com](mailto:feedback@yourdomain.com)

## Quick Reference

### Essential Actions
- **Call Next Patient**: Green button at top of queue table
- **Mark Complete**: Blue "Mark Complete" link next to called patients
- **Refresh Data**: Circular arrow button in header
- **Check Connection**: Look for colored dot in header

### Keyboard Shortcuts
- **Refresh Page**: F5 or Ctrl+R (Cmd+R on Mac)
- **Force Refresh**: Ctrl+F5 or Ctrl+Shift+R (Cmd+Shift+R on Mac)
- **Logout**: Available in user menu

### Important Links
- **Staff Dashboard**: [yourdomain.com/staff](https://yourdomain.com/staff)
- **Main Site**: [yourdomain.com](https://yourdomain.com)
- **Support**: [support@yourdomain.com](mailto:support@yourdomain.com)

### Emergency Contacts
- **Technical Support**: [Your IT contact]
- **System Administrator**: [Your admin contact]
- **After Hours Support**: [Emergency contact]

---

**Questions?** Contact your system administrator or IT support team for additional help with SmartWait. 🏥✨
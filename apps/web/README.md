# SmartWait Web Portal

A Next.js 13+ web application providing browser-based access to the SmartWait virtual queue management system.

## Features

### ✅ Implemented (Day 7 Task)

- **Next.js 13+ with App Router**: Modern React framework with server-side rendering
- **TypeScript**: Full type safety throughout the application
- **Tailwind CSS**: Responsive, utility-first styling
- **Responsive Check-In Form**: Matches mobile app functionality with:
  - Full name validation (2-50 characters, letters/spaces/hyphens/apostrophes only)
  - Phone number formatting and validation (10-15 digits, auto-formats to (XXX) XXX-XXXX)
  - Appointment time validation (supports 12-hour and 24-hour formats)
  - Real-time field validation with error messages
  - Loading states and form submission handling
- **Queue Status Page**: Real-time queue position tracking with:
  - Dynamic queue position display
  - Estimated wait time
  - Status-based messaging (waiting, called, completed)
  - Connection status indicator
  - Auto-refresh functionality
- **Error Handling**: Comprehensive error boundaries and user-friendly error messages
- **Accessibility**: Proper ARIA labels, semantic HTML, keyboard navigation
- **Mobile-First Design**: Responsive layout that works on all screen sizes

### ✅ Real-Time Features

- **WebSocket Integration**: Full Socket.io client implementation with:
  - Automatic connection management and reconnection
  - Patient-specific room joining for targeted updates
  - Real-time position and status updates
  - Connection status monitoring and error handling
  - Fallback polling when WebSocket is unavailable
- **Custom React Hook**: `useWebSocket` hook for easy WebSocket integration
- **Visual Feedback**: Real-time update animations and connection indicators
- **Resilient Architecture**: Graceful degradation with polling fallback

### 🔄 Ready for Integration

- **API Service**: Abstracted API calls ready for backend integration
- **Local Storage**: Patient ID persistence for status checking
- **URL-based Status**: Shareable status links (`/status/[patientId]`)

## Project Structure

```
src/
├── app/                    # Next.js 13+ App Router pages
│   ├── checkin/           # Check-in form page
│   ├── status/[id]/       # Dynamic queue status page
│   ├── layout.tsx         # Root layout with error boundary
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles with Tailwind
├── components/            # Reusable React components
│   ├── CheckInForm.tsx    # Main check-in form component
│   ├── ErrorBoundary.tsx  # Error handling component
│   └── LoadingSpinner.tsx # Loading indicator component
├── services/              # API and external services
│   └── api.ts            # API service abstraction
└── types/                 # TypeScript type definitions
    └── index.ts          # Shared types and interfaces
```

## Key Components

### CheckInForm Component

Responsive form component that matches mobile app functionality:

- **Validation**: Real-time field validation with user-friendly error messages
- **Phone Formatting**: Automatic formatting to (XXX) XXX-XXXX format
- **Loading States**: Visual feedback during form submission
- **Accessibility**: Full ARIA support and semantic HTML
- **Error Handling**: Graceful error handling with retry options

### WebSocket Service

Comprehensive WebSocket client for real-time communication:

- **Connection Management**: Automatic connection, reconnection, and error handling
- **Room Management**: Patient-specific room joining and leaving
- **Event Handling**: Position updates, status changes, and queue updates
- **Resilience**: Exponential backoff reconnection strategy
- **Type Safety**: Full TypeScript support with proper event typing

### useWebSocket Hook

Custom React hook for WebSocket integration:

- **State Management**: Connection status, error handling, and reconnection attempts
- **Event Callbacks**: Easy integration with React components
- **Automatic Cleanup**: Proper cleanup on component unmount
- **Room Management**: Automatic patient room joining/leaving
- **Reconnection Control**: Manual reconnection capabilities

### Queue Status Page

Dynamic status page for tracking queue position:

- **Real-time Updates**: WebSocket-based live updates with polling fallback
- **Connection Management**: Automatic reconnection with visual status indicators
- **Update Animations**: Visual feedback when position or status changes
- **Patient Room Management**: Automatic joining/leaving of patient-specific rooms
- **Responsive Design**: Works on mobile and desktop
- **Shareable URLs**: Direct links to patient status pages
- **Resilient Architecture**: Graceful handling of connection failures

## API Integration

The application is ready for backend integration with the following endpoints:

```typescript
// Check-in endpoint
POST /api/checkin
Body: { name: string, phone: string, appointmentTime: string }
Response: { success: boolean, data: { patientId: string, position: number, estimatedWait: number } }

// Queue status endpoint
GET /api/position/{patientId}
Response: { patientId: string, position: number, estimatedWait: number, status: string }
```

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Type checking
npm run type-check

# Linting
npm run lint
```

### Environment Variables

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Testing

The application includes comprehensive tests for the CheckInForm component:

- Form validation testing
- Phone number formatting
- Error handling
- Loading states
- Form submission

Run tests with: `npm test -- --testPathPattern=CheckInForm.test.tsx`

## Responsive Design

The application is fully responsive and works on:

- **Mobile devices** (320px+)
- **Tablets** (768px+)
- **Desktop** (1024px+)

Key responsive features:
- Mobile-first CSS approach
- Touch-friendly form inputs
- Readable typography at all sizes
- Optimized button sizes for touch

## Performance

- **Server-Side Rendering**: Fast initial page loads
- **Code Splitting**: Automatic code splitting with Next.js
- **Optimized Images**: Next.js image optimization
- **Minimal Bundle Size**: Tree-shaking and dead code elimination

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Deployment

The application is ready for deployment on:

- **Vercel** (recommended for Next.js)
- **Netlify**
- **AWS Amplify**
- **Docker** (Dockerfile included)

## Next Steps

1. **Backend Integration**: Connect to actual API endpoints
2. **WebSocket Integration**: Add real-time updates
3. **Staff Dashboard**: Implement staff management interface
4. **Advanced Features**: Add location services, notifications, etc.

## Task Completion

✅ **Day 7 Task Complete**: 
- Set up Next.js 13+ application with TypeScript and Tailwind CSS
- Created responsive check-in form matching mobile app functionality
- Implemented server-side rendering for fast initial page load
- Built queue status page with real-time update infrastructure
- Added form validation and error handling
- Implemented responsive design for mobile and desktop
- Added loading states and error boundaries

The web portal is now ready for integration with the backend API and provides a complete alternative to the mobile app for patient check-in and queue tracking.
# SmartWait - Healthcare Queue Management System

A comprehensive virtual queuing ecosystem that transforms healthcare waiting experiences through intelligent queue management, real-time communication, and data-driven optimization.

## 🏗️ Project Structure

This is a monorepo containing all SmartWait applications and services:

```
smartwait/
├── apps/
│   ├── api/          # Node.js/Express API server
│   ├── web/          # Next.js web portal and staff dashboard
│   └── mobile/       # React Native mobile app (Expo)
├── packages/
│   └── shared/       # Shared types and utilities
├── infrastructure/
│   └── docker/       # Docker configurations
└── docs/            # Documentation
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm 8+
- Docker and Docker Compose
- Expo CLI (for mobile development)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd smartwait
   ```

2. **Install dependencies**
   ```bash
   npm run install:all
   ```

3. **Set up environment variables**
   ```bash
   # Copy environment files
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env
   
   # Edit the .env files with your configuration
   ```

4. **Start the development environment**
   ```bash
   # Start all services with Docker
   docker-compose up -d
   
   # Or start individual services
   npm run dev
   ```

### Development URLs

- **API Server**: http://localhost:3001
- **Web Portal**: http://localhost:3000
- **Mobile App**: Use Expo Go app to scan QR code

## 📱 Applications

### API Server (`apps/api`)
- **Technology**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Redis caching
- **Features**: Queue management, SMS notifications, real-time updates

### Web Portal (`apps/web`)
- **Technology**: Next.js 13, React, TypeScript, Tailwind CSS
- **Features**: Patient check-in portal, staff dashboard

### Mobile App (`apps/mobile`)
- **Technology**: React Native, Expo, TypeScript
- **Features**: Patient check-in, queue status tracking, push notifications

## 🛠️ Development

### Available Scripts

```bash
# Development
npm run dev              # Start all services
npm run dev:api          # Start API server only
npm run dev:web          # Start web portal only
npm run dev:mobile       # Start mobile app only

# Building
npm run build            # Build all applications
npm run build:api        # Build API server
npm run build:web        # Build web portal

# Testing
npm run test             # Run all tests
npm run test:api         # Test API server
npm run test:web         # Test web portal
npm run test:mobile      # Test mobile app

# Linting
npm run lint             # Lint all projects
```

### Database Setup

The PostgreSQL database is automatically initialized with Docker Compose. The schema includes:

- **patients**: Patient information
- **queue_positions**: Queue management
- **staff_sessions**: Staff authentication
- **sms_notifications**: SMS delivery tracking

### Environment Configuration

#### API Server (`.env`)
```env
PORT=3001
DATABASE_URL=postgresql://user:password@localhost:5432/smartwait
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-jwt-secret
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=+1234567890
```

#### Web Portal (`.env`)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

## 🏥 Features

### Core Functionality
- ✅ **Multi-channel Check-in**: Mobile app, web portal, QR codes
- ✅ **Real-time Queue Management**: Live position updates
- ✅ **SMS Notifications**: Automated patient notifications
- ✅ **Staff Dashboard**: Queue management interface
- ✅ **Remote Waiting**: Location-based waiting capabilities

### Technical Features
- 🔒 **HIPAA Compliant**: Secure patient data handling
- 📱 **Cross-platform**: iOS, Android, and web support
- ⚡ **Real-time Updates**: WebSocket-based live updates
- 🔄 **API Integration**: Healthcare system compatibility
- 📊 **Analytics**: Queue performance insights

## 🧪 Testing

### Unit Tests
```bash
npm run test:api         # API unit tests
npm run test:web         # Web component tests
npm run test:mobile      # Mobile component tests
```

### Integration Tests
```bash
# API integration tests
cd apps/api && npm run test:integration

# End-to-end tests
cd apps/web && npm run test:e2e
```

## 📦 Deployment

### Docker Production Build
```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy to production
docker-compose -f docker-compose.prod.yml up -d
```

### Individual Service Deployment
```bash
# API Server
cd apps/api
npm run build
npm start

# Web Portal
cd apps/web
npm run build
npm start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript strict mode
- Use conventional commit messages
- Write tests for new features
- Update documentation as needed
- Follow the established code style

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in this repository
- Check the [documentation](./docs/)
- Review the [API documentation](http://localhost:3001/docs) when running locally

## 🗺️ Roadmap

- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] Voice notifications
- [ ] Digital signage integration
- [ ] Advanced EHR integrations
- [ ] Machine learning wait time predictions
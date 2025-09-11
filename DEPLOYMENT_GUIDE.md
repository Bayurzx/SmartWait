# SmartWait MVP Production Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the SmartWait MVP to a production environment. The deployment uses Docker Compose with production-optimized configurations, automated backups, monitoring, and security best practices.

## Prerequisites

### System Requirements

- **Operating System**: Ubuntu 20.04 LTS or newer (recommended)
- **CPU**: 2+ cores
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 50GB minimum, 100GB recommended
- **Network**: Static IP address with ports 80, 443 open

### Software Requirements

- Docker 20.10+
- Docker Compose 2.0+
- Git
- curl
- openssl (for SSL certificates)

### Domain and SSL

- Domain name pointing to your server
- SSL certificate (Let's Encrypt recommended)
- Subdomain for staff dashboard (optional)

## Pre-Deployment Setup

### 1. Server Preparation

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y docker.io docker-compose git curl openssl ufw

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Configure firewall
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### 2. Clone Repository

```bash
# Clone the SmartWait repository
git clone https://github.com/your-org/smartwait-mvp.git
cd smartwait-mvp

# Checkout production branch (if applicable)
git checkout main
```

### 3. Configure Environment Variables

```bash
# Copy production environment template
cp .env.production.example .env.production

# Edit production configuration
nano .env.production
```

**Critical settings to update:**

```bash
# Database passwords
DATABASE_URL=postgresql://smartwait_user:YOUR_STRONG_DB_PASSWORD@localhost:5432/smartwait_production
DB_PASSWORD=YOUR_STRONG_DB_PASSWORD

# Redis password
REDIS_PASSWORD=YOUR_STRONG_REDIS_PASSWORD

# JWT secret (generate with: openssl rand -base64 32)
JWT_SECRET=YOUR_VERY_STRONG_JWT_SECRET_32_CHARS_MINIMUM

# Session secret
SESSION_SECRET=YOUR_STRONG_SESSION_SECRET

# Domain configuration
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Twilio credentials
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

### 4. Create Secrets

```bash
# Create secrets directory
mkdir -p secrets

# Generate and store secrets
echo "YOUR_STRONG_DB_PASSWORD" > secrets/postgres_password.txt
echo "YOUR_STRONG_REDIS_PASSWORD" > secrets/redis_password.txt
echo "YOUR_VERY_STRONG_JWT_SECRET" > secrets/jwt_secret.txt
echo "your_twilio_auth_token" > secrets/twilio_auth_token.txt

# Secure secrets directory
chmod 600 secrets/*
chmod 700 secrets
```

### 5. SSL Certificate Setup

#### Option A: Let's Encrypt (Recommended)

```bash
# Install Certbot
sudo apt install -y certbot

# Generate certificate
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Copy certificates to project
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem infrastructure/ssl/smartwait.crt
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem infrastructure/ssl/smartwait.key
sudo chown $USER:$USER infrastructure/ssl/*
```

#### Option B: Self-Signed Certificate (Development)

```bash
# Create SSL directory
mkdir -p infrastructure/ssl

# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout infrastructure/ssl/smartwait.key \
  -out infrastructure/ssl/smartwait.crt \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=yourdomain.com"
```

## Deployment Process

### 1. Run Deployment Script

```bash
# Make deployment script executable
chmod +x scripts/deploy-production.sh

# Run deployment
./scripts/deploy-production.sh
```

The deployment script will:
- Perform pre-deployment checks
- Build production Docker images
- Start services in the correct order
- Run database migrations
- Perform health checks
- Display deployment summary

### 2. Verify Deployment

```bash
# Check service status
docker-compose -f docker-compose.prod.yml ps

# Check service health
curl -f https://yourdomain.com/health

# Check logs
docker-compose -f docker-compose.prod.yml logs api
docker-compose -f docker-compose.prod.yml logs web
```

### 3. Create Initial Staff User

```bash
# Connect to database
docker-compose -f docker-compose.prod.yml exec postgres psql -U smartwait_user -d smartwait_production

# Create staff user (replace with your details)
INSERT INTO staff_sessions (username, session_token, expires_at) 
VALUES ('admin', 'temporary_token_change_immediately', NOW() + INTERVAL '1 hour');
```

## Post-Deployment Configuration

### 1. Test SMS Functionality

```bash
# Test SMS with real Twilio credentials
curl -X POST https://yourdomain.com/api/checkin \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Patient",
    "phone": "+1234567890",
    "appointmentTime": "2:00 PM"
  }'
```

### 2. Configure Monitoring

Access monitoring dashboards:
- **Prometheus**: http://your-server-ip:9090
- **Grafana**: http://your-server-ip:3001 (admin/admin)

### 3. Set Up Automated Backups

Backups are automatically configured to run daily at 2 AM. To test:

```bash
# Run manual backup
docker-compose -f docker-compose.prod.yml exec backup /scripts/backup.sh

# Check backup files
ls -la backups/
```

### 4. Configure Log Rotation

```bash
# Create logrotate configuration
sudo tee /etc/logrotate.d/smartwait << EOF
/path/to/smartwait/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
    postrotate
        docker-compose -f /path/to/smartwait/docker-compose.prod.yml restart nginx
    endscript
}
EOF
```

## Maintenance and Operations

### Service Management

```bash
# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Stop all services
docker-compose -f docker-compose.prod.yml down

# Restart specific service
docker-compose -f docker-compose.prod.yml restart api

# View logs
docker-compose -f docker-compose.prod.yml logs -f api

# Scale services (if needed)
docker-compose -f docker-compose.prod.yml up -d --scale api=2
```

### Database Operations

```bash
# Connect to database
docker-compose -f docker-compose.prod.yml exec postgres psql -U smartwait_user -d smartwait_production

# Create database backup
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U smartwait_user smartwait_production > backup.sql

# Restore database backup
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U smartwait_user -d smartwait_production < backup.sql
```

### Updates and Upgrades

```bash
# Pull latest code
git pull origin main

# Rebuild and restart services
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# Run database migrations (if needed)
docker-compose -f docker-compose.prod.yml exec api npm run migrate
```

## Monitoring and Alerting

### Health Checks

The system includes comprehensive health checks:

- **API Health**: `GET /health`
- **Database Health**: Included in API health check
- **Redis Health**: Included in API health check
- **WebSocket Health**: Included in API health check

### Log Monitoring

Important log files to monitor:

- **Application Logs**: `logs/api/app.log`
- **Error Logs**: `logs/api/error.log`
- **Nginx Logs**: `logs/nginx/access.log`, `logs/nginx/error.log`
- **Deployment Logs**: `logs/deployment.log`

### Performance Monitoring

Key metrics to monitor:

- **Response Times**: API endpoint response times
- **Queue Length**: Number of patients in queue
- **SMS Delivery**: Success rate of SMS notifications
- **Database Performance**: Query execution times
- **Memory Usage**: Container memory consumption
- **CPU Usage**: Container CPU utilization

## Security Considerations

### Network Security

- All services run in isolated Docker network
- Only necessary ports exposed (80, 443)
- Nginx acts as reverse proxy and load balancer
- Rate limiting configured for API endpoints

### Data Security

- All sensitive data encrypted at rest
- TLS 1.3 for data in transit
- JWT tokens for authentication
- Session management with automatic expiration
- Regular security updates applied

### Access Control

- Role-based access control (RBAC)
- Staff authentication required for management operations
- Patient data access logged and audited
- Database access restricted to application users

## Troubleshooting

### Common Issues

#### Services Won't Start

```bash
# Check Docker daemon
sudo systemctl status docker

# Check service logs
docker-compose -f docker-compose.prod.yml logs [service-name]

# Check resource usage
docker stats
```

#### Database Connection Issues

```bash
# Check database status
docker-compose -f docker-compose.prod.yml exec postgres pg_isready

# Check database logs
docker-compose -f docker-compose.prod.yml logs postgres

# Test connection
docker-compose -f docker-compose.prod.yml exec postgres psql -U smartwait_user -d smartwait_production -c "SELECT 1;"
```

#### SSL Certificate Issues

```bash
# Check certificate validity
openssl x509 -in infrastructure/ssl/smartwait.crt -text -noout

# Test SSL connection
openssl s_client -connect yourdomain.com:443

# Renew Let's Encrypt certificate
sudo certbot renew
```

#### SMS Not Working

```bash
# Check Twilio credentials
docker-compose -f docker-compose.prod.yml exec api node -e "
  const twilio = require('twilio');
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  client.messages.create({
    body: 'Test message',
    from: process.env.TWILIO_PHONE_NUMBER,
    to: '+1234567890'
  }).then(message => console.log('SMS sent:', message.sid));
"
```

### Performance Issues

```bash
# Check resource usage
docker stats

# Check database performance
docker-compose -f docker-compose.prod.yml exec postgres psql -U smartwait_user -d smartwait_production -c "
  SELECT query, calls, total_time, mean_time 
  FROM pg_stat_statements 
  ORDER BY total_time DESC 
  LIMIT 10;
"

# Check Redis performance
docker-compose -f docker-compose.prod.yml exec redis redis-cli info stats
```

## Backup and Recovery

### Automated Backups

Backups run automatically daily at 2 AM and include:
- PostgreSQL database dump
- Redis data snapshot
- Application logs
- Configuration files

### Manual Backup

```bash
# Run immediate backup
docker-compose -f docker-compose.prod.yml exec backup /scripts/backup.sh

# Backup to external location
rsync -av backups/ user@backup-server:/path/to/backups/
```

### Disaster Recovery

```bash
# Stop services
docker-compose -f docker-compose.prod.yml down

# Restore database
docker-compose -f docker-compose.prod.yml up -d postgres
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U smartwait_user -d smartwait_production < backup.sql

# Restore Redis
docker-compose -f docker-compose.prod.yml up -d redis
docker cp backup.rdb $(docker-compose -f docker-compose.prod.yml ps -q redis):/data/dump.rdb
docker-compose -f docker-compose.prod.yml restart redis

# Start all services
docker-compose -f docker-compose.prod.yml up -d
```

## Support and Maintenance

### Regular Maintenance Tasks

**Daily:**
- Check service health
- Review error logs
- Monitor backup completion

**Weekly:**
- Update system packages
- Review performance metrics
- Clean up old log files

**Monthly:**
- Update Docker images
- Review security patches
- Test disaster recovery procedures

### Getting Help

For technical support:
1. Check this deployment guide
2. Review application logs
3. Check GitHub issues
4. Contact development team

## Conclusion

This deployment guide provides comprehensive instructions for deploying and maintaining the SmartWait MVP in production. Follow the security best practices and monitoring recommendations to ensure reliable operation.

For questions or issues not covered in this guide, please refer to the project documentation or contact the development team.
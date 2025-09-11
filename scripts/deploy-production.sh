#!/bin/bash
# SmartWait MVP Production Deployment Script

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_ROOT/backups"
LOG_FILE="$PROJECT_ROOT/logs/deployment.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error_exit() {
    log "${RED}ERROR: $1${NC}"
    exit 1
}

success() {
    log "${GREEN}✅ $1${NC}"
}

warning() {
    log "${YELLOW}⚠️  $1${NC}"
}

info() {
    log "${BLUE}ℹ️  $1${NC}"
}

# Create necessary directories
mkdir -p "$BACKUP_DIR" "$(dirname "$LOG_FILE")" secrets

log "${BLUE}🚀 Starting SmartWait MVP Production Deployment${NC}"
log "=================================================="

# Pre-deployment checks
info "Running pre-deployment checks..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    error_exit "Docker is not running. Please start Docker and try again."
fi

# Check if required files exist
REQUIRED_FILES=(
    ".env.production"
    "docker-compose.prod.yml"
    "apps/api/Dockerfile.prod"
    "apps/web/Dockerfile.prod"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [[ ! -f "$PROJECT_ROOT/$file" ]]; then
        error_exit "Required file not found: $file"
    fi
done

success "Pre-deployment checks passed"

# Check for secrets
info "Checking secrets configuration..."

REQUIRED_SECRETS=(
    "secrets/postgres_password.txt"
    "secrets/redis_password.txt"
    "secrets/jwt_secret.txt"
)

for secret in "${REQUIRED_SECRETS[@]}"; do
    if [[ ! -f "$PROJECT_ROOT/$secret" ]]; then
        warning "Secret file not found: $secret"
        echo "Please create this file with the appropriate secret value."
        read -p "Press Enter to continue after creating the secret file..."
    fi
done

# Backup existing deployment (if exists)
if docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
    info "Backing up current deployment..."
    
    # Create backup directory with timestamp
    BACKUP_TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    DEPLOYMENT_BACKUP_DIR="$BACKUP_DIR/deployment_$BACKUP_TIMESTAMP"
    mkdir -p "$DEPLOYMENT_BACKUP_DIR"
    
    # Backup database
    if docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump -U smartwait_user smartwait_production > "$DEPLOYMENT_BACKUP_DIR/database_backup.sql"; then
        success "Database backup created"
    else
        warning "Database backup failed, continuing with deployment"
    fi
    
    # Stop services gracefully
    info "Stopping current services..."
    docker-compose -f docker-compose.prod.yml down --timeout 30
    success "Services stopped"
fi

# Build new images
info "Building production images..."

# Build API image
info "Building API image..."
if docker build -f apps/api/Dockerfile.prod -t smartwait-api:latest apps/api/; then
    success "API image built successfully"
else
    error_exit "Failed to build API image"
fi

# Build Web image
info "Building Web image..."
if docker build -f apps/web/Dockerfile.prod -t smartwait-web:latest apps/web/; then
    success "Web image built successfully"
else
    error_exit "Failed to build Web image"
fi

# Start services
info "Starting production services..."

# Start database and Redis first
info "Starting database and Redis..."
if docker-compose -f docker-compose.prod.yml up -d postgres redis; then
    success "Database and Redis started"
else
    error_exit "Failed to start database and Redis"
fi

# Wait for database to be ready
info "Waiting for database to be ready..."
for i in {1..30}; do
    if docker-compose -f docker-compose.prod.yml exec -T postgres pg_isready -U smartwait_user -d smartwait_production > /dev/null 2>&1; then
        success "Database is ready"
        break
    fi
    if [[ $i -eq 30 ]]; then
        error_exit "Database failed to start within 30 seconds"
    fi
    sleep 1
done

# Run database migrations
info "Running database migrations..."
if docker-compose -f docker-compose.prod.yml exec -T api npm run migrate; then
    success "Database migrations completed"
else
    warning "Database migrations failed, continuing with deployment"
fi

# Start application services
info "Starting application services..."
if docker-compose -f docker-compose.prod.yml up -d api web; then
    success "Application services started"
else
    error_exit "Failed to start application services"
fi

# Wait for services to be healthy
info "Waiting for services to be healthy..."

# Check API health
for i in {1..60}; do
    if curl -f http://localhost/health > /dev/null 2>&1; then
        success "API is healthy"
        break
    fi
    if [[ $i -eq 60 ]]; then
        error_exit "API failed to become healthy within 60 seconds"
    fi
    sleep 1
done

# Check Web health
for i in {1..60}; do
    if curl -f http://localhost/ > /dev/null 2>&1; then
        success "Web application is healthy"
        break
    fi
    if [[ $i -eq 60 ]]; then
        error_exit "Web application failed to become healthy within 60 seconds"
    fi
    sleep 1
done

# Start supporting services
info "Starting supporting services..."
if docker-compose -f docker-compose.prod.yml up -d nginx backup; then
    success "Supporting services started"
else
    warning "Some supporting services failed to start"
fi

# Run post-deployment tests
info "Running post-deployment tests..."

# Test API endpoints
API_TESTS=(
    "GET /health"
    "GET /api/health"
)

for test in "${API_TESTS[@]}"; do
    method=$(echo "$test" | cut -d' ' -f1)
    endpoint=$(echo "$test" | cut -d' ' -f2)
    
    if curl -f -X "$method" "http://localhost$endpoint" > /dev/null 2>&1; then
        success "API test passed: $test"
    else
        warning "API test failed: $test"
    fi
done

# Test database connectivity
if docker-compose -f docker-compose.prod.yml exec -T postgres psql -U smartwait_user -d smartwait_production -c "SELECT 1;" > /dev/null 2>&1; then
    success "Database connectivity test passed"
else
    warning "Database connectivity test failed"
fi

# Test Redis connectivity
if docker-compose -f docker-compose.prod.yml exec -T redis redis-cli ping | grep -q PONG; then
    success "Redis connectivity test passed"
else
    warning "Redis connectivity test failed"
fi

# Display deployment summary
log ""
log "${GREEN}🎉 Deployment Summary${NC}"
log "===================="

# Show running services
log "Running services:"
docker-compose -f docker-compose.prod.yml ps

# Show service URLs
log ""
log "Service URLs:"
log "  - Main Application: https://yourdomain.com"
log "  - Staff Dashboard: https://yourdomain.com/staff"
log "  - API Health Check: https://yourdomain.com/health"
log "  - API Documentation: https://yourdomain.com/api/docs"

# Show logs location
log ""
log "Logs location:"
log "  - Deployment log: $LOG_FILE"
log "  - Application logs: $PROJECT_ROOT/logs/"
log "  - Container logs: docker-compose -f docker-compose.prod.yml logs"

# Show backup information
log ""
log "Backup information:"
log "  - Backup directory: $BACKUP_DIR"
log "  - Automated backups: Daily at 2 AM"
log "  - Manual backup: ./scripts/backup-now.sh"

# Show monitoring information
log ""
log "Monitoring:"
log "  - Prometheus: http://localhost:9090"
log "  - Grafana: http://localhost:3001 (admin/admin)"

# Final success message
log ""
success "🚀 SmartWait MVP deployed successfully!"
log "The system is now ready for production use."
log ""
log "Next steps:"
log "1. Update DNS records to point to this server"
log "2. Configure SSL certificates"
log "3. Set up monitoring alerts"
log "4. Test SMS notifications with real Twilio credentials"
log "5. Create staff user accounts"
log ""
log "For troubleshooting, check:"
log "  - Service logs: docker-compose -f docker-compose.prod.yml logs [service]"
log "  - Service status: docker-compose -f docker-compose.prod.yml ps"
log "  - System health: curl http://localhost/health"
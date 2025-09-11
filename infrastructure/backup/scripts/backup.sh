#!/bin/bash
# SmartWait Production Backup Script

set -euo pipefail

# Configuration
BACKUP_DIR="/var/backups/smartwait"
POSTGRES_BACKUP_DIR="$BACKUP_DIR/postgres"
REDIS_BACKUP_DIR="$BACKUP_DIR/redis"
LOG_FILE="$BACKUP_DIR/logs/backup.log"
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Error handling
error_exit() {
    log "ERROR: $1"
    exit 1
}

# Create backup directories
mkdir -p "$POSTGRES_BACKUP_DIR" "$REDIS_BACKUP_DIR" "$(dirname "$LOG_FILE")"

log "Starting SmartWait backup process..."

# PostgreSQL Backup
log "Starting PostgreSQL backup..."
POSTGRES_BACKUP_FILE="$POSTGRES_BACKUP_DIR/smartwait_${TIMESTAMP}.sql"

if PGPASSWORD="$(cat /run/secrets/postgres_password)" pg_dump \
    -h "$POSTGRES_HOST" \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    --verbose \
    --no-password \
    --format=custom \
    --compress=9 \
    --file="$POSTGRES_BACKUP_FILE"; then
    log "PostgreSQL backup completed: $POSTGRES_BACKUP_FILE"
    
    # Compress the backup
    gzip "$POSTGRES_BACKUP_FILE"
    log "PostgreSQL backup compressed: ${POSTGRES_BACKUP_FILE}.gz"
else
    error_exit "PostgreSQL backup failed"
fi

# Redis Backup
log "Starting Redis backup..."
REDIS_BACKUP_FILE="$REDIS_BACKUP_DIR/redis_${TIMESTAMP}.rdb"

if redis-cli -h "$REDIS_HOST" -p 6379 --rdb "$REDIS_BACKUP_FILE"; then
    log "Redis backup completed: $REDIS_BACKUP_FILE"
    
    # Compress the backup
    gzip "$REDIS_BACKUP_FILE"
    log "Redis backup compressed: ${REDIS_BACKUP_FILE}.gz"
else
    error_exit "Redis backup failed"
fi

# Upload to S3 (if configured)
if [[ -n "${BACKUP_S3_BUCKET:-}" ]]; then
    log "Uploading backups to S3..."
    
    # Upload PostgreSQL backup
    if aws s3 cp "${POSTGRES_BACKUP_FILE}.gz" \
        "s3://$BACKUP_S3_BUCKET/postgres/$(basename "${POSTGRES_BACKUP_FILE}.gz")" \
        --region "${BACKUP_S3_REGION:-us-east-1}"; then
        log "PostgreSQL backup uploaded to S3"
    else
        log "WARNING: Failed to upload PostgreSQL backup to S3"
    fi
    
    # Upload Redis backup
    if aws s3 cp "${REDIS_BACKUP_FILE}.gz" \
        "s3://$BACKUP_S3_BUCKET/redis/$(basename "${REDIS_BACKUP_FILE}.gz")" \
        --region "${BACKUP_S3_REGION:-us-east-1}"; then
        log "Redis backup uploaded to S3"
    else
        log "WARNING: Failed to upload Redis backup to S3"
    fi
fi

# Cleanup old backups
log "Cleaning up old backups (older than $RETENTION_DAYS days)..."

# Local cleanup
find "$POSTGRES_BACKUP_DIR" -name "*.gz" -mtime +$RETENTION_DAYS -delete
find "$REDIS_BACKUP_DIR" -name "*.gz" -mtime +$RETENTION_DAYS -delete

# S3 cleanup (if configured)
if [[ -n "${BACKUP_S3_BUCKET:-}" ]]; then
    # This would require a more complex script to list and delete old S3 objects
    log "S3 cleanup should be configured separately using S3 lifecycle policies"
fi

# Verify backup integrity
log "Verifying backup integrity..."

# Test PostgreSQL backup
if PGPASSWORD="$(cat /run/secrets/postgres_password)" pg_restore \
    --list "${POSTGRES_BACKUP_FILE}.gz" > /dev/null 2>&1; then
    log "PostgreSQL backup integrity verified"
else
    log "WARNING: PostgreSQL backup integrity check failed"
fi

# Calculate backup sizes
POSTGRES_SIZE=$(du -h "${POSTGRES_BACKUP_FILE}.gz" | cut -f1)
REDIS_SIZE=$(du -h "${REDIS_BACKUP_FILE}.gz" | cut -f1)

log "Backup completed successfully!"
log "PostgreSQL backup size: $POSTGRES_SIZE"
log "Redis backup size: $REDIS_SIZE"
log "Backup files:"
log "  - ${POSTGRES_BACKUP_FILE}.gz"
log "  - ${REDIS_BACKUP_FILE}.gz"

# Send notification (if configured)
if [[ -n "${BACKUP_WEBHOOK_URL:-}" ]]; then
    curl -X POST "$BACKUP_WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "{
            \"text\": \"SmartWait backup completed successfully\",
            \"details\": {
                \"timestamp\": \"$TIMESTAMP\",
                \"postgres_size\": \"$POSTGRES_SIZE\",
                \"redis_size\": \"$REDIS_SIZE\"
            }
        }" || log "WARNING: Failed to send backup notification"
fi

log "Backup process completed at $(date)"
# SmartWait Backup Service Dockerfile
FROM alpine:3.18

# Install required packages
RUN apk add --no-cache \
    postgresql-client \
    redis \
    aws-cli \
    curl \
    bash \
    dcron \
    && rm -rf /var/cache/apk/*

# Create backup user
RUN addgroup -g 1001 -S backup && \
    adduser -S backup -u 1001 -G backup

# Create backup directories
RUN mkdir -p /var/backups/smartwait/postgres \
             /var/backups/smartwait/redis \
             /var/backups/smartwait/logs \
             /scripts \
    && chown -R backup:backup /var/backups/smartwait /scripts

# Copy backup scripts
COPY scripts/ /scripts/
RUN chmod +x /scripts/*.sh && \
    chown -R backup:backup /scripts

# Switch to backup user
USER backup

# Set up cron job
RUN echo "0 2 * * * /scripts/backup.sh" | crontab -

# Health check
HEALTHCHECK --interval=1h --timeout=30s --start-period=1m --retries=3 \
    CMD /scripts/health-check.sh

# Start cron daemon
CMD ["crond", "-f", "-d", "8"]
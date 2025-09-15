# SmartWait API Production Dockerfile
FROM node:18-alpine AS base

# Install security updates and required packages
RUN apk update && apk upgrade && \
    apk add --no-cache \
    curl \
    dumb-init \
    openssl && \
    rm -rf /var/cache/apk/*

# Create app directory and user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S smartwait -u 1001 -G nodejs

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Dependencies stage
FROM base AS dependencies
RUN npm install --only=production --legacy-peer-deps && npm cache clean --force

# Build stage
FROM base AS build
COPY --chown=smartwait:nodejs . .
RUN npm install --legacy-peer-deps && \
    npx prisma generate && \
    npm run build && \
    npm prune --production --legacy-peer-deps

# Production stage
FROM base AS production

# Copy built application and dependencies
COPY --from=build --chown=smartwait:nodejs /app/dist ./dist
COPY --from=build --chown=smartwait:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=smartwait:nodejs /app/package*.json ./
COPY --from=build --chown=smartwait:nodejs /app/prisma ./prisma

# Create necessary directories
RUN mkdir -p /var/log/smartwait /var/backups/smartwait && \
    chown -R smartwait:nodejs /var/log/smartwait /var/backups/smartwait /app

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Switch to non-root user
USER smartwait

# Expose port
EXPOSE 3001

# Start application with dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
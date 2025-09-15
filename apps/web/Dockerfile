# SmartWait Web Portal Production Dockerfile
FROM node:18-alpine AS base

# Install security updates and required packages
RUN apk update && apk upgrade && \
    apk add --no-cache \
    curl \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Create app directory and user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S smartwait -u 1001 -G nodejs

WORKDIR /app

# Copy package files and config
COPY package*.json ./
COPY next.config.js* ./
COPY tailwind.config.js* ./
COPY postcss.config.js* ./
COPY tsconfig.json ./

# Dependencies stage
FROM base AS dependencies
RUN npm ci --only=production --legacy-peer-deps && npm cache clean --force

# Build stage
FROM base AS build
COPY . .
RUN npm ci --legacy-peer-deps && \
    npm run build

# Production stage
FROM base AS production

# Copy built application
COPY --from=build --chown=smartwait:nodejs /app/.next/standalone ./
COPY --from=build --chown=smartwait:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=smartwait:nodejs /app/public ./public

# Create necessary directories
RUN mkdir -p /var/log/smartwait && \
    chown -R smartwait:nodejs /var/log/smartwait /app

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000 || exit 1

# Switch to non-root user
USER smartwait

# Expose port
EXPOSE 3000

# Start application with dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
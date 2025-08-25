# Multi-stage build for production optimization
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (needed for build)
RUN npm ci && npm cache clean --force

# Copy source code
COPY src/ ./src/
COPY demo/ ./demo/

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Install runtime dependencies (PostgreSQL client tools)
RUN apk add --no-cache postgresql-client

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S codemind -u 1001

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Copy PostgreSQL schema file (needed for runtime)
COPY src/database/schema.postgres.sql ./dist/src/database/

# Set permissions
RUN chown -R codemind:nodejs /app

# Switch to non-root user
USER codemind

# Expose port
EXPOSE 3004

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3004/health || exit 1

# Set environment variables
ENV NODE_ENV=production
ENV DB_TYPE=postgresql
ENV PORT=3004

# Start the application
CMD ["node", "dist/api/server.js"]
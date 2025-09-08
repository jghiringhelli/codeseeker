# Multi-stage Docker build for CodeMind API
FROM node:20-slim AS base

# Set working directory
WORKDIR /app

# Install system dependencies including Python for native builds
RUN apt-get update && apt-get install -y \
    postgresql-client \
    curl \
    bash \
    python3 \
    make \
    g++ \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -g 1001 codemind && \
    useradd -u 1001 -g codemind -m codemind

# Development stage
FROM base AS development

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies)
RUN npm ci --include=dev

# Copy source code
COPY --chown=codemind:codemind . .

# Expose development port
EXPOSE 3004

# Switch to non-root user
USER codemind

# Development command
CMD ["npm", "run", "dev"]

# Production build stage
FROM base AS builder

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including dev for build)
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-slim AS production

# Install production system dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    curl \
    bash \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -g 1001 codemind && \
    useradd -u 1001 -g codemind -m codemind

# Set working directory
WORKDIR /app

# Install production dependencies only
COPY --from=builder --chown=codemind:codemind /app/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder --chown=codemind:codemind /app/dist ./dist
COPY --from=builder --chown=codemind:codemind /app/src ./src

# Create logs directory
RUN mkdir -p /app/logs && chown codemind:codemind /app/logs

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3004
ENV LOG_LEVEL=info

# Expose port
EXPOSE 3004

# Switch to non-root user
USER codemind

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3004/health || exit 1

# Start the API server  
CMD ["node", "dist/api/server.js"]

# Metadata labels
LABEL maintainer="CodeMind Team <team@codemind.dev>" \
      version="0.1.0" \
      description="CodeMind API - Intelligent code analysis and orchestration" \
      org.opencontainers.image.title="CodeMind API" \
      org.opencontainers.image.description="API service for CodeMind intelligent code orchestration" \
      org.opencontainers.image.vendor="CodeMind" \
      org.opencontainers.image.version="0.1.0" \
      org.opencontainers.image.schema-version="1.0"
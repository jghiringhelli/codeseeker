# Multi-stage Docker build for CodeMind Dashboard
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
EXPOSE 3005

# Switch to non-root user
USER codemind

# Development command with hot reload
CMD ["npm", "run", "dashboard:dev"]

# Production build stage
FROM base AS builder

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy source code
COPY . .

# Build any assets if needed
RUN if [ -f "src/dashboard/build.js" ]; then node src/dashboard/build.js; fi

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

# Copy built application from builder stage
COPY --from=builder --chown=codemind:codemind /app/node_modules ./node_modules
COPY --from=builder --chown=codemind:codemind /app/src ./src
COPY --from=builder --chown=codemind:codemind /app/package*.json ./

# Create logs directory
RUN mkdir -p /app/logs && chown codemind:codemind /app/logs

# Copy health check script
COPY --chown=codemind:codemind docker/scripts/dashboard-healthcheck.sh /app/healthcheck.sh
RUN chmod +x /app/healthcheck.sh

# Set environment variables
ENV NODE_ENV=production
ENV DASHBOARD_PORT=3005
ENV LOG_LEVEL=info

# Expose port
EXPOSE 3005

# Switch to non-root user
USER codemind

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD /app/healthcheck.sh

# Use node directly as entrypoint

# Start the dashboard server (minimal version for deployment)
CMD ["node", "src/dashboard/server.js"]

# Metadata labels
LABEL maintainer="CodeMind Team <team@codemind.dev>" \
      version="0.1.0" \
      description="CodeMind Dashboard - Real-time monitoring and visualization" \
      org.opencontainers.image.title="CodeMind Dashboard" \
      org.opencontainers.image.description="Real-time monitoring dashboard for CodeMind AI orchestration processes" \
      org.opencontainers.image.vendor="CodeMind" \
      org.opencontainers.image.version="0.1.0" \
      org.opencontainers.image.schema-version="1.0"
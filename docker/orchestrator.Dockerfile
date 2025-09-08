# Sequential Workflow Orchestrator Service Dockerfile

FROM node:20-slim AS base

# Install system dependencies including build tools for native modules
RUN apt-get update && apt-get install -y \
    curl \
    git \
    bash \
    python3 \
    python3-distutils \
    python3-dev \
    make \
    g++ \
    build-essential \
    sqlite3 \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Don't install here - do it in development stage

FROM base AS development
# Install all dependencies including dev
RUN npm ci
COPY . .
# Build TypeScript
RUN npm run build
# Prune dev dependencies after build
RUN npm prune --production

FROM base AS production

# Copy built application
COPY --from=development /app/dist ./dist
COPY --from=development /app/src ./src
COPY --from=development /app/package*.json ./
COPY --from=development /app/node_modules ./node_modules

# Create non-root user (Debian syntax)
RUN groupadd -g 1001 codemind && \
    useradd -u 1001 -g codemind -m codemind

# Create directories and set permissions
RUN mkdir -p /app/logs /app/temp && \
    chown -R codemind:codemind /app

# Switch to non-root user
USER codemind

# Health check script
RUN echo '#!/bin/bash\ncurl -f http://localhost:${ORCHESTRATOR_PORT:-3006}/health || exit 1' > /app/healthcheck.sh && \
    chmod +x /app/healthcheck.sh

# Expose port
EXPOSE 3006

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD /app/healthcheck.sh

# Start the orchestrator server
CMD ["node", "dist/orchestration/orchestrator-server.js"]
# Role Terminal Worker Dockerfile

FROM node:20-alpine AS base

# Install system dependencies including tsx for TypeScript execution
RUN apk add --no-cache \
    curl \
    git \
    bash \
    python3 \
    python3-dev \
    make \
    g++ \
    py3-setuptools

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies including development deps for tsx
RUN npm ci && npm cache clean --force

FROM base AS development
COPY . .
RUN npm run build

FROM base AS production

# Copy application code
COPY --from=development /app/dist ./dist
COPY --from=development /app/src ./src
COPY --from=development /app/package*.json ./
COPY --from=development /app/tsconfig.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S codemind -u 1001 -G nodejs

# Create directories and set permissions
RUN mkdir -p /app/logs /app/temp && \
    chown -R codemind:nodejs /app

# Switch to non-root user
USER codemind

# Health check - role terminals don't have HTTP endpoints, so check process
RUN echo '#!/bin/bash\npgrep -f "role-terminal-worker" > /dev/null || exit 1' > /app/healthcheck.sh && \
    chmod +x /app/healthcheck.sh

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD /app/healthcheck.sh

# Start role terminal worker
CMD ["npx", "tsx", "src/orchestration/role-terminal-worker.ts"]
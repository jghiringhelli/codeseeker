# Manual Setup Guide for CodeSeeker

This guide provides instructions for manually setting up CodeSeeker.

## Quick Start (Embedded Mode - Recommended)

Most users should use embedded mode which requires **no setup at all**:

```bash
# Install globally
npm install -g codeseeker

# Or link from source
cd CodeSeeker
npm run build && npm link

# Verify installation
codeseeker --help

# Initialize your project
cd /path/to/your/project
codeseeker init --quick

# Start using CodeSeeker
codeseeker -c "what is this project about"
```

**That's it!** Embedded mode uses SQLite + Graphology + LRU-cache with zero configuration.

---

## Server Mode Setup (Advanced)

> **Note**: Server mode is only needed for large codebases (100K+ files), teams, or production environments. Most users should use embedded mode.

### Prerequisites

- Node.js 16+ installed
- One of the following for databases:
  - Docker Desktop / Rancher Desktop / Podman (easiest)
  - Manual PostgreSQL, Neo4j, Redis installations

### Option A: Using Docker Compose (Quick Testing)

```bash
# Start database services only
docker-compose up -d database redis neo4j

# Verify containers are running
docker ps
# Should show: codeseeker-database, codeseeker-neo4j, codeseeker-redis

# Configure CodeSeeker for server mode
export CODESEEKER_STORAGE_MODE=server
```

### Option B: Manual Database Installation (Production)

#### PostgreSQL with pgvector

```bash
# Install PostgreSQL 15+ with pgvector extension
# On Ubuntu:
sudo apt install postgresql postgresql-contrib
sudo apt install postgresql-15-pgvector

# Create database and user
sudo -u postgres psql
CREATE USER codeseeker WITH PASSWORD 'your-password';
CREATE DATABASE codeseeker OWNER codeseeker;
\c codeseeker
CREATE EXTENSION vector;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO codeseeker;
```

#### Neo4j

```bash
# Install Neo4j Community Edition
# Download from https://neo4j.com/download/

# Start the service
sudo systemctl start neo4j

# Access at http://localhost:7474
# Set initial password via browser
```

#### Redis

```bash
# On macOS
brew install redis
brew services start redis

# On Ubuntu/Debian
sudo apt install redis-server
sudo systemctl start redis
```

### Configuration

Create `~/.codeseeker/storage.json`:

```json
{
  "mode": "server",
  "server": {
    "postgres": {
      "host": "localhost",
      "port": 5432,
      "database": "codeseeker",
      "user": "codeseeker",
      "password": "your-password"
    },
    "neo4j": {
      "uri": "bolt://localhost:7687",
      "user": "neo4j",
      "password": "your-password"
    },
    "redis": {
      "host": "localhost",
      "port": 6379
    }
  }
}
```

Or use environment variables:

```bash
export CODESEEKER_STORAGE_MODE=server
export CODESEEKER_PG_HOST=localhost
export CODESEEKER_PG_PORT=5432
export CODESEEKER_PG_DATABASE=codeseeker
export CODESEEKER_PG_USER=codeseeker
export CODESEEKER_PG_PASSWORD=your-password
export CODESEEKER_NEO4J_URI=bolt://localhost:7687
export CODESEEKER_NEO4J_USER=neo4j
export CODESEEKER_NEO4J_PASSWORD=your-password
export CODESEEKER_REDIS_HOST=localhost
export CODESEEKER_REDIS_PORT=6379
```

---

## Building and Running CodeSeeker

### Install Dependencies

```bash
npm install
```

### Build TypeScript

```bash
npm run build
```

### Link CLI Globally (Optional)

```bash
npm link
```

### Run CodeSeeker

```bash
# If linked globally
codeseeker

# Or directly
npm run codeseeker
```

---

## Initializing a Project

```bash
# Start the CLI
codeseeker

# Initialize project data
/init

# Or with reset flag
/init --reset
```

---

## Troubleshooting

### Container System Not Found (Docker)

If Docker is installed but not detected:

```bash
# Check if it's running
docker version

# Check Docker context
docker context ls
docker context use default

# On Windows with WSL2 - ensure WSL2 integration is enabled
wsl --list --verbose
```

### Database Connection Issues

```bash
# Check container logs
docker-compose logs database
docker-compose logs neo4j
docker-compose logs redis

# Test connections directly
# PostgreSQL
docker exec -it codeseeker-database psql -U codeseeker -d codeseeker -c "SELECT 1;"

# Neo4j
curl http://localhost:7474

# Redis
docker exec -it codeseeker-redis redis-cli ping
```

### Permission Issues (Linux/macOS)

```bash
# Add user to docker group
sudo usermod -aG docker $USER
# Log out and back in for changes to take effect
```

---

## Related Documentation

- [Storage Guide](./storage.md) - Detailed storage configuration
- [CLI Commands](./cli_commands_manual.md) - Full CLI reference
- [MCP Server](./mcp-server.md) - MCP server setup for Claude Code/Desktop
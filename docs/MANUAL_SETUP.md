# Manual Setup Guide for CodeMind

This guide provides instructions for manually setting up CodeMind when automated setup fails or when you prefer manual configuration.

## Prerequisites

- Node.js 16+ installed
- One of the following container systems:
  - Docker Desktop
  - Rancher Desktop
  - Podman
  - Docker CE (Linux)

## Starting Container Systems Manually

### Windows

#### Docker Desktop
```powershell
# Start from Start Menu or System Tray
# Or via PowerShell:
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
```

#### Rancher Desktop
```powershell
# Start from Start Menu
# Or via PowerShell:
Start-Process "$env:LOCALAPPDATA\Programs\Rancher Desktop\Rancher Desktop.exe"
```

### macOS

#### Docker Desktop
```bash
open -a Docker
```

#### Rancher Desktop
```bash
open -a "Rancher Desktop"
```

### Linux

#### Docker Service
```bash
sudo systemctl start docker
# or
sudo service docker start
```

#### Podman
```bash
sudo systemctl start podman
```

## Manual Database Setup

### 1. Start Containers

```bash
# From the CodeMind project directory
docker-compose up -d

# Or with docker compose v2
docker compose up -d
```

### 2. Verify Containers are Running

```bash
docker ps
# Should show:
# - codemind-database (PostgreSQL with pgvector)
# - codemind-neo4j (Neo4j Graph Database)
# - codemind-redis (Redis Cache)
```

### 3. Initialize PostgreSQL

```bash
# Connect to PostgreSQL
docker exec -it codemind-database psql -U codemind -d codemind

# Run the schema (from another terminal)
docker exec -i codemind-database psql -U codemind -d codemind < src/database/schema.postgres.sql

# Enable pgvector extension
docker exec -it codemind-database psql -U codemind -d codemind -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 4. Initialize Neo4j

```bash
# Neo4j should auto-start with default configuration
# Access at http://localhost:7474
# Default credentials: neo4j / codemind123

# Create constraints via cypher-shell
docker exec -it codemind-neo4j cypher-shell -u neo4j -p codemind123 \
  "CREATE CONSTRAINT project_id IF NOT EXISTS FOR (p:Project) REQUIRE p.id IS UNIQUE;"
```

### 5. Verify Redis

```bash
# Test Redis connection
docker exec -it codemind-redis redis-cli ping
# Should return: PONG
```

## Configuration

### Environment Variables

Create or update `.env` file in the project root:

```env
# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=codemind
DB_USER=codemind
DB_PASSWORD=codemind123

# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=codemind123

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Optional: Custom ports if defaults are in use
# DB_PORT=5433
# REDIS_PORT=6380
```

### Using Non-Default Ports

If default ports are already in use, update `docker-compose.yml`:

```yaml
services:
  database:
    ports:
      - "5433:5432"  # Use 5433 externally

  redis:
    ports:
      - "6380:6379"  # Use 6380 externally

  neo4j:
    ports:
      - "7688:7687"  # Use 7688 for bolt
      - "7475:7474"  # Use 7475 for web interface
```

Then update your `.env` file accordingly:
```env
DB_PORT=5433
REDIS_PORT=6380
NEO4J_URI=bolt://localhost:7688
```

## Building and Running CodeMind

### 1. Install Dependencies

```bash
npm install
```

### 2. Build TypeScript

```bash
npm run build
```

### 3. Link CLI Globally (Optional)

```bash
npm link
```

### 4. Run CodeMind

```bash
# If linked globally
codemind

# Or directly
npm run codemind
```

## Initializing a Project

Once setup is complete:

```bash
# Start the CLI
codemind

# Initialize project data
/init

# Or with reset flag
/init --reset
```

## Troubleshooting

### Container System Not Found

If Docker/Rancher is installed but not detected:

1. Check if it's running:
   ```bash
   docker version
   ```

2. Check Docker context:
   ```bash
   docker context ls
   docker context use default
   ```

3. On Windows with WSL2:
   ```bash
   # Ensure WSL2 integration is enabled in Docker Desktop settings
   wsl --list --verbose
   ```

### Database Connection Issues

1. Check container logs:
   ```bash
   docker-compose logs database
   docker-compose logs neo4j
   docker-compose logs redis
   ```

2. Test connections directly:
   ```bash
   # PostgreSQL
   docker exec -it codemind-database psql -U codemind -d codemind -c "SELECT 1;"

   # Neo4j
   curl http://localhost:7474

   # Redis
   docker exec -it codemind-redis redis-cli ping
   ```

### Permission Issues

On Linux/macOS, you may need to run with sudo:
```bash
sudo docker-compose up -d
```

Or add your user to the docker group:
```bash
sudo usermod -aG docker $USER
# Log out and back in for changes to take effect
```

## Database Table Reference

### PostgreSQL Tables Created

- `projects` - Project registry
- `semantic_search_embeddings` - File embeddings for search
- `code_embeddings` - Code snippet embeddings (with pgvector)
- `code_analysis` - Analysis results
- `project_metadata` - Project metadata
- `claude_decisions` - AI decision tracking
- `system_logs` - System logging

### Neo4j Node Types

- `Project` - Project nodes
- `File` - File nodes
- `Class` - Class definitions
- `Function` - Function definitions
- `Directory` - Directory structure

### Redis Keys

- `codemind:initialized` - Initialization timestamp
- `codemind:config` - Configuration data
- Cache keys for various operations

## Getting Help

If manual setup fails:

1. Check the logs in `logs/` directory
2. Run the setup doctor:
   ```bash
   node scripts/tools/setup-doctor.js
   ```
3. Check GitHub issues: https://github.com/your-org/codemind/issues
4. See the main README.md for more information
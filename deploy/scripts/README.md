# CodeSeeker Database Setup Scripts

> **Recommended** for server mode deployments. These scripts give you full control over your database setup and are suitable for production use.

## When to Use These Scripts

**Most users don't need server mode.** CodeSeeker works out-of-the-box with embedded storage (SQLite + Graphology). Only use server mode if you need:
- Support for 100K+ files
- Multi-user/team access
- Production deployment with high availability

If you just want to try CodeSeeker, use embedded mode: `npm install -g codeseeker && codeseeker init --quick`

## Overview

These scripts set up the required database schemas for CodeSeeker server mode:

| Script | Database | Purpose |
|--------|----------|---------|
| `setup-postgres.sql` | PostgreSQL | Vector search + project storage |
| `setup-neo4j.cypher` | Neo4j | Code relationship graph |

Redis requires no schema setup - it works out of the box.

## Prerequisites

### PostgreSQL with pgvector

1. **Install PostgreSQL 15+**

   ```bash
   # Ubuntu/Debian
   sudo apt install postgresql-15

   # macOS
   brew install postgresql@15

   # Windows
   # Download from https://www.postgresql.org/download/windows/
   ```

2. **Install pgvector extension**

   ```bash
   # Ubuntu/Debian
   sudo apt install postgresql-15-pgvector

   # macOS
   brew install pgvector

   # From source (any platform)
   git clone https://github.com/pgvector/pgvector.git
   cd pgvector
   make
   sudo make install
   ```

### Neo4j

1. **Install Neo4j Community Edition**

   ```bash
   # Ubuntu/Debian
   # Add Neo4j repository and install
   wget -O - https://debian.neo4j.com/neotechnology.gpg.key | sudo apt-key add -
   echo 'deb https://debian.neo4j.com stable 5' | sudo tee /etc/apt/sources.list.d/neo4j.list
   sudo apt update
   sudo apt install neo4j

   # macOS
   brew install neo4j

   # Windows
   # Download from https://neo4j.com/download/
   ```

2. **Start Neo4j**

   ```bash
   # Linux
   sudo systemctl start neo4j

   # macOS
   brew services start neo4j

   # Windows
   # Start from Neo4j Desktop or Services
   ```

3. **Set password via Neo4j Browser**
   - Open http://localhost:7474
   - Login with neo4j/neo4j
   - Set new password when prompted

### Redis

```bash
# Ubuntu/Debian
sudo apt install redis-server
sudo systemctl start redis

# macOS
brew install redis
brew services start redis

# Windows
# Download from https://github.com/microsoftarchive/redis/releases
# Or use WSL
```

## Running the Scripts

### PostgreSQL Setup

```bash
# Run as superuser (needed for CREATE EXTENSION)
psql -U postgres -f setup-postgres.sql

# Or specify host
psql -h localhost -U postgres -f setup-postgres.sql

# Verify setup
psql -U codeseeker -d codeseeker -c "\dt"
```

**Important**: The script creates:
- User `codeseeker` with password `codeseeker123`
- Database `codeseeker`
- pgvector extension
- Required tables and indexes
- Hybrid search function

**Change the password** in production!

### Neo4j Setup

```bash
# Using cypher-shell
cypher-shell -u neo4j -p your-password -f setup-neo4j.cypher

# Or paste into Neo4j Browser at http://localhost:7474
```

**Important**: The script creates:
- Indexes for fast node lookups
- Unique constraint on node IDs

### Redis Setup

Redis requires no schema setup. Just verify it's running:

```bash
redis-cli ping
# Should return: PONG
```

## Configuring CodeSeeker

After running the scripts, configure CodeSeeker:

### Option 1: Environment Variables

```bash
export CODESEEKER_STORAGE_MODE=server

# PostgreSQL
export CODESEEKER_PG_HOST=localhost
export CODESEEKER_PG_PORT=5432
export CODESEEKER_PG_DATABASE=codeseeker
export CODESEEKER_PG_USER=codeseeker
export CODESEEKER_PG_PASSWORD=codeseeker123

# Neo4j
export CODESEEKER_NEO4J_URI=bolt://localhost:7687
export CODESEEKER_NEO4J_USER=neo4j
export CODESEEKER_NEO4J_PASSWORD=your-password

# Redis
export CODESEEKER_REDIS_HOST=localhost
export CODESEEKER_REDIS_PORT=6379
```

### Option 2: Config File

Create `~/.codeseeker/storage.json` (or `%APPDATA%\codeseeker\storage.json` on Windows):

```json
{
  "mode": "server",
  "server": {
    "postgres": {
      "host": "localhost",
      "port": 5432,
      "database": "codeseeker",
      "user": "codeseeker",
      "password": "codeseeker123"
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

## Verification

Test the setup:

```bash
# Check storage mode
codeseeker storage status

# Test connections
codeseeker storage test

# Initialize a project
cd /path/to/project
codeseeker init
```

## Troubleshooting

### PostgreSQL: "extension vector does not exist"

pgvector is not installed. See installation instructions above.

### PostgreSQL: "permission denied"

Run setup script as superuser (`postgres` user).

### Neo4j: "connection refused"

- Verify Neo4j is running: `systemctl status neo4j`
- Check bolt port: default is 7687
- Verify password is correct

### Redis: "connection refused"

- Verify Redis is running: `redis-cli ping`
- Check if Redis is bound to localhost

## Security Notes

1. **Change default passwords** in production
2. **Use SSL/TLS** for database connections
3. **Restrict network access** to database ports
4. **Use secrets management** (Vault, AWS Secrets Manager, etc.)

## Performance Tuning

### PostgreSQL

```sql
-- Increase shared buffers (in postgresql.conf)
shared_buffers = 256MB

-- Increase work_mem for complex queries
work_mem = 64MB

-- Tune HNSW index parameters based on dataset size
-- m = 16, ef_construction = 64 is a good default
```

### Neo4j

```properties
# In neo4j.conf
server.memory.heap.initial_size=1G
server.memory.heap.max_size=2G
server.memory.pagecache.size=512m
```

### Redis

```conf
# In redis.conf
maxmemory 512mb
maxmemory-policy allkeys-lru
```
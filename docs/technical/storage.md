# CodeMind Storage Configuration

**NEW: CodeMind now works out-of-the-box with zero setup!**

By default, CodeMind uses embedded storage (SQLite + Graphology + LRU-cache) that requires no Docker or external databases. Just `npm install` and go.

CodeMind supports two storage modes to fit different use cases:

## Storage Modes

| Mode | Setup | Best For |
|------|-------|----------|
| **Embedded** (default) | Zero setup - just `npm install` | Personal use, small-medium projects, getting started |
| **Server** | Docker or manual setup | Large codebases, teams, production environments |

---

## Embedded Mode (Default)

**Zero configuration required.** Works immediately after installation.

### What It Uses

| Component | Technology | Persistence |
|-----------|------------|-------------|
| Vector Search | SQLite + better-sqlite3 | `~/.codemind/data/vectors.db` |
| Graph Database | Graphology (in-memory) | `~/.codemind/data/graph.json` |
| Cache | LRU-cache (in-memory) | `~/.codemind/data/cache.json` |
| Projects | SQLite | `~/.codemind/data/projects.db` |

### Data Location

Data is stored in platform-specific locations:

| Platform | Location |
|----------|----------|
| **Windows** | `%APPDATA%\codemind\data\` |
| **macOS** | `~/Library/Application Support/codemind/data/` |
| **Linux** | `~/.local/share/codemind/data/` |

### Features

- **Automatic persistence**: All data auto-saves every 30 seconds and on exit
- **Crash recovery**: Uses SQLite WAL mode for durability
- **No external dependencies**: Everything runs in-process
- **Fast startup**: No network connections to establish
- **Offline capable**: Works without internet

### Customizing Data Location

Set the `CODEMIND_DATA_DIR` environment variable:

```bash
# Windows (PowerShell)
$env:CODEMIND_DATA_DIR = "D:\codemind-data"

# macOS/Linux
export CODEMIND_DATA_DIR="/custom/path/to/data"
```

Or create a config file:

```json
// ~/.codemind/storage.json (Windows: %APPDATA%\codemind\storage.json)
{
  "mode": "embedded",
  "dataDir": "/custom/path/to/data",
  "flushIntervalSeconds": 60
}
```

---

## Server Mode (Advanced)

For large codebases (100K+ files), teams, or production environments.

> **Note**: Most users don't need server mode. Start with embedded mode and upgrade only if you hit performance limits or need multi-user support.

### What It Uses

| Component | Technology | Purpose |
|-----------|------------|---------|
| Vector Search | PostgreSQL + pgvector | Scalable vector similarity search |
| Graph Database | Neo4j | Powerful graph queries with Cypher |
| Cache | Redis | Distributed caching |
| Projects | PostgreSQL | Relational data with ACID |

### Setup Options (Choose One)

| Option | Best For | Documentation |
|--------|----------|---------------|
| **Manual Installation** | Recommended for most users | [Database Scripts](../deploy/scripts/README.md) |
| **Kubernetes** | Production deployments | [Kubernetes Templates](../deploy/kubernetes/README.md) |
| **Docker Compose** | Quick testing only (experimental) | See below |

### Manual Installation (Recommended)

Follow the [Database Scripts Guide](../deploy/scripts/README.md) to install PostgreSQL, Neo4j, and Redis manually. This gives you the most control and is recommended for production use.

### Docker Compose (Experimental)

> ⚠️ **Docker Compose is experimental** and provided for quick local testing only. For production, use manual installation or Kubernetes.

```bash
# Start database services only (experimental)
docker-compose up -d database redis neo4j

# Verify services are running
docker-compose ps
```

### Configuration

Create `~/.codemind/storage.json`:

```json
{
  "mode": "server",
  "server": {
    "postgres": {
      "host": "localhost",
      "port": 5432,
      "database": "codemind",
      "user": "codemind",
      "password": "your-password"
    },
    "neo4j": {
      "uri": "bolt://localhost:7687",
      "user": "neo4j",
      "password": "your-password"
    },
    "redis": {
      "host": "localhost",
      "port": 6379,
      "password": "optional-password"
    }
  }
}
```

### Environment Variables

You can also configure via environment variables:

```bash
# Storage mode
export CODEMIND_STORAGE_MODE=server

# PostgreSQL
export CODEMIND_PG_HOST=localhost
export CODEMIND_PG_PORT=5432
export CODEMIND_PG_DATABASE=codemind
export CODEMIND_PG_USER=codemind
export CODEMIND_PG_PASSWORD=secret

# Neo4j
export CODEMIND_NEO4J_URI=bolt://localhost:7687
export CODEMIND_NEO4J_USER=neo4j
export CODEMIND_NEO4J_PASSWORD=secret

# Redis
export CODEMIND_REDIS_HOST=localhost
export CODEMIND_REDIS_PORT=6379
export CODEMIND_REDIS_PASSWORD=optional
```

### PostgreSQL Setup

If not using Docker, install PostgreSQL with pgvector:

```sql
-- Create database
CREATE DATABASE codemind;

-- Enable pgvector extension
CREATE EXTENSION vector;

-- Create user
CREATE USER codemind WITH PASSWORD 'your-password';
GRANT ALL PRIVILEGES ON DATABASE codemind TO codemind;
```

### Neo4j Setup

If not using Docker, install Neo4j Community Edition:

1. Download from https://neo4j.com/download/
2. Start the service
3. Set initial password via Neo4j Browser

### Redis Setup

If not using Docker:

```bash
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt install redis-server
sudo systemctl start redis
```

---

## Checking Storage Status

```bash
# Check current storage mode and health
codemind storage status

# Test server connectivity (server mode)
codemind storage test
```

---

## Migrating Between Modes

### Embedded to Server

1. Configure server mode in `storage.json`
2. Run `codemind init` to re-index your project
3. Existing embedded data remains in place as backup

### Server to Embedded

1. Change mode to `embedded` in `storage.json`
2. Run `codemind init` to re-index your project
3. Server data remains intact for future use

---

## Persistence Details

### Embedded Mode Persistence

| Store | Format | Flush Interval | Durability |
|-------|--------|----------------|------------|
| Vectors | SQLite WAL | Automatic | High (WAL) |
| Graph | JSON | 30 seconds | Good |
| Cache | JSON | 30 seconds | Good |
| Projects | SQLite WAL | Automatic | High (WAL) |

### Flush Behavior

- **Automatic flush**: Every 30 seconds (configurable)
- **Graceful shutdown**: Flushes before exit
- **Crash recovery**: SQLite WAL protects vector/project data
- **JSON stores**: May lose up to 30 seconds of data on crash

### Customizing Flush Interval

```json
{
  "mode": "embedded",
  "flushIntervalSeconds": 10
}
```

---

## Troubleshooting

### "Cannot find module 'better-sqlite3'"

Rebuild native modules:

```bash
npm rebuild better-sqlite3
```

### "Database is locked"

Only one CodeMind process can access embedded storage at a time.
Kill any background processes:

```bash
# Find CodeMind processes
ps aux | grep codemind

# Or on Windows
tasklist | findstr codemind
```

### Server mode connection errors

1. Verify services are running
2. Check firewall settings
3. Verify credentials in config
4. Test connectivity:
   ```bash
   # PostgreSQL
   psql -h localhost -U codemind -d codemind

   # Redis
   redis-cli ping

   # Neo4j
   cypher-shell -u neo4j -p password
   ```

---

## Performance Comparison

| Metric | Embedded | Server |
|--------|----------|--------|
| Startup time | ~100ms | ~500ms+ |
| Vector search (1K docs) | ~50ms | ~20ms |
| Vector search (100K docs) | ~500ms | ~50ms |
| Graph traversal | Good | Excellent |
| Concurrent users | 1 | Many |
| Memory usage | Low | Variable |

**Recommendation**: Start with embedded mode. Switch to server mode when you have:
- 100K+ files to index
- Multiple team members
- High query volume

---

## API Usage

```typescript
import { getStorageProvider } from '@codemind/storage';

// Get the storage provider (auto-configured)
const storage = await getStorageProvider();

// Access individual stores
const vectors = storage.getVectorStore();
const graph = storage.getGraphStore();
const cache = storage.getCacheStore();
const projects = storage.getProjectStore();

// Check health
const health = await storage.healthCheck();
console.log('Storage healthy:', health.healthy);

// Manual flush (usually not needed)
await storage.flushAll();

// Cleanup on shutdown
await storage.closeAll();
```
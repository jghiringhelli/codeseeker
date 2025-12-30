# CodeMind CLI Commands Manual

**Version**: 2.0.0
**Last Updated**: December 2025

CodeMind is an intelligent CLI tool that enhances Claude Code with semantic search, knowledge graphs, and AI-powered code analysis.

---

## Table of Contents

1. [Installation & Quick Start](#installation--quick-start)
2. [Command-Line Usage](#command-line-usage)
3. [Infrastructure Setup](#infrastructure-setup-setup)
4. [Project Initialization](#project-initialization-init)
5. [Semantic Search](#semantic-search-search)
6. [Project Management](#project-management-project)
7. [Code Analysis](#code-analysis-analyze)
8. [Natural Language Queries](#natural-language-queries)
9. [Built-in Commands](#built-in-commands)
10. [Environment Variables](#environment-variables)

---

## Installation & Quick Start

```bash
# Install globally
npm install -g codemind

# Or link from source
cd CodeMind
npm run build && npm link

# Verify installation
codemind --help
```

### Quick Start Workflow

```bash
# 1. Setup infrastructure (first time only)
codemind setup

# 2. Initialize your project
cd /path/to/your/project
codemind init

# 3. Ask questions about your code
codemind -c "what is this project about"
```

---

## Command-Line Usage

### Basic Syntax

```bash
codemind [options] [command]
```

### Options

| Option | Description |
|--------|-------------|
| `-V, --version` | Output the version number |
| `-p, --project <path>` | Specify project path |
| `-c, --command <cmd>` | Execute single command and exit |
| `-t, --transparent` | Skip interactive prompts, output context directly |
| `--no-color` | Disable colored output |
| `-h, --help` | Display help information |

### Usage Examples

```bash
# Start interactive REPL mode
codemind

# Start with specific project path
codemind -p /path/to/project

# Execute single command and exit
codemind -c "analyze main entry point"

# Execute in transparent mode (no prompts)
codemind -t -c "what files handle authentication"

# Direct command (same as -c)
codemind "what is this project about"
```

---

## Infrastructure Setup (`setup`)

One-time infrastructure setup for Docker containers and databases.

### Syntax

```bash
codemind setup [options]
```

### Options

| Option | Description |
|--------|-------------|
| `--force` | Force setup even if already configured |
| `--skip-docker` | Skip Docker container setup |
| `--skip-db`, `--skip-databases` | Skip database initialization |
| `--project-path <path>` | Setup from specific directory |

### What It Does

1. Verifies Docker is installed and running
2. Starts required containers (PostgreSQL, Neo4j, Redis)
3. Initializes database schemas
4. Creates required indexes and extensions (pgvector)

### Examples

```bash
# Full infrastructure setup
codemind setup

# Force re-setup
codemind setup --force

# Setup without Docker (use existing databases)
codemind setup --skip-docker

# Setup with custom project path
codemind setup --project-path /path/to/project
```

---

## Project Initialization (`init`)

Initialize a project for CodeMind analysis. Creates embeddings, knowledge graph, and configuration.

### Syntax

```bash
codemind init [options] [path]
```

### Options

| Option | Description |
|--------|-------------|
| `--reset` | Complete cleanup and reinitialization |
| `--quick` | Initialize without indexing (faster) |
| `--new-config` | Reset project configuration (for copied folders) |

### What It Does

1. Registers project in database
2. Creates `.codemind/project.json` configuration
3. Indexes codebase for semantic search (unless `--quick`)
4. Builds initial knowledge graph in Neo4j
5. Creates `CODEMIND.md` template if missing

### Examples

```bash
# Initialize current directory
codemind init

# Quick initialization (no indexing)
codemind init --quick

# Complete reset (clears all data)
codemind init --reset

# Reset config for copied project folder
codemind init --new-config
```

### Output

```
🚀 Initializing CodeMind project...
📁 Project path: /path/to/project
📊 Setting up database...
✅ Database connection established
📋 Registering project...
✅ Project registered: MyProject (uuid)
🔍 Indexing codebase for semantic search...
✅ Indexed 150 files, 450 code segments
🕸️ Building knowledge graph...
✅ Knowledge graph created with triads
📝 Setting up project instructions...
✅ CODEMIND.md already exists
🎉 CodeMind project initialized successfully!
```

---

## Semantic Search (`search`)

Index codebase and perform semantic searches using vector embeddings.

### Syntax

```bash
codemind search [query] [options]
```

### Options

| Option | Description |
|--------|-------------|
| `--index` | Index/reindex the codebase |
| `--threshold=<value>` | Similarity threshold (default: 0.7) |
| `--limit=<value>` | Maximum results (default: 10) |
| `--verbose` | Show detailed content previews |

### Index Command

```bash
# Index codebase for semantic search
codemind search --index
```

**Indexing features:**
- Incremental indexing (only changed files)
- Content hashing for change detection
- Automatic cleanup of deleted files
- Uses Xenova/all-MiniLM-L6-v2 model (384 dimensions)

### Search Command

```bash
# Basic search
codemind search "authentication middleware"

# Search with options
codemind search "database connection" --threshold=0.5 --limit=20 --verbose
```

### Examples

```bash
# Index the codebase first
codemind search --index

# Search for specific functionality
codemind search "user validation"

# Search with lower threshold for more results
codemind search "error handling" --threshold=0.5

# Verbose search with content previews
codemind search "API endpoints" --verbose --limit=15
```

### Output

```
🔍 Searching for: "authentication middleware"
🧠 Found 450 code segments to search

🔍 Search Results (5 found):

📄 Result 1:
   File: src/middleware/auth.ts
   Type: code
   Similarity: 89.2%

📄 Result 2:
   File: src/services/auth-service.ts
   Type: code
   Similarity: 76.5%
```

---

## Project Management (`project`)

Manage project registration, identity, and duplicates.

### Syntax

```bash
codemind project <subcommand> [args]
```

### Subcommands

| Subcommand | Alias | Description |
|------------|-------|-------------|
| `list` | `ls` | List all registered projects |
| `info` | - | Show detailed project information |
| `id` | - | Get deterministic ID for a path |
| `cleanup` | `clean` | Clean up duplicate project entries |
| `duplicates` | `dups` | Find all duplicate project entries |
| `help` | - | Show project command help |

### Examples

```bash
# List all projects
codemind project list
codemind project ls

# Show project info
codemind project info
codemind project info /path/to/project

# Get deterministic ID
codemind project id
codemind project id /path/to/project

# Find duplicates
codemind project duplicates
codemind project dups

# Clean up duplicates for current project
codemind project cleanup
codemind project clean /path/to/project

# Show help
codemind project help
```

### List Output

```
=== Registered Projects ===

  ✓ MyProject
    ID: 2b9a2a85-b3e4-47cc-ade1-2da2724fe0f4
    Path: /workspace/myproject
    Status: active
    Embeddings: 450

  ✓ AnotherProject
    ID: df588867-a7f4-4964-b0e2-f732cb3438f2
    Path: /workspace/another
    Status: active
    Embeddings: 280
```

### Project ID System

CodeMind uses deterministic project IDs based on SHA-256 hash of normalized path:
- Ensures consistent IDs across reinitializations
- Prevents duplicate entries for the same project
- Handles path normalization (Windows/Unix differences)

---

## Code Analysis (`analyze`)

Perform AI-enhanced code analysis using the 11-step workflow.

### Syntax

```bash
codemind analyze <query>
```

### What It Does (11-Step Workflow)

1. **Query Analysis** - Detects assumptions and ambiguities
2. **Task Decomposition** - Splits complex queries into focused sub-tasks
3. **User Clarification** - Prompts for clarification when needed
4. **Hybrid Search** - Semantic + text + path search with RRF fusion
5. **Knowledge Graph Query** - Analyzes code relationships
6. **Sub-Task Context** - Generates tailored context per sub-task
7. **Context Building** - Combines all sources into enhanced context
8. **AI Analysis** - Generates contextual recommendations
9. **File Approval** - Confirms any file modifications
10. **Build/Test Verification** - Validates code changes
11. **Database Sync** - Updates embeddings and knowledge graph

### Examples

```bash
# Analyze specific functionality
codemind analyze "how does user authentication work"

# Analyze code patterns
codemind analyze "where is validation logic implemented"

# Analyze architecture
codemind analyze "what design patterns are used"
```

### Output

```
🔍 Analyzing: "how does user authentication work"

🚀 Starting enhanced AI workflow...

1️⃣ Detecting assumptions...
   📝 Detected 3 contextual assumptions
      • Project implements API/service architecture
      • Security and authorization is important
      • User seeks understanding of system behavior

2️⃣ Processing clarifications...
   🎯 Enhanced query: "how does user authentication work (Context: ...)"

3️⃣ Performing semantic search...
   🧠 Found 450 code segments to search
   🔍 Found 5 relevant code segments

4️⃣ Querying knowledge graph...
   🕸️ Found 12 relationships in knowledge graph

5️⃣ Building enhanced context...
   📊 Context enhancement quality: 8/10

6️⃣ Generating AI analysis...
   🤖 Generated contextual analysis with 4 recommendations

7️⃣ File modifications: Not implemented in MVP

8️⃣ Preparing summary...

📋 Analysis Summary:
   Query: how does user authentication work
   Code segments found: 5
   Relationships found: 12

🔍 Key Insights:
   1. Contains function/class definitions for auth
   2. Handles imports and dependencies
   3. Provides testing logic and validation scenarios

💡 Recommendations:
   1. Review 5 code segments found for "authentication"
   2. Check consistency across 3 files
   3. Analyze 12 architectural relationships

✅ Enhanced analysis completed!
```

---

## Natural Language Queries

Ask questions directly without specific commands. CodeMind automatically detects natural language and triggers the enhanced workflow.

### Search Toggle Feature

Before entering a prompt, you can toggle semantic search on/off. This is useful when:
- You want to skip file discovery and send prompts directly to Claude
- You know exactly what you want Claude to do without context gathering
- You want faster responses for simple queries

#### Menu-Based Toggle

When using the menu-based prompt interface, you'll see:

```
  Search: ON

? Options:
  > Enter prompt (with search)
    Turn OFF search (skip file discovery)
    Cancel
```

Select "Turn OFF search" to disable semantic search, then enter your prompt.

#### Inline Toggle

When using the inline prompt interface:

```
  [s] to toggle search | Search: ON
>
```

- Type `s` and press Enter to toggle search mode
- Or type your prompt directly

### Syntax

```bash
codemind -c "<natural language query>"
# or in interactive mode, just type your question
```

### Examples

```bash
# Understanding the project
codemind -c "what is this project about"
codemind -c "explain the main architecture"

# Finding code
codemind -c "where are the API endpoints defined"
codemind -c "show me files related to user authentication"

# Code changes (triggers approval workflow)
codemind -c "add error handling to the database service"
codemind -c "create a new middleware for request logging"

# Analysis requests
codemind -c "check this codebase for SOLID violations"
codemind -c "find duplicate code patterns"
```

### Interactive Mode

```
codemind> what is this project about
codemind> show me how authentication works
codemind> create a new API endpoint for users
```

---

## Built-in Commands

Available in both slash-command (`/command`) and direct (`command`) formats.

### Help

```bash
/help          # Show all available commands
help           # Same as above
```

### Status

```bash
/status        # Show current project and service status
status         # Same as above
```

Shows:
- Current project name, path, and ID
- File count and embeddings count
- Database connection status
- Workflow service status

### History

```bash
/history              # Show command history
/history show         # Same as above
/history clear        # Clear command history
/history help         # Show history help
```

Features:
- Per-project command history
- Stored in `~/.codemind/history/`
- Up to 100 commands preserved

### Exit

```bash
/exit          # Exit CodeMind
/quit          # Same as above
exit           # Same as above
quit           # Same as above
```

---

## Environment Variables

Configure CodeMind behavior via environment variables or `.env` file.

### Database Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `codemind` | Database name |
| `DB_USER` | `codemind` | Database user |
| `DB_PASSWORD` | `codemind123` | Database password |

### Neo4j Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `NEO4J_URI` | `bolt://localhost:7687` | Neo4j connection URI |
| `NEO4J_USER` | `neo4j` | Neo4j user |
| `NEO4J_PASSWORD` | `codemind123` | Neo4j password |

### Redis Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | (empty) | Redis password |

### Example `.env` File

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=codemind
DB_USER=codemind
DB_PASSWORD=codemind123

# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=codemind123

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

---

## Troubleshooting

### Common Issues

**Low semantic similarity scores:**
```bash
# Regenerate embeddings with correct model
codemind search --index
```

**Project not found:**
```bash
# Initialize the project first
codemind init
```

**Database connection failed:**
```bash
# Check Docker containers
docker ps

# Restart infrastructure
codemind setup --force
```

**Path mismatch (copied project folder):**
```bash
# Reset configuration for new location
codemind init --new-config
```

**Duplicate projects:**
```bash
# Find duplicates
codemind project duplicates

# Clean up
codemind project cleanup
```

### Keyboard Shortcuts (Interactive Mode)

| Shortcut | Action |
|----------|--------|
| `Ctrl+C` (once) | Show warning, press again to exit |
| `Ctrl+C` (twice) | Force exit |
| `Escape` | Interrupt current operation |
| `Ctrl+Z` | Interrupt current operation |
| `Up/Down` | Navigate command history |

---

## Technical Notes

### Embedding Model

CodeMind uses **Xenova/all-MiniLM-L6-v2** for all embeddings:
- 384-dimensional vectors
- Consistent model across indexing and retrieval
- pgvector extension in PostgreSQL for similarity search

### Project Identity

- Deterministic IDs using SHA-256 of normalized path
- Prevents duplicates across reinitializations
- Supports project migration and path changes

### Database Schema

- **PostgreSQL**: Projects, embeddings, analysis results
- **Neo4j**: Knowledge graph (files, classes, relationships)
- **Redis**: Caching and session management

---

## Support

- **Issues**: https://github.com/anthropics/claude-code/issues
- **Documentation**: `codemind --help`
- **Interactive Help**: `/help` in REPL mode

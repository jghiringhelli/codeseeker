# CodeMind: Intelligent Claude Code Enhancement

> Enhance Claude Code with semantic search, knowledge graphs, and intelligent code analysis for dramatically improved developer productivity.

[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue.svg)](https://www.typescriptlang.org/)
[![Storage](https://img.shields.io/badge/Storage-Embedded%20%7C%20Server-green.svg)](#storage-modes)
[![Status](https://img.shields.io/badge/status-MVP-green.svg)](https://github.com/your-org/codemind)

## Overview

CodeMind provides multiple integration points - use what fits your workflow:

| Component | Description | Auto-Sync? |
|-----------|-------------|------------|
| **CLI** | Direct command-line tool with natural language queries | Manual |
| **MCP Server** | Model Context Protocol server for Claude Desktop/Code | Manual |
| **Claude Code Plugin** | Seamless integration with hooks for auto-sync | Yes |
| **VSCode Extension** | File watching for manual edits | Yes |

**Zero Setup Required**: CodeMind uses embedded storage by default (SQLite + Graphology). No Docker or external databases needed to get started.

**Recommended Setup**: Install CLI + Claude Code Plugin for the best "install and forget" experience. See [Integration Guide](docs/INTEGRATION.md).

## Quick Start

```bash
# 1. Install globally
npm install -g codemind

# 2. Initialize your project
cd /path/to/your/project
codemind init --quick

# 3. Start using CodeMind
codemind -c "what is this project about?"
codemind -c "show me all the classes"
codemind -c "find authentication code"
```

That's it! CodeMind works immediately with embedded storage.

## Four Ways to Use CodeMind

### 1. Claude Code Plugin (Recommended)

The easiest way to use CodeMind with Claude Code - install once and forget:

```bash
# Install CLI globally
npm install -g codemind-enhanced-cli

# Copy plugin to Claude Code
cp -r plugins/codemind ~/.claude/plugins/   # Linux/macOS
xcopy /E /I plugins\codemind %USERPROFILE%\.claude\plugins\codemind  # Windows

# Restart Claude Code, then in any project:
/codemind:init
```

**What you get:**
- Slash commands (`/codemind:search`, `/codemind:standards`, etc.)
- MCP tools auto-configured (no manual setup)
- Auto-sync hooks (index updates automatically when Claude edits files or runs git)
- Agent skills (Claude uses CodeMind proactively)

See [Plugin README](plugins/codemind/README.md) for details.

### 2. CLI Mode

Direct command-line interface for code analysis and search:

```bash
# Natural language queries
codemind -c "what does the UserService do?"
codemind -c "find all API endpoints"
codemind -c "show me SOLID principle violations"

# Project management
codemind init           # Initialize project
codemind sync           # Update after code changes
codemind list           # List indexed projects

# Claude CLI passthrough (directly access Claude)
claude login            # Login to Claude (passed through)
claude logout           # Logout from Claude
claude --version        # Check Claude version
```

**Claude CLI Passthrough**: When you type commands starting with `claude`, CodeMind automatically passes them directly to the Claude CLI, then returns you to CodeMind. This makes it seamless to manage authentication, check versions, or run any Claude CLI command without leaving the CodeMind REPL.

### 3. MCP Server Mode

Run as an MCP server for Claude Desktop or Claude Code integration:

```bash
# Start MCP server
codemind serve --mcp
```

Add to Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "codemind": {
      "command": "codemind",
      "args": ["serve", "--mcp"]
    }
  }
}
```

**Available MCP Tools:**
- `search_code` - Semantic search across indexed projects
- `get_file_context` - File content with related code chunks
- `get_code_relationships` - Navigate code dependency graph
- `list_projects` - View indexed projects
- `index_project` - Index new projects
- `notify_file_changes` - Incremental or full reindex

See [MCP Server Documentation](docs/technical/mcp-server.md) for details.

### 4. VSCode Extension

Automatic file sync with visual status bar:

```bash
# Build and install extension
cd extensions/vscode-codemind
npm install && npm run compile
npm run package
code --install-extension vscode-codemind-0.1.0.vsix
```

**Features:**
- Automatic sync on file changes (debounced)
- Status bar with sync status indicator
- Commands: Sync Now, Full Reindex, Toggle Auto-Sync
- Smart exclusions (node_modules, .git, dist, etc.)

See [VSCode Extension README](extensions/vscode-codemind/README.md) for details.

## Storage Modes

CodeMind supports two storage configurations:

### Embedded Mode (Default)

**Zero configuration required.** Perfect for personal use and getting started.

| Component | Technology | Purpose |
|-----------|------------|---------|
| Vector Search | SQLite + better-sqlite3 | Semantic code search |
| Graph Database | Graphology (in-memory) | Code relationships |
| Cache | LRU-cache (in-memory) | Query caching |

Data is stored locally:
- **Windows**: `%APPDATA%\codemind\data\`
- **macOS**: `~/Library/Application Support/codemind/data/`
- **Linux**: `~/.local/share/codemind/data/`

### Server Mode (Advanced)

For large codebases (100K+ files), teams, or production environments:

> **Most users don't need this.** Start with embedded mode and upgrade only if you hit performance limits.

| Component | Technology | Purpose |
|-----------|------------|---------|
| Vector Search | PostgreSQL + pgvector | Scalable vector search |
| Graph Database | Neo4j | Powerful graph queries |
| Cache | Redis | Distributed caching |

**Setup Options (in order of recommendation):**

1. **Manual Installation** (Recommended)
   - Full control, production-ready
   - See [Database Scripts](deploy/scripts/README.md)

2. **Kubernetes** (Production)
   - For cloud deployments
   - See [Kubernetes Templates](deploy/kubernetes/)

3. **Docker Compose** (Experimental)
   - Quick local testing only, not for production
   - See [Docker Setup](#docker-experimental)

See [Storage Documentation](docs/technical/storage.md) for detailed configuration.

## Key Features

- **Semantic Search**: Vector-based code search with 100% accuracy
- **Knowledge Graphs**: Automatic mapping of code relationships
- **Smart Analysis**: SOLID violations, duplications, patterns
- **Natural Language**: Ask questions in plain English
- **Hybrid Search**: Text + vector + graph combined results
- **Incremental Updates**: Fast sync on file changes
- **Full Reindex**: Complete refresh after major changes
- **Claude CLI Passthrough**: Direct access to Claude login, logout, and other CLI commands

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CodeMind                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌──────────┐    ┌──────────────┐    ┌──────────────────────┐     │
│   │   CLI    │    │  MCP Server  │    │  VSCode Extension    │     │
│   │ codemind │    │ serve --mcp  │    │  vscode-codemind     │     │
│   └────┬─────┘    └──────┬───────┘    └──────────┬───────────┘     │
│        │                 │                        │                  │
│        └─────────────────┴────────────────────────┘                  │
│                          │                                           │
│   ┌──────────────────────┴──────────────────────────┐               │
│   │              Storage Manager                     │               │
│   │  (Auto-selects embedded or server mode)         │               │
│   └──────────────────────┬──────────────────────────┘               │
│                          │                                           │
│   ┌──────────────────────┴──────────────────────────┐               │
│   │                                                  │               │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────┐  │               │
│   │  │ Vector Store│  │ Graph Store │  │  Cache  │  │               │
│   │  │ SQLite/PG   │  │ Graphology/ │  │ LRU/    │  │               │
│   │  │ + pgvector  │  │ Neo4j       │  │ Redis   │  │               │
│   │  └─────────────┘  └─────────────┘  └─────────┘  │               │
│   │                                                  │               │
│   └──────────────────────────────────────────────────┘               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Documentation

| Document | Description |
|----------|-------------|
| [Integration Guide](docs/INTEGRATION.md) | All components explained with sync behavior |
| [Claude Code Plugin](plugins/codemind/README.md) | Plugin installation and usage |
| [Storage Guide](docs/technical/storage.md) | Embedded vs Server mode configuration |
| [MCP Server](docs/technical/mcp-server.md) | MCP protocol for Claude Code/Desktop integration |
| [CLI Commands](docs/install/cli_commands_manual.md) | Full CLI reference |
| [Manual Setup](docs/install/manual_setup.md) | Step-by-step setup instructions |
| [Core Cycle](docs/technical/core_cycle.md) | How the analysis workflow works |
| [Architecture](docs/technical/architecture.md) | Technical deep-dive |
| [VSCode Extension](extensions/vscode-codemind/README.md) | Extension setup and usage |
| [All Documentation](docs/README.md) | Complete documentation index |

## Docker (Experimental)

> **Note**: Docker Compose is provided for quick local testing. For production, we recommend manual database installation or Kubernetes deployment.

```bash
# Start databases only (experimental)
docker-compose up -d database redis neo4j

# Configure CodeMind to use server mode
export CODEMIND_STORAGE_MODE=server

# Initialize project
codemind init
```

See [Kubernetes Templates](deploy/kubernetes/) for production deployments.

## Performance

| Metric | Embedded | Server |
|--------|----------|--------|
| Startup time | ~100ms | ~500ms |
| Search (1K files) | ~50ms | ~20ms |
| Search (100K files) | ~500ms | ~50ms |
| Concurrent users | 1 | Many |
| Memory usage | Low | Variable |

**Recommendation**: Start with embedded mode. Switch to server mode when you have 100K+ files or need team collaboration.

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Built for developers, powered by AI, optimized for productivity.**
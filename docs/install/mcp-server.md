# CodeSeeker MCP Server

CodeSeeker can run as an MCP (Model Context Protocol) server, allowing Claude Desktop and Claude Code to directly search your codebases.

## What is MCP?

MCP is Anthropic's protocol for AI assistants to communicate with external tools. When running as an MCP server, CodeSeeker provides Claude with:

- Semantic search across your indexed projects
- File context with related code chunks
- Code relationship graph traversal
- Project indexing and management
- Incremental index updates

## Quick Start

### 1. Install CodeSeeker

```bash
npm install -g codeseeker
```

### 2. Index Your Project

```bash
cd /path/to/your/project
codeseeker init --quick
```

### 3. Configure Claude Code or Claude Desktop

#### Option A: Claude Code (CLI) - Recommended

Use the `claude mcp add` command:

```bash
# Add CodeSeeker as an MCP server (user-wide)
claude mcp add codeseeker --scope user -- codeseeker serve --mcp

# Verify it was added
claude mcp list
```

Or edit `~/.claude.json` directly:

```json
{
  "mcpServers": {
    "codeseeker": {
      "command": "codeseeker",
      "args": ["serve", "--mcp"]
    }
  }
}
```

After configuring, restart Claude Code. Test with:
```bash
claude mcp get codeseeker
```

#### Option B: Claude Desktop (GUI App)

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "codeseeker": {
      "command": "codeseeker",
      "args": ["serve", "--mcp"]
    }
  }
}
```

**Config file locations:**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/claude/claude_desktop_config.json`

### 4. Restart and Verify

After adding the configuration, restart Claude Code or Claude Desktop. In Claude Code, verify with:

```bash
claude mcp list
# Should show: codeseeker (user)
```

## Available Tools

### `search_code`

Search for code across indexed projects using semantic search.

**Parameters:**
- `query` (required): Natural language query or code snippet
- `limit` (optional): Maximum results (default: 10)
- `project` (optional): Filter to specific project
- `search_type` (optional): `hybrid` | `fts` | `vector` | `graph`

**Example:**
```
Search for "authentication middleware" in CodeSeeker
```

### `get_file_context`

Get a file's content with semantically related code chunks.

**Parameters:**
- `filepath` (required): Path to the file
- `include_related` (optional): Include related chunks (default: true)
- `project` (optional): Project name or path

**Example:**
```
Get the context for src/auth/middleware.ts
```

### `get_code_relationships`

Explore code relationships in the knowledge graph. Traverses imports, exports, function calls, class inheritance, and other code dependencies.

**Parameters:**
- `filepath` (required): Path to the file or entity to start traversal from
- `depth` (optional): How many relationship hops to traverse (default: 2, max: 5)
- `relationship_types` (optional): Filter by relationship types. Options: `imports`, `exports`, `calls`, `extends`, `implements`, `contains`, `uses`, `depends_on`
- `direction` (optional): Traversal direction - `in` (incoming), `out` (outgoing), or `both` (default: `both`)
- `project` (optional): Project name or path

**Example:**
```
What does src/auth/middleware.ts depend on?
Show me all files that import the UserService class
```

**Response includes:**
- `nodes`: Array of code entities (files, classes, functions) with their types and metadata
- `relationships`: Array of connections between nodes with relationship types
- `summary`: Human-readable description of the graph structure

### `list_projects`

List all indexed projects with their status.

**Example:**
```
What projects are indexed in CodeSeeker?
```

### `index_project`

Index a project directory for semantic search.

**Parameters:**
- `path` (required): Absolute path to project directory
- `name` (optional): Project name

**Example:**
```
Index my project at /home/user/my-app
```

### `notify_file_changes`

Update the index after file changes. Supports two modes:

1. **Incremental** (default): Pass specific file changes for fast updates
2. **Full reindex**: Use `full_reindex: true` after large operations like git pull

**Parameters:**
- `project` (required): Project name or path
- `changes` (optional): Array of `{type: "created"|"modified"|"deleted", path: string}`
- `full_reindex` (optional): Set to `true` for complete project re-index

**Examples:**
```
# Incremental update after modifying a file
I just modified src/api/routes.ts - update the index

# Full reindex after git pull
I just did a big git pull, please refresh the entire index
```

**Response includes:**
- `mode`: 'incremental' or 'full_reindex'
- `files_indexed` or `chunks_added/removed`: Count of changes
- `duration_ms`: Processing time

### `get_coding_standards`

Get auto-detected coding patterns and standards for a project. Returns validation patterns, error handling patterns, logging patterns, and testing patterns discovered from the codebase.

**Parameters:**
- `project` (required): Project name or path
- `category` (optional): Filter to specific category: `validation`, `error-handling`, `logging`, `testing`, or `all` (default: `all`)

**Example:**
```
What validation patterns does this project use?
Get the coding standards for error handling
```

**Response includes:**
- `generated_at`: Timestamp when standards were generated
- `project_id`: Project identifier
- `project_path`: Absolute path to project
- `standards`: Object with category-based patterns:
  - **validation**: Email, phone, URL validation patterns
  - **error-handling**: Try-catch, error response patterns
  - **logging**: Console, structured logging patterns
  - **testing**: Test setup, assertion patterns

**Example response:**
```json
{
  "standards": {
    "validation": {
      "validator-isemail": {
        "preferred": "validator.isEmail()",
        "import": "const validator = require('validator');",
        "usage_count": 5,
        "files": ["src/auth.ts", "src/user.ts"],
        "confidence": "high",
        "rationale": "Project standard - uses validator library in 5 files...",
        "alternatives": [...]
      }
    }
  }
}
```

**Use cases:**
- Learn project-specific coding patterns before making changes
- Ensure consistency with existing code style
- Discover which libraries are used for common tasks (validation, logging, etc.)
- Get recommendations on which pattern to use when multiple exist

**Note:** Standards are auto-generated during `codeseeker init` and updated incrementally when pattern-related files change. If not yet generated, the tool will create them on first call.

### `install_language_support`

Analyze project languages and install Tree-sitter parsers for better code understanding. Enhanced parsers provide more accurate AST extraction for imports, classes, functions, and relationships.

**Parameters:**
- `project` (optional): Project path to analyze (auto-detects needed parsers)
- `languages` (optional): Array of language names to install (e.g., `["python", "java", "csharp"]`)
- `list_available` (optional): Set to `true` to list all available parsers and their status

**Examples:**
```
# Analyze project and see which parsers are needed
Analyze my project at /path/to/project for language support

# Install specific parsers
Install Python and Java parsers for CodeSeeker

# List available parsers
List all available CodeSeeker language parsers
```

**Supported Languages:**
| Language | Parser | Quality |
|----------|--------|---------|
| TypeScript/JavaScript | Babel (bundled) | Excellent |
| Python | Tree-sitter | Excellent |
| Java | Tree-sitter | Excellent |
| C# | Tree-sitter/Regex | Excellent/Good |
| Go | Tree-sitter/Regex | Excellent/Good |
| Rust | Tree-sitter | Excellent |
| C/C++ | Tree-sitter | Excellent |
| Ruby | Tree-sitter | Excellent |
| PHP | Tree-sitter | Good |
| Swift | Tree-sitter | Good |
| Kotlin | Tree-sitter | Good |

**Response includes:**
- `installed_parsers`: Languages with parsers already available
- `available_parsers`: Languages that can be installed
- `detected_languages`: (when analyzing project) Languages found with file counts
- `recommendations`: Installation suggestions

**Use cases:**
- Improve code understanding for non-JavaScript/TypeScript projects
- Enable better relationship detection for Python, Java, C#, Go, etc.
- Reduce index size by having proper AST parsing instead of regex fallback

## Architecture

```
┌─────────────────┐     MCP Protocol      ┌──────────────────┐
│  Claude Desktop │ ◄──────────────────► │  CodeSeeker Server │
│  or Claude Code │    (stdio/JSON-RPC)   │  (MCP mode)      │
└─────────────────┘                       └──────────────────┘
                                                   │
                              ┌─────────────────────┼─────────────────────┐
                              ▼                     ▼                     ▼
                    ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
                    │  Vector Store    │  │   Graph Store    │  │   Cache Store    │
                    │  SQLite/Postgres │  │ Graphology/Neo4j │  │  LRU/Redis       │
                    └──────────────────┘  └──────────────────┘  └──────────────────┘
```

## Storage Modes

CodeSeeker supports two storage modes:

| Mode | Setup | Best For |
|------|-------|----------|
| **Embedded** (default) | Zero setup | Personal use, getting started |
| **Server** | Docker or manual | Teams, large codebases, production |

### Embedded Mode (Default)

Uses SQLite + Graphology + LRU-cache. Data is stored locally:

- **Windows**: `%APPDATA%\codeseeker\data\`
- **macOS**: `~/Library/Application Support/codeseeker/data/`
- **Linux**: `~/.local/share/codeseeker/data/`

### Server Mode

Uses PostgreSQL + Neo4j + Redis for production deployments. Configure via environment variables:

```bash
# PostgreSQL (vector search + projects)
export CODESEEKER_PG_HOST=localhost
export CODESEEKER_PG_PORT=5432
export CODESEEKER_PG_DATABASE=codeseeker
export CODESEEKER_PG_USER=codeseeker
export CODESEEKER_PG_PASSWORD=secret

# Neo4j (code graph)
export CODESEEKER_NEO4J_URI=bolt://localhost:7687
export CODESEEKER_NEO4J_USER=neo4j
export CODESEEKER_NEO4J_PASSWORD=secret

# Redis (caching)
export CODESEEKER_REDIS_HOST=localhost
export CODESEEKER_REDIS_PORT=6379

# Enable server mode
export CODESEEKER_STORAGE_MODE=server  # or 'auto' to try server first
```

For Claude Code with server mode, add via CLI:

```bash
claude mcp add codeseeker --scope user \
  -e CODESEEKER_STORAGE_MODE=server \
  -e CODESEEKER_PG_HOST=localhost \
  -e CODESEEKER_NEO4J_URI=bolt://localhost:7687 \
  -e CODESEEKER_REDIS_HOST=localhost \
  -- codeseeker serve --mcp
```

Or configure in `~/.claude.json` (Claude Code) or `claude_desktop_config.json` (Claude Desktop):

```json
{
  "mcpServers": {
    "codeseeker": {
      "command": "codeseeker",
      "args": ["serve", "--mcp"],
      "env": {
        "CODESEEKER_STORAGE_MODE": "server",
        "CODESEEKER_PG_HOST": "localhost",
        "CODESEEKER_NEO4J_URI": "bolt://localhost:7687",
        "CODESEEKER_REDIS_HOST": "localhost"
      }
    }
  }
}
```

See [storage.md](./storage.md) for detailed server setup instructions.

## Debugging

### Using the MCP Inspector

```bash
npx @modelcontextprotocol/inspector codeseeker serve --mcp
```

This opens a GUI where you can test tools interactively.

### Checking Logs

MCP server logs go to stderr. To capture them:

```bash
codeseeker serve --mcp 2>codeseeker-mcp.log
```

## Troubleshooting

### "codeseeker" not found

Ensure CodeSeeker is installed globally and in your PATH:

```bash
npm install -g codeseeker
which codeseeker  # or 'where codeseeker' on Windows
```

### No results from search

Make sure you've indexed your project first:

```bash
codeseeker init  # in your project directory
```

### Connection issues

Check that the MCP server starts correctly:

```bash
codeseeker serve --mcp
# Should output: "CodeSeeker MCP server running on stdio"
```

### Claude Code MCP Issues

If MCP isn't working in Claude Code:

```bash
# Check if server is registered
claude mcp list

# Get detailed server info
claude mcp get codeseeker

# Remove and re-add if needed
claude mcp remove codeseeker
claude mcp add codeseeker --scope user -- codeseeker serve --mcp
```

## Example Claude Conversations

### Semantic Search
```
You: Search for how authentication is implemented in my project

Claude: [Uses search_code tool with query "authentication implementation"]

I found 5 relevant files:
1. src/auth/jwt-handler.ts (score: 0.92) - JWT token validation and generation
2. src/middleware/auth-middleware.ts (score: 0.87) - Express middleware for auth
3. src/routes/auth.ts (score: 0.85) - Login/logout endpoints
...

Would you like me to explain any of these in detail?
```

### Code Relationships
```
You: What files depend on the UserService class?

Claude: [Uses get_code_relationships tool with filepath "src/services/user-service.ts", direction "in"]

I found 8 files that depend on UserService:

Incoming relationships (files that import UserService):
├── src/controllers/user-controller.ts (imports, calls)
├── src/controllers/auth-controller.ts (imports, calls)
├── src/middleware/auth-middleware.ts (imports)
├── src/routes/api/users.ts (imports)
└── tests/services/user-service.test.ts (imports)

The UserService is a core dependency used by authentication,
user management APIs, and has comprehensive test coverage.
```

### Full Reindex After Major Changes
```
You: I just did a big git pull, can you refresh the entire CodeSeeker index?

Claude: [Uses notify_file_changes tool with full_reindex: true]

I've triggered a full reindex of your project. This clears the existing
index and rebuilds it from scratch.

Result:
- Mode: full_reindex
- Files indexed: 247
- Duration: 12.4 seconds

The index is now up to date with all your latest changes.
```

## VSCode Extension Integration

For automatic index synchronization, install the CodeSeeker VSCode extension:

```bash
cd extensions/vscode-codeseeker
npm install && npm run compile
npm run package
code --install-extension vscode-codeseeker-0.1.0.vsix
```

### How It Works

The VSCode extension watches for file changes and automatically calls the MCP server's `notify_file_changes` tool:

```
┌──────────────────┐     File Events     ┌──────────────────┐
│  VSCode Editor   │ ─────────────────► │ CodeSeeker Extension│
└──────────────────┘                     └────────┬─────────┘
                                                  │
                                                  │ Debounce (2s)
                                                  ▼
                                         ┌──────────────────┐
                                         │   MCP Client     │
                                         │ notify_file_     │
                                         │ changes          │
                                         └────────┬─────────┘
                                                  │
                                                  │ stdio/JSON-RPC
                                                  ▼
                                         ┌──────────────────┐
                                         │  CodeSeeker MCP    │
                                         │     Server       │
                                         └────────┬─────────┘
                                                  │
                                                  ▼
                                         ┌──────────────────┐
                                         │  Vector/Graph    │
                                         │     Stores       │
                                         └──────────────────┘
```

### Extension Features

| Feature | Description |
|---------|-------------|
| **Auto-Sync** | Files automatically synced on save |
| **Debouncing** | Changes batched (configurable, default 2s) |
| **Status Bar** | Visual indicator of sync status |
| **Full Reindex** | Command palette: "CodeSeeker: Full Reindex" |
| **Toggle Sync** | Enable/disable automatic syncing |

### Extension Settings

Configure via VSCode Settings:

| Setting | Default | Description |
|---------|---------|-------------|
| `codeseeker.autoSync` | `true` | Auto-sync on file changes |
| `codeseeker.syncDebounceMs` | `2000` | Debounce delay (ms) |
| `codeseeker.excludePatterns` | `["**/node_modules/**", ...]` | Files to ignore |
| `codeseeker.mcpCommand` | `"codeseeker"` | MCP server command |

See [VSCode Extension README](../extensions/vscode-codeseeker/README.md) for full documentation.

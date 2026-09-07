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

CodeSeeker exposes **exactly one** MCP tool — `codeseeker` — with an `action` routing key.
A single tool keeps the per-request description cost low; see ADR-002 in
`.claude/adr/index.md` for the rationale.

```js
codeseeker({ action, project, search?|sym?|graph?|analyze?|index? })
```

Fill only the nested group matching `action`. **Always pass `project`** with the absolute
project root — an MCP server cannot detect your editor's working directory, and without it
a query may resolve against a different index.

### `action: "search"`

Hybrid retrieval: BM25 + vector embeddings fused with Reciprocal Rank Fusion, a RAPTOR
directory-summary cascade, then graph expansion.

| Param | Type | Default | Meaning |
|---|---|---|---|
| `q` | string | required | Natural-language query |
| `type` | `hybrid` \| `fts` \| `vector` | `hybrid` | Retrieval mode |
| `limit` | number | 10 | Max results |
| `full` | boolean | false | Include a snippet per result |
| `exists` | boolean | false | Quick yes/no — returns `{found,count,top_file}` |

```js
codeseeker({ action: "search", project: "/abs/root", search: { q: "jwt refresh token" } })
```

Results are summaries by default (path, score, line range, signature). Read the file with
your editor's Read tool rather than asking for `full: true`, unless you only need a peek.

### `action: "sym"`

Look up a class, function or method by name in the knowledge graph and show its neighbours.

| Param | Type | Default | Meaning |
|---|---|---|---|
| `name` | string | required | Symbol name, exact or partial |
| `full` | boolean | false | Include resolved relationships |

```js
codeseeker({ action: "sym", project: "/abs/root", sym: { name: "UserService" } })
```

### `action: "graph"`

Traverse the knowledge graph built from AST-parsed imports.

| Param | Type | Default | Meaning |
|---|---|---|---|
| `seed` | string | — | Seed file (project-relative) |
| `q` | string | — | Or: find seed files semantically |
| `depth` | number | 1 | Traversal depth, 1–3 |
| `rel` | string[] | all | `imports`, `exports`, `calls`, `extends`, `implements`, `contains`, `uses`, `depends_on` |
| `dir` | `in` \| `out` \| `both` | `both` | Edge direction |
| `max` | number | 50 | Max nodes returned |

```js
codeseeker({ action: "graph", project: "/abs/root",
             graph: { seed: "src/auth/jwt.ts", dir: "in" } })   // who depends on this?
```

**Accuracy note:** import edges come from AST parsing and are reliable. Call edges use
regex heuristics, so dynamic dispatch, callbacks and event handlers are not detected.

### `action: "analyze"`

| `kind` | Extra params | What it returns |
|---|---|---|
| `standards` | `category` | Detected patterns per category, with usage counts and confidence |
| `duplicates` | `threshold`, `min_lines` | Semantically similar code blocks |
| `dead_code` | `patterns` | Unused exports, orphaned files, coupling issues |

`project` is **required** for every `analyze` call.

```js
codeseeker({ action: "analyze", project: "/abs/root", analyze: { kind: "dead_code" } })
```

### `action: "index"`

| `op` | Extra params | What it does |
|---|---|---|
| `init` | `path`, `name` | Build the index (required once per project) |
| `sync` | `changes[]`, `full_reindex` | Incremental update, or full rebuild |
| `status` | — | List indexed projects with file/chunk counts and job progress |
| `parsers` | `languages`, `list_available` | List or install Tree-sitter parsers |
| `exclude` | `exclude_op`, `paths`, `reason` | Exclude/include paths; persists to `.codeseeker/exclusions.json` |

```js
codeseeker({ action: "index", index: { op: "init", path: "/abs/root" } })
codeseeker({ action: "index", index: { op: "status" } })
```

Indexing runs in the background — `init` returns immediately, so poll `op: "status"` until
`indexing_status` is `completed`.

### Language support

Relationship extraction quality by language, as actually implemented:

| Language | Parser in use | Relationship extraction |
|----------|---------------|------------------------|
| TypeScript / JavaScript | Babel AST (bundled) | Excellent |
| Python | Tree-sitter | Excellent |
| Java | Tree-sitter | Excellent |
| C# | Regex | Good |
| Go | Regex | Good |
| Rust, C/C++, Ruby, PHP | Regex | Basic |

`index({op:"parsers"})` lists further Tree-sitter packages, but only TypeScript,
JavaScript, Python and Java are currently wired into the graph builder — installing a
parser for another language does not yet change extraction quality for it.


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

Claude: [Calls codeseeker({action:"search", project:"/abs/root", search:{q:"authentication implementation"}})]

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

Claude: [Calls codeseeker({action:"graph", project:"/abs/root", graph:{seed:"src/services/user-service.ts", dir:"in"}})]

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

Claude: [Calls codeseeker({action:"index", project:"/abs/root", index:{op:"sync", full_reindex:true}})]

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

The VSCode extension watches for file changes and automatically calls the MCP server with `{action:"index", index:{op:"sync", changes:[...]}}`:

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

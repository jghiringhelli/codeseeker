# CodeSeeker

**Graph-powered code intelligence for Claude Code.** CodeSeeker builds a knowledge graph of your codebase—not just embeddings—so Claude understands how your code actually connects.

[![npm version](https://img.shields.io/npm/v/codeseeker.svg)](https://www.npmjs.com/package/codeseeker)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue.svg)](https://www.typescriptlang.org/)

> **What is CodeSeeker?** An MCP server that gives Claude semantic code search and knowledge graph traversal. Works with Claude Code, Claude Desktop, and Cursor.

## The Problem

Claude Code is powerful, but it navigates your codebase like a tourist with a phrasebook:
- **Grep searches** find text matches, not semantic meaning
- **File reads** show code in isolation, missing the bigger picture
- **No memory** of your project's patterns—every session starts fresh

The result? Claude asks you to explain code relationships it should already know. It writes validation logic that doesn't match your existing patterns. It misses dependencies and breaks things.

## How CodeSeeker Fixes This

CodeSeeker builds a **knowledge graph** of your codebase:

```
┌─────────────┐     imports      ┌─────────────┐
│  auth.ts    │ ───────────────▶ │  user.ts    │
└─────────────┘                  └─────────────┘
       │                                │
       │ calls                          │ extends
       ▼                                ▼
┌─────────────┐     implements   ┌─────────────┐
│ session.ts  │ ◀─────────────── │ BaseUser.ts │
└─────────────┘                  └─────────────┘
```

When you ask "add password reset to authentication", Claude doesn't just find files containing "auth"—it traverses the graph to find:
- What `auth.ts` imports and exports
- Which services call authentication functions
- What patterns exist in related code
- How your project handles similar flows

This is **Graph RAG** (Retrieval-Augmented Generation), not just vector search.

## Installation

### Quick Install (Recommended)

Use the `install` command to automatically configure MCP for your IDE:

```bash
# Install globally
npm install -g codeseeker

# Configure for your IDE (run from your project directory)
codeseeker install --copilot     # VS Code + GitHub Copilot
codeseeker install --cursor      # Cursor IDE
codeseeker install --windsurf    # Windsurf IDE

# Or install globally (applies to all projects)
codeseeker install --copilot --global
```

Then restart your IDE. CodeSeeker tools are now available!

### Claude Code (Terminal or VS Code)

**Option A: Plugin**

```
/plugin install codeseeker@github:jghiringhelli/codeseeker#plugin
```

This installs the plugin with:
- MCP server auto-configured
- Hooks that keep the index in sync when Claude edits files
- Slash commands (`/codeseeker:init`, `/codeseeker:reindex`)

**Option B: Automatic Install**

```bash
npm install -g codeseeker
codeseeker install --copilot
```

**Option C: Manual MCP Configuration**

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "codeseeker": {
      "command": "npx",
      "args": ["-y", "codeseeker", "serve", "--mcp"],
      "env": {
        "CODESEEKER_STORAGE_MODE": "embedded"
      }
    }
  }
}
```

### VS Code + GitHub Copilot

```bash
npm install -g codeseeker
codeseeker install --copilot
```

This creates `.vscode/mcp.json` with the correct configuration for GitHub Copilot's MCP support (VS Code 1.99+).

### Cursor

```bash
npm install -g codeseeker
codeseeker install --cursor
```

Or manually add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "codeseeker": {
      "command": "npx",
      "args": ["-y", "codeseeker", "serve", "--mcp"],
      "env": {
        "CODESEEKER_STORAGE_MODE": "embedded"
      }
    }
  }
}
```

### Claude Desktop

Add to your `claude_desktop_config.json`:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "codeseeker": {
      "command": "npx",
      "args": ["-y", "codeseeker", "serve", "--mcp"],
      "env": {
        "CODESEEKER_STORAGE_MODE": "embedded"
      }
    }
  }
}
```

### CLI Standalone

```bash
npm install -g codeseeker
cd your-project
codeseeker init
codeseeker -c "how does authentication work in this project?"
```

## What You Get

Once configured, Claude has access to these MCP tools (used automatically):

| Tool | What It Does |
|------|--------------|
| `search_code` | Hybrid search: vector + text + path with RRF fusion |
| `find_and_read` | Search + Read in one step - returns file content directly |
| `get_code_relationships` | Traverse the knowledge graph (imports, calls, extends) |
| `get_file_context` | Read a file with its related code automatically included |
| `get_coding_standards` | Your project's detected patterns (validation, error handling) |
| `index_project` | Manually trigger indexing (rarely needed) |
| `notify_file_changes` | Update index for specific files |
| `manage_index` | Dynamically exclude/include files from the index |

**You don't invoke these manually**—Claude uses them automatically when searching code or analyzing relationships.

## How Indexing Works

**You don't need to manually index.** When Claude uses any CodeSeeker tool, the tool automatically checks if the project is indexed. If not, it indexes on first use.

```
User: "Find the authentication logic"
        │
        ▼
┌─────────────────────────────────────┐
│ Claude calls search_code()          │
│         │                           │
│         ▼                           │
│ Project indexed? ──No──► Index now  │
│         │                  (auto)   │
│        Yes                   │      │
│         │◀───────────────────┘      │
│         ▼                           │
│ Return search results               │
└─────────────────────────────────────┘
```

First search on a new project takes 30 seconds to several minutes (depending on size). Subsequent searches are instant.

## What Makes It Different

| Approach | How It Works | Strengths | Limitations |
|----------|--------------|-----------|-------------|
| **Grep/ripgrep** | Text pattern matching | Fast, universal | No semantic understanding |
| **Vector search only** | Embedding similarity | Finds similar code | Misses structural relationships |
| **LSP-based tools** | Language server protocol | Precise symbol definitions | No semantic search, no cross-file reasoning |
| **CodeSeeker** | Knowledge graph + hybrid search | Semantic + structure + patterns | Requires initial indexing (30s-5min) |

### CodeSeeker's Unique Capabilities

**What LSP tools can't do:**
- *"Find code that handles errors like this"* → Semantic search finds similar patterns
- *"What validation approach does this project use?"* → Auto-detected coding standards
- *"Show me everything related to authentication"* → Graph traversal across indirect dependencies

**What vector-only search misses:**
- Direct import/export relationships
- Class inheritance chains
- Function call graphs
- Which files actually depend on which

CodeSeeker combines all three: **graph traversal** for structure, **vector search** for meaning, **text search** for precision—fused with Reciprocal Rank Fusion (RRF) for optimal results.

## Auto-Detected Coding Standards

CodeSeeker analyzes your codebase and extracts patterns:

```json
{
  "validation": {
    "email": {
      "preferred": "z.string().email()",
      "usage_count": 12,
      "files": ["src/auth.ts", "src/user.ts"]
    }
  },
  "react-patterns": {
    "state": {
      "preferred": "useState<T>()",
      "usage_count": 45
    }
  }
}
```

Detected pattern categories:
- **validation**: Zod, Yup, Joi, validator.js, custom regex
- **error-handling**: API error responses, try-catch patterns, custom Error classes
- **logging**: Console, Winston, Bunyan, structured logging
- **testing**: Jest/Vitest setup, assertion patterns
- **react-patterns**: Hooks (useState, useEffect, useMemo, useCallback, useRef)
- **state-management**: Redux Toolkit, Zustand, React Context, TanStack Query
- **api-patterns**: Fetch, Axios, Express routes, Next.js API routes

When Claude writes new code, it follows your existing conventions instead of inventing new ones.

## Managing Index Exclusions

If Claude notices files that shouldn't be indexed (like Unity's Library folder, build outputs, or generated files), it can dynamically exclude them:

```typescript
// Exclude Unity Library folder and generated files
manage_index({
  action: "exclude",
  project: "my-unity-game",
  paths: ["Library/**", "Temp/**", "*.generated.cs"],
  reason: "Unity build artifacts"
})
```

Exclusions are persisted in `.codeseeker/exclusions.json` and automatically respected during reindexing.

## Language Support

| Language | Parser | Relationship Extraction |
|----------|--------|------------------------|
| TypeScript/JavaScript | Babel AST | Excellent |
| Python | Tree-sitter | Excellent |
| Java | Tree-sitter | Excellent |
| C# | Regex | Good |
| Go | Regex | Good |
| Rust, C/C++, Ruby, PHP | Regex | Basic |

Tree-sitter parsers install automatically when needed.

## Keeping the Index in Sync

### With Claude Code Plugin

The plugin installs **hooks** that automatically update the index:

| Event | What Happens |
|-------|--------------|
| Claude edits a file | Index updated automatically |
| Claude runs `git pull/checkout/merge` | Full reindex triggered |
| You run `/codeseeker:reindex` | Manual full reindex |

**You don't need to do anything**—the plugin handles sync automatically.

### With MCP Server Only (Cursor, Claude Desktop)

- **Claude-initiated changes**: Claude can call `notify_file_changes` tool
- **Manual changes**: Not automatically detected—ask Claude to reindex periodically

### Sync Summary

| Setup | Claude Edits | Git Operations | Manual Edits |
|-------|--------------|----------------|--------------|
| **Plugin** (Claude Code) | Auto | Auto | Manual |
| **MCP** (Cursor, Desktop) | Ask Claude | Ask Claude | Ask Claude |
| **CLI** | Auto | Auto | Manual |

## When CodeSeeker Helps Most

**Good fit:**
- Large codebases (10K+ files) where Claude struggles to find relevant code
- Projects with established patterns you want Claude to follow
- Complex dependency chains across multiple files
- Teams wanting consistent AI-generated code

**Less useful:**
- Greenfield projects with little existing code
- Single-file scripts
- Projects where you're actively changing architecture

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     Claude Code                          │
│                         │                                │
│                    MCP Protocol                          │
│                         │                                │
│  ┌──────────────────────▼──────────────────────────┐    │
│  │              CodeSeeker MCP Server               │    │
│  │  ┌─────────────┬─────────────┬────────────────┐ │    │
│  │  │   Vector    │  Knowledge  │    Coding      │ │    │
│  │  │   Search    │    Graph    │   Standards    │ │    │
│  │  │  (SQLite)   │  (SQLite)   │   (JSON)       │ │    │
│  │  └─────────────┴─────────────┴────────────────┘ │    │
│  └─────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

All data stored locally in `.codeseeker/`. No external services required.

For large teams (100K+ files, shared indexes), server mode supports PostgreSQL + Neo4j. See [Storage Documentation](docs/technical/storage.md).

## Troubleshooting

### MCP server not connecting

1. Verify npx works: `npx -y codeseeker --version`
2. Check MCP config file syntax (valid JSON)
3. Restart your editor/Claude application

### Indexing seems slow

First-time indexing of large projects (50K+ files) can take 5+ minutes. Subsequent uses are instant.

### Tools not appearing in Claude

MCP tools appear automatically once the server connects. Ask Claude "what CodeSeeker tools do you have?" to verify.

## Documentation

- [Integration Guide](docs/INTEGRATION.md) - How all components connect
- [Architecture](docs/technical/architecture.md) - Technical deep dive
- [CLI Commands](docs/install/cli_commands_manual.md) - Full command reference

## Compatibility Note

**GitHub Copilot**: Not compatible. Copilot uses a different architecture (not MCP).

**Supported platforms**: Claude Code, Claude Desktop, Cursor, and any MCP-compatible client.

## License

MIT License. See [LICENSE](LICENSE).

---

*CodeSeeker gives Claude the code understanding that grep and embeddings alone can't provide.*

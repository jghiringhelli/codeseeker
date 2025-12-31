# CodeMind

**Graph-powered code intelligence for Claude Code.** CodeMind builds a knowledge graph of your codebase—not just embeddings—so Claude understands how your code actually connects.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue.svg)](https://www.typescriptlang.org/)

> **What is CodeMind?** CodeMind is a **Claude Code plugin** that adds MCP tools for semantic code search and knowledge graph traversal. It works anywhere Claude Code runs—terminal, VS Code with Claude Code extension, or any other environment. It is *not* a VS Code extension itself.

## The Problem

Claude Code is powerful, but it navigates your codebase like a tourist with a phrasebook:
- **Grep searches** find text matches, not semantic meaning
- **File reads** show code in isolation, missing the bigger picture
- **No memory** of your project's patterns—every session starts fresh

The result? Claude asks you to explain code relationships it should already know. It writes validation logic that doesn't match your existing patterns. It misses dependencies and breaks things.

## How CodeMind Fixes This

CodeMind builds a **knowledge graph** of your codebase:

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

## What Makes It Different

| Approach | How It Works | Strengths | Limitations |
|----------|--------------|-----------|-------------|
| **Grep/ripgrep** | Text pattern matching | Fast, universal | No semantic understanding |
| **Vector search only** | Embedding similarity | Finds similar code | Misses structural relationships |
| **LSP-based tools** | Language server protocol | Precise symbol definitions, instant setup | No semantic search, no cross-file reasoning, requires LSP server |
| **CodeMind** | Knowledge graph + hybrid search | Semantic search, relationship traversal, pattern detection | Requires initial indexing (30s-5min) |

### CodeMind's Unique Capabilities

**What LSP tools can't do:**
- *"Find code that handles errors like this"* → Semantic search finds similar patterns
- *"What validation approach does this project use?"* → Auto-detected coding standards
- *"Show me everything related to authentication"* → Graph traversal across indirect dependencies

**What vector-only search misses:**
- Direct import/export relationships
- Class inheritance chains
- Function call graphs
- Which files actually depend on which

CodeMind combines all three: **graph traversal** for structure, **vector search** for meaning, **text search** for precision—fused with Reciprocal Rank Fusion (RRF) for optimal results.

## Quick Start

### For Claude Code (Recommended)

Install the plugin in Claude Code (terminal or VS Code):

```
/plugin install codemind@github:jghiringhelli/codemind#plugin
```

Then in any project, initialize the index:
```
/codemind:init
```

Indexing takes 30 seconds to several minutes depending on project size. After that, Claude automatically uses CodeMind's MCP tools when searching code or analyzing relationships.

**Note:** The plugin installs hooks that automatically keep the index in sync when Claude edits files or runs git operations.

### For Claude Desktop (MCP Server)

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "codemind": {
      "command": "npx",
      "args": ["-y", "codemind-enhanced-cli", "serve", "--mcp"]
    }
  }
}
```

### CLI Standalone

```bash
npm install -g codemind-enhanced-cli
codemind init
codemind -c "how does authentication work in this project?"
```

## How Indexing Works

**You don't need to manually index.** When Claude uses any CodeMind MCP tool (`search_code`, `get_code_relationships`, etc.), the tool automatically checks if the project is indexed. If not, it indexes on first use.

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
│         │◄───────────────────┘      │
│         ▼                           │
│ Return search results               │
└─────────────────────────────────────┘
```

First search on a new project takes 30 seconds to several minutes (depending on size). Subsequent searches are instant.

## What Claude Gets

Once indexed, Claude has access to these MCP tools:

| Tool | What It Does |
|------|--------------|
| `search_code` | Hybrid search: vector + text + path with RRF fusion |
| `get_code_relationships` | Traverse the knowledge graph (imports, calls, extends) |
| `get_file_context` | Read a file with its related code automatically included |
| `get_coding_standards` | Your project's detected patterns (validation, error handling) |
| `index_project` | Manually trigger indexing (rarely needed) |
| `notify_file_changes` | Update index for specific files |

Claude uses these automatically—you don't need to invoke them manually.

## Auto-Detected Coding Standards

CodeMind analyzes your codebase and extracts patterns:

```json
{
  "validation": {
    "email": {
      "preferred": "validator.isEmail()",
      "usage_count": 12,
      "files": ["src/auth.ts", "src/user.ts", "src/api/register.ts"]
    }
  },
  "error-handling": {
    "api_errors": {
      "preferred": "res.status(code).json({ error: message })",
      "usage_count": 34
    }
  }
}
```

When Claude writes new code, it follows your existing conventions instead of inventing new ones.

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

## When CodeMind Helps Most

**Good fit:**
- Large codebases (10K+ files) where Claude struggles to find relevant code
- Projects with established patterns you want Claude to follow
- Complex dependency chains across multiple files
- Teams wanting consistent AI-generated code

**Less useful:**
- Greenfield projects with little existing code
- Single-file scripts
- Projects where you're actively changing architecture

## Keeping the Index in Sync

CodeMind uses different sync mechanisms depending on how you use it:

### Claude Code Plugin (Recommended)

The plugin installs **hooks** that automatically update the index:

| Event | Hook | What Happens |
|-------|------|--------------|
| Claude edits a file | `PostToolUse(Edit,Write)` | Calls `notify_file_changes` MCP tool |
| Claude runs git commands | `PostToolUse(Bash)` | Detects `git pull/checkout/merge`, triggers reindex |
| You run `/codemind:reindex` | Slash command | Full reindex via `index_project` MCP tool |

**You don't need to do anything**—the plugin handles sync automatically when Claude makes changes.

### MCP Server (Claude Desktop)

The MCP server exposes `notify_file_changes` tool. When Claude edits files, it can call this tool to update the index. However, Claude Desktop doesn't have hooks, so:
- Claude-initiated changes: Claude can call `notify_file_changes` (if instructed)
- Manual changes: Not automatically detected—run `index_project` tool periodically

### CLI Mode

The CLI has a built-in workflow that syncs after operations:
```bash
codemind -c "refactor the auth module"  # Syncs automatically after changes
codemind reindex                         # Manual full reindex
```

### VS Code Extension (Optional)

For manual edits made outside Claude (directly in VS Code), install the extension:
```bash
cd extensions/vscode-codemind
npm install && npm run package
code --install-extension vscode-codemind-*.vsix
```

The extension watches for file saves and calls `notify_file_changes` automatically.

### Sync Summary

| How You Use CodeMind | Claude Edits | Git Operations | Manual Edits |
|---------------------|--------------|----------------|--------------|
| **Plugin** (Claude Code) | ✅ Auto | ✅ Auto | ❌ Manual or Extension |
| **MCP** (Claude Desktop) | ⚠️ Manual | ❌ Manual | ❌ Manual |
| **CLI** | ✅ Auto | ✅ Auto | ❌ Manual |
| **+ VS Code Extension** | — | — | ✅ Auto |

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     Claude Code                          │
│                         │                                │
│                    MCP Protocol                          │
│                         │                                │
│  ┌──────────────────────▼──────────────────────────┐    │
│  │              CodeMind MCP Server                 │    │
│  │  ┌─────────────┬─────────────┬────────────────┐ │    │
│  │  │   Vector    │  Knowledge  │    Coding      │ │    │
│  │  │   Search    │    Graph    │   Standards    │ │    │
│  │  │  (SQLite)   │  (SQLite)   │   (JSON)       │ │    │
│  │  └─────────────┴─────────────┴────────────────┘ │    │
│  └─────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

All data stored locally in `.codemind/`. No external services required.

For large teams (100K+ files, shared indexes), server mode supports PostgreSQL + Neo4j. See [Storage Documentation](docs/technical/storage.md).

## Documentation

- [Integration Guide](docs/INTEGRATION.md) - How all components connect
- [MCP Server Reference](docs/technical/mcp-server.md) - Available tools and parameters
- [CLI Commands](docs/install/cli_commands_manual.md) - Full command reference

## License

MIT License. See [LICENSE](LICENSE).

---

*CodeMind gives Claude the code understanding that grep and embeddings alone can't provide.*

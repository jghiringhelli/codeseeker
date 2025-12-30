# CodeMind

**Graph-powered code intelligence for Claude Code.** CodeMind builds a knowledge graph of your codebase—not just embeddings—so Claude understands how your code actually connects.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue.svg)](https://www.typescriptlang.org/)

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

| Approach | How It Works | Limitation |
|----------|--------------|------------|
| **Grep/ripgrep** | Text pattern matching | No semantic understanding |
| **Vector search** | Embedding similarity | Misses structural relationships |
| **LSP tools** | Symbol definitions | No cross-file reasoning |
| **CodeMind** | Knowledge graph + hybrid search | Requires initial indexing |

CodeMind combines:
- **Graph traversal** - Understands imports, exports, inheritance, function calls
- **Hybrid search** - Vector similarity + full-text + file path matching, fused with RRF
- **Auto-detected standards** - Learns your validation, error handling, and logging patterns

## Quick Start

### For Claude Code (VS Code)

```
/install-plugin codemind@github:jghiringhelli/codemind#plugin
```

Restart VS Code, then in any project:
```
/codemind:init
```

Indexing takes 30 seconds to several minutes depending on project size. After that, Claude automatically uses the graph when relevant.

### For Claude Desktop

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

## What Claude Gets

Once indexed, Claude has access to these MCP tools:

| Tool | What It Does |
|------|--------------|
| `search_code` | Hybrid search: vector + text + path with RRF fusion |
| `get_code_relationships` | Traverse the knowledge graph (imports, calls, extends) |
| `get_file_context` | Read a file with its related code automatically included |
| `get_coding_standards` | Your project's detected patterns (validation, error handling) |

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

## Automatic Sync

| Scenario | What Happens |
|----------|--------------|
| Claude edits files | Index updates automatically via plugin hooks |
| `git pull` / `git checkout` | Full reindex triggers automatically |
| Manual edits in VS Code | Extension syncs changes (if installed) |
| Manual edits elsewhere | Run `/codemind:reindex` |

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

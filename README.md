# CodeSeeker

**Graph-powered code intelligence for Claude Code.** CodeSeeker builds a knowledge graph of your codebase—not just embeddings—so Claude understands how your code actually connects.

[![npm version](https://img.shields.io/npm/v/codeseeker.svg)](https://www.npmjs.com/package/codeseeker)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue.svg)](https://www.typescriptlang.org/)

> **What is CodeSeeker?** An MCP server that gives AI assistants semantic code search and knowledge graph traversal. Works with **Claude Code**, **GitHub Copilot**, **Cursor**, and **Claude Desktop**.

> **⚠️ NOT A VS CODE EXTENSION:** CodeSeeker is installed via `npm`, not the VS Code marketplace. It's an MCP server that enhances AI assistants, not a standalone extension.

## Installation

> **🚨 Important:** CodeSeeker is **NOT a VS Code extension**. It's an **MCP server** (Model Context Protocol) that works WITH AI assistants like Claude Code and GitHub Copilot. Don't look for it in the VS Code marketplace—install via the methods below.

### ⚡ One-Line Install (Easiest)

Copy/paste ONE command - auto-detects your system and configures everything:

**macOS/Linux:**
```bash
curl -fsSL https://raw.githubusercontent.com/jghiringhelli/codeseeker/master/scripts/install.sh | sh
```

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/jghiringhelli/codeseeker/master/scripts/install.ps1 | iex
```

Restart your IDE and you're done!

### 📦 Package Managers (Advanced)

**Linux (Snap) - All Distributions:**
```bash
sudo snap install codeseeker --classic
codeseeker install --vscode      # or --cursor, --windsurf
```

**macOS/Linux (Homebrew):**
```bash
brew install jghiringhelli/codeseeker/codeseeker
codeseeker install --vscode      # or --cursor, --windsurf
```

**Windows (Chocolatey):**
```powershell
choco install codeseeker
codeseeker install --vscode      # or --cursor, --windsurf
```

**Cross-platform (npm):**
```bash
npm install -g codeseeker
codeseeker install --vscode      # or --cursor, --windsurf
```

### 🚀 No Install Required (npx)

Run without installing:
```bash
npx codeseeker init
npx codeseeker -c "how does authentication work?"
```

### 🔌 Claude Code Plugin

If you use Claude Code CLI, you can install as a plugin:

```bash
/plugin install codeseeker@github:jghiringhelli/codeseeker#plugin
```

This gives you auto-sync hooks and slash commands (`/codeseeker:init`, `/codeseeker:reindex`).

### ☁️ Devcontainer / GitHub Codespaces

CodeSeeker auto-installs in devcontainers! Just add `.devcontainer/devcontainer.json`:

```json
{
  "name": "My Project",
  "image": "mcr.microsoft.com/devcontainers/javascript-node:18",
  "postCreateCommand": "npm install -g codeseeker && codeseeker install --vscode"
}
```

Or use our pre-configured devcontainer (already included in this repo).

### ✅ Verify Installation

Ask your AI assistant: *"What CodeSeeker tools do you have?"*

You should see: `search`, `search_and_read`, `show_dependencies`, `read_with_context`, `standards`, etc.

---

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

## Advanced Installation Options

<details>
<summary><b>📋 Manual MCP Configuration</b> (if auto-install doesn't work)</summary>

### VS Code (Claude Code & GitHub Copilot)

Add to `.vscode/mcp.json` in your project:

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

### Cursor

Add to `.cursor/mcp.json` in your project:

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

### Global vs Project-Level Configuration

```bash
# Apply to all projects (user-level)
codeseeker install --vscode --global

# Apply to current project only
codeseeker install --vscode
```

</details>

<details>
<summary><b>🖥️ CLI Standalone Usage</b> (without AI assistant)</summary>

```bash
npm install -g codeseeker
cd your-project
codeseeker init
codeseeker -c "how does authentication work in this project?"
```

</details>

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

### "I can't find CodeSeeker in the VS Code marketplace"

**CodeSeeker is NOT a VS Code extension.** It's an MCP server that works WITH AI assistants.

✅ **Correct:** Install via npm: `npm install -g codeseeker`
❌ **Wrong:** Looking for it in VS Code Extensions marketplace

### MCP server not connecting

1. Verify npm and npx work: `npx -y codeseeker --version`
2. Check MCP config file syntax (valid JSON, no trailing commas)
3. Restart your editor/Claude application completely
4. Check that Node.js is installed: `node --version` (need v18+)

### Indexing seems slow

First-time indexing of large projects (50K+ files) can take 5+ minutes. Subsequent uses are instant.

### Tools not appearing in Claude

1. Ask Claude: *"What CodeSeeker tools do you have?"*
2. If no tools appear, check MCP config file exists and has correct syntax
3. Restart your IDE completely (not just reload window)
4. Check Claude/Copilot MCP connection status in IDE

### Still stuck?

Open an issue: [GitHub Issues](https://github.com/jghiringhelli/codeseeker/issues)

## Documentation

- [Integration Guide](docs/INTEGRATION.md) - How all components connect
- [Architecture](docs/technical/architecture.md) - Technical deep dive
- [CLI Commands](docs/install/cli_commands_manual.md) - Full command reference

## Supported Platforms

| Platform | MCP Support | Install Command |
|----------|-------------|-----------------|
| **Claude Code** (VS Code) | Yes | `codeseeker install --vscode` or plugin |
| **GitHub Copilot** (VS Code) | Yes (VS Code 1.99+) | `codeseeker install --vscode` |
| **Cursor** | Yes | `codeseeker install --cursor` |
| **Claude Desktop** | Yes | Manual config |
| **Windsurf** | Yes | `codeseeker install --windsurf` |
| **Visual Studio** | Yes | `codeseeker install --vs` |

> **Note:** Claude Code and GitHub Copilot both run in VS Code and share the same MCP configuration (`.vscode/mcp.json`). The flags `--vscode`, `--claude-code`, and `--copilot` are interchangeable.

## Support

If CodeSeeker is useful to you, consider [sponsoring the project](https://github.com/sponsors/jghiringhelli).

## License

MIT License. See [LICENSE](LICENSE).

---

*CodeSeeker gives Claude the code understanding that grep and embeddings alone can't provide.*

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
sudo snap install codeseeker
codeseeker install --vscode      # or --cursor, --windsurf
```
> ⚠️ **Snap limitation:** Due to strict confinement, the snap can only access projects in your home directory (`~/`). For projects outside `~/`, use npm or Homebrew instead.

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

You should see: `search`, `analyze`, `index` — CodeSeeker's three unified tools.

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

| Tool | Actions / Usage | What It Does |
|------|-----------------|-------------|
| `search` | `{query}` | Hybrid search: vector + BM25 text + path-match, fused with RRF; RAPTOR directory summaries surface for abstract queries |
| `search` | `{query, search_type: "graph"}` | Hybrid search **+ Graph RAG** — follows import/call/extends edges to surface structurally connected files |
| `search` | `{query, search_type: "vector"}` | Pure embedding cosine-similarity search (no BM25 or path scoring) |
| `search` | `{query, search_type: "fts"}` | Pure BM25 text search with CamelCase tokenisation and synonym expansion |
| `search` | `{query, read: true}` | Search + read file contents in one step |
| `search` | `{filepath}` | Read a file with its related code automatically included |
| `analyze` | `{action: "dependencies", filepath}` | Traverse the knowledge graph (imports, calls, extends) |
| `analyze` | `{action: "standards"}` | Your project's detected patterns (validation, error handling) |
| `analyze` | `{action: "duplicates"}` | Find duplicate/similar code blocks across your codebase |
| `analyze` | `{action: "dead_code"}` | Detect unused exports, functions, and classes |
| `index` | `{action: "init", path}` | Manually trigger indexing (rarely needed) |
| `index` | `{action: "sync", changes}` | Update index for specific files |
| `index` | `{action: "exclude", paths}` | Dynamically exclude/include files from the index |
| `index` | `{action: "status"}` | List indexed projects with file/chunk counts |

**You don't invoke these manually**—Claude uses them automatically when searching code or analyzing relationships.

## How Indexing Works

**You don't need to manually index.** When Claude uses any CodeSeeker tool, the tool automatically checks if the project is indexed. If not, it indexes on first use.

```
User: "Find the authentication logic"
        │
        ▼
┌─────────────────────────────────────┐
│ Claude calls search({query: ...})  │
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
| **Serena** | LSP-based symbol navigation via MCP | Precise symbol definitions, 30+ languages | No semantic search, no cross-file reasoning, no workflow layer |
| **Codanna** | Semantic search + call graph via MCP (Rust) | Fast symbol lookup, 15 languages, great call graphs | Semantic search requires JSDoc/docstrings — undocumented JS/TS gets 0 embeddings; no BM25 fusion, no RAPTOR, no workflow layer, Windows experimental |
| **CodeSeeker** | Knowledge graph + hierarchical hybrid search + workflow orchestration | Semantic + BM25 fusion + RAPTOR + Graph RAG + coding standards | Requires initial indexing (30s-5min) |

### CodeSeeker's Unique Capabilities

**The 4-stage search pipeline:**

```
Query: "find JWT refresh token logic"
        │
        ▼  Stage 1 — Chunking & Indexing (done once at init)
   ┌─────────────────────────────────────────────────────┐
   │ AST chunker splits files into semantic units:       │
   │  • TypeScript/JS → Babel AST (functions, classes)  │
   │  • Python/Java   → Tree-sitter                     │
   │  • C#/Go/Rust    → Regex-based extraction          │
   │ Each chunk → Xenova embedding (384-dim) + BM25 doc  │
   │ Graph builder: FILE→FILE edges from import/require  │
   │ RAPTOR: per-dir summary = mean-pool all file embeds │
   └─────────────────────────────────────────────────────┘
        │
        ▼  Stage 2 — Hybrid retrieval (every query)
   ┌─────────────────────────────────────────────────────┐
   │ Vector search (cosine similarity on embeddings)     │
   │   +                                                 │
   │ BM25 text search (MiniSearch, CamelCase tokenized)  │
   │   ↓                                                 │
   │ RRF fusion: combined_score = Σ 1/(k + rank_i)      │
   │ Top-30 raw results (includes RAPTOR summary nodes)  │
   └─────────────────────────────────────────────────────┘
        │
        ▼  Stage 3 — RAPTOR cascade filter (conditional)
   ┌─────────────────────────────────────────────────────┐
   │ IF best RAPTOR directory-summary score ≥ 0.5:       │
   │   → narrow results to that directory's files only   │
   │   → fallback if < 3 results or top score < 0.25    │
   │ ELSE: pass all 30 results through unchanged         │
   │ Effect: abstract queries ("what does auth/ do?")    │
   │ get scoped to the right package automatically       │
   └─────────────────────────────────────────────────────┘
        │
        ▼  Stage 4 — Scoring, dedup, graph expansion
   ┌─────────────────────────────────────────────────────┐
   │ Dedup by file (keep highest-score chunk per file)   │
   │ Type scoring: source +0.10, test −0.15, docs −0.05 │
   │ Symbol boost: +0.20 if query token in file name     │
   │ Multi-chunk boost: up to +0.30 for files with       │
   │   multiple high-scoring (≥0.15) chunks              │
   │ Graph expansion: top-10 files → follow import edges │
   │   neighbors scored at source_score × 0.7 (1-hop)   │
   │ Sort, return top-15 files to Claude                 │
   └─────────────────────────────────────────────────────┘
        │
        ▼
   auth/jwt.ts (0.94), auth/refresh.ts (0.89), ...
```

**RAPTOR (hierarchical directory summaries):**
Per-directory embedding nodes generated by mean-pooling all file embeddings in a folder. They live in the same vector index as regular file chunks. On abstract queries ("what does the payments module do?") they score high and narrow results to the right directory. On concrete symbol queries they score low and are bypassed. Cost: one mean-pool per directory at index time; zero extra queries at search time.

**Knowledge graph (import/dependency edges):**
Built from AST-parsed imports during indexing. Each file node connects to the files it imports (`IMPORTS`, `DEPENDS_ON` edges). Average connectivity: 20.8 file→file edges per node (measured across TS and C# codebases). Used for: `analyze dependencies` traversal, `analyze dead_code` (disconnected nodes), and graph-expansion in hybrid search (neighbors of top-10 results appended at discounted score).

**BM25 + embedding RRF fusion:**
Both searches run simultaneously on the same SQLite database. BM25 (MiniSearch) handles exact symbol names, camelCase tokenisation, and typo-tolerant prefix matching. Embedding search (Xenova `all-MiniLM-L6-v2`, 384 dimensions) handles semantic similarity when names differ. Reciprocal Rank Fusion combines both without manual weight tuning: `score = Σ 1/(60 + rank_i)` across both ranked lists.

**What LSP tools can't do:**
- *"Find code that handles errors like this"* → Semantic search finds similar patterns
- *"What validation approach does this project use?"* → Auto-detected coding standards
- *"Show me everything related to authentication"* → Graph traversal across indirect dependencies

**What vector-only search misses:**
- Direct import/export relationships
- Class inheritance chains
- Which files actually depend on which

**Search quality guarantee:**
Every release is gated by a precision/recall benchmark suite that runs 104 tests across hand-curated TypeScript, Python, and Go fixtures (JWT middleware, generic repositories, async ORMs, Pydantic schemas, goroutine workers, and more). FTS, hybrid, and graph modes must all achieve R@5 = 1.0 and MRR = 1.0 for language-specific queries; a regression of more than 0.15 on any (query × mode) cell blocks the release automatically.

---

## Search Quality Research

<details>
<summary><b>📊 Component ablation study (v2.0.0)</b> — measured impact of each retrieval layer</summary>

### Setup

18 hand-labelled queries across two real-world codebases:

| Corpus | Language | Files | Queries | Query types |
|--------|----------|-------|---------|-------------|
| [Conclave](https://github.com/jghiringhelli/conclave) | TypeScript (pnpm monorepo) | 201 | 10 | Symbol lookup, cross-file chains, out-of-scope |
| [ImperialCommander2](https://github.com/jonwill8/ImperialCommander2) | C# / Unity | 199 | 8 | Class lookup, controller wiring, file I/O |

Each query has one or more `mustFind` targets (exact file basenames) and optional `mustNotFind` targets (scope leak check). Queries were run on a real index built from source — real Xenova embeddings, real graph, real RAPTOR L2 nodes — to reflect production conditions.

Metrics: **MRR** (Mean Reciprocal Rank), **P@1** (Precision at 1), **R@5** (Recall at 5), **F1@3**.

### Ablation results

| Configuration | MRR | P@1 | P@3 | R@5 | F1@3 | Notes |
|--------------|-----|-----|-----|-----|------|-------|
| **Hybrid baseline** (BM25 + embed + RAPTOR, no graph) | **75.2%** | 61.1% | 29.6% | 91.7% | 44.4% | Production default |
| + graph 1-hop | 74.9% | 61.1% | 29.6% | 91.7% | 44.4% | ±0% ranking, adds structural neighbors |
| + graph 2-hop | 74.9% | 61.1% | 29.6% | 91.7% | 44.4% | Scope leaks on unrelated queries |
| No RAPTOR (graph 1-hop) | 74.9% | 61.1% | 29.6% | 91.7% | 44.4% | RAPTOR contributes +0.3% |

### What each layer actually does

**BM25 + embedding fusion (RRF)**  
The workhorse. Handles ~94% of ranking quality on its own. BM25 catches exact symbol names and camelCase tokens; vector embeddings catch semantic similarity when names differ. Fused with Reciprocal Rank Fusion to combine both signals without manual weight tuning.

**RAPTOR (hierarchical directory summaries)**  
Generates per-directory embedding nodes by mean-pooling all file embeddings in a folder. Acts as a post-filter: when a directory summary scores ≥ 0.5 against the query, results are narrowed to that directory's files. Measured contribution: **+0.3% MRR** on symbol queries. Fires conservatively — only when the directory is an obvious match. Its real value is on _abstract queries_ ("what does the payments module do?") which don't appear in this benchmark; for those queries it prevents broad scattering across the entire codebase.

**Knowledge graph (import/dependency edges)**  
Average connectivity: 20.8 file→file edges per node across both TS and C# codebases. Measured ranking impact: **±0% MRR** for 1-hop expansion. The graph doesn't move MRR because the semantic layer already finds the right files — the graph's neighbors are usually already in the top-15. Its value is structural: the `analyze dependencies` action and explicit `graph` search type give Claude traversable import chains, inheritance hierarchies, and dependency paths that embeddings alone cannot provide.

**Type boost / penalty scoring**  
Source files get +0.10 score boost; test files get −0.15 penalty; lock files and docs get −0.05 penalty. Without this, `integration.test.ts` would rank above `dag-engine.ts` for exact symbol queries because test files import and exercise every symbol in the source. The penalty corrects this without eliminating test files from results.

**Monorepo directory exclusion fix**  
The single highest-impact change in v1.12.0: removing `packages/` from the default exclusion list. For pnpm/yarn/lerna monorepos where all source lives under `packages/`, this exclusion was silently dropping all source files. Effect: **10% → 72% MRR** on the Conclave monorepo benchmark.

### Known limitations

| Query | Target | Issue | Root cause |
|-------|--------|-------|-----------|
| `cv-prompts` | `orchestrator.ts` | rank 97+ even with 2-hop graph | `prompt-builder.test.ts` outscores `prompt-builder.ts` semantically; source file never enters top-10, so we can't graph-walk from it to `orchestrator.ts`. Test-file dominance on cross-file queries. |
| `cv-exec-mode` | `types.ts` | rank 11–12 | `types.ts` is a pure type-export file; low keyword density. Found within R@5 (rank ≤ 15). |

### Benchmark script

Reproduce with:
```bash
npm run build
node scripts/real-bench.js
```

Requires `C:\workspace\claude\conclave` and `C:\workspace\ImperialCommander2` to be present locally (or update paths in `scripts/real-bench.js`).

</details>

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

```
// Exclude Unity Library folder and generated files
index({
  action: "exclude",
  project: "my-unity-game",
  paths: ["Library/**", "Temp/**", "*.generated.cs"],
  reason: "Unity build artifacts"
})
```

Exclusions are persisted in `.codeseeker/exclusions.json` and automatically respected during reindexing.

## Code Cleanup Tools

CodeSeeker helps you maintain a clean codebase by finding duplicate code and detecting dead code.

### Finding Duplicate Code

Ask Claude to find similar code blocks that could be consolidated:

```
"Find duplicate code in my project"
"Are there any similar functions that could be merged?"
"Show me copy-pasted code that should be refactored"
```

CodeSeeker uses vector similarity to find semantically similar code—not just exact matches. It detects:
- Copy-pasted functions with minor variations
- Similar validation logic across files
- Repeated patterns that could be extracted into utilities

### Finding Dead Code

Ask Claude to identify unused code that can be safely removed:

```
"Find dead code in this project"
"What functions are never called?"
"Show me unused exports"
```

CodeSeeker analyzes the knowledge graph to find:
- Exported functions/classes that are never imported
- Internal functions with no callers
- Orphaned files with no incoming dependencies

**Example workflow:**
```
User: "Use CodeSeeker to clean up this project"

Claude: I'll analyze your codebase for cleanup opportunities.

Found 3 duplicate code blocks:
- validateEmail() in auth.ts and user.ts (92% similar)
- formatDate() appears in 4 files with minor variations
- Error handling pattern repeated in api/*.ts

Found 2 dead code files:
- src/utils/legacy-helper.ts (0 imports)
- src/services/unused-service.ts (exported but never imported)

Would you like me to:
1. Consolidate the duplicate validators into a shared utility?
2. Remove the dead code files?
```

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

- **Claude-initiated changes**: Claude can call `index({action: "sync"})` tool
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

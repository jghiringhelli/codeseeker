# CodeSeeker

**Four-layer hybrid search and knowledge graph for AI coding assistants.**  
BM25 + vector embeddings + RAPTOR directory summaries + graph expansion — fused into a single MCP tool that gives Claude, Copilot, and Cursor a real understanding of your codebase.

[![npm version](https://img.shields.io/npm/v/codeseeker.svg)](https://www.npmjs.com/package/codeseeker)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue.svg)](https://www.typescriptlang.org/)

Works with **Claude Code**, **GitHub Copilot** (VS Code 1.99+), **Cursor**, **Windsurf**, and **Claude Desktop**.  
One command to index; the Claude Code plugin keeps it in sync from there.

Built by [PragmaWorks](https://pragmaworks.dev) as part of **Generative Specification** — the
discipline for building software with AI that doesn't drift. Two sibling MCP servers compose
with this one, each solving a different half of the same problem:

| | what it gives your assistant |
|---|---|
| **CodeSeeker** (this) | *where things are* — semantic search and a knowledge graph over your code |
| **[Chronicle](https://github.com/jghiringhelli/chronicle-mcp)** &nbsp;`npm i -g chronicle-mcp` | *what happened before* — tiered memory that survives context resets |
| **[Forgecraft](https://github.com/jghiringhelli/forgecraft-mcp)** &nbsp;`npm i -g forgecraft-mcp` | *how it should be built* — SOLID, testing, architecture and CI/CD standards |

They are independent: install one, or all three.

### When you stop needing this

CodeSeeker solves a retrieval problem, and that problem is shrinking.

If you run a spec-driven loop with a real harness — a specification precise enough that a
stateless model derives from it, and quality gates that verify the result against a live
system — or an intent-driven one, your assistant is being handed the structure it would
otherwise have to go find. A sentinel tool that routes actions instead of sprawling across a
dozen endpoints removes another slice of the searching. Frontier models with better
navigation and larger effective context remove more. Past a certain point, semantic search
over your own code stops being the bottleneck, and this server becomes something you could
uninstall without noticing.

That is the intended outcome, not a defect: a method that works should make its own
scaffolding unnecessary. Most teams do not start there, though, and until the process is in
place CodeSeeker is the cheaper substitute — one command instead of a discipline.

If you would rather have the process than the substitute, start with the field guide:
**[Generative Specification — Field Guide (PDF)](https://github.com/jghiringhelli/generative-specification/blob/main/docs/white-paper/GenerativeSpecification_FieldGuide.pdf)**.

## The Problem

AI assistants are powerful editors, but they navigate code like a tourist:
- **Grep finds text** — not meaning. `"find authentication logic"` returns every file containing the word "auth"
- **File reads are isolated** — Claude sees a file but not its dependencies, callers, or the patterns your team established
- **No memory of your project** — every session starts from scratch

CodeSeeker fixes this. It indexes your codebase once and gives AI assistants a queryable knowledge graph they can use on every turn.

## How It Works

A 4-stage pipeline runs on every query:

```
Query: "find JWT refresh token logic"
        │
        ▼  Stage 1 — Hybrid retrieval
   ┌─────────────────────────────────────────────────────┐
   │ BM25 (exact symbols, camelCase tokenized)           │
   │   +                                                 │
   │ Vector search (384-dim Xenova embeddings)           │
   │   ↓                                                 │
   │ Reciprocal Rank Fusion: score = Σ 1/(60 + rank_i)  │
   │ Top-30 results, including RAPTOR directory nodes    │
   └─────────────────────────────────────────────────────┘
        │
        ▼  Stage 2 — RAPTOR cascade (conditional)
   ┌─────────────────────────────────────────────────────┐
   │ IF best directory-summary score ≥ 0.5:              │
   │   → narrow results to that directory automatically  │
   │ ELSE: all 30 results pass through unchanged         │
   │ Effect: "what does auth/ do?" scopes to auth/       │
   │         "jwt.ts decode function" bypasses this      │
   └─────────────────────────────────────────────────────┘
        │
        ▼  Stage 3 — Scoring and deduplication
   ┌─────────────────────────────────────────────────────┐
   │ Dedup: keep highest-score chunk per file            │
   │ Source files:  +0.10  (definition sites matter)     │
   │ Test files:    −0.15  (prevent test dominance)      │
   │ Symbol boost:  +0.20  (query token in filename)     │
   │ Multi-chunk:   up to +0.30  (file has many hits)    │
   └─────────────────────────────────────────────────────┘
        │
        ▼  Stage 4 — Graph expansion
   ┌─────────────────────────────────────────────────────┐
   │ Top-10 results → follow IMPORTS/CALLS/EXTENDS edges │
   │ Structural neighbors scored at source × 0.7        │
   │ Avg graph connectivity: 20.8 edges/node             │
   └─────────────────────────────────────────────────────┘
        │
        ▼
   auth/jwt.ts (0.94), auth/refresh.ts (0.89), ...
```

The knowledge graph is built from AST-parsed imports at index time. It's what powers the `graph` action, dead-code detection, and graph expansion in every search.

## What Makes It Different

| Approach | Strengths | Limitations |
|----------|-----------|-------------|
| **Grep / ripgrep** | Fast, universal | No semantic understanding |
| **Vector search only** | Finds similar code | Misses structural relationships |
| **Serena** | Precise LSP symbol navigation, 30+ languages | No semantic search, no cross-file reasoning |
| **Codanna** | Fast symbol lookup, good call graphs | Semantic search needs JSDoc — undocumented code gets no embeddings; no BM25, no RAPTOR, Windows experimental |
| **CodeSeeker** | BM25 + embedding fusion + RAPTOR + graph + coding standards + multi-language AST | Requires initial indexing (30s–5min) |

**What LSP tools can't do:**
- *"Find code that handles errors like this"* → semantic pattern search
- *"What validation approach does this project use?"* → auto-detected coding standards
- *"Show me everything related to authentication"* → graph traversal across indirect dependencies

**What vector-only search misses:**
- Direct import/export chains
- Class inheritance hierarchies
- Which files actually depend on which

## Installation

### Recommended: install once, configure once

```bash
npm install -g codeseeker
claude mcp add codeseeker --scope user -e CODESEEKER_STORAGE_MODE=embedded -- codeseeker serve --mcp
```

`--scope user` makes it available in every project you open, not just the current one.

**Why global rather than `npx -y`:** on a machine that has never seen the package, npx
downloads it and builds native dependencies before the server can answer, which measured
**13.7 seconds** to a completed MCP handshake. Clients that give up sooner report that as
a connection failure. A global install answers in **759 ms** — the download happens once,
at a moment when you are expecting it to.

### npx (no install)

Portable, and fine once the package is cached. Expect a slow first start.

```json
{
  "mcpServers": {
    "codeseeker": {
      "command": "npx",
      "args": ["-y", "codeseeker", "serve", "--mcp"],
      "env": { "CODESEEKER_STORAGE_MODE": "embedded" }
    }
  }
}
```

Add this to your MCP config file ([see below](#advanced-installation-options) for per-client locations) and restart your editor.

### Other editors

```bash
npm install -g codeseeker
codeseeker install --vscode      # or --cursor, --windsurf, --vs
```

### 🔌 Claude Code Plugin

For Claude Code CLI users — adds auto-sync hooks and slash commands:

```bash
/plugin install codeseeker@github:jghiringhelli/codeseeker#plugin
```

Slash commands: `/codeseeker:init`, `/codeseeker:reindex`

### ☁️ Devcontainers / GitHub Codespaces

```json
{
  "name": "My Project",
  "image": "mcr.microsoft.com/devcontainers/javascript-node:18",
  "postCreateCommand": "npm install -g codeseeker && codeseeker install --vscode"
}
```

### ✅ Verify

Ask your AI assistant: *"What CodeSeeker tools do you have?"*

You should see a single tool named `codeseeker`. That is intentional: one tool with an
`action` routing key keeps per-request token overhead low (ADR-002). The actions are
`search`, `sym`, `graph`, `analyze` and `index`.

## Advanced Installation Options

<details>
<summary><b>📋 MCP Configuration by client</b></summary>

The MCP config JSON is the same for all clients — only the file location differs:

| Client | Config file |
|--------|------------|
| **VS Code** (Claude Code / Copilot) | `.vscode/mcp.json` in your project, or `~/.vscode/mcp.json` globally |
| **Cursor** | `.cursor/mcp.json` in your project |
| **Claude Desktop** | `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows) |
| **Windsurf** | `.windsurf/mcp.json` in your project |

```json
{
  "mcpServers": {
    "codeseeker": {
      "command": "npx",
      "args": ["-y", "codeseeker", "serve", "--mcp"]
    }
  }
}
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

CodeSeeker exposes **one** MCP tool, `codeseeker`. You pick behaviour with `action` and
fill only the matching nested parameter group:

```js
codeseeker({ action, project, search?|sym?|graph?|analyze?|index? })
```

Always pass `project` (the absolute project root) — an MCP server cannot detect your
working directory.

| action | Parameters | What It Does |
|---|---|---|
| `search` | `search:{q}` | Hybrid search: BM25 + vector embeddings fused with RRF, then graph expansion; RAPTOR directory summaries surface for abstract queries |
| `search` | `search:{q, type:"vector"}` | Pure embedding cosine-similarity search |
| `search` | `search:{q, type:"fts"}` | Pure BM25 text search with CamelCase tokenisation |
| `search` | `search:{q, full:true}` | Include a code snippet with each result (default: summaries only) |
| `search` | `search:{q, exists:true}` | Quick yes/no — returns `{found, count, top_file}` |
| `sym` | `sym:{name}` | Look up a class/function by name and show its graph neighbours |
| `graph` | `graph:{seed, depth, rel, dir}` | Traverse the knowledge graph from a file (imports, calls, extends) |
| `graph` | `graph:{q}` | Same, but find the seed files semantically first |
| `analyze` | `analyze:{kind:"standards"}` | Your project's detected patterns (validation, error handling) |
| `analyze` | `analyze:{kind:"duplicates"}` | Find duplicate/similar code blocks |
| `analyze` | `analyze:{kind:"dead_code"}` | Detect unused exports, orphaned files, coupling issues |
| `index` | `index:{op:"init", path}` | Build the index for a project (required once — see below) |
| `index` | `index:{op:"sync", changes}` | Update the index for specific files |
| `index` | `index:{op:"exclude", paths}` | Exclude/include paths from the index |
| `index` | `index:{op:"status"}` | List indexed projects with file/chunk counts |
| `index` | `index:{op:"parsers"}` | List/install Tree-sitter parsers |

**You don't invoke these manually**—Claude uses them automatically when searching code or analyzing relationships.

## How Indexing Works

**You do not have to index anything first.** Searching a project CodeSeeker has never seen
starts the index automatically and says so. Indexing runs in the background, so the call
returns at once rather than blocking your assistant:

```
User: "Find the authentication logic"
        │
        ▼
┌────────────────────────────────────────────────────────┐
│ Claude calls codeseeker({action:"search"})             │
│         │                                              │
│         ▼                                              │
│ Project indexed? ──No──► starts indexing, returns      │
│         │                {status:"indexing_started"}   │
│        Yes                                             │
│         ▼                                              │
│ Return ranked results + confidence                     │
└────────────────────────────────────────────────────────┘
```

So the first question you ask a new project answers with "indexing started, retry shortly"
rather than with results. **A small project is ready in a couple of seconds; a large one
takes several minutes.** Check with `index({op:"status"})` rather than guessing.

You can still index deliberately, and it is worth doing for a big repository so the wait
happens when you expect it:

```js
codeseeker({ action: "index", index: { op: "init", path: "/abs/path", name: "my-project" } })
```
```bash
codeseeker init          # or, from the CLI
```

`name` is the only thing an explicit init gives you that the automatic one cannot know —
otherwise the project is registered under its directory name.

### Keeping the index current

The index is a snapshot. Nothing watches your filesystem, so after files change there are
three ways it gets back in step:

| | how |
|---|---|
| **Claude Code plugin** | hooks re-sync after every `Edit`/`Write`, and fully after `git pull`/`checkout`/`merge`. This is the only hands-off option. |
| **Manual** | `index({op:"sync", changes:[…]})` for named files, or `index({op:"sync", full_reindex:true})` after large external changes. |
| **It tells you** | a search that returns a file which no longer exists reports `stale_index`, naming the missing files and the sync call. That is proof rather than a guess — a timestamp cannot tell you whether anything actually moved. |

Without the plugin, an index that drifts will keep returning results; they will simply be
from the code as it was. The `stale_index` signal is what surfaces that.

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

```js
// Exclude Unity Library folder and generated files
codeseeker({
  action: "index",
  project: "/abs/path/to/my-unity-game",
  index: {
    op: "exclude",
    exclude_op: "exclude",
    paths: ["Library/**", "Temp/**", "*.generated.cs"],
    reason: "Unity build artifacts"
  }
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

Every language is **indexed and searchable** — chunking and embeddings do not depend on a
parser. What the parser changes is the *knowledge graph*: how accurately CodeSeeker knows
which symbol is a declaration and what depends on what.

| Language | Parser used | Relationship extraction |
|----------|-------------|------------------------|
| TypeScript, JavaScript (`.ts .tsx .js .jsx .mts .cts .mjs .cjs`) | Babel AST | Excellent |
| Python | Tree-sitter AST | Excellent |
| C# | Tree-sitter AST | Excellent |
| Java | Tree-sitter AST | Good — same parser as Python, but unmeasured (no Java corpus) |
| Go | Regex | Good — packages and funcs, no call graph |
| Rust, C/C++, Ruby, PHP, everything else | Regex | Basic |

**Regex extraction is a real limitation, not a smaller version of the same thing.** It
finds declarations by shape, so it misses anything written unusually and cannot tell a
declaration from a call. Import edges stay reliable for TypeScript and JavaScript, where
Babel parses them; call edges are heuristic everywhere.

The ratings above are measured, not asserted. `scripts/corpus-bench.js` indexes seven
real projects and `scripts/graph-quality.js` reports how much of each resulting graph is
plausibly a real declaration. Java carries no rating of its own because no Java project is
in that corpus; it shares Python's Tree-sitter code path, and that is all we can claim.

Measured on the four RealWorld Conduit implementations — the same application written four
times, so a gap between them is language handling and not task difficulty — mean reciprocal
rank over 30 labelled queries is TypeScript 83.3%, Python 81.5%, JavaScript 77.1%,
C# 70.5%.

### Adding a parser for your language

If your project is mostly Go, Rust, C++ or Ruby, you can install the Tree-sitter
grammar for it:

```bash
npm install -g tree-sitter-go        # or tree-sitter-rust, tree-sitter-cpp, …
```

Then ask your assistant, or run:

```js
codeseeker({ action: "index", project: "/abs/path", index: { op: "parsers", list_available: true } })
```

The response marks each parser with `wired: true` or `wired: false`. **Only a parser
marked `wired: true` is consumed by the graph builder** — installing one marked `false`
changes nothing today, and the response says so rather than letting you find out by not
noticing an improvement.

Currently wired: TypeScript, JavaScript, Python, Java, C#. The others are honest `false`.
Wiring one is a small, self-contained change — a parser implementing
`ILanguageParser` registered in `extensionToParser`
([`src/mcp/indexing-service.ts`](src/mcp/indexing-service.ts)) — and contributions are
welcome. `scripts/graph-quality.js` measures whether a new parser actually improved the
graph, so the improvement is demonstrable rather than assumed.

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

- **Claude-initiated changes**: Claude can call `codeseeker({action:"index", index:{op:"sync"}})`
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

For the complete technical internals — exact scoring formulas, MCP tool schema, graph edge types, RAPTOR threshold logic, pipeline stages, analysis confidence tiers — see the **[Technical Architecture Manual](docs/technical/architecture.md)**.

## Troubleshooting

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

| Client | MCP Support | Config |
|--------|-------------|--------|
| **Claude Code** (VS Code) | ✅ | `.vscode/mcp.json` or plugin |
| **GitHub Copilot** (VS Code 1.99+) | ✅ | `.vscode/mcp.json` |
| **Cursor** | ✅ | `.cursor/mcp.json` |
| **Windsurf** | ✅ | `.windsurf/mcp.json` |
| **Claude Desktop** | ✅ | `claude_desktop_config.json` |
| **Visual Studio** | ✅ | `codeseeker install --vs` |

> Claude Code and GitHub Copilot share the same `.vscode/mcp.json` — configure once, works for both.

## Support

If CodeSeeker is useful to you, consider [sponsoring the project](https://github.com/sponsors/jghiringhelli).

## License

**Apache License 2.0.** See [LICENSE](LICENSE) and [NOTICE](NOTICE).

Free for any use, commercial included — no company-size or revenue limits. Apache-2.0
adds an explicit patent grant over MIT, which is why it is the choice here.

### Running CodeSeeker across a team

Everything above is the local, single-developer setup: the index lives in `.codeseeker/`
on your machine and never leaves it.

There is a centralized deployment for teams — one shared index over your organisation's
repositories (PostgreSQL + pgvector, Neo4j), so engineers aren't each paying to reindex
the same code, and so the graph spans service boundaries instead of stopping at one repo.
It also surfaces what the local tool structurally cannot: how code understanding is
actually distributed across a codebase and where the knowledge gaps sit.

If that's useful to your team, get in touch: **https://pragmaworks.dev**

---

*CodeSeeker gives Claude the code understanding that grep and embeddings alone can't provide.*


---

## Part of Generative Specification

An Apache-2.0 tool behind **Generative Specification (GS)** — the discipline for building software with AI that doesn't drift: you author a specification precise enough that a stateless AI derives correct code from it, and a harness verifies it against a live system.

- 📄 **White paper** (open access): https://doi.org/10.5281/zenodo.21726017
- 📕 **Field guide** — the short, practical on-ramp: https://github.com/jghiringhelli/generative-specification/blob/main/docs/white-paper/GenerativeSpecification_FieldGuide.pdf
- 🧭 **Start here** — method, tools, testimonials: https://pragmaworks.dev
- 🔨 **The Forge** — 2-day hands-on GS workshop for your team: https://forgeworkshop.dev

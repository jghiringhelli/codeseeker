# CodeSeeker Core

## What It Is
Smart Claude Code CLI: semantic search, graph analysis, token-optimized code intelligence.
Enhances Claude Code with pre-indexed context — does NOT replace Claude's native tools.

## Hard Constraint: CLI-Only, No API Calls
All AI interactions route through `ClaudeCodeIntegration` (`src/integrations/claude/claude-cli-integration.ts`).
No `fetch()` to Claude API. No HTTP requests. Direct `child_process.exec()` of the `claude` CLI only.
Fallback: when CLI fails → transparent passthrough mode.

## Layer Map
```
src/mcp/          ← MCP server (sentinel tool, indexing, analysis handlers)
src/cli/commands/ ← Search orchestration, workflow, task decomposition
src/cli/services/ ← data/ analysis/ search/ monitoring/ integration/
src/storage/      ← embedded (SQLite+MiniSearch) | server (Postgres+pgvector)
```

## Invariants
- Single MCP tool: `codeseeker` with `action` routing key. Never add a second top-level tool.
- Results default to summaries (`full:false`). Content only on explicit `full:true`.
- All result paths are relative to project root — pass directly to Read/View.
- Index must be updated after every file edit: `codeseeker({action:"index",index:{op:"sync",...}})`.

## SOLID — Non-Negotiable
Every class has one reason to change. Depend on abstractions. Use constructor injection.
See `.claude/dev.md` for naming and file conventions.

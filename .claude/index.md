# CodeSeeker Context Index

## Always Load
@.claude/core.md

## Navigation Protocol — follow before any task

1. Read this file. Identify the task domain from the table below.
2. Read `.claude/core.md`. Always. It is always relevant.
3. Read the matching domain node. One node only.
4. If the task spans two domains, name both before loading either.
5. If no node matches, read core.md only and flag the gap.

## Navigate by Task

| Task Domain | Node | When to Use |
|---|---|---|
| Using / calling MCP tools | @.claude/mcp-tool.md | Searching, sym lookup, graph, analyze, index calls |
| Search quality / ranking | @.claude/search.md | Hybrid search, RAPTOR, embeddings, scoring |
| Index management | @.claude/index-mgmt.md | init, sync, exclude, staleness |
| Code analysis tools | @.claude/analyze.md | dead_code, duplicates, standards |
| Writing new code | @.claude/dev.md | Conventions, SOLID, naming, build |
| Releases / versioning | @.claude/versioning.md | Version bump, npm publish, GitHub release |
| Architecture decisions | @.claude/adr/index.md | Before any structural change |

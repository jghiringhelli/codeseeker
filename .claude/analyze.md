# Code Analysis Tools

## Dead Code (`analyze:{kind:"dead_code"}`)
Reports: `unreferenced_symbols` (class/function with no inbound static edges) + `orphaned_files` (no inbound imports).
Tiered confidence: private/internal with no callers = 85%, public unexported = 60%.
**Always read `graph_limitations[]` in the response before acting.** Call edges are regex-based — dynamic dispatch, callbacks, and event handlers are invisible to the graph.
Exported symbols are skipped (may be used by external packages).
Entry-point names (main, index, app, server, cli, …) are never flagged.

## Duplicates (`analyze:{kind:"duplicates", threshold?:0.80}`)
Probabilistic: 0.98+ = exact, 0.80-0.97 = semantic, structural threshold = 0.85.
Advisory only — similarity does not mean identical intent. Review before deleting.
Key file: `src/cli/services/analysis/deduplication/duplicate-code-detector.ts`

## Standards (`analyze:{kind:"standards", category?:"validation"|"error-handling"|"logging"|"testing"|"all"}`)
Auto-detected from indexed code. Stored at `.codeseeker/coding-standards.json`.
Use before writing new code to match existing project patterns.
Regenerated automatically on full reindex.

## Graph Construction Quality
TS/JS: Babel AST (accurate). Python/Java: regex + optional tree-sitter. Others: 70-lang regex.
Import edges are reliable. Call edges are approximations.

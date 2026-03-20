# Search Architecture

## Pipeline
```
Query → hybrid searchHybrid() → RAPTOR cascade filter → processRawResults() → SemanticResult[]
```

## Hybrid Scoring (RRF fusion)
Vector similarity 50% + BM25 text (MiniSearch/tsvector) 35% + path match 15%.
Key file: `src/cli/commands/services/semantic-search-orchestrator.ts`

## RAPTOR Cascade (post-filter only)
L2 directory-summary nodes indexed at `__raptor__/` prefix.
If top L2 score ≥ 0.50 → filter results to that directory → return filtered.
Falls back to full results if: no L2 nodes, score too low, or < 3 results in dir.
Cascade confidence uses **raw** (pre-boost) score. Symbol-name boost does not affect cascade gate.

## Symbol-Name Boost
`processRawResults()` applies additive +0.20 when a query token (>2 chars) matches
`metadata.symbolName`, `functions[]`, `classes[]`, or filename.
Helps exact-symbol queries outrank semantically similar but wrong files.

## Tuning Reference (baseline, 39 queries)
MRR 85% | P@1 71.8% | R@5 100% | F1@3 54%
Run `npx jest tests/relevance/metrics.test.ts` to regenerate; report in `$TEMP/codeseeker-metrics-report.txt`.

## Storage Modes
Embedded (default): SQLite + MiniSearch. Server: Postgres + pgvector.
`CODESEEKER_STORAGE_MODE=embedded|server` — embedded requires no Docker.

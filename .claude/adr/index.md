# Architecture Decision Records

| # | Decision | Status |
|---|---|---|
| 001 | CLI-only integration (no Claude API calls) | Active |
| 002 | Single sentinel MCP tool with action routing | Active |
| 003 | Summaries by default, full content on explicit request | Active |
| 004 | Additive +0.20 symbol-name boost (not multiplicative) | Active |
| 005 | RAPTOR as post-filter cascade (not a 3rd RRF weight) | Active |
| 006 | CNT wayfinder pattern for CLAUDE.md | Active |
| 007 | Dead-code analysis: export + entry-point exemption | Active |
| 008 | Graph edges: import (reliable) + call (approximate) | Active |
| 009 | Source-file type boost (+0.10) + test-file penalty (-0.15) | Active |
| 010 | Remove 'packages' from default excluded directories (monorepo support) | Active |
| 011 | Graph expansion: depth=1 default, per-source scoring, top-10 expansion | Active |

**ADR-004 (additive boost):** Multiplicative ×1.2 fails rank-reversal when gap > 0.2 (e.g. 0.65×1.2=0.78 < competitor 0.80). Additive +0.20 guarantees: boosted score = raw + 0.20 > any competitor with raw ≤ base+0.19. Cascade gate uses pre-boost raw score to prevent weak boosted files from triggering directory cascade.

**ADR-005 (RAPTOR post-filter):** RAPTOR L2 nodes = directory summaries. Used as a confidence gate after initial hybrid search, not as a parallel search track. Reason: adding RAPTOR as a 3rd RRF weight would downweight its signal — using it as a filter preserves recall while sharpening precision.

**ADR-006 (CNT):** CLAUDE.md monolith was 10,600 tokens loaded every session. CNT loads ~100 lines on average (3-line CLAUDE.md + index.md + core.md + 1 domain node). O(log N) context load.

**ADR-009 (type boost/penalty):** Source files (+0.10) and test files (-0.15) need differential scoring because test/doc files contain all the same symbols as implementation files (imported and exercised) but are not the authoritative location. Without penalty, `integration.test.ts` would rank above `dag-engine.ts` for exact symbol queries.

**ADR-010 (packages dir):** `packages/` is the conventional source root for pnpm/yarn/lerna monorepos. Excluding it by default (as a "vendor" equivalent) silently indexed 0 source files in monorepo projects. Removed from both `file-scanner-config.json` and `IGNORE_DIRS` hardcode in indexing-service.ts.

**ADR-011 (graph expansion scoring):** Ablation across 18 queries (Conclave TS + IC2 C#) showed graph expansion is neutral to slightly positive (+/−0.3% MRR). Key findings: (1) graph IS well-connected (avg 20.8 file→file edges/node) so expansion works structurally; (2) flat "worst-score × 0.7" gave rank-100 placements — fixed to per-source scoring (each neighbor inherits its pointing file's score × 0.7, take max if pointed by multiple); (3) expand from top-10 not top-5 to capture neighbors of rank-7/8 files; (4) 2-hop disabled by default (introduces scope leaks on out-of-scope queries); (5) cv-prompts orchestrator miss is a test-file-dominance problem (prompt-builder.test.ts outscores prompt-builder.ts), not a graph problem — needs a stronger test penalty or a definition-vs-usage AST signal. Graph expansion value is primarily navigation (dependencies, imports) not semantic re-ranking.

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

## Key Rationale Summaries

**ADR-004 (additive boost):** Multiplicative ×1.2 fails rank-reversal when gap > 0.2 (e.g. 0.65×1.2=0.78 < competitor 0.80). Additive +0.20 guarantees: boosted score = raw + 0.20 > any competitor with raw ≤ base+0.19. Cascade gate uses pre-boost raw score to prevent weak boosted files from triggering directory cascade.

**ADR-005 (RAPTOR post-filter):** RAPTOR L2 nodes = directory summaries. Used as a confidence gate after initial hybrid search, not as a parallel search track. Reason: adding RAPTOR as a 3rd RRF weight would downweight its signal — using it as a filter preserves recall while sharpening precision.

**ADR-006 (CNT):** CLAUDE.md monolith was 10,600 tokens loaded every session. CNT loads ~100 lines on average (3-line CLAUDE.md + index.md + core.md + 1 domain node). O(log N) context load.

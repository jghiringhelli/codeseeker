# ADR 0005: RAPTOR as a post-filter cascade, not a third RRF weight

- **Status:** Accepted
- **Date:** 2026-09-07

## Context

RAPTOR L2 nodes are per-directory summary embeddings, produced by mean-pooling the file
embeddings in each directory. They answer abstract queries ("what does the payments
module do?") that no individual file answers well.

The obvious integration is a third retrieval track fused into the RRF alongside BM25 and
vector search.

## Decision

Use RAPTOR as a confidence gate applied after hybrid retrieval, not as a parallel track.
When the best directory-summary scores at or above 0.5 against the query, narrow results
to that directory. Otherwise pass all results through unchanged.

## Consequences

Adding RAPTOR as a third RRF weight would have diluted its signal across the fusion;
as a filter it preserves recall while sharpening precision.

Measured contribution on the symbol-query benchmark is +0.3% MRR — small, because the
benchmark contains few abstract queries. Its value is on the query class the benchmark
does not represent, which is an honest limitation of the measurement rather than
evidence the layer is worthless.

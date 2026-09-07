# ADR 0011: Graph expansion: depth 1, per-source scoring, from the top 10

- **Status:** Accepted
- **Date:** 2026-09-07

## Context

Graph expansion adds structurally connected files to search results. Three parameters
needed settling: traversal depth, how expanded neighbours are scored, and how many
results to expand from.

An ablation across 18 hand-labelled queries on two real codebases (Conclave, TypeScript
monorepo; ImperialCommander2, C#/Unity) measured each.

## Decision

Depth 1 by default. Neighbours inherit `max(source_score) x 0.7`, taking the maximum
when several results point at the same neighbour. Expand from the top 10.

## Consequences

Measured ranking impact is neutral, within +/-0.3% MRR. The graph does not move MRR
because the semantic layer already finds the right files; its neighbours are usually
already in the top 15.

That is not an argument for removing it. Its value is structural rather than
re-ranking: the `graph` action and dependency analysis give traversable import chains
and inheritance hierarchies that embeddings alone cannot provide. Average connectivity
is 20.8 file-to-file edges per node across both codebases, so the graph is well formed.

Rejected alternatives, and why:
- Flat "worst-result x 0.7" scoring produced rank-100 placements for neighbours of
  high-scoring files. Replaced with per-source scoring.
- Expanding from the top 5 missed neighbours of results at ranks 6 through 10.
- Depth 2 is available but off by default: it introduces scope leaks on out-of-scope
  queries, where unrelated files arrive through two hops.

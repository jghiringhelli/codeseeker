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

Depth 1 by default. Neighbours inherit `max(source_score) x 0.6`, taking the maximum
when several results point at the same neighbour. Expand from the top 10.

The decay was 0.7 until it was measured against queries that need an edge to answer; see
the amendment below.

## Consequences

Measured ranking impact is neutral, within +/-0.3% MRR. The graph does not move MRR
because the semantic layer already finds the right files; its neighbours are usually
already in the top 15.

**Amendment, after building an instrument that can see the feature.** The ablation above,
and the RealWorld one that replaced it, report *identical* numbers for no-graph,
graph-1hop and graph-2hop on every query. That was read as "the graph does not move
ranking". It is better read as: those corpora are 41-51 files with R@5 already at 100%, so
no expansion could have shown anything. The instrument could not see the feature.

`scripts/graph-bench.js` asks a question they cannot: each query has a multi-file answer
including at least one target that is *lexically silent* — containing none of the query's
distinctive terms, so reachable only across an import edge, verified mechanically per run.

Under it the graph is not neutral at all:

| decay | R@5 | R@10 | silent targets found |
|---|---|---|---|
| none (depth 0) | 80.0% | 85.0% | 1 of 2 |
| 0.7 | 65.0% | 90.0% | 2 of 2 |
| **0.6** | **75.0%** | **90.0%** | **2 of 2** |
| 0.5 | 80.0% | 85.0% | 2 of 2 |

Expansion does retrieve files search alone cannot, and at 0.7 it was paying for them by
displacing real answers out of the top five. 0.6 dominates 0.7 outright. real-bench is
unchanged at MRR 80.4% and the curated benchmark still passes all 104 assertions.

Rejected here too: ranking neighbours strictly below every direct hit. It reached R@5
80.0% but dropped R@10 to 85.0% and failed seven curated assertions that expect expansion
to reach the top five. Being adjacent to an answer is weaker evidence than being one, but
it is not worthless.

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

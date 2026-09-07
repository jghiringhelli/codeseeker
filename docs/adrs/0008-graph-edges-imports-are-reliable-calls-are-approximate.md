# ADR 0008: Graph edges: imports are reliable, calls are approximate

- **Status:** Accepted
- **Date:** 2026-09-07

## Context

The knowledge graph carries several edge types. They are not equally trustworthy:
import edges come from AST parsing and are exact, while call edges are extracted with
regex heuristics.

## Decision

Build both, but state the difference wherever results are returned. Analysis responses
carry an explicit `graph_limitations` list: call edges miss dynamic dispatch, callbacks
and event handlers; export status is reliable only for TypeScript and JavaScript, where
Babel parses the AST; symbols consumed by external packages appear unreferenced.

## Consequences

Positive: the caller can weight conclusions by edge type instead of treating a
heuristic as ground truth.

Negative: every consumer must read and respect the caveats.

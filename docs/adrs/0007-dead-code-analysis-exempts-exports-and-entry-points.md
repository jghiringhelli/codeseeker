# ADR 0007: Dead-code analysis exempts exports and entry points

- **Status:** Accepted
- **Date:** 2026-09-07

## Context

A symbol with no inbound edges in the knowledge graph looks unused. For a library, that
is often wrong: exported symbols are consumed by callers outside the repository, and
entry points are invoked by tooling rather than imported.

## Decision

Treat export status and entry-point naming as exemptions. Report unreferenced symbols
with an explicit confidence figure and a list of the analysis's own limitations
alongside the findings, so the caller can weigh them.

## Consequences

Positive: far fewer false positives on library code, and the caller is told what the
analysis cannot see rather than being left to assume it is authoritative.

Negative: genuinely dead exported code is not reported. This is the correct direction to
err: a false negative costs disk space, a false positive costs a deletion.

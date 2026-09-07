# ADR 0003: Summaries by default, full content only on request

- **Status:** Accepted
- **Date:** 2026-09-07

## Context

A search that returns file content spends the caller's context on text it may not need,
and duplicates content the assistant can obtain with its own Read tool.

## Decision

Search results default to `full: false` and return path, score, line range and the first
meaningful declaration line. Content is returned only when the caller passes
`full: true`, and then as a 300-character snippet.

All result paths are relative to the project root, so they can be passed directly to a
Read tool without transformation.

## Consequences

Positive: a ten-result search costs a few hundred tokens rather than thousands.

Negative: the assistant needs a second call to see code, which is the right trade when
it only needs one of the ten files.

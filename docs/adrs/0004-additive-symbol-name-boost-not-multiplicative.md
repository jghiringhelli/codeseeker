# ADR 0004: Additive symbol-name boost, not multiplicative

- **Status:** Accepted
- **Date:** 2026-09-07

## Context

When a query token appears in a file's name, that file is very likely the definition
site and should outrank semantic near-misses. The natural implementation is a
multiplier on the existing score.

A multiplier fails to reverse the ranking when the gap is large: 0.65 x 1.2 = 0.78,
which still loses to a competitor at 0.80. The boost silently does nothing in exactly
the cases where it matters most.

## Decision

Apply an additive +0.20 boost when a query token appears in the file name.

Additive guarantees the reversal: a boosted score of raw + 0.20 outranks any competitor
whose raw score is at most raw + 0.19.

The RAPTOR cascade gate uses the pre-boost raw score, so a weak file lifted by the boost
cannot trigger a directory-wide cascade.

## Consequences

Positive: the boost is predictable and its effect provable from the arithmetic.

Negative: an additive constant is scale-dependent. It assumes scores are normalised to
roughly 0..1; if the scoring range changes, 0.20 must be revisited.

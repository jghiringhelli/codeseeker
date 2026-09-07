# ADR 0009: Source-file boost and test-file penalty in ranking

- **Status:** Accepted
- **Date:** 2026-09-07

## Context

Test files import and exercise every symbol in the code they test, so for an exact
symbol query they are semantically excellent matches. Without correction,
`integration.test.ts` outranks `dag-engine.ts` for a query naming a symbol that
`dag-engine.ts` defines. The user almost always wants the definition site.

## Decision

Apply differential scoring by file type: source files +0.10, test files -0.15,
documentation and configuration -0.05.

The multi-chunk boost (up to +0.30) is quality-gated: only chunks scoring at least 0.15
count toward it, so lock files and generated files cannot accumulate a large boost from
many weak matches.

## Consequences

Positive: definition sites outrank their tests for symbol queries.

Negative: a genuine search for a test is penalised, and the penalty is a tuned constant
rather than a learned weight.

Known limitation: on cross-file queries the penalty is not always sufficient. The
`cv-prompts` benchmark query still fails because `prompt-builder.test.ts` outscores
`prompt-builder.ts`, so the source file never enters the top-10 and cannot be
graph-walked from. A stronger penalty, or a definition-versus-usage AST signal, is the
open direction.

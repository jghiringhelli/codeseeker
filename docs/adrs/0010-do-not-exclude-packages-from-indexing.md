# ADR 0010: Do not exclude packages/ from indexing

- **Status:** Accepted
- **Date:** 2026-09-07

## Context

The default excluded-directory list treated `packages/` as a vendor directory. For
pnpm, yarn and lerna monorepos, `packages/` is the conventional source root — so the
default silently indexed zero source files for an entire class of projects, with no
error and no warning.

## Decision

Remove `packages` from the default exclusions, in both
`file-scanner-config.json` and the `IGNORE_DIRS` hardcode in `indexing-service.ts`.

## Consequences

Measured effect: MRR moved from 10% to 72% on the Conclave TypeScript monorepo
benchmark. The single highest-impact change in v2.0.0.

Users who genuinely want to exclude a `packages/` directory can do so per-project with
`index({op:"exclude"})`, which persists to `.codeseeker/exclusions.json`.

The general lesson, and the reason this ADR exists rather than just a changelog line: a
default that silently produces an empty index is worse than one that fails loudly.

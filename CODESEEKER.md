# CODESEEKER.md — CodeSeeker

Instructions for CodeSeeker when it analyses this repository. This file is read by the
tool itself; humans and AI assistants should start at `CLAUDE.md` instead.

## Project

**CodeSeeker** — a code-intelligence MCP server and CLI. It indexes a codebase into
chunks with embeddings plus a knowledge graph, and answers meaning-based and
structure-based queries over it for an AI coding assistant.

- **Type:** MCP server + CLI, distributed on npm
- **Languages:** TypeScript (source), JavaScript (bin, scripts)
- **Runtime:** Node ≥ 18
- **Architecture:** layered, storage behind interfaces with two implementations
  (embedded SQLite / server PostgreSQL + Neo4j), a single MCP sentinel tool over a shared
  engine
- **Testing:** Jest — unit and integration as the gate, e2e on demand, Stryker mutation
  testing on the retrieval core
- **Standards:** ESLint, Prettier, conventional commits enforced at commit time

The canonical description is `docs/specs/spec.md`. If this file and the specification
disagree, the specification is correct.

## Where the authority lives

| Question | Document |
|---|---|
| What must this do? | `docs/specs/spec.md` |
| What does this term mean? | `docs/specs/domain.md` |
| What is the architecture obliged to be? | `docs/specs/architecture.md` |
| How does it actually work? | `docs/technical/architecture.md` |
| Why was this decided? | `docs/adrs/` |
| What is enforced, and at what severity? | `.forgecraft/project-gates.yaml` |

## Detected platforms

Reference documentation for the stack in use:

- **TypeScript** — https://www.typescriptlang.org/docs/
- **Node.js** — https://nodejs.org/docs/
- **Jest** — https://jestjs.io/docs/getting-started
- **Stryker** — https://stryker-mutator.io/docs/
- **Model Context Protocol** — https://modelcontextprotocol.io/
- **PostgreSQL / pgvector** (server mode) — https://www.postgresql.org/docs/
- **Neo4j** (server mode) — https://neo4j.com/docs/
- **Docker** — https://docs.docker.com/

## Analysis guidance

When analysing this repository specifically:

- **Do not report long files as a discovery.** 144 of 338 source files exceed 300 lines.
  It is a known, recorded violation with a ratchet on it
  (`.forgecraft/project-gates.yaml`). Report movement, not the standing figure.
- **Do not report low coverage as a discovery.** 11.16% of statements, recorded, with a
  per-module plan. A mutation run on the best-tested module scored 70.63% before
  improvement, so the suite is narrow rather than shallow — treat those as different
  findings.
- **`archive/` is dead by intent.** It holds superseded implementations kept for
  reference. Duplicate detection will match it against live code; that is expected and
  not actionable.
- **`tests/fixtures/` is synthetic.** It contains deliberately poor code that exists to
  be indexed by tests. Do not treat its patterns as project conventions — the same bug
  the coding-standards analyser currently has (R18).
- Prefer findings that are new or that move an existing baseline. A finding already
  recorded in the specification's Known Gaps section is not news.

# CodeSeeker Context Index

## Always Load
@.claude/core.md

## Navigation Protocol — follow before any task

1. Read this file. Identify the task domain from the table below.
2. Read `.claude/core.md`. Always. It is always relevant.
3. Read the matching domain node. One node only.
4. If the task spans two domains, name both before loading either.
5. If no node matches, read core.md only and flag the gap.
6. **Before changing behaviour, not just describing it**, read `docs/specs/spec.md`.
   The specification is what the implementation derives from; where they disagree, the
   specification is what we trust.

## Navigate by Task

| Task Domain | Node | When to Use |
|---|---|---|
| Using / calling MCP tools | @.claude/mcp-tool.md | Searching, sym lookup, graph, analyze, index calls |
| Search quality / ranking | @.claude/search.md | Hybrid search, RAPTOR, embeddings, scoring |
| Index management | @.claude/index-mgmt.md | init, sync, exclude, staleness |
| Code analysis tools | @.claude/analyze.md | dead_code, duplicates, standards |
| Writing new code | @.claude/dev.md | Conventions, SOLID, naming, build |
| Releases / versioning | @.claude/versioning.md | Version bump, npm publish, GitHub release |
| Architecture decisions | @.claude/adr/index.md | Before any structural change |

## The specification set

The nodes above tell you how to *operate* CodeSeeker. These tell you what it is
*obliged* to do. Read them before changing behaviour, adding a capability, or deciding
whether something is a bug.

| Document | What it settles |
|---|---|
| `docs/specs/spec.md` | Purpose, scope, numbered requirements, hard contracts, acceptance criteria, known gaps |
| `docs/specs/domain.md` | The vocabulary. A term means what this says and nothing else |
| `docs/specs/architecture.md` | Layer rules, dependency direction, forbidden patterns, current violations |
| `docs/specs/use-cases/` | Each requirement as a sequence with an observable outcome, and the test that covers it |
| `docs/adrs/` | Why each non-obvious decision was made, and what it cost |

## The cascade — read before committing

A change is admissible only if the layer above it has been amended to explain it
(ADR-0012). In practice:

| Commit type | Owes |
|---|---|
| `feat:` | a specification amendment |
| `fix:` | a regression test |
| `refactor:`, `perf:` | an ADR if an architectural choice was made |
| `docs:`, `test:`, `chore:`, `ci:` | nothing |

Regardless of type: a change to the MCP tool schema, exported types or CLI flags
requires a touch of `docs/specs/` or `docs/adrs/`.

Commit messages are validated by commitlint at commit time. Quality gates and their
current baselines are in `.forgecraft/project-gates.yaml`.

# CodeSeeker — Functional Specification

*Version 1.0 · 2026-09-07 · status: adopted*

This document is the canonical functional specification for CodeSeeker. Implementation
derives from it; it does not describe implementation. Where the two disagree, this
document is what we trust — we tighten it and regenerate rather than amending it to
match the code.

This is the apex of the cascade (ADR-0012). A change to it requires no upstream
explanation; every change below it does.

**Written retroactively.** CodeSeeker was built before this specification existed. This
is a brownfield archaeology pass: it states the decisions the code already embodies,
plus the ones that were only ever implicit. Where an obligation is stated here but not
yet enforced, it is marked `NOT ENFORCED` rather than written as though it were true.

---

## 1. Purpose

CodeSeeker gives an AI coding assistant a queryable model of a codebase, so the
assistant can find code by meaning and by structure rather than by string match.

It exists because of the read-asymmetry: a reader — human or machine — comprehends a
system from its structural surface, not by reading every line and inferring behaviour.
Grep exposes text. An LSP exposes symbols. Neither exposes *"what validation approach
does this project use"* or *"what breaks if I change this"*. CodeSeeker indexes a
codebase once and answers both classes of question on every turn.

The audience is an AI assistant, not a human. Every output decision follows from that:
results are summaries by default because the caller pays for tokens, paths are
project-relative because the caller will pass them to a file-reading tool, and the tool
surface is deliberately one tool because tool descriptions are re-sent on every request.

---

## 2. Scope

### In scope

**S1 — Indexing.** Scan a project, chunk source files at symbol boundaries, embed each
chunk, build a knowledge graph of code relationships, and generate per-directory
summaries. Persist locally under `.codeseeker/`.

**S2 — Retrieval.** Answer natural-language queries over the index using BM25 and vector
embeddings fused with Reciprocal Rank Fusion, a directory-summary cascade, and graph
expansion.

**S3 — Symbol lookup.** Resolve a class, function or method name to its definition site
and immediate graph neighbours.

**S4 — Graph traversal.** Walk import, call and inheritance edges from a seed file or a
semantically-located set of seed files.

**S5 — Analysis.** Report duplicate code, dead code, and the coding patterns the project
already uses.

**S6 — Index maintenance.** Incremental sync on file change, full reindex, dynamic
exclusion of paths, and installation of language parsers.

**S7 — Two surfaces.** An MCP server (`codeseeker serve --mcp`) and an interactive CLI.
Both drive the same engine.

**S8 — Two storage modes.** Embedded (SQLite + MiniSearch, single developer, default)
and server (PostgreSQL + pgvector + Neo4j, shared index across a team).

### Out of scope — explicitly

Named so that the gap is deliberate rather than discovered later. An AI reader that
finds a gap here should ask, not improvise.

- **Editing code.** CodeSeeker reads and indexes. It never writes to source files. The
  assistant edits; CodeSeeker tells it where and what depends on what.
- **Being a language server.** No go-to-definition-grade precision, no rename
  refactoring, no type resolution. Where an LSP is available and the question is exact,
  the LSP is the better tool and the assistant should use it.
- **Calling a model API.** All inference is local ONNX (embeddings) or a subprocess
  invocation of the user's own `claude` CLI. No API keys, no HTTP to any model provider
  (ADR-0001).
- **Hosted service.** Nothing customer-touching is hosted. Server mode is deployed by
  the customer on their own infrastructure.
- **Auto-indexing on first query.** Deliberately excluded — see C4.
- **Cross-repository indexing in embedded mode.** One project, one index. Spanning
  repositories is a server-mode capability.
- **Natural-language code generation.** The CLI's `-c` mode passes context to the user's
  `claude` CLI; CodeSeeker itself generates no code.

---

## 3. Functional requirements

Each requirement is stated so that a test can exist for it. Where a test already exists
it is named; where none does, the requirement carries `NO TEST` and that is a debt
recorded in `.forgecraft/project-gates.yaml`, not a decoration.

**Numbering is append-only.** A requirement number is a durable key — ADR-0012 enforces
the cascade by citing them, so a citation must keep meaning. New requirements take the
next free number and are placed with their topic; they are never renumbered, reused, or
interleaved to sit beside a related one. A retired requirement is marked withdrawn and
keeps its number.

### 3.1 Tool surface

**R1.** The MCP server MUST expose exactly one tool, named `codeseeker`, routed by an
`action` key with values `search | sym | graph | analyze | index`. Adding a second
top-level tool is a specification change, not an implementation choice. *(ADR-0002;
tests/mcp/mcp-server.test.ts)*

**R2.** Each action MUST accept only its own nested parameter group. A caller filling
the wrong group MUST receive an error naming the expected group, not a silent default.
*(tests/mcp/mcp-tools-integration.test.ts)*

**R3.** Every action that resolves a project MUST do so through the shared resolver.
No action may implement its own resolution, and none may fall back to `process.cwd()` —
an MCP server's working directory belongs to its launcher, not to the user's project.
*(gate `no-divergent-project-resolution`; regression for issue #2)*

#### The parameter groups

`project` is shared across every action and carries the absolute project root. Each
action then fills exactly one nested group. This table is normative: adding, removing or
renaming a field here is a specification change under R21.

**`search`**

| Field | Type | Default | Meaning |
|---|---|---|---|
| `q` | string | required | Natural-language query |
| `type` | `hybrid` \| `fts` \| `vector` | `hybrid` | Retrieval mode |
| `limit` | number | 10 | Maximum results returned |
| `full` | boolean | false | Attach a bounded snippet to each result |
| `exists` | boolean | false | Quick check — returns `{found, count, top_file}` and skips the cache |

**`sym`**

| Field | Type | Default | Meaning |
|---|---|---|---|
| `name` | string | required | Symbol name, exact or partial |
| `full` | boolean | false | Include resolved relationships |

**`graph`**

| Field | Type | Default | Meaning |
|---|---|---|---|
| `seed` | string | — | Seed file, project-relative |
| `q` | string | — | Alternative to `seed`: locate seeds semantically |
| `depth` | number | 1 | Traversal depth, 1–3 |
| `rel` | string[] | all | `imports`, `exports`, `calls`, `extends`, `implements`, `contains`, `uses`, `depends_on` |
| `dir` | `in` \| `out` \| `both` | `both` | Edge direction |
| `max` | number | 50 | Maximum nodes returned |

**`analyze`** — `project` is required for this action.

| Field | Type | Default | Meaning |
|---|---|---|---|
| `kind` | `duplicates` \| `dead_code` \| `standards` | required | Analysis type |
| `threshold` | number | 0.80 | Similarity threshold, `duplicates` only |
| `min_lines` | number | 5 | Minimum block size, `duplicates` only |
| `patterns` | string[] | all | `dead_code`, `god_class`, `circular_deps`, `feature_envy`, `coupling` |
| `category` | `validation` \| `error-handling` \| `logging` \| `testing` \| `all` | `all` | `standards` only |

**`index`**

| Field | Type | Default | Meaning |
|---|---|---|---|
| `op` | `init` \| `sync` \| `status` \| `parsers` \| `exclude` | required | Operation |
| `path` | string | — | Project directory, `init` only |
| `name` | string | — | Project name, `init` only |
| `changes` | `{type, path}[]` | — | `created` \| `modified` \| `deleted`, `sync` only |
| `full_reindex` | boolean | false | Rebuild rather than apply `changes` |
| `languages` | string[] | — | Parsers to install, `parsers` only |
| `list_available` | boolean | false | List parsers instead of installing |
| `exclude_op` | `exclude` \| `include` \| `list` | — | `exclude` only |
| `paths` | string[] | — | Globs, `exclude` only |
| `reason` | string | — | Why, recorded with the exclusion |

### 3.2 Retrieval

**R4.** Hybrid search MUST fuse BM25 and vector rankings with Reciprocal Rank Fusion at
k=60, weighting each source equally. *(tests/storage/hybrid-search-scoring.test.ts)*

**R5.** Path relevance MUST be captured inside the text index rather than as a separate
fusion dimension or a post-fusion bonus. A flat bonus applied after RRF corrupts the
ranking it is meant to improve. *(tests/relevance/fts-relevance.test.ts)*

**R6.** Result scoring MUST apply: source-file boost +0.10, test-file penalty −0.15,
doc/config penalty −0.05, symbol-name boost +0.20 additive, and a multi-chunk boost
capped at +0.30 counting only chunks scoring ≥0.15. *(ADR-0004, ADR-0009;
tests/unit/symbol-name-boost.test.ts)*

**R7.** The RAPTOR cascade MUST fire only when a directory summary scores ≥0.5, and MUST
gate on the pre-boost raw score so a boosted file cannot trigger a directory-wide
narrowing. *(ADR-0005; tests/unit/raptor-cascade.test.ts)*

**R8.** Graph expansion MUST run at depth 1 by default, score each neighbour at
`max(source_score) × 0.7`, and expand from the top 10 results. *(ADR-0011)*

**R9.** Search results MUST default to summaries. Content is returned only when the
caller passes `full: true`, and then bounded to a snippet. *(ADR-0003)*

**R10.** Every `file` field in every response MUST be a path relative to the project
root, so it can be passed directly to a file-reading tool without transformation.

### 3.3 Indexing

**R11.** Indexing MUST run in the background and return immediately, with progress
observable through `index({op:"status"})`.

**R12.** The default exclusion list MUST NOT contain `packages`. For pnpm, yarn and
lerna monorepos that directory is the source root, and excluding it indexes nothing
while reporting success. *(ADR-0010)*

**R13.** A `sync` carrying `{type:"deleted"}` MUST remove that file's chunks and its
graph nodes. A subsequent `graph` or `search` MUST NOT return the deleted file.
*(NOT ENFORCED — issue #5(b); the deletion primitive is verified, its wiring through
sync is not)*

**R14.** Graph file-node coverage MUST match the search corpus for **code** files: a
code file that `search` can return MUST be reachable as a graph node. Documents and
configuration are indexed but intentionally have no graph node — the graph models code
relationships. *(verified: scripts/corpus-bench.js across 7 corpora)*

**R22.** An index MUST record which embedder built it, and a search against an index
built by a different embedder MUST be refused with an error naming both identities.
Vectors from two embedders share shape and range, so a mismatch degrades ranking without
failing — the failure mode this forbids is silence, not error.
*(tests/unit/embedding-identity.test.ts)*

**R15.** Exclusions MUST persist to `.codeseeker/exclusions.json` and be respected on
the next full reindex.

### 3.4 Analysis

**R16.** Every analysis response MUST carry an explicit statement of the analysis's own
limitations alongside its findings. A caller must be able to weight a conclusion by how
it was derived. *(ADR-0008)*

**R17.** Dead-code analysis MUST exempt exported symbols and entry points, and MUST
report a confidence figure per finding. *(ADR-0007)*

**R18.** Coding-standards detection MUST consider only source files. Patterns quoted
from Markdown, changelogs or test fixtures are not project standards.
*(enforced: all seven detectors route through a single source-file filter)*

**R19.** No listing of files may present a truncated set without stating the full count
and labelling itself as a sample. *(gate `no-silent-truncation-in-diagnostics`;
regression for issue #3)*

### 3.5 Honesty of capability

**R20.** The `parsers` operation MUST NOT advertise a parser whose installation would not
change extraction quality. Today only TypeScript, JavaScript, Python and Java are wired
into the graph builder. *(enforced: each registry entry carries a `wired` flag, surfaced in the parsers response)*

**R21.** Documented behaviour MUST match implemented behaviour. Any change to the tool
schema, exported types, or CLI flags requires a corresponding change to this document or
an ADR. *(ADR-0012; the commit-type half is enforced, the public-surface half is not)*

---

## 4. Hard contracts

Non-negotiable. Violating any of these breaks something a user depends on.

**C1 — Local by default.** In embedded mode, no data leaves the machine. No telemetry,
no phone-home, no remote index.

**C2 — No model API calls.** All inference is local ONNX or a subprocess call to the
user's own `claude` CLI. No `fetch()` to any model provider (ADR-0001).

**C3 — Never write to source.** CodeSeeker writes only under `.codeseeker/`. It does not
modify, move or delete a file it did not create.

**C4 — Index explicitly, never implicitly.** *(verified: tests/contract/mcp-protocol.contract.test.ts)* A project must be indexed by an explicit
`index({op:"init"})` or `codeseeker init`. A query against an unindexed project returns
an error naming the fix. Indexing a large repository silently inside a tool call would
block the assistant for minutes with no way to cancel and no way to know why.

**C5 — Refuse dangerous paths.** Indexing MUST refuse system directories and credential
directories (`/etc`, `C:\Windows`, `.ssh`, `.gnupg`, `.aws`, …) and any path containing
`..`. *(tests via scripts/smoke-test-mcp.js)*

**C6 — Degrade visibly.** When a subsystem is unavailable, say so in the response.
Never return a partial result that reads like a complete one.

**C7 — One tool.** The MCP surface stays at a single tool. This is a token-economy
contract with every user of the server, not an aesthetic preference (ADR-0002).

---

## 5. Quality gates

Full definitions in `.forgecraft/gates/`; current baselines and promotion criteria in
`.forgecraft/project-gates.yaml`. Severity follows the brownfield ramp — advisory with a
recorded baseline until the baseline is clean, then blocking.

| Gate | Status | Baseline |
|---|---|---|
| `tsc-no-emit-exits-zero` | blocking | passing |
| `jest-no-failed-tests` | blocking | 727 passing |
| `conventional-commits` | blocking | passing |
| `coverage-threshold-80` | advisory | 11.16% statements |
| `mutation-score-threshold` | advisory | 85.31% on the measured scope |
| `npm-audit-no-high-cve` | advisory | 0 critical, 4 high (all install-time or unreachable) |
| `file-length-max-300` | advisory | 144 of 338 files over |
| `typescript-strict-mode` | advisory | `strict: false` |
| `adr-files-emitted` | blocking | 12 records |

---

## 6. Acceptance criteria

How we would know CodeSeeker is doing its job. These are observable, not aspirational.

**A1 — Retrieval quality.** On the labelled benchmark (18 queries, two real codebases,
`scripts/real-bench.js`): MRR ≥ 70%, P@1 ≥ 60%, R@5 ≥ 90%. Current: 75.2% / 61.1% /
91.7%.

**A2 — Integrity holds across languages and project shapes.** `scripts/corpus-bench.js`
runs the index/graph/search integrity checks over seven corpora spanning JavaScript,
TypeScript and Python, from 41 to 1,746 files. Retrieval *quality* (MRR/P@1/R@5) is
still measured only on TypeScript and C# by `scripts/real-bench.js`.

**A3 — Graph fidelity.** Graph file-node count equals the indexed file count, and a
delete-then-sync cycle leaves no reachable node for the deleted file. *(NOT MEASURED)*

**A4 — Cold-start cost.** A 500-file project indexes in under 5 minutes on a developer
laptop. Current: 504 files, 9,714 chunks, 3,778 nodes, 4,647 edges in 147 seconds.

**A5 — Query cost.** A search on a warm index returns in under 2 seconds.

**A6 — The gate is usable.** `npm test` completes in under 60 seconds, so it can run on
every push without being disabled. Current: ~11 seconds.

**A8 — Contracts run against a live runtime.** The MCP protocol is exercised as a
contract against a spawned server process, not in-process handlers. Current: 17 contract
tests over stdio, run by `npm run test:contract`.

**A7 — Documentation derives.** A reader given only this specification, `domain.md`,
`architecture.md` and the ADRs can state what the tool surface is, what each action does
**and accepts**, and why the surface is one tool — without reading the implementation.
*(Tested 2026-09-08. The reader derived the architecture and every hard constraint, but
could not state what any action accepted, because no parameter group was written down.
The parameter tables in §3.1 exist because A7 failed on its own terms.)*

---

## 7. Known gaps

Stated here rather than discovered later. Each is either an open issue or a recorded
debt.

- **A3 / retrieval quality across languages** — `corpus-bench.js` verifies index/graph
  integrity on seven corpora, but ranking quality (MRR, P@1, R@5) is still measured only
  on TypeScript and C#. A Python or JavaScript corpus with hand-labelled queries would
  close this; none exists yet.
- **Coverage** — 11.16% of statements. The suite is narrow rather than shallow: a
  mutation run on the best-tested module scored 70.63% before improvement, so the
  assertions that exist are real.
- **Composability** — 144 of 338 source files exceed 300 lines;
  `user-interaction-service.ts` is 2,264 and `mcp-server.ts` is 1,886. The change
  surface of those files is not predictable from their boundary declaration.
- **Executable** — a contract suite now runs against a live server over stdio, covering
  the tool surface, the refusals and the error contracts. It does not yet cover the
  retrieval contracts (R4-R8), which need an indexed fixture.

### Found by the derivability test

A reader given only this specification, `domain.md`, `architecture.md` and the ADR router
— no source access — was asked to describe the system and implement a bounded feature.
It derived the architecture and every hard constraint correctly, and produced an
implementation that respected all of them. What it could not derive is recorded here.

- **No requirement class covers query modifiers.** Twenty-two requirements govern
  fusion, boosts, cascade thresholds, expansion arithmetic and analysis honesty. None
  governs *restricting* a result set. A reader adding a filter finds nothing to comply
  with — only things to avoid colliding with. The gap is a category, not a detail.
- **Where a filter acts in the pipeline is undetermined**, and it is a correctness
  question: filtering after fusion starves a narrow query of results because `limit`
  bound the whole corpus. The specification never says whether `limit` binds the
  candidate set or the returned set.
- **Two directory-narrowing mechanisms would stack undefined.** R7's RAPTOR cascade
  already narrows to a directory. Nothing says what a caller-supplied scope does to it.
- **Graph expansion crosses module boundaries by construction** — an import edge points
  out of the module — so any boundary-restricting feature collides with R8, and ADR-0011
  discusses depth, scoring and fan-out without ever mentioning filtering.
- **The `__raptor__/` prefix is a trap.** A predicate written over stored paths silently
  excludes every directory summary. Which fields carry synthetic prefixes, and how
  consumers must handle them, is stated only in passing.
- **Path-matching semantics for *input* are unstated.** R10 governs paths in responses.
  Nothing states the canonical stored form or whether comparison is case-sensitive — on
  Windows that is the difference between a working filter and one that matches nothing
  while reporting success, which is ADR-0010's failure mode exactly.
- **The shared error types are named as a category and never enumerated**, and no
  document shows an error response, so a new validation path cannot be written to match.
- **The CLI is a governed public surface with no documented content.** ADR-0012 makes CLI
  flags require an amendment; not one flag appears anywhere in the specification set.
- **ADR-0012 is `Proposed`,** and it is the rule the whole document system leans on.
  Nothing says how a reader should treat a proposed ADR — binding, advisory, or draft.

The full report is in the session record. These are omissions, not errors: everything the
specification does state, it stated well enough to derive from.

---

## 8. References

- Domain glossary: `docs/specs/domain.md`
- Mandated architecture: `docs/specs/architecture.md`
- Use cases: `docs/specs/use-cases/`
- Decision records: `docs/adrs/` (router at `.claude/adr/index.md`)
- Technical internals: `docs/technical/architecture.md`
- MCP surface reference: `docs/install/mcp-server.md`
- Quality gates: `.forgecraft/gates/`, `.forgecraft/project-gates.yaml`
- Generative Specification white paper: https://doi.org/10.5281/zenodo.21726017

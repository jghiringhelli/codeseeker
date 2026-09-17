# Chronos — Functional Specification

*Version 0.5 · 2026-09-15 · status: **evidence gate met (§10) — completed for
derivability (audit v0.3), build authorised by the GS devlog experiment.** Praxis (the behaviour axis)
moved to its own document, `praxis-behaviour-axis.md`, and stays gated.*

A specification for an MCP server written before the server exists, so that implementation derives from
it rather than the reverse. v0.4 closed the degrees of freedom a stateless reader would otherwise fill by
guessing (`chronos-spec-audit-v0.3.md` lists each one); v0.5 closes the last open decisions. Every
decision in §8 is now closed. Requirements R1–R14 keep their numbers: the benchmark and the build prompt
cite them.

**Reading rule.** MUST / SHOULD / MAY are RFC 2119. Every MUST is an acceptance criterion and therefore a
probe (§9). Everything in parentheses or italics is rationale.

---

## 1. Purpose

Chronos answers *why the code is the way it is*, from the repository's own history.

Six MCP servers are in daily use here, and between them they answer where code is (CodeSeeker), what
happened in the session (Chronicle), how it should be built (Forgecraft), what third-party libraries do
(Context7), and what a browser or the web says (Playwright, Firecrawl). None answers:

- *Why is this written this way?*
- *Who should review this change?*
- *What shipped together with this, and what broke after it?*
- *Is this code load-bearing or vestigial?*

Those answers exist in git. They are unreachable today because reading them means running `git log -p`
and inferring from diffs, which costs thousands of tokens and produces a guess.

### Why a graph rather than retrieval

This follows the Compact Knowledge Graph result (McCreary/Yarmoluk): a question answered by traversing
**declared** relationships beats the same question answered by inferring from **retrieved text**, on
dependency, multi-hop and aggregate queries — 0.634 vs 0.078 F1 on direct dependency, 0.660 vs 0.201 on
multi-hop, roughly 269 tokens per query against 2,982.

Git history is already a declared graph. A commit *declares* its author, its parent, and every file it
touched. Nothing has to be inferred, embedded, or approximated:

```
author ──authored──▶ commit ──touched──▶ file
                        │
                     parent
                        ▼
                     commit
```

CodeSeeker's graph is the same shape over a different axis — it declares `file ──imports──▶ file`. The
two share the file node, which is why this composes rather than duplicates: *"who last changed the thing
this file depends on"* is one traversal across both.

---

## 2. Scope and boundary

### In scope

- Commits, authors, files, and the edges between them, for **one repository per call**.
- Questions answered by traversal: authorship, co-change, churn, ownership, recency.
- Merge commits and renames, because ignoring either makes ownership wrong.
- A sentinel tool surface: one tool, action-routed (CodeSeeker ADR-0002).
- Any git working tree, including a subdirectory of one and a linked worktree. A **shallow clone** is in
  scope but its truncation MUST be visible in every response (R20).

### Out of scope

- **Semantic search over commit messages.** That is retrieval, and CodeSeeker already does retrieval. If a
  question needs meaning rather than structure, it is CodeSeeker's.
- **Hosting-platform data** — PR reviews, issues, CI runs. Lives behind an API with rate limits and auth;
  none of it is needed for the questions in §1. This version is `git` and nothing else.
- **Blame at line granularity.** `git blame` exists, is fast, and an assistant can run it. Chronos answers
  what blame cannot: aggregates and multi-hop relationships.
- **Submodules.** A submodule path is reported as a single file node; its inner history is not traversed.
- **Persistence across processes** in this version (D3 in §8). The graph lives for the life of the server
  process.
- **Any judgement about people.** See §7.

---

## 3. Functional requirements

**R1. One tool.** Exactly one tool, named `chronos`, routed by an `action` key, with parameters nested per
action. The action set is **`history | owners | cochange | why`** and MUST NOT grow without an ADR.
*(CodeSeeker ADR-0002. The measured reason: a flat schema forces every parameter to document which actions
use it, which cost Forgecraft 12,392 characters of `"Used by: …"` prose that nesting makes unnecessary.)*

**R2. Description budget, and the Chronicle disambiguation.** The tool description MUST stay under 400
characters; MUST state when to use `git` directly instead (at minimum: single-line blame, diff content,
anything needing the patch text); and MUST distinguish Chronos from **Chronicle** in one clause — Chronos
reads *the repository's git history*, Chronicle reads *the session's history*. *(Re-sent on every request.
Chronicle's long description earns its length because it teaches a protocol; this one has nothing
non-obvious to teach. The disambiguation is not optional: two PragmaWorks servers two letters apart both
answer "what happened", they are frequently loaded together, and these 400 characters are the only thing
the calling model has to choose between them — D7.)*

**R3. Zero setup on the target repository.** Building the graph for a repository MUST NOT require network
access, an API key, a language toolchain, or any file written into that repository. The only external
program is the `git` executable on `PATH`. *(Measured: `git log --pretty --name-only` over 331 commits
completes in 122 ms and yields 200 KB. There is no reason for this to be slow or configured.)* Build time
SHOULD stay under 2 s for a 10,000-commit repository on a developer laptop; beyond that the graph MUST still
be correct, only slower.

**R4. `history`.** For a file, MUST return: every commit that touched it (renames followed), each with
short sha, author name, ISO-8601 date, subject, the change status for that file (`A | M | D | R`), the
previous path when the status is `R`, and whether the commit is a merge — as declared edges, never as diff
text. Order is **newest first**. The response MUST carry `total` (all commits) even when `limit` truncates
the rows.

**R5. `owners`.** MUST rank contributors for a path (file or directory, recursive) by **the number of
non-merge commits by that author that touched the path**, renames followed for files; MUST name the metric
in the response, in these words: `"familiarity: non-merge commits touching the path"`; MUST carry, per
author, `commits`, `first` and `last` (ISO-8601 dates). Ties are broken by most recent `last`, then by name
— both fields are in the response, so the order is recomputable (R14). *(A number whose definition is
hidden is advice nobody can check.)*

**R6. `cochange`.** MUST return which files changed together with a given file and how often, over a
window of the **N most recent non-merge commits that touched the file** (`window`, default 100, maximum
1000). Each row carries `file` and `count`; the response carries `commits_examined` so `count /
commits_examined` is recomputable. The target file itself is excluded. Rows are sorted by `count`
descending, then by path, truncated to `limit` (default 10). No commit is filtered out for its size: a
1,000-file reformat counts, and the caller can see it did, because `commits_examined` and the counts are in
the answer. *(This is the query git makes hardest and that predicts blast radius better than imports: a
config file and the code reading it co-change constantly and import nothing from each other. Filtering
large commits is a heuristic; §6 says the benchmark comes before any heuristic.)*

**R7. `why`.** For a file, or a line range of a file (`line_start`/`line_end`, both or neither), MUST return
the commits that shaped it **oldest first**, each with short sha, author, date, subject, and body when the
message has one (the body is where the why lives), plus `refs`: the issue and decision references found in
the message. `refs` MUST include every `#<digits>` token and every `ADR-<digits>` / `EDR-<digits>` token
(case-insensitive, optional zero-padding, `ADR 0002` and `adr-2` both count), and every `docs/…` path in
the message that exists at HEAD. Other reference forms MAY be added; a form that is added MUST be listed
in the response's `ref_forms`. Line-range mode follows git's own line-tracking (renames and moves as git
declares them); the response MUST echo the range it answered for.

**R8. Renames are followed and visible.** A file's history MUST NOT begin at its current path, and the
rename event MUST appear in the response as an `R` row carrying `previous_path`, so the caller can ask
about the old path. Probe P-08 (§9) pins this on a real repository: the history of `bin/codeseeker.js`
has 6 commits and mentions `bin/codemind.js`; following silently shows the 6 but never the old name; not
following shows 1 — 83% of the history invisible. *(Amended in 0.2 after building the benchmark found both
failures.)*

**R9. Merges are attributable but do not inflate.** Merge commits (more than one parent) MUST appear in
`history` and `why`, flagged `merge: true`. They MUST be excluded from the counts in `owners` and
`cochange`. Every response MUST state this in a `merges` field, in these words:
`"excluded from counts; listed in history and why"`. *(A merge that touches 200 files does not make its
author the owner of 200 files.)*

**R10. Paths.** Every path in a response MUST be repository-relative, forward-slash separated, exactly as
git records it (case preserved). Input paths MAY be absolute or relative to `repo`; both are normalised
before use. *(CodeSeeker R10, for the same reason: the caller will pass it to a file-reading tool.)*

**R11. Three states for an unknown path.** A query MUST distinguish, in a `path_state` field:
`"unknown"` — never in history and not on disk; `"untracked"` — present on disk, no commits; `"tracked"` —
has history. The first two return empty rows, never an error. *(The same distinction CodeSeeker draws
between an empty index and a populated index with no match.)*

**R12. Freshness is reported, then corrected.** The graph is built on the first query for a repository
and extended incrementally when HEAD has moved since. Every response MUST carry `head` (sha answered
against), and when the graph was extended for this query, `refreshed: { from, to, commits }`. If the
previously indexed commit is no longer an ancestor of HEAD (rebase, force-push), the graph MUST be rebuilt
in full and the response MUST say `refreshed.reason: "diverged"`. A response never answers from a graph
behind HEAD without saying so. *(CodeSeeker proves staleness rather than guessing at it. Chronos differs
in one respect — it corrects it, because R3 measured the correction as cheap; D4 in §8 records the why.)*

**R13. Edges, not prose.** A response MUST be a single JSON object (§4.3), never a paragraph. The caller is
a model that will compose it; a paragraph costs more and says less than a list of edges.

**R14. Every ranking is recomputable from the response.** Given the counts returned, a reader MUST be
able to recompute the order. No hidden weights, no recency decay, no normalisation. *(The lesson from
CodeSeeker's `score` field, which turned out not to be a confidence and could not be made into one because
normalisation and additive boosts had destroyed the scale.)*

**R15. Repository identification.** Every action takes `repo`: an absolute path to a git working tree or
any directory inside one. Chronos resolves it to the toplevel and answers for that repository; the server
holds no default and no state that outlives the process (D3). The resolved toplevel is echoed as `repo` in
the response.

**R16. Author identity.** Authors are identified by **author name (not committer), mailmap-resolved** —
git's own declared identity mechanism (`.mailmap`), so two spellings of one person merge only when the
repository says so. Chronos MUST NOT merge, filter or rename identities by any rule of its own, including
bot detection. (Emails: C4.)

**R17. Bounds.** `history`, `owners`, `cochange` and `why` take `limit` (default 50 for `history`/`why`, 20
for `owners`, 10 for `cochange`; maximum 500). A truncated response MUST carry `total` so truncation is
visible. Requests above the maximum are clamped and the response says `limit_clamped: true`.

**R18. Errors are answers.** A refusal (C2) or a malformed request MUST come back as a tool result with
`isError: true` and a one-line `error` naming the cause and, when there is one, the fix — never as a
JSON-RPC protocol error and never by exiting the process. *(The caller is a model; a protocol error is
invisible to it.)*

**R19. Read-only invocation of git.** `git` MUST be invoked with an argument vector (no shell), with
user-supplied paths placed after `--`, and with `stdin` closed. *(Two incident classes at once: shell
injection through a path, and a path that starts with `-` parsed as a flag.)*

**R20. Shallow clones are flagged.** Every response carries `shallow: true | false` (git declares this).
When true, `owners` and `cochange` still answer, from the truncated history, and the flag is the caller's
warning.

**R21. The build cost is reported.** When a query built or extended the graph, the response MUST carry
`build_ms` (wall-clock milliseconds spent in that build). *(D3 defers persistence on the strength of one
measurement — 122 ms over 331 commits. Reporting the cost is what lets that decision be reopened with a
number instead of an impression: if `build_ms` is routinely large on a real repository, the R3 budget was
exceeded and D3 says revisit. A decision whose revisit trigger is not measured is a decision nobody will
revisit.)*

---

## 4. Tool surface

### 4.1 Actions and parameters

| action | required | optional |
|---|---|---|
| `history` | `repo`, `path` (file) | `limit` |
| `owners` | `repo`, `path` (file or directory) | `limit` |
| `cochange` | `repo`, `path` (file) | `window`, `limit` |
| `why` | `repo`, `path` (file) | `line_start` + `line_end`, `limit` |

Parameters are nested per action in the JSON schema (one object per action, ADR-0002 shape). A parameter
outside its action's group is an error (R18).

### 4.2 Description (R2)

Under 400 characters. Says: what the four actions answer; that it reads history, never diffs; and when to
use `git` directly. The exact text is an EDR and a test (P-02).

### 4.3 Response envelope (R13)

Every successful response is one JSON object:

```
{
  action, repo, head, shallow,           // R15, R12, R20
  path, path_state,                      // R10, R11
  merges,                                // R9 — the fixed sentence
  metric,                                // owners only — the fixed sentence (R5)
  window, commits_examined,              // cochange only (R6)
  line_start, line_end,                  // why in range mode (R7)
  refreshed,                             // present only when the graph was extended (R12)
  build_ms,                              // present only when this query built or extended the graph (R21)
  total, limit_clamped,                  // R17
  rows: [ … ]                            // per-action row shapes below
}
```

Rows:
- `history`: `{ sha, author, date, subject, status, previous_path?, merge }`
- `owners`: `{ author, commits, first, last }`
- `cochange`: `{ file, count }`
- `why`: `{ sha, author, date, subject, body?, refs: [], merge }` (+ `ref_forms` on the envelope)

Field names are the public contract: renaming one is a breaking change and follows CodeSeeker ADR-0012
(the document cascade).

---

## 5. Hard contracts

| | |
|---|---|
| **C1** | stdout carries JSON-RPC only. Everything else goes to stderr. *(CodeSeeker shipped a release where a progress line on stdout killed live sessions, reported only as "Connection closed".)* |
| **C2** | The tool refuses a `path` outside the resolved repository, and a `repo` that is not inside a git working tree, with a message naming which (R18). |
| **C3** | No write operation. Chronos never commits, checks out, or mutates a repository, and never writes a file inside a working tree — not even an ignored one. It is a reader. |
| **C4** | No email address appears in any response, in any field, including commit bodies (an email inside a body is redacted to `<email>`). Authors are identified by name. *(§7.)* |
| **C5** | Runtime dependencies are the MCP SDK and what it requires. No git library (the `git` executable is the only reader of the repository — R3, R19), no graph library, no shared storage package, and **no dependency on CodeSeeker** (D9). No model, no embedding, no vector store: every edge Chronos returns is declared by git, never inferred (§1). |

---

## 6. Quality gates

Inherited from CodeSeeker's discipline, wired from `gate-template.md` before the first feature. Blocking
gates fail the commit or the CI run; advisory gates warn and feed the ratchet.

| gate | threshold | level |
|---|---|---|
| `tsc --strict`, no explicit `any` | passes | blocking (pre-commit, CI) |
| line coverage | ≥ 80% lines and branches | blocking (CI) |
| mutation score (Stryker, whole `src/`) | ≥ 70% | blocking (CI) — greenfield, no legacy excuse |
| file length / function length / complexity | ≤ 300 lines / ≤ 50 lines / CC ≤ 10 | blocking |
| duplication (jscpd) | < 5% | blocking |
| dead code (knip) | none | advisory → blocking after the fourth feature |
| layer boundaries (dependency-cruiser) | `mcp → application → git`; `git` and `graph` never import `mcp` | blocking |
| secrets (gitleaks) · `npm audit` | none · no high/critical | blocking |
| conventional commits (commitlint) | parses | blocking (commit-msg) |
| TDD order (D11) | a `feat:` touching `src/` is preceded by a `test:[RED]` touching `tests/`, and that test asserts a contract already written (§4.3 envelope, §9 probe) | **blocking** (this build's point) |
| tool surface (`mcp-surface` port) | total under **4,000 characters**; description under 400 | blocking (CI) |
| stdout purity (C1) | a spawned server emits nothing but JSON-RPC on stdout | blocking (CI) |
| contract suite over stdio | every probe in §9 passes against a live server, on the fixture repository | blocking (CI) |
| behavioural oracle | `chronos-bench.js` (21 questions, 3 repositories) answered 21/21 through the built server | blocking (pre-push, local — the repositories are local) |

**The benchmark comes before the heuristic, not after.** No ranking constant exists in this version (R14);
one may only be introduced with a labelled query set and a stated metric first. *(CodeSeeker tuned two
constants on 23 correlated queries and had to say so in its own ADRs.)*

---

## 7. What this must not become

A repository's history is a record of people's work. This specification forbids, as a design constraint
rather than a policy note:

- Any metric presented as individual productivity — commit counts as output, lines as effort, or any
  ranking of people against each other.
- Any response that identifies a person by email address.
- `owners` exists to answer *"who should review this"* and *"who can explain this"*. It ranks
  **familiarity with a path**, and the response says so in those words (R5).

The distinction is not cosmetic. The same counts support both readings, and the only thing that decides
which one a caller acts on is what the tool says it measured.

---

## 8. Decisions

Closed here so the reader does not reopen them. Each becomes an ADR in the Chronos repository on the
first commit that depends on it; the *why* travels with it. **All decisions are closed as of 2026-09-15.**

| | decision | why |
|---|---|---|
| **D1** | TypeScript strict on Node ≥ 20, `@modelcontextprotocol/sdk` over stdio, git as a subprocess. | The gate discipline in §6 is the CodeSeeker toolchain; a second stack means a second harness. Node 18 is end-of-life. |
| **D2** | One tool, four actions, nested parameters. | ADR-0002, measured. |
| **D3** | Graph in memory for the life of the process; nothing persisted. **Confirmed by JC, 2026-09-15.** | R3 measured the build as cheap; a cache adds invalidation, a format and a location to get wrong, and C3 forbids the obvious location. The revisit trigger is a measured one: `build_ms` (R21) routinely exceeding the R3 budget on a real repository. |
| **D4** | Build on first query; extend incrementally; report every refresh. **Confirmed by JC, 2026-09-15.** | CodeSeeker indexes explicitly (its C4) because embedding is expensive. Chronos's index is a `git log`; making the caller ask for it adds a step that buys nothing. The refresh is visible (R12) so the caller never wonders which HEAD it got. |
| **D5** | `owners` = non-merge commit count; ties by recency then name. | The only metric that is both recomputable (R14) and describable as familiarity, not productivity (§7). |
| **D6** | Merges excluded from counts, listed in narratives. | R9. |
| **D7** | **Package `@pragmaworks/chronos`, bin `chronos`, server name `chronos`.** The name is kept despite colliding with Chronicle; R2 carries the disambiguation instead. | *(JC, 2026-09-15.)* Scoped sidesteps the unscoped-name lottery and fits an org that publishes several servers. On the collision: `chronos` and `chronicle` differ by two letters, are loaded together, and both answer "what happened" — renaming now would cost the spec, `chronos-bench.js`, the build prompt and the series title, so the cheaper fix is to make the 400 characters of R2 do the disambiguating, and to record here that it was a choice rather than an oversight. |
| **D8** | **Apache-2.0**, matching CodeSeeker. | *(JC, 2026-09-15.)* The product is the method; the servers are its evidence. One licence conversation across the servers rather than two. Patent grant included, unlike MIT. |
| **D12** | **The repository is public from the first commit.** The README states its status (a tool being built in public from a written specification, not yet adopted). | *(JC, 2026-09-15.)* The devlog series offers the history as its evidence, so the history has to be reachable. Publishing at the end would invite a tidy-up before the push, which destroys exactly what the series is showing. Publishing as it goes is the same principle already in the build prompt: a gate catching a real error is better material than a staged success. **Note the asymmetry: this is the one decision here that is not reversible** — a published history is cached and indexed even if the repository is later removed. |
| **D13** | **The canonical specification moves with the build.** On the first commit, `mcp/chronos/docs/spec.md` becomes the single source of truth; the copy in CodeSeeker is reduced to a one-line pointer, keeping only `chronos-spec-audit-v0.3.md` (which documents CodeSeeker's own benchmark and ADRs) and `praxis-behaviour-axis.md`. | *(JC, 2026-09-15.)* Two live copies drift, and the drift is precisely CodeSeeker ADR-0012: a schema refactor that amended no document left README, install guides, the plugin and the CLI describing a removed API for two releases. The lesson is already paid for; not repeating it is free. |
| **D9** | **Chronos owns its graph.** No shared graph package, no extraction from CodeSeeker, in this version (C5). | Three reasons and a trigger. (a) *The types do not fit:* CodeSeeker's `GraphNode.type` is `file\|class\|function\|method\|variable\|import\|export` and `GraphEdge.type` is `imports\|exports\|calls\|…`; Chronos needs `commit` and `author` nodes and `authored\|touched\|parent` edges. Sharing means widening a published package's unions for a consumer that does not exist yet, or storing commits as untyped `properties` — which discards exactly what a declared graph is for. (b) *The shapes do not fit either:* that interface is async across 15 methods, `projectId`-scoped, with `flush()`/`close()` for SQLite and Neo4j backends; D3 is three in-memory maps for the life of a process. (c) *Extraction needs two working implementations, not one imagined one* — and the second candidate, Praxis, has unbounded volume (its §8.4) against Chronos's small bounded maps, so one abstraction would fit neither. **Revisit at Praxis's evidence gate**, from two implementations that work. |
| **D10** | **Composition happens at the file path, not in shared code.** | CodeSeeker, Chronos and Praxis key on the same node: the repository-relative path, fixed by R10. The composite question — *what imports this, what changes with it, what executes it* — is three traversals the calling model stitches over one key. A shared library would buy coupling the contract already gives for free. |
| **D11** | **Contract first, then red, then green.** The order per feature is: the probe in §9 and the types/envelope in §4.3 — the contract — then a failing test committed as `test:[RED]`, then the implementation as `feat:`. The gate in §6 is blocking. | *(JC, 2026-09-15.)* An executor facing a failing test takes the cheapest path, which is editing production code until it passes; writing the contract before the test is what makes the test's shape non-negotiable. The commit order is also the artefact the devlog reads from. |

---

## 9. Tests as spec — the probes

Each MUST above maps to at least one probe. The contract suite (§6) runs P-01…P-21 against a live server
over stdio on a **fixture repository the tests construct** (deterministic authors and dates; ≥ 3 authors,
a rename, a merge commit touching many files, a co-change pair that never import each other, an untracked
file, a `.mailmap` entry, a commit body with `#12`, `ADR-0002` and an email address). The oracle
(`chronos-bench.js`) runs against the three real repositories locally.

| probe | pins |
|---|---|
| P-01 | one tool named `chronos`; a fifth action is rejected (R1) |
| P-02 | description < 400 chars and contains the words `git` and `instead` (R2) |
| P-03 | server starts and answers with no network, no env vars, in a repository with no toolchain (R3) |
| P-04 | `history` rows newest-first, statuses correct, `total` ≥ rows (R4, R17) |
| P-05 | `owners` carries the metric sentence, counts exclude the merge, tie order follows `last` (R5, R9, R14) |
| P-06 | `cochange` finds the no-import pair; `commits_examined` matches the window; target excluded (R6) |
| P-07 | `why` oldest-first, `refs` contains `#12` and `ADR-0002`; range mode echoes the range (R7) |
| P-08 | rename: the `R` row carries `previous_path`; real-repo variant: `bin/codeseeker.js` → 6 commits, `codemind` present (R8) |
| P-09 | merge listed in `history`/`why` with `merge: true`; envelope carries the merges sentence (R9) |
| P-10 | every path repo-relative with forward slashes, on Windows too (R10) |
| P-11 | `path_state` is `unknown` / `untracked` / `tracked` for the three cases; empty rows, no error (R11) |
| P-12 | commit after first query → next response carries `refreshed`; after a rebase → `reason: "diverged"` (R12) |
| P-13 | response parses as one JSON object with the envelope fields (R13, §4.3) |
| P-14 | `owners` order recomputed from `commits`/`last` equals the returned order (R14) |
| P-15 | `repo` given as a subdirectory resolves to the toplevel (R15) |
| P-16 | `.mailmap` merges the two spellings; a bot author is not filtered (R16) |
| P-17 | `limit` above maximum → clamped and flagged (R17) |
| P-18 | path outside the repo and non-git `repo` → `isError: true` naming which; process still alive (R18, C2) |
| P-19 | a path starting with `-` and a path with a shell metacharacter are answered, not executed (R19) |
| P-20 | shallow fixture → `shallow: true` (R20) |
| P-21 | first query carries `build_ms`; a second query that builds nothing omits it (R21) |
| P-C1 | stdout purity under a full session (C1) |
| P-C3 | the fixture working tree is byte-identical and `git status` empty after every action (C3) |
| P-C4 | no `@` inside an email pattern anywhere in any response, including bodies (C4) |

---

## 10. What was true before this was adopted (the evidence gate, §7 in v0.3, kept as record)

Chronos was **not** approved by the existence of this document. Three conditions had to hold first, and
`scripts/chronos-bench.js` measured them on 2026-09-12:

| condition | result |
|---|---|
| labelled query set | 21 questions, 3 repositories, 21/21 answers confirmed |
| token claim measured, not assumed | **186.6× cheaper** — 10,687 chars against 1,994,407 |
| at least one §1 question unanswerable today | holds: `indexing-service.ts` and `minisearch-text-store.ts` co-change 4× and neither imports the other; CodeSeeker's graph has 13 file neighbours for that file and that one is not among them — it **cannot represent** the relationship |

Two defects in CodeSeeker were found by building the benchmark rather than by reading code: the `history`
plumbing needed rename visibility before R8 was verifiable, and `import type { X } from` produced no graph
edge because the regex captured `type` as the imported name. Both are fixed. If the token claim had failed,
this document would have stayed as the record of why not — a successful outcome for a specification, and
cheaper than a package.

---

## 11. Follow-up — Praxis

The behaviour axis (tests, traces, exceptions over the same file node) is a concept with its own evidence
gate: `praxis-behaviour-axis.md`. Nothing about it starts while Chronos is unfinished, and its gate
requires Chronos adopted and *used* for a month.

---

## 12. References

- CodeSeeker functional specification, `docs/specs/spec.md` — the format and the gates.
- ADR-0002, a single sentinel tool with action routing — and the measurement that justified it:
  `scripts/mcp-surface.js`.
- ADR-0008, import edges are reliable and call edges are approximate — the same honesty is required about
  which history edges are declared and which are inferred.
- ADR-0012, the document cascade — what a change to §4.3 obliges.
- ADR-0014, confidence comes from the raw cosine — the precedent for R14.
- `scripts/chronos-bench.js` — the §10 evidence and the §6 oracle.
- GS gate template, `gs/generative-specification/docs/gate-template.md` — the source of §6.
- Compact Knowledge Graph benchmark, https://github.com/Yarmoluk/ckg-benchmark — the declared-versus-
  inferred result this design rests on.

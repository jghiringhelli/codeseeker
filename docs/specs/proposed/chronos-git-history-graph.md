# Chronos — Functional Specification (proposed)

*Version 0.1 · 2026-09-12 · status: **proposed, not adopted***

A specification for an MCP server that does not exist yet. It is written first so that
implementation derives from it rather than the reverse — and so that the decision *not*
to build it stays cheap.

**Not adopted** means: no code, no package name reserved, no promise. Adoption requires
the evidence in §7 to exist.

---

## 1. Purpose

Chronos answers *why the code is the way it is*, from the repository's own history.

Six MCP servers are in daily use here, and between them they answer where code is
(CodeSeeker), what happened in the session (Chronicle), how it should be built
(Forgecraft), what third-party libraries do (Context7), and what a browser or the web
says (Playwright, Firecrawl). None answers:

- *Why is this written this way?*
- *Who should review this change?*
- *What shipped together with this, and what broke after it?*
- *Is this code load-bearing or vestigial?*

Those answers exist in git. They are unreachable today because reading them means running
`git log -p` and inferring from diffs, which costs thousands of tokens and produces a
guess.

### Why a graph rather than retrieval

This follows the Compact Knowledge Graph result (McCreary/Yarmoluk): a question answered
by traversing **declared** relationships beats the same question answered by inferring
from **retrieved text**, on dependency, multi-hop and aggregate queries — measured at
0.634 vs 0.078 F1 on direct dependency, 0.660 vs 0.201 on multi-hop, and roughly 269
tokens per query against 2,982.

Git history is already a declared graph. A commit *declares* its author, its parent, and
every file it touched. Nothing has to be inferred, embedded, or approximated:

```
author ──authored──▶ commit ──touched──▶ file
                        │
                     parent
                        ▼
                     commit
```

CodeSeeker's graph is the same shape over a different axis — it declares
`file ──imports──▶ file`. The two share the file node, which is why this composes rather
than duplicates: *"who last changed the thing this file depends on"* is one traversal
across both.

---

## 2. Scope

### In scope

- Commits, authors, files, and the edges between them, for one repository.
- Questions answered by traversal: authorship, co-change, churn, ownership, recency.
- Merge commits and renames, because ignoring either makes ownership wrong.
- A sentinel tool surface, one tool, action-routed (CodeSeeker ADR-0002).

### Out of scope

- **Semantic search over commit messages.** That is retrieval, and CodeSeeker already
  does retrieval. If a question needs meaning rather than structure, it is CodeSeeker's.
- **Hosting-platform data** — PR reviews, issues, CI runs. It lives behind an API with
  rate limits and auth, and none of it is needed for the questions in §1. A later version
  may add it; this one is `git` and nothing else.
- **Blame at line granularity.** `git blame` already exists, is fast, and an assistant can
  run it. Chronos answers what blame cannot: aggregates and multi-hop relationships.
- **Any judgement about people.** See §6.

---

## 3. Functional requirements

**R1.** Exactly one tool, named `chronos`, routed by an `action` key, with parameters
nested per action. *(CodeSeeker ADR-0002. The measured reason: a flat schema forces every
parameter to document which actions use it, which cost Forgecraft 12,392 characters of
`"Used by: …"` prose that nesting makes unnecessary.)*

**R2.** The tool description MUST stay under 400 characters and MUST state when to use
`git` directly instead. *(Re-sent on every request. Chronicle's long description earns its
length because it teaches a protocol; this one has nothing non-obvious to teach.)*

**R3.** Building the graph for a repository MUST NOT require network access, an API key,
or a language toolchain. *(Measured: `git log --pretty --name-only` over 331 commits
completes in 122 ms and yields 200 KB. There is no reason for this to be slow or
configured.)*

**R4.** `history` MUST answer, for a file: who has changed it, when, in how many commits,
and under what messages — as declared edges, never as diff text.

**R5.** `owners` MUST rank contributors for a path by a stated, inspectable metric, and
MUST name the metric in the response. *(A number whose definition is hidden is advice
nobody can check. See R14.)*

**R6.** `cochange` MUST answer which files change together with a given file, and how
often, over a bounded window. *(This is the query git makes hardest and that predicts
blast radius better than imports: a config file and the code reading it co-change
constantly and import nothing from each other.)*

**R7.** `why` MUST, for a file or a line range, return the commits that shaped it with
their messages and any referenced issue or ADR — ordered oldest-first, so the reader gets
the narrative rather than the latest patch.

**R8.** Renames MUST be followed. A file's history MUST NOT begin at its current path.
*(`git log --follow`. Without this, ownership of any refactored file is wrong and silently
so.)*

**R9.** Merge commits MUST be attributable but MUST NOT inflate authorship. A merge that
touches 200 files does not make its author the owner of 200 files. The response MUST state
how merges were treated.

**R10.** Every response that names a file MUST use a repository-relative path.
*(CodeSeeker R10, for the same reason: the caller will pass it to a file-reading tool.)*

**R11.** A query about a path that does not exist in history MUST say so and MUST
distinguish it from a path that exists with no commits — the same distinction CodeSeeker
draws between an empty index and a populated index with no match.

**R12.** The graph MUST be rebuildable incrementally from the last indexed commit, and a
query against a stale graph MUST say how far behind it is. *(CodeSeeker proves staleness
rather than guessing at it; the same obligation applies here, and history is easier: the
HEAD sha either matches or it does not.)*

**R13.** A response MUST be traversal output, not prose. The caller is a model that will
compose it; a paragraph costs more and says less than a list of edges.

**R14.** Any ranking MUST be reproducible from the response itself: given the counts
returned, a reader must be able to recompute the order. *(No hidden weights. This is the
lesson from CodeSeeker's `score` field, which turned out not to be a confidence and could
not be made into one because normalisation and additive boosts had destroyed the scale.)*

---

## 4. Hard contracts

| | |
|---|---|
| **C1** | stdout carries JSON-RPC only. Everything else goes to stderr. *(CodeSeeker shipped a release where a progress line on stdout killed live sessions, reported only as "Connection closed".)* |
| **C2** | The tool refuses a path outside the repository, and a repository path that is not a git working tree, with a message naming which. |
| **C3** | No write operation. Chronos never commits, checks out, or mutates a repository. It is a reader. |
| **C4** | No email address appears in any response. Authors are identified by name. *(§6.)* |

---

## 5. Quality gates

Inherited from CodeSeeker's discipline, because the point of this being a GS tool is that
the gates come first:

- Line coverage and mutation score thresholds enforced as hooks, not as intentions.
- A behavioural contract suite that speaks MCP to a live server over stdio, rather than
  calling handlers directly.
- `scripts/mcp-surface.js` run in CI with a budget: the server's total tool surface must
  stay under **4,000 characters**. *(CodeSeeker is 3,142 for five actions. There is no
  excuse for this to be larger.)*
- A labelled query set with a stated metric before any ranking heuristic is tuned. **The
  benchmark comes before the heuristic, not after** — CodeSeeker tuned two constants on 23
  correlated queries and had to say so in its own ADRs.

---

## 6. What this must not become

A repository's history is a record of people's work. This specification forbids, as a
design constraint rather than a policy note:

- Any metric presented as individual productivity — commit counts as output, lines as
  effort, or any ranking of people against each other.
- Any response that identifies a person by email address.
- `owners` exists to answer *"who should review this"* and *"who can explain this"*. It
  ranks **familiarity with a path**, and the response must say so in those words.

The distinction is not cosmetic. The same counts support both readings, and the only thing
that decides which one a caller acts on is what the tool says it measured.

---

## 7. What must be true before this is adopted

This section is the point of writing the spec first. Chronos is **not** approved by the
existence of this document.

1. **A labelled query set exists** — at least 20 questions over at least three real
   repositories, each with an answer confirmed by reading the history, before any
   implementation. CodeSeeker's `graph-bench.js` is the model: each query must have a
   target that traversal can reach and retrieval cannot, verified mechanically.
2. **The token claim is measured, not assumed.** The CKG result is 269 tokens against
   2,982 on a textbook corpus. If answering *"why is this file like this"* through Chronos
   does not beat `git log -p` piped to the model by a wide margin on our own repositories,
   the premise is wrong and this should not be built.
3. **At least one question in §1 is shown to be unanswerable today.** If CodeSeeker plus
   plain `git` already answers all four adequately, this is a tool looking for a problem.

If (2) fails, this document stays as a record of why not. That is a successful outcome for
a specification, and cheaper than a package.

---

## 8. Deliberately deferred

A second candidate — indexing runtime evidence (logs, test output, traces) the same way —
is **not specified here**. It is the more valuable idea and has no measured case behind it
yet. Writing its specification now would produce a document nobody derives from, which is
the failure mode this format exists to prevent.

Chronos is specified first because its evidence is cheap to gather. If the pattern holds,
runtime evidence is the next specification. If it does not, we have learned that for the
cost of one document.

---

## 9. References

- CodeSeeker functional specification, `docs/specs/spec.md` — the format and the gates.
- ADR-0002, a single sentinel tool with action routing — and the measurement that
  justified it: `scripts/mcp-surface.js`.
- ADR-0008, import edges are reliable and call edges are approximate — the same honesty is
  required about which history edges are declared and which are inferred.
- ADR-0014, confidence comes from the raw cosine — the precedent for R14.
- Compact Knowledge Graph benchmark, https://github.com/Yarmoluk/ckg-benchmark — the
  declared-versus-inferred result this design rests on.

# Chronos — Functional Specification (proposed)

*Version 0.3 · 2026-09-13 · status: **proposed — §7 conditions met, adoption not yet decided***

Covers two servers built in series: **Chronos** (§1–§7), the history axis, whose evidence
gate is satisfied; and **Praxis** (§8), the behaviour axis, which is a concept with its own
gate and does not begin until Chronos is adopted and used.

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

**R8.** Renames MUST be followed, **and the rename event MUST appear in the response**. A
file's history MUST NOT begin at its current path, and a caller MUST be able to see that
the path changed.

*Amended in 0.2 after building the benchmark.* Following a rename silently is not enough:
with `--follow --format` alone, the history of `bin/codeseeker.js` never mentions
`bin/codemind.js`, so the caller cannot tell the path changed and cannot ask about the old
one. `--name-status -M` puts the rename in the answer. Without `--follow` at all that file
shows 1 commit instead of 6 — 83% of its history invisible.

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

> **Status 2026-09-12: all three conditions met.** Measured by `scripts/chronos-bench.js`.
> Adoption is now a decision rather than a question — the evidence no longer blocks it.
>
> | condition | result |
> |---|---|
> | §7.1 labelled query set | 21 questions, 3 repositories, 21/21 answers confirmed |
> | §7.2 token claim | **186.6× cheaper** — 10,687 chars against 1,994,407 |
> | §7.3 unanswerable today | holds — see below |
>
> §7.3 is the one that matters most. `indexing-service.ts` and `minisearch-text-store.ts`
> change together four times and neither imports the other, so CodeSeeker's graph does not
> rank that relationship low — it **cannot represent it**. Verified mechanically: 13 file
> neighbours, and that file is not among them. It is not a tuning problem.
>
> Two defects in CodeSeeker were found by building this benchmark rather than by reading
> code: the `history` action had to gain `--name-status -M` before R8 was verifiable
> (amended above), and `import type { X } from` produced no graph edge at all, because the
> regex captured `type` as the imported name. Both are fixed.

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

## 8. Follow-up work — Praxis, the behaviour axis

A second server, to be built **after** Chronos and gated the same way. This section states
the concept well enough to derive from; it is not a specification and does not authorise
implementation. Praxis gets its own document when §8.5 is satisfied, exactly as Chronos
did.

### 8.1 What it answers

CodeSeeker knows a file exists and what it imports. Chronos knows who changed it and what
moved with it. Neither knows whether it *runs*.

- *Is this code actually executed, or only reachable on paper?*
- *Which tests cover this file — by execution, not by filename resemblance?*
- *What fails when I change this, before I change it?*
- *Where does this exception come from, and has it happened before?*

`dead_code` in CodeSeeker already admits the gap: it reports what has no inbound static
reference and has to caveat that reflection, plugin loading and dynamic dispatch make it a
guess. Execution settles it. A file that no test and no production trace ever entered is
dead in a way static analysis cannot assert.

### 8.2 Why it is the same shape

The premise is the one Chronos validated: **traverse declared relationships instead of
inferring from retrieved text.** Runtime artefacts declare relationships as plainly as git
does, and this is the part worth noticing —

| artefact | declares |
|---|---|
| coverage report | `test ──executed──▶ file:line` |
| stack trace | `exception ──raised at──▶ file:line ──called from──▶ file:line` |
| structured log | `event ──emitted by──▶ module` |
| test result | `test ──asserted──▶ outcome` |

A stack frame is not a hint about which file failed; it *states* the file and the line. A
coverage report is not an estimate of which tests touch a file; it is a record of which
ones did. Neither needs embedding, similarity, or a heuristic.

### 8.3 Why it composes rather than duplicates

All three servers key on the same node — a repository-relative file path. That is the
whole design:

```
                    ┌─────────────┐
   CodeSeeker ─────▶│    file     │◀───── Chronos
   (imports,        │             │       (commits,
    symbols)        └─────────────┘        authors,
                           ▲               co-change)
                           │
                        Praxis
                    (tests, traces,
                     exceptions)
```

The question none of the six servers in use today can answer is the one that needs all
three axes at once: *"I am about to change this file. What imports it, what historically
changes with it, and which tests actually execute it?"* Structure, history and behaviour
are three traversals over one node.

That composite is the reason to build Praxis at all. If it turns out the three answers are
better fetched separately and stitched by the model, that is a finding, and §8.5 is where
it surfaces.

### 8.4 What makes this harder than Chronos, stated up front

Chronos was cheap because git is already there. None of this is:

1. **The data has to be produced.** Git history exists whether or not anyone asked for it.
   Coverage, traces and structured logs exist only if the project emits them. A server that
   is useful on three of ten projects is a different proposition from one that works
   everywhere.
2. **Formats are not standard.** LCOV, Istanbul JSON, Cobertura, Go's coverprofile, JUnit
   XML, OpenTelemetry spans. Chronos had one input; this has a matrix, and each parser is a
   place to be wrong in the way the regex parsers were wrong.
3. **Staleness is worse and less visible.** A coverage report is a snapshot of a commit. Git
   history is append-only and its staleness is a sha comparison; a coverage report from last
   week describes code that no longer exists, and nothing about the file says so. Praxis
   MUST refuse or flag a report whose commit does not match, not silently answer from it.
4. **Volume is unbounded.** A repository's history is finite and small — 200 KB for 331
   commits. Production logs are not. Any design that assumes it can read them all is wrong
   before it starts.
5. **Production data carries whatever the application logged.** Traces and logs can contain
   user data, tokens and identifiers. §6's constraint applies with more force here: a tool
   that indexes production telemetry is a tool that can leak it. Redaction is a requirement,
   not a setting.

### 8.5 The evidence gate — what must be true before Praxis is specified

Written now so it cannot be lowered later, and deliberately stricter than §7 because §8.4
says the risk is higher.

1. **Chronos is built, adopted, and used for a month.** Not "works" — *used*. If the
   history axis turns out not to be reached for in practice, the composite in §8.3 is
   speculative and Praxis should not begin.
2. **A labelled query set of at least 20 questions across at least three projects**, built
   before implementation, with answers confirmed from real coverage and trace artefacts —
   not fixtures. The Chronos benchmark is the template.
3. **The token comparison holds at the same order.** Traversal against what an assistant
   reads today, which for this axis is a coverage report or a log file dumped into context.
   Chronos measured 186.6×. If Praxis cannot clear 10×, the premise does not transfer.
4. **At least one question is shown unanswerable by CodeSeeker + Chronos + plain tooling.**
   The Chronos equivalent was co-change: a relationship an import graph cannot represent
   rather than ranks poorly. Praxis needs its own, and *"which tests execute this file"* is
   the candidate — `dead_code`'s own caveat is the argument that it is not answerable today.
5. **Coverage data is obtainable on at least three of the projects without changing how
   they are built.** If it needs a new CI step everywhere, the tool has a distribution
   problem that no retrieval quality fixes.

If (1) fails, this section stays as a record of an idea that did not earn its turn. If (3)
or (4) fails, we have learned that the declared-relationship result does not generalise
beyond history — which is worth knowing and costs one benchmark rather than one package.

### 8.6 Build order

Serial, with the gate between them:

```
Chronos ──build──▶ adopt ──use for a month──▶ §8.5 ──pass──▶ Praxis spec ──▶ build
                                                │
                                              fail
                                                ▼
                                     stays a section in this document
```

Nothing about Praxis starts while Chronos is unfinished. Two half-built servers that each
answer part of a composite question are worth less than one that answers its own well.

---

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

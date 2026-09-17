# Praxis — the behaviour axis (concept, not a specification)

*Extracted verbatim from `chronos-git-history-graph.md` v0.3 §8 on 2026-09-14, so the Chronos
specification stays bounded to Chronos. Status: **concept — gated by §8.5 below. Does not
authorise implementation.** Gets its own specification when §8.5 is satisfied, exactly as Chronos
did with its §7.*

---

## 8. Praxis, the behaviour axis

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

## References

- Chronos specification (the template for the gate and the format): `chronos-git-history-graph.md`.
- CodeSeeker `dead_code` action and its caveat — the argument that "which tests execute this file" is not answerable today.

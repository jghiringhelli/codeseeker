# ADR 0006: A canonical navigational tree for the architectural constitution

- **Status:** Accepted
- **Date:** 2026-09-07

## Context

CLAUDE.md had grown to roughly 10,600 tokens and was loaded in full at the start of
every session, whatever the task. Most of it was irrelevant to any given task, and an
assistant's working context degrades as it fills with irrelevant material.

## Decision

Replace the monolith with a routing tree: a three-line CLAUDE.md pointing at
`.claude/index.md`, which routes by task domain to exactly one node, plus
`.claude/core.md` which is always loaded.

Each node declares its own scope. A session loads the index, core, and one domain node —
roughly 100 lines on average instead of the full corpus.

The tree must carry five categories: architectural identity, standards, constraints and
prohibitions, tool sequencing, and routing. Tool sequencing is the category most often
omitted and the most consequential: a tree that lists tools without stating when to
prefer one over another forces the reader to guess.

## Consequences

Positive: context load is bounded and roughly logarithmic in the size of the corpus.

Negative: a task spanning two domains must name both before loading either, and a task
matching no node must be recognised as a gap rather than silently under-served.

# ADR 0012: The document cascade governs changes to the public surface

- **Status:** Proposed
- **Date:** 2026-09-07

## Context

The v2.0 consolidation to a single sentinel tool (ADR-0002) changed the public MCP tool
schema. No specification, ADR, README section or plugin file was amended in the same
change.

The result was not a documentation lapse but a structural one. For two releases the
README documented three tools that did not exist, the install guides documented eight
that did not exist, the shipped Claude Code plugin instructed the assistant to call a
tool that did not exist — breaking auto-sync for every plugin user — and the CLI's own
installer printed the removed API. Each artifact was individually plausible; nothing in
the process required any of them to agree with the code.

Asked as a specification query — what constraint, had it been present, would have ruled
this out? — the answer is a rule binding a change to an amendment of the layer above it.

## Decision

Adopt the cascade rule: a change is admissible if and only if the layer immediately
above it has been amended to explain it.

Two enforcement surfaces, deliberately redundant:

1. Commit type. Conventional Commits are already required (enforced at commit-msg by
   commitlint). The type declares which upper layer is owed: `feat:` owes a
   specification amendment; `fix:` owes a regression test.

2. Public surface. A change to the MCP tool schema, exported types, or CLI flags
   requires a specification or ADR touch regardless of commit type. This closes the
   loophole the type map alone leaves open, where a behaviour change is smuggled in
   under `chore:` or `refactor:`. It operates on the diff, not on the declared type,
   so the two classifiers can disagree and the disagreement is itself the signal.

Severity follows the brownfield ramp: advisory while the baseline is unclean, blocking
once it is.

## Consequences

Positive: the class of drift that produced the incident becomes structurally
unreachable rather than merely discouraged.

Negative: a genuine one-line fix now carries an amendment obligation. This is the
intended cost — the documents are the artifact the tool is derived from, and keeping
them true is the work, not an overhead on the work.

Status is Proposed rather than Accepted: the commit-type surface is enforced, the
public-surface rule is not yet implemented.

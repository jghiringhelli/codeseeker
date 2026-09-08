# Use case: understand a change's blast radius

**Actor.** An AI assistant about to modify a file, needing to know what depends on it.

**Requirements.** R3, R8, R14, R16.

## Main flow

1. The assistant calls `graph({seed:"<project-relative path>", dir:"in"})` — incoming
   edges answer "who depends on this".
2. CodeSeeker resolves the project through the shared resolver (R3), loads the graph, and
   matches the seed against node paths.
3. It traverses to the configured depth and returns nodes and edges, with graph
   statistics and an explicit statement of the analysis's limitations (R16).

## Observable outcome

The assistant edits with the callers in view, or reports that the change is contained.

## Variations

- **The actor knows a concept, not a file.** `graph({q:"authentication middleware"})`
  locates the seeds semantically first.
- **Outgoing edges.** `dir:"out"` answers "what does this depend on".
- **Cross-file chains.** `depth: 2` finds them, at the cost of scope leaks on broad
  queries, so it is off by default (ADR-0011).

## Failure modes

| Condition | Required behaviour |
|---|---|
| Seed matches no node | Error carrying the indexed file count, suggestions scored against the seed, and a sample labelled as a sample (R19) |
| Project not indexed | Error naming the init call — never a working-directory fallback (R3) |

## What must never happen

Presenting a regex-derived call edge as though it were AST-derived. Import edges are
exact; call edges miss dynamic dispatch, callbacks and event handlers. Every response
carries that caveat (ADR-0008).

Silently truncating the candidate list. A previous version returned the first 15 file
nodes with no total, so a complete 500-file index looked like it was missing files and a
user spent effort on a defect that did not exist (issue #3).

## Known gap

R14 — that graph coverage matches the search corpus — holds for TypeScript and is
unverified elsewhere. A user reported files that `search` returned but `graph` could not
reach, on a flat CommonJS project. Tracked as issue #5(a).

Until that is settled, this use case is specified but not fully verified.

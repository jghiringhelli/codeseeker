# Use case: index a project

**Actor.** A developer, or an AI assistant acting for them, on a codebase CodeSeeker has
never seen.

**Requirements.** R11, R12, R15; contracts C4, C5.

## Main flow

1. The actor calls `index({op:"init", path:"<absolute project root>"})`.
2. CodeSeeker validates the path, refusing system and credential directories (C5).
3. It registers the project and returns immediately with `status: "indexing_started"` —
   indexing runs in the background (R11).
4. The actor polls `index({op:"status"})` until `indexing_status` is `completed`.
5. The response reports files indexed, chunks created, graph nodes and edges, and
   duration.

## Observable outcome

A subsequent `search` against the project returns ranked results rather than an
unindexed error.

## Variations

- **Monorepo.** A pnpm, yarn or lerna project keeps all source under `packages/`. That
  directory must be indexed, not excluded (R12). The failure this guards against is
  silent: zero files indexed, success reported (ADR-0010).
- **Noisy project.** Build output, vendored code or a Unity `Library/` folder inflate the
  index and pollute duplicate detection. The actor excludes them with
  `index({op:"exclude", exclude_op:"exclude", paths:[...]})` and reindexes; the
  exclusions persist across reindexes (R15).
- **Already indexed.** `init` on a known project rebuilds it from scratch.

## Failure modes

| Condition | Required behaviour |
|---|---|
| Path does not exist | Error naming the path |
| Path is a system or credential directory | Refusal naming the directory (C5) |
| Path contains `..` | Refusal — path traversal |
| No path given | Error stating the parameter is required |

## What must never happen

A query against an unindexed project must not trigger indexing (C4). It returns an error
naming the fix. Indexing a large repository inside a tool call would block the assistant
for minutes, with no way to cancel and no way to know why it was waiting.

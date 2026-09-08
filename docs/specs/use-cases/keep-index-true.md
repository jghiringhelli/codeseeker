# Use case: keep the index true after an edit

**Actor.** An AI assistant that has just edited, created or deleted a file.

**Requirements.** R13, R15.

## Main flow

1. The assistant calls
   `index({op:"sync", changes:[{type:"modified", path:"src/foo.ts"}]})`.
2. CodeSeeker re-chunks and re-embeds that file, and rebuilds its graph nodes.
3. Subsequent searches reflect the new content.

For `{type:"deleted"}`, the file's chunks and graph nodes are removed, and no subsequent
`search` or `graph` returns it (R13).

## Observable outcome

The index and the working tree agree. A search never returns a file that no longer
exists, and never misses one that does.

## Variations

- **Many files at once.** After `git pull`, `checkout`, `merge`, `rebase` or a stash
  apply, `full_reindex: true` rebuilds rather than enumerating every change.
- **With the Claude Code plugin.** Hooks issue the sync call after each Edit or Write,
  and a full reindex after a git operation.
- **Without the plugin.** The assistant must call sync itself. Nothing detects staleness,
  so an unsynced index goes quietly wrong rather than failing.

## Failure modes

| Condition | Required behaviour |
|---|---|
| Path is not in the index | Treat as `created`; do not error |
| Deleted file still reachable afterwards | **Defect.** R13 is violated |

## Known gap — this use case has no test

This is the weakest point in the specification, and it is stated here rather than left to
be discovered.

A user reported that files deleted from disk continued to appear in graph output, and
that re-running sync with an explicit `deleted` entry did not change it.

Investigation confirmed the deletion primitive works: a direct call to `deleteFile()`
removed a file's nodes — 3 file-level nodes, 24 entries in total, down to zero. So the
defect is not in deletion but in how `sync` routes a `deleted` change to it. The likely
cause is a path-form mismatch: `deleteByFilePaths` compares the supplied path against an
absolute `filePath` and a project-relative `relativePath`, and a caller passing the wrong
form matches neither.

Tracked as issue #5(b). Until a test exists for this flow, R13 is an obligation the
project states but does not verify — which is the distinction this document exists to
keep visible.

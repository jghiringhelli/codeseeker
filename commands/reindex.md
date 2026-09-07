# Reindex Project

Trigger a full reindex of the project after major changes.

## What this does:
1. Re-scans all project files
2. Regenerates vector embeddings and RAPTOR directory summaries
3. Rebuilds the knowledge graph
4. Regenerates coding-standards detection

## When to use:
- After pulling major changes from git or switching branches
- After bulk file operations
- When graph results reference files that no longer exist

## Instructions for Claude:

CodeSeeker exposes a **single** MCP tool, `mcp__codeseeker__codeseeker`, routed by `action`.

1. Trigger the reindex:
   ```json
   {
     "action": "index",
     "project": "<absolute path of the project root>",
     "index": { "op": "sync", "full_reindex": true }
   }
   ```

2. Indexing runs in the background. Poll until it reports `completed`:
   ```json
   { "action": "index", "index": { "op": "status" } }
   ```

3. Report files indexed, chunks created, and graph nodes/edges.

For an incremental update of specific files, prefer `op: "sync"` with explicit changes —
it is far cheaper than a full reindex:
```json
{
  "action": "index",
  "project": "<root>",
  "index": { "op": "sync", "changes": [{ "type": "modified", "path": "src/foo.ts" }] }
}
```

Note: a full reindex takes 30 s to several minutes depending on project size.

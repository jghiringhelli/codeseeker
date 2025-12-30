# Reindex Project

Trigger a full reindex of the project after major changes.

## What this does:
1. Re-scans all project files
2. Regenerates vector embeddings
3. Rebuilds the knowledge graph
4. Updates coding standards detection

## When to use:
- After pulling major changes from git
- After switching branches
- After bulk file operations
- When search results seem stale

## Instructions for Claude:

Use the CodeMind MCP tool to trigger reindex:

1. Call `notify_file_changes` MCP tool with:
   - project: current working directory
   - full_reindex: true

2. Report the reindex status and any errors

If MCP tools are not available, run:
```bash
codemind init --force
```

Note: Full reindex may take a few minutes for large projects.
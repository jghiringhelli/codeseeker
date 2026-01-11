# CodeSeeker Project Indexing Skill

This skill ensures the project is properly indexed for semantic search.

## When to use this skill:
- When CodeSeeker MCP tools return empty results
- When semantic search seems incomplete
- After major git operations (pull, merge, checkout)
- When `.codeseeker/` directory doesn't exist

## How to check indexing status:

1. Check if `.codeseeker/` directory exists
2. Check if `.codeseeker/project.json` has recent timestamps
3. Try a simple search - if no results, reindex may be needed

## How to trigger indexing:

### For initial setup:
```bash
codeseeker init
```

### For reindexing after changes:
Use MCP tool:
```
notify_file_changes(project: ".", full_reindex: true)
```

Or CLI:
```bash
codeseeker init --force
```

## Automatic file change notification:

When you modify files during a session, notify CodeSeeker:
```
notify_file_changes(
  project: ".",
  changes: [
    { type: "modified", path: "src/auth.ts" },
    { type: "created", path: "src/new-file.ts" }
  ]
)
```

This keeps the index current without full reindexing.

## Benefits:
- Always have up-to-date search results
- Coding standards reflect latest patterns
- Knowledge graph includes recent changes
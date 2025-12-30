# Semantic Search

Search the codebase using semantic understanding to find relevant code.

## Arguments:
- `$ARGUMENTS` - The search query (natural language or code snippet)

## What this does:
1. Uses hybrid search (vector + text + path matching)
2. Returns semantically relevant files and code snippets
3. Shows relationships between found code

## Instructions for Claude:

Use the CodeMind MCP tools to search:

1. First, ensure the project is indexed by checking if `.codemind/` exists
2. Use the `search_code` MCP tool with the query: "$ARGUMENTS"
3. Present the results showing:
   - File paths with relevance scores
   - Code snippets from matching files
   - Related files and dependencies

If MCP tools are not available, fall back to CLI:
```bash
codemind search "$ARGUMENTS"
```

Present the search results in a clear, organized format.
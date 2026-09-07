# Semantic Search

Search the codebase using semantic understanding to find relevant code.

## Arguments:
- `$ARGUMENTS` - The search query (natural language or code snippet)

## What this does:
1. Hybrid retrieval: BM25 + vector embeddings fused with Reciprocal Rank Fusion
2. RAPTOR directory summaries surface for abstract queries
3. Graph expansion adds structurally connected files

## Instructions for Claude:

CodeSeeker exposes a **single** MCP tool, `mcp__codeseeker__codeseeker`, routed by `action`.

1. Call it with:
   ```json
   {
     "action": "search",
     "project": "<absolute path of the project root>",
     "search": { "q": "$ARGUMENTS", "limit": 10 }
   }
   ```
   Always pass `project` — the MCP server cannot detect the working directory.

2. Optional refinements:
   - `search.type`: `"hybrid"` (default), `"fts"` (pure BM25), `"vector"` (pure embeddings)
   - `search.full: true` to include a snippet per result (default returns summaries only)
   - `search.exists: true` for a quick yes/no check

3. If the response says the project is not indexed, run `/codeseeker:init` first.

4. Present results as file paths with scores. Paths are project-relative — pass them
   straight to Read.

If MCP tools are not available, fall back to the CLI:
```bash
codeseeker -c "$ARGUMENTS"
```

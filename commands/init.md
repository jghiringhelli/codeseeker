# Initialize CodeSeeker for this project

Build the semantic index and knowledge graph for the current project.

## What this does:
1. Scans and chunks all source files, creating 384-dim vector embeddings
2. Builds a knowledge graph of imports, calls, and inheritance
3. Generates RAPTOR directory summaries
4. Detects coding standards from existing patterns
5. Registers the project so later calls can resolve it by name or path

## Instructions for Claude:

CodeSeeker does **not** index on first search — the project must be initialized once.

1. Start indexing via the MCP tool:
   ```json
   {
     "action": "index",
     "index": { "op": "init", "path": "<absolute path of the project root>" }
   }
   ```

2. Indexing runs in the background. Poll until `indexing_status` is `completed`:
   ```json
   { "action": "index", "index": { "op": "status" } }
   ```

3. Report files indexed, chunks created, graph nodes and edges, and whether coding
   standards were detected.

4. If large generated directories were indexed (build output, vendored code, Unity
   `Library/`), exclude them and reindex:
   ```json
   {
     "action": "index",
     "project": "<root>",
     "index": { "op": "exclude", "exclude_op": "exclude", "paths": ["dist/**"], "reason": "build output" }
   }
   ```

If MCP tools are not available, run the CLI instead:
```bash
npm install -g codeseeker   # if not already installed
codeseeker init
```

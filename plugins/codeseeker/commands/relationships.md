# Explore Code Relationships

Explore dependencies and relationships for a file or code pattern.

## Arguments:
- `$ARGUMENTS` - File path or search query to explore relationships for

## What this does:
1. Traverses the knowledge graph built from AST-parsed imports
2. Shows import/export chains, class hierarchies, call relationships
3. Follows edges in either direction

## Instructions for Claude:

CodeSeeker exposes a **single** MCP tool, `mcp__codeseeker__codeseeker`, routed by `action`.

1. If `$ARGUMENTS` looks like a file path, seed the traversal with it:
   ```json
   {
     "action": "graph",
     "project": "<absolute path of the project root>",
     "graph": { "seed": "$ARGUMENTS", "depth": 1, "dir": "both", "max": 50 }
   }
   ```

2. If `$ARGUMENTS` is a search term, let CodeSeeker find the seeds semantically:
   ```json
   {
     "action": "graph",
     "project": "<absolute path of the project root>",
     "graph": { "q": "$ARGUMENTS", "depth": 1 }
   }
   ```

3. Useful options:
   - `graph.depth`: 1–3. Depth 2 finds cross-file chains but leaks scope on broad queries.
   - `graph.rel`: filter edge types — `imports`, `exports`, `calls`, `extends`,
     `implements`, `contains`, `uses`, `depends_on`
   - `graph.dir`: `"in"` (who depends on this), `"out"` (what this depends on), `"both"`

4. To look up a single symbol rather than traverse from a file, use `action: "sym"`:
   ```json
   { "action": "sym", "project": "<root>", "sym": { "name": "UserService" } }
   ```

5. Present the result as a dependency tree: what imports this, what this imports,
   related classes and functions.

**Note on accuracy:** import edges are static and reliable; call edges use regex
heuristics, so dynamic dispatch, callbacks, and event handlers are not detected.

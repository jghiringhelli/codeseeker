# Get File Context

Read a file together with the code that is semantically and structurally related to it.

## Arguments:
- `$ARGUMENTS` - File path to get context for

## What this does:
1. Reads the file itself
2. Finds semantically similar code elsewhere in the project
3. Shows what the file imports and what imports it

## Instructions for Claude:

CodeSeeker has no single "read file with context" action — compose it from two calls
plus a normal Read. That is deliberate: the file content comes from Read, so it is never
duplicated into the tool response.

1. Read the file directly with the Read tool: `$ARGUMENTS`

2. Find structurally related files via the knowledge graph:
   ```json
   {
     "action": "graph",
     "project": "<absolute path of the project root>",
     "graph": { "seed": "$ARGUMENTS", "depth": 1, "dir": "both" }
   }
   ```

3. Find semantically similar code, using the file's purpose as the query:
   ```json
   {
     "action": "search",
     "project": "<absolute path of the project root>",
     "search": { "q": "<what the file does, in a few words>", "limit": 5 }
   }
   ```

4. Summarise: what the file is, what it depends on, what depends on it, and which other
   files solve a similar problem.

Use this before making a non-trivial change, so the edit accounts for callers.

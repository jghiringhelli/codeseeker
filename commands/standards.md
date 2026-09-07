# Get Coding Standards

Retrieve the coding patterns CodeSeeker auto-detected from this project.

## Arguments:
- `$ARGUMENTS` - Optional category filter: `validation`, `error-handling`, `logging`, `testing`, or `all`

## What this does:
1. Returns patterns detected by scanning the indexed codebase
2. Shows each preferred pattern with usage count and confidence
3. Lists alternatives with a recommendation

## Instructions for Claude:

CodeSeeker exposes a **single** MCP tool, `mcp__codeseeker__codeseeker`, routed by `action`.

1. Call it with:
   ```json
   {
     "action": "analyze",
     "project": "<absolute path of the project root>",
     "analyze": { "kind": "standards", "category": "$ARGUMENTS" }
   }
   ```
   Use `"all"` when no category is given. `project` is required for every `analyze` call.

2. Present, per category: the preferred pattern, its usage count and confidence, the
   import statement, and any alternatives.

3. Apply these when writing new code so it matches existing conventions instead of
   introducing a new style.

**Caveat:** standards are derived from indexed chunks, which include Markdown and test
fixtures. Treat a pattern whose cited files are documentation rather than source as weak
evidence, and say so rather than adopting it.

If MCP tools are not available, read the generated file directly:
```bash
cat .codeseeker/coding-standards.json
```

# CodeSeeker Semantic Context Skill

Use CodeSeeker to understand code by meaning and structure, not just text.

## When to use this skill
- Exploring unfamiliar code
- Modifying existing code that other files may depend on
- Understanding how components connect
- Debugging an issue that spans files

## The tool surface

CodeSeeker exposes exactly **one** MCP tool — `mcp__codeseeker__codeseeker` — routed by
an `action` key. Fill only the nested parameter group matching the action.

| action | Group | Use for |
|---|---|---|
| `search` | `search:{q,type?,limit?,full?,exists?}` | "How does X work?", "where is pattern Y?" |
| `sym` | `sym:{name,full?}` | Jump to a named class or function |
| `graph` | `graph:{seed\|q,depth?,rel?,dir?}` | "What imports this?", dependency chains |
| `analyze` | `analyze:{kind,...}` | duplicates, dead_code, standards |
| `index` | `index:{op,...}` | init, sync, status, parsers, exclude |

**Always pass `project`** with the absolute project root — the MCP server cannot detect
the working directory, and without it searches may hit the wrong index.

## When NOT to use CodeSeeker

Prefer the native tools when you already know what you are looking for:
- You know the exact string → Grep
- You know the file path → Read
- Literals: UUIDs, error codes, magic numbers → Grep

CodeSeeker earns its cost on conceptual and relational questions, not exact-match lookups.

## Example workflow

User asks: *"Update the authentication middleware"*

1. Find the relevant code by meaning:
   ```json
   {"action":"search","project":"/abs/root","search":{"q":"authentication middleware"}}
   ```

2. Read the top result with the Read tool (CodeSeeker returns summaries, not content,
   unless you pass `search.full: true`).

3. Find out who depends on it before editing:
   ```json
   {"action":"graph","project":"/abs/root","graph":{"seed":"src/middleware/auth.ts","dir":"in"}}
   ```

4. Make the change, then keep the index current:
   ```json
   {"action":"index","project":"/abs/root",
    "index":{"op":"sync","changes":[{"type":"modified","path":"src/middleware/auth.ts"}]}}
   ```

## Benefits
- Find code by meaning when you do not know the identifier
- See the blast radius of a change before making it
- Avoid breaking dependent code

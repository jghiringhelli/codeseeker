# MCP Tool — Usage Reference

## Sentinel Schema
Single entry point. Fill only the nested group that matches `action`.

```
codeseeker({ action, project, search?|sym?|graph?|analyze?|index? })
```

| action | Nested group | Key params |
|---|---|---|
| `search` | `search:{q,...}` | `q`, `type?`(hybrid/fts/vector), `exists?`, `full?`, `limit?` |
| `sym` | `sym:{name,...}` | `name`, `full?` |
| `graph` | `graph:{seed,...}` | `seed`\|`q`, `depth?`(1-3), `rel?`, `dir?`, `max?` |
| `analyze` | `analyze:{kind,...}` | `kind`(duplicates/dead_code/standards), `threshold?`, `category?` |
| `index` | `index:{op,...}` | `op`(init/sync/status/parsers/exclude) |

## Always Pass `project`
MCP cannot detect cwd. Pass workspace root path every call or searches hit wrong index.

## When to Use CodeSeeker vs. Native Tools
**Use CodeSeeker when the query is conceptual or relational:**
- "How does auth work?" / "Where is X pattern?" → `search`
- "What imports UserService?" → `graph`
- "Find symbol UserService" → `sym`

**Use grep/glob/Read when:**
- You know the exact string or file path
- Searching for literals (UUIDs, error codes, magic numbers)

## Keep Index Current
After any Edit/Write: `codeseeker({action:"index", project:"...", index:{op:"sync", changes:[{type:"modified",path:"src/foo.ts"}]}})`

## Exclude Build Artifacts
`codeseeker({action:"index", project:"...", index:{op:"exclude", exclude_op:"exclude", paths:["dist/**","build/**"], reason:"..."}})`

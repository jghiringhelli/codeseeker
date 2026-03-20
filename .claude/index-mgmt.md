# Index Management

## Init (full index)
`codeseeker({action:"index", index:{op:"init", path:"/abs/path/to/project", name:"optional-name"}})`
Runs background: scanning → AST chunking → embeddings → graph → RAPTOR L2/L3.
Check progress: `codeseeker({action:"index", index:{op:"status"}})`.

## Sync (incremental)
After editing files:
`codeseeker({action:"index", project:"...", index:{op:"sync", changes:[{type:"modified"|"created"|"deleted", path:"rel/path"}]}})`
`full_reindex:true` forces complete rebuild.

## Exclude Patterns
Exclude: `index:{op:"exclude", exclude_op:"exclude", paths:["dist/**","*.generated.ts"], reason:"..."}`
List:    `index:{op:"exclude", exclude_op:"list"}`
Include: `index:{op:"exclude", exclude_op:"include", paths:[...]}`
Exclusions saved to `.codeseeker/exclusions.json`. Respected on next full reindex.

## Staleness
Index goes stale when files change without a sync call.
Rule: every Edit/Write tool call must be followed by a sync call.
If results seem wrong, run full `op:"init"` to rebuild from scratch.

## AST Chunking
`src/cli/services/search/ast-chunker.ts` — regex boundary chunker, 80-line max.
Produces `symbolName`, `symbolType` metadata used by symbol-name boost in search.

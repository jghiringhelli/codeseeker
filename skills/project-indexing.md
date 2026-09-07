# CodeSeeker Project Indexing Skill

Keep the CodeSeeker index accurate so search and graph results stay trustworthy.

## The index is not automatic

CodeSeeker does **not** index on first use. A project must be initialized once, and the
index must be kept in sync afterwards, or results will silently reflect stale code.

## First-time setup

```json
{"action":"index","index":{"op":"init","path":"<absolute project root>"}}
```

Indexing runs in the background. Poll until `indexing_status` is `completed`:

```json
{"action":"index","index":{"op":"status"}}
```

## After changing files

Incremental sync is much cheaper than a full reindex. Send only what changed:

```json
{"action":"index","project":"<root>",
 "index":{"op":"sync","changes":[
   {"type":"modified","path":"src/auth.ts"},
   {"type":"created","path":"src/new-file.ts"},
   {"type":"deleted","path":"src/old-file.ts"}
 ]}}
```

Rule of thumb: every Edit or Write should be followed by a sync for that path. The plugin
hooks do this automatically; call it yourself when working without them.

## After git operations

Pull, checkout, merge, rebase, reset and stash apply can change many files at once. Rebuild:

```json
{"action":"index","project":"<root>","index":{"op":"sync","full_reindex":true}}
```

## Excluding noise

Build output, vendored code and generated files pollute both search and duplicate
detection. Exclude them, then reindex:

```json
{"action":"index","project":"<root>",
 "index":{"op":"exclude","exclude_op":"exclude",
          "paths":["dist/**","Library/**","*.generated.cs"],"reason":"build artifacts"}}
```

Exclusions persist in `.codeseeker/exclusions.json` and apply on the next full reindex.
List them with `exclude_op: "list"`, undo with `exclude_op: "include"`.

## Symptoms of a stale index
- `graph` reports files that were deleted
- `search` misses a file you know exists
- Results reference symbols that were renamed

All three are fixed by a `full_reindex`.

# CodeSeeker v2.0 — Technical Architecture

> **Updated**: 2026-03-22 — v2.0.0 (replaces the pre-refactor 2025 description)

This document is the technical manual for developers contributing to CodeSeeker and anyone who wants to understand how the system actually works at the code level. For a user-facing overview see the [main README](../../README.md).

---

## System Overview

CodeSeeker is an **MCP server** that exposes exactly **one tool** — `codeseeker` — to AI assistants. It pre-indexes codebases into a local SQLite store and answers semantic queries without any network calls or external services.

```
Your codebase  →  Index (once, ~1–5 min)  →  .codeseeker/ (SQLite)
                                                      ↑
AI assistant  →  MCP protocol  →  codeseeker({action,...})  →  Results
```

All inference runs locally via ONNX (Xenova `all-MiniLM-L6-v2`, 384 dims). No Claude API calls. No external services in embedded mode.

---

## Layer Map

```
src/mcp/              ← MCP server, sentinel tool, indexing, analysis handlers
src/cli/commands/     ← Search orchestration, workflow
src/cli/services/     ← data/ analysis/ search/ monitoring/ integration/
src/storage/          ← embedded/ (SQLite+MiniSearch+graphology)
                         server/  (Postgres+pgvector+Neo4j, optional)
```

---

## The MCP Sentinel Tool

**File**: `src/mcp/mcp-server.ts` → `registerSentinelTool()`

### Design principle

One tool. One routing key. No per-action tool proliferation.

```
Description shown to Claude:
  "Code intelligence: search (q), symbol lookup (sym), graph traversal (graph),
   analysis (analyze), index management (index)."
```

This is intentionally the **minimum viable description** — a wayfinder, not instructions. Claude's own judgment determines when to call CodeSeeker vs. native grep/Read. The short description keeps the tool from being invoked for tasks where grep is more appropriate (exact string search, known file path).

### Schema

```typescript
codeseeker({
  action:   'search' | 'sym' | 'graph' | 'analyze' | 'index',
  project:  string,          // workspace root — required every call (MCP has no cwd)

  // Fill only the group matching action:
  search?:  { q, type?:'hybrid'|'fts'|'vector', exists?:bool, full?:bool, limit?:number },
  sym?:     { name, full?:bool },
  graph?:   { seed?, q?, depth?:1-3, rel?:EdgeType[], dir?:'in'|'out'|'both', max?:number },
  analyze?: { kind:'duplicates'|'dead_code'|'standards', threshold?, category? },
  index?:   { op:'init'|'sync'|'status'|'parsers'|'exclude', path?, changes?, ... },
})
```

### When Claude uses each action

| Action | Triggers on | Examples |
|--------|-------------|---------|
| `search` | Conceptual/semantic queries | "How does auth work?", "Where is error handling?" |
| `sym` | Named symbol lookup | "Find UserService", "Where is validateEmail defined?" |
| `graph` | Dependency/import traversal | "What imports this file?", "Show the dependency tree" |
| `analyze` | Explicit cleanup/audit tasks | "Find duplicate code", "What's unused?", "What are our conventions?" |
| `index` | First use (auto), after file edits | Triggered by plugin hooks after every Claude edit |

### Output contract

- **Default**: summaries only — `{ file, sig, similarity }` — no file content
- **Full mode** (`full: true`): adds `content` snippet
- **Exists mode** (`exists: true`): returns `{ found, count, top_file }` for quick yes/no
- All `file` paths are **relative to project root** — pass directly to Read/View without modification

---

## Indexing Pipeline

**File**: `src/mcp/indexing-service.ts`

### Phase 1 — File scanning

`IndexingService.indexProject()` calls `ConfigurableExclusionFilter` which reads:
- `src/cli/services/monitoring/file-scanning/file-scanner-config.json` (copied to `dist/` by build)
- `.codeseeker/exclusions.json` (per-project dynamic exclusions)

Default excluded: `node_modules`, `dist`, `build`, `.git`, `coverage`, `.codeseeker`. Binary files and files > 500KB are skipped. **`packages/` is NOT excluded** (v2.0 fix — was silently dropping all source in pnpm/yarn monorepos).

### Phase 2 — AST chunking

**File**: `src/cli/services/data/chunking/`

Files are split into semantic chunks, not fixed line windows:

| Language | Parser | Notes |
|----------|--------|-------|
| TypeScript / JavaScript | Babel AST | Functions, classes, methods each become a chunk |
| Python, Java | Tree-sitter (auto-installed on demand) | Same granularity |
| C# | Regex extraction | Good for class/method boundaries |
| Go, Rust, Ruby, PHP, 60+ more | Regex | Basic — function-level only |

Each chunk preserves surrounding class context so embeddings capture "method of X class" not just the method body. Target chunk size: 100–400 tokens.

### Phase 3 — Embedding + BM25 index

Each chunk → `EmbeddingGeneratorAdapter` → `@huggingface/transformers` running `Xenova/all-MiniLM-L6-v2` as **q8-quantized** ONNX → 384-dim float32 vector → stored in SQLite (`codeseeker_chunks` table).

The quantization is load-bearing, not an implementation detail. The same model at fp32 produces vectors that differ by up to 1.03e-2 — enough to shift ranking against any index built at q8, and it would not error, only degrade. Every index is stamped with `model@dtype/dimensions` and a search against a mismatched stamp is refused (`src/mcp/embedding-identity.ts`). Before changing the model, the dtype or the package, run `node scripts/embedding-fingerprint.js --compare reports/embedding/baseline.json`.

Simultaneously, chunk text → MiniSearch BM25 index with camelCase tokenisation (`UserService` → tokens `user`, `service`). Both stored in the embedded SQLite file under `.codeseeker/`.

### Phase 4 — Knowledge graph

**File**: `src/cli/services/data/semantic-graph/`

AST imports parsed into directed edges. Stored in graphology (in-memory directed multigraph), persisted to SQLite:

| Edge type | Source → Target | How detected |
|-----------|----------------|--------------|
| `IMPORTS` | FILE → FILE | `import ... from '...'` resolved to absolute path |
| `DEPENDS_ON` | FILE → FILE | Relative imports (`./ ../`) — stronger signal |
| `CONTAINS` | FILE → CLASS/FUNCTION/INTERFACE | Class/function definitions in file |
| `EXTENDS` | CLASS → CLASS | `extends` clause |
| `IMPLEMENTS` | CLASS → INTERFACE | `implements` clause |

**Call edges** (`CALLS`) are approximate (regex-based for non-TS languages). Import edges are reliable; call edges should not be trusted for dead-code analysis.

Measured average connectivity (v2.0 benchmarks): **20.8 file→file edges per node** on both TS and C# real codebases.

### Phase 5 — RAPTOR summaries

**File**: `src/cli/services/search/raptor-indexing-service.ts`

For each directory, all file embeddings in that directory are **mean-pooled** into one 384-dim summary vector. These directory-summary nodes are stored in the same `codeseeker_chunks` table with path prefix `__raptor__/<dir>`. No separate index, no extra queries at search time.

On incremental sync: a structural hash (file list + mtime) and cosine drift check determine whether regeneration is needed. Most edits to single files don't change the directory summary enough to trigger regeneration.

---

## Search Pipeline

**File**: `src/cli/commands/services/semantic-search-orchestrator.ts`

Entry point: `performSemanticSearch(query, projectPath, searchType='hybrid')`

### Stage 1 — Hybrid retrieval

```typescript
vectorStore.searchHybrid(query, queryEmbedding, projectId, limit=30)
```

Two searches run in parallel inside SQLite:
- **Vector**: cosine similarity on `queryEmbedding` vs all stored chunk vectors
- **BM25**: MiniSearch full-text search on tokenized query

Fused with **Reciprocal Rank Fusion**:
```
combined_score(doc) = Σ  1 / (60 + rank_i)   for each ranked list i
```

RRF constants: vector weight 0.50, FTS weight 0.50, path-match bonus 2× on path-matched results. Returns 30 raw results including any `__raptor__` nodes that ranked.

### Stage 2 — RAPTOR cascade filter

```typescript
applyCascadeFilter(rawResults, projectPath): SemanticResult[] | null
```

Checks raw results for `__raptor__` nodes:
1. Extract L2 directory-summary nodes (metadata `raptorLevel=2`)
2. If best L2 score ≥ `l2Threshold` (default **0.5**):
   - Collect `raptorDir` metadata from qualifying nodes
   - Filter raw results to files whose paths start with those dirs
3. Fallback to full results if:
   - No L2 nodes found
   - Best L2 score < 0.5
   - Filtered set has < `cascadeMinResults` (default **3**) files
   - Top filtered file scores < `cascadeTopScore` (default **0.25**)
4. Cascade confidence check uses **raw** (pre-boost) score — symbol-name boost must not inflate cascade confidence

Measured contribution: **+0.3% MRR** on symbol lookup queries. Primary value is on abstract queries ("what does the payments module do?") where directory summaries score strongly and prevent results from scattering across the whole codebase.

### Stage 3 — processRawResults()

```typescript
processRawResults(rawResults, projectPath): SemanticResult[]
```

Applied to whichever set survives Stage 2:

```
1. Filter out __raptor__ nodes (summary nodes, not real files)
2. Dedup by file: keep highest-scoring chunk per file
3. Symbol-name boost: +0.20 (additive) if any query token (>2 chars)
     appears in metadata.symbolName, functions[], classes[], or filename
4. Source-file type boost: +0.10 for .ts .js .py .cs .go .java .rs .cpp etc.
5. Test-file penalty: -0.15 for *.test.* *.spec.* __tests__/ test/ *_test.*
6. Doc/config penalty: -0.05 for .md .yaml .yml .lock .json (config) .txt
7. Multi-chunk boost: up to +0.30 if file had multiple chunks scoring ≥ 0.15
     formula: min((qualifying_count - 1) * 0.10, 0.30)
8. Sort by final score descending
9. Return top-15 files
```

Why additive (not multiplicative) symbol-name boost: multiplicative boost fails when the score gap exceeds the boost factor. `0.65 × 1.2 = 0.78` still loses to a competitor at `0.80`. Additive `0.65 + 0.20 = 0.85` guarantees the boosted file wins against any competitor with base score ≤ `0.64`. See ADR-004.

### Stage 4 — Graph expansion

```typescript
expandWithGraphNeighbors(results, projectPath, depth=graphExpansionDepth)
```

Runs after processRawResults for `hybrid` and `graph` search types (depth=0 disables):

1. Load all file-type graph nodes for this project (`graphStore.findNodes(projectId, 'file')`)
2. Build `filePath → nodeId` map (indexed by both absolute and relative path)
3. **1-hop**: for each of top-10 results, call `graphStore.getNeighbors(nodeId)`, collect file-type neighbors not already in results
4. Score: each neighbor gets `max(source_scores_pointing_to_it) × 0.7`, minimum 0.05
5. **2-hop** (if `depth=2`, off by default): for each 1-hop neighbor, collect their file neighbors not already in 1-hop set. Score: `hop1_score × 0.7`, minimum 0.04
6. Append scored neighbors to result list, re-sort

**Per-source scoring** (v2.0): neighbors inherit the score of their strongest pointing file rather than the worst result's score. A file imported by a high-scoring orchestrator gets a meaningful graph score.

**2-hop disabled by default**: ablation showed scope leaks on out-of-scope queries (bcrypt/CSS queries got code infrastructure files via 2-hop). Enable via `orch.setGraphExpansionDepth(2)`.

Measured ranking impact: **±0% MRR** for 1-hop. Graph expansion does not improve ranked retrieval because semantic search already finds the right files — graph neighbors are usually already in the top-15. Its value is structural context: dependency chains that embeddings can't encode.

---

## Symbol Lookup (`action: 'sym'`)

**File**: `src/mcp/mcp-server.ts` → `handleSymbolLookup()`

Uses the symbol metadata index populated during AST chunking. Each chunk stores extracted `functions[]`, `classes[]`, `interfaces[]` arrays. Symbol lookup searches these arrays directly (exact + prefix match) rather than going through the embedding pipeline.

`full: true` adds resolved relationships: what this symbol imports, what imports it (via graph edges).

---

## Graph Traversal (`action: 'graph'`)

**File**: `src/mcp/mcp-server.ts` → `handleShowDependencies()`

Two seed modes:
- `seed: "src/auth/jwt.ts"` — direct node lookup, no semantic search
- `q: "JWT refresh logic"` — semantic search to find seed files, then traverse

Traversal parameters:
- `depth`: 1–3 hops (default 1)
- `rel`: filter by edge type (`imports`, `exports`, `calls`, `extends`, `implements`, `contains`, `uses`, `depends_on`)
- `dir: 'in'` — what depends on this seed (reverse traversal)
- `dir: 'out'` — what this seed depends on (forward traversal)
- `dir: 'both'` — full neighborhood
- `max`: cap output at N nodes (default 50)

Returns a structured dependency map with node types, edge labels, and file paths. Not a ranked list — a graph snapshot.

---

## Analysis Tools

**File**: `src/cli/commands/analyze-command-handler.ts`

### Dead code (`kind: 'dead_code'`)

Traverses the knowledge graph to find:

**Unreferenced symbols** — class or function nodes with zero inbound `CALLS`/`IMPORTS`/`CONTAINS` edges from other nodes in the project. Confidence tiers:
- 85% — private/internal, no callers found
- 60% — public, unexported, no static callers found

Exempt: exported symbols (may be used by external packages), entry-point filenames (`main`, `index`, `app`, `server`, `cli`, `run`).

**Orphaned files** — file nodes with zero inbound import edges. Same entry-point exemption applies.

**Always check `graph_limitations[]` in the response.** Dynamic dispatch, callbacks, event handlers, and plugin systems are invisible to static import analysis. Call edges for non-TS languages are regex-approximated.

### Duplicates (`kind: 'duplicates'`)

Pairwise cosine similarity on all chunk embeddings (limited to chunks with ≥ `min_lines` lines, default 5). Thresholds:
- ≥ 0.98 — very likely exact copy or trivial rename
- 0.85–0.97 — structural duplicate (same logic, different variable names)
- 0.80–0.84 — semantic duplicate (similar intent)

Advisory only. High similarity ≠ identical intent. Always review before consolidating.

### Standards (`kind: 'standards'`)

Reads `.codeseeker/coding-standards.json`, auto-generated during full reindex by scanning for recurring patterns. Categories: `validation`, `error-handling`, `logging`, `testing`, `react-patterns`, `state-management`, `api-patterns`. Claude uses this before writing new code to match existing project conventions.

---

## Storage

**Embedded mode** (default): everything in `.codeseeker/<project-id>/`
- `vectors.db` — SQLite: chunk embeddings, BM25 index, RAPTOR nodes, graph edges
- `projects.db` — SQLite: project registry
- `coding-standards.json` — detected patterns
- `exclusions.json` — per-project exclusion rules

**Server mode** (large teams, shared indexes): Postgres + pgvector (vectors), Neo4j (graph). Set `CODESEEKER_STORAGE_MODE=server`. See `docs/technical/storage.md`.

---

## CNT Wayfinder (for CodeSeeker contributors)

`CLAUDE.md` is 3 lines pointing to `.claude/index.md`. That file is a routing table mapping task domain to one `.claude/*.md` file. Instead of loading the full doc set every session, Claude loads ~100 tokens (index + core + one domain node). O(log N) context load vs the previous 10,600-token monolith. See ADR-006.

---

## Benchmark Harness

**File**: `scripts/real-bench.js`

Runs full production indexing on real codebases and measures ranking quality:
```bash
npm run build
node scripts/real-bench.js
```

Four ablation modes per project: no-graph, graph-1hop, graph-2hop, no-RAPTOR. Outputs MRR/P@1/P@3/R@5/F1@3 per mode. See `tests/relevance/` for the unit-level relevance fixtures.

---

## Key Invariants (enforced by convention and tests)

1. **Single MCP tool** — `codeseeker` with `action` routing key. Never add a second top-level tool.
2. **Summaries by default** — `full:false` is the default. File content only on `full:true`.
3. **Relative paths** — all result `file` fields are relative to project root.
4. **Index sync after edits** — every file edit must be followed by `action:'index', op:'sync'`.
5. **No API calls** — all AI inference via local ONNX or Claude CLI subprocess. No `fetch()` to Claude API.
6. **SOLID** — one reason to change per class, constructor injection, depend on interfaces. See `.claude/dev.md`.

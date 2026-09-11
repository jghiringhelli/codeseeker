# Changelog

All notable changes to CodeSeeker will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2026-09-10

The release where the graph became real. Four parsers were advertised and never wired,
most import edges were silently dropped, and every AST-derived symbol was recorded at line
1. Each of those was reproduced and measured before it was fixed, on the same application
implemented four times — RealWorld Conduit in Python, JavaScript, TypeScript and C# — so a
difference between them is language handling and not task difficulty.

Mean reciprocal rank over 30 labelled queries: TypeScript 83.3%, Python 81.5%,
JavaScript 77.1%, C# 70.6%.

### Added

- **`search` now reports a `confidence` of `high`, `low` or `unknown`.** Search returns the
  closest files it has whether or not any are relevant: ask a Conduit backend about
  Kubernetes and it answers with a JWT generator, at a reported score of 100.0%. That score
  cannot warn anyone — an FTS-only hit is normalised against the best score in its own
  result set, and the ranking boosts saturate at the 1.0 cap, so its answerable and
  unanswerable distributions overlap by 42.3 points. The raw cosine behind it overlaps by
  1.3 and was already carried on every result, consumed by nothing. Below 0.34 the response
  also explains that the files are the closest available rather than necessarily relevant.
  Nothing is suppressed: with a 1.3-point overlap a filter would silently discard real
  answers, trading a visible failure for an invisible one. (spec R23, ADR-0014)
- **An unindexed project indexes itself.** Every action used to stop with "run
  `index({op:"init"})` first" — a round trip and a decision for something with one sensible
  answer. An embedder mismatch is still refused rather than auto-rebuilt: that discards
  minutes of work and is a decision, not a default (R22).
- **A stale index says so, with proof.** Files move or are deleted and search keeps
  returning them, so a caller reads a path that is not there and cannot tell why. A
  timestamp would be a guess; a returned file that no longer exists is proof, and checking
  the handful of paths already in hand costs nothing. `stale_index` names them and the sync
  call.
- **C# is parsed with Tree-sitter.** `tree-sitter-c-sharp` was already a dependency and was
  never wired. The regex parser it replaces reported, for one 60-line MediatR handler,
  `Delete[Handle, RestException, RestException]` — inventing two methods from `throw new
  RestException(...)`, attributing `Handle` to the wrong type, and missing the
  `QueryHandler` class and `Command` record entirely. `RestException` appeared as a callable
  in 18 files of that corpus; not one declares it. Across 84 files: classes 81 → 137,
  callables 265 → 117, and the graph-quality heuristic flags 0.0% of them rather than 1.5%.
- **Two new measurement gates.** `scripts/parser-health.js` asserts in a fresh process that
  every parser advertised as AST-backed actually produces one — it caught the Java import
  bug below on its first run, and is now a CI gate. `scripts/graph-bench.js` asks whether
  search can reach a file the query does not name: every query has a target that is
  *lexically silent*, verified mechanically each run.
- **The C# RealWorld corpus**, and labelled retrieval queries for Python, JavaScript and
  C#. Ranking quality used to be scored on 18 queries across two TypeScript/C# codebases;
  it is now 30 across four languages, plus 10 structural queries in the graph benchmark.

### Fixed

- **Import edges, the backbone of the graph, were mostly missing.** The resolver decided
  whether a specifier already carried an extension with `path.extname`, which for
  `../../models/http-exception.model` returns `.model` — so it never appended `.ts`, never
  matched the file, and never created the edge. That is the dominant naming convention in
  TypeScript backends (`*.service.ts`, `*.model.ts`, `*.controller.ts`), so an entire
  ecosystem of projects had almost none. `article.service.ts` declares six imports and
  produced one: the only specifier without a dot in its name. Now 209 edges where there
  were 173 on that corpus.
- **Four parsers were advertised and never used.** Babel was absent from the extension map,
  so TypeScript and JavaScript — 541 of 543 files in this repository — fell through to
  regex while the README promised "Babel AST | Excellent". `PythonParser` carried a header
  reading "using Tree-sitter" above a body reading `TODO: Implement tree-sitter`. Java was
  regex too, and its imports were **never extracted at all**: the grammar gives
  `import_declaration` no `name` field, so the lookup returned null for every import ever
  written. Wiring them moved callable nodes on this repository from 2,808 to 7,254 while
  the share the quality heuristic flags fell from 14.5% to 1.6%.
- **Every AST-derived symbol was recorded at line 1**, under a comment reading "Line info
  not available from parser". So `sym` pointed at the top of the file for every TypeScript,
  Python, Java and C# symbol — and wiring the real parsers made it worse, because the regex
  fallback they replaced did compute a line. Parsers now report `symbolLines`. On the Django
  corpus: 163 of 163 symbols at line 1 → 0 of 112.
- **Python reported every method twice.** `descendantsOfType` reaches into class bodies, so
  each method was collected as a method *and* as a top-level function, and the indexer built
  a node for each — `Profile.follow` and `follow`, same file, same line. 51 of 117 function
  nodes on the Django corpus.
- **A neighbour could outrank a direct hit.** Graph expansion gave a neighbour 0.7 of its
  source's score and re-sorted the whole list, so a neighbour of the top hit displaced a
  genuine match. Worse, the project-root node — stored as a file node whose path *is* the
  project root — was returned as `{file: ""}`, something no caller can open, and acted as a
  hub connecting every file to every other. With real import edges and that hub removed,
  expansion now adds recall at no cost to precision: R@10 85.0% → 90.0% with R@5 unchanged
  at 80.0%, finding both lexically-silent targets instead of one. (ADR-0011)
- **A file named after the query counted as much as a file declaring it.** Both earned the
  same +0.20, which is how a 14-line `routes.ts` outranked the controller declaring all
  eleven endpoints, and how a README outranked the `auth.service.ts` it describes. A
  declaration keeps +0.20; a filename-only match drops to +0.12. Over 23 queries at the
  time: MRR 66.3% → 80.4%, P@1 43.5% → 65.2%, R@5 95.7% → 100%. (ADR-0013)
- **Chunks were named after control-flow keywords.** `switch (action.type) {` matches the
  method-boundary pattern, so chunks were called `switch` and `if` — and since those names
  now feed the ranking boost, a query containing "switch" would promote every reducer in a
  project. Removing those boundaries was measured and is far worse (MRR 80.4% → 67.0%):
  they are real topic boundaries even though they name nothing. Split there, leave the chunk
  unnamed.
- **Anonymous declarations yielded no symbol at all.** `export default (state, action) =>`
  and `router.get('/articles', handler)` declare no name, so 19 of 39 Express files and 11
  of 38 React files contributed nothing — including a 244-line controller holding an entire
  REST surface. Both have a name in practice: the module, and the string literal labelling
  the call.
- **Tree-sitter could degrade to regex silently.** Initialisation was fired from a
  constructor and never awaited, so a parse arriving first took the fallback without saying
  so; and a binding can load, accept `setLanguage`, and still return a tree with no root.
  Both now decide once, loudly, and `usingAst()` lets a caller ask which path it is on.
- **Python kept only the first name of each import.** `childForFieldName` returns one child
  of a multi-valued field, so `from rest_framework import generics, mixins, status` produced
  one import. Over the Django corpus: 107 imports with 5 malformed names → 120 with none.
- **The chunker ignored `.mjs`, `.cjs`, `.mts` and `.cts`** — the same extension drift that
  once hid those files from the graph — and matched neither `async def` nor a Python method
  at any indent but exactly four spaces.

### Changed

- **The tool description now says which action answers which question, and when to use
  `grep` or `read` instead.** It previously listed action names only, which gives a caller
  no basis to choose. It stays within the 400-character cap ADR-0002 sets, because it is
  re-sent on every request; per-action guidance lives on each parameter group.

### Measurement notes

- `scripts/real-bench.js` is not perfectly reproducible: one run reported 77.2% MRR where
  the same code gave 80.4% on two runs either side. Differences of about two points should
  be read as noise; the larger ones here (13 and 18 points) are well clear of it.
- Two directions were tried, measured, and rejected rather than shipped. Feeding the
  parsers' declarations into the chunker raised chunks carrying a symbol from 57% to 78%
  and *lowered* MRR from 80.4% to 78.3% — the declaration boost works because it is
  selective, and chunk shape dominates chunk labels. Ranking graph neighbours strictly below
  every direct hit reached R@5 80.0% but dropped R@10 to 85.0% and failed seven curated
  assertions. Both are recorded in the ADRs so the directions are closed rather than
  rediscovered.
- Four high-severity advisories remain in the dependency tree, all without an upstream fix.
  `sharp` and `adm-zip` arrive through `@huggingface/transformers`, the embedding runtime,
  in its image-decoding path — which CodeSeeker never enters, because it embeds text. The
  same tree shipped in 2.0.2.
- Go is still regex, and is marked `wired: false` honestly. No Go corpus exists to measure a
  parser against, and shipping one unmeasured is the mistake this release spent its time
  undoing.

## [2.0.2] - 2026-09-09

The release that makes a fresh install work. Every item below was reproduced before it
was fixed, and the install journey that measures the whole sequence went from 5/10 on
2.0.1 to 10/10 here.

### Fixed

- **The MCP connection could die mid-session, reported only as "Connection closed".**
  stdout is the JSON-RPC channel, and the coding-standards generator — which runs at the
  end of every index — printed two progress lines to it. That desynchronises a client's
  parser and a strict client hangs up. `Logger` was worse: it wrote every message at
  every level to `console.log`, so any log line anywhere in the tree could kill a live
  session; it simply had not fired yet. The logger now writes to stderr, and
  `startMcpServer` redirects console.log/info/warn/debug to stderr for the life of the
  process, which covers the 319 `console.log` calls in MCP-reachable code and any added
  later. The SDK transport writes to `process.stdout` directly, so the protocol is
  unaffected.
- **`sym` and `graph` reported "Project not indexed" for projects `search` resolved
  fine.** Each carried a private copy of project resolution that fell back to
  `process.cwd()` — an MCP server's working directory belongs to its launcher. All three
  now use one resolver, extracted to `src/mcp/project-resolver.ts`. (#2)
- **A search against an unindexed project answered "No results. Try different terms"**,
  telling the user their code lacked what they asked for when the truth was that nothing
  had been indexed. It now says so and names the fix.
- **A fully indexed project could be declared unindexed.** The check searched for the
  literal token "test" and read zero hits as proof of absence. The RealWorld Django
  corpus has 156 embedded chunks and no occurrence of that word, so every query against a
  working index was rejected. Replaced with a chunk count.
- **`.mjs` and `.cjs` files were searchable but invisible to `graph`.** Three separate
  extension lists disagreed; the one gating graph-node creation omitted them. Consolidated
  to one `CODE_EXTENSIONS` constant, adding `.mts` and `.cts`. Measured across seven
  corpora: 4 files in CodeSeeker, 14 in a 1,746-file monorepo. (#5)
- **A graph seed that matched nothing listed 15 files with no total**, so a complete
  500-file index looked like it was missing files. The error now carries
  `indexed_file_count`, suggestions scored against the seed, and a sample labelled as a
  sample. The project-root node no longer leaks into file listings as an empty string. (#3)
- **Coding standards were derived from documentation and test fixtures.** All seven
  detectors now filter to source files. On this repository: 6 non-source files cited as
  evidence before, 0 after.
- **`index({op:"parsers"})` advertised Tree-sitter support for nine languages the graph
  builder does not consume.** Each entry now carries a `wired` flag and the unwired ones
  are demoted from "excellent" to "basic".
- **`npm test` never terminated.** The e2e helpers set `CODESEEKER_MOCK_CLAUDE` but
  nothing read it, so every query spawned the real `claude` binary; and `shell: true` on
  Windows left orphaned processes that held stdio open. Both fixed; the suite is now the
  gate at ~11s, with e2e on demand.

### Changed

- **Embeddings run on `@huggingface/transformers`.** `@xenova/transformers` is frozen at
  2.17.2 and will never be patched. Pinned to `dtype: 'q8'` because the new package
  defaults to fp32, which produces vectors differing by up to 1.03e-2 from every existing
  index — enough to shift ranking, and it degrades rather than fails. Verified
  bit-identical: **no user needs to reindex.**
- **Indexes are stamped with the embedder that built them**, and a search against a
  mismatched stamp is refused with both identities named. Unstamped indexes are accepted,
  since they were built by the same embedder still in use.
- **Licence is Apache-2.0**, replacing PolyForm Small Business. Free for any use,
  commercial included, with an explicit patent grant.
- Server version is read from package.json instead of a hardcoded constant that had
  already drifted.

### Added

- `scripts/install-journey.js` — ten timed steps measuring what a new user experiences,
  from handshake to a useful answer.
- `scripts/corpus-bench.js` — index/graph/search integrity over seven real projects
  spanning JavaScript, TypeScript and Python, 41 to 1,746 files.
- `scripts/mcp-stdout-purity.js` — drives a full index through a live server and asserts
  stdout carried protocol only.
- `scripts/embedding-fingerprint.js` — deterministic vector fingerprint, to be compared
  before and after any change to the model, dtype or package.
- Behavioural contract suite against a live server over stdio (18 contracts).
- A written specification: `docs/specs/spec.md`, `domain.md`, `architecture.md` and use
  cases, plus twelve ADRs as individual files.
- Quality gates with a brownfield ramp, commit hooks, commitlint, and mutation testing.

## [2.0.1] - 2026-03-23

### Fixed
- **Test-bridged 2-hop graph expansion**: cross-file chains like `prompt-builder.test.ts → prompt-builder.ts → orchestrator.ts` are now recovered. When a test file ranks in the top-10 and its 1-hop graph neighbor is a non-test source file, that source file is expanded one further hop. Targeted fix — avoids the scope leaks that occur with unrestricted depth=2 expansion.

### Changed
- Extracted `isTestFile` logic into a reusable private class method (previously a local closure in `processRawResults`; now shared with `expandWithGraphNeighbors`)

## [2.0.0] - 2026-03-23

Major release fixing a critical monorepo indexing bug (MRR 10% → 72% on pnpm workspaces), adding measured scoring improvements, enabling graph expansion in default hybrid mode, and shipping a real-index ablation benchmark. All 711 unit/integration tests passing.

### Fixed

- **Monorepo support: remove `packages/` from default excluded directories** — For pnpm/yarn/lerna monorepos where all source lives under `packages/`, the directory was silently excluded by both `file-scanner-config.json` and a hardcode in `indexing-service.ts`. Effect: MRR 10% → 72% on the Conclave TS monorepo benchmark. This is the single highest-impact fix in this release.
- **`pathMatch` hardcoded `false`** in `sqlite-vector-store.ts` — path-match boost was never firing. Now correctly detects query tokens in file paths.
- **Sort invariant in `expandWithGraphResults`** — graph neighbors were appended without re-sorting, violating descending similarity order when neighbor score exceeded the lowest result.
- **MCP tools API drift** — `mcp-tools-integration.test.ts` was testing a 5-arg `handleSearch` signature against the current 6-arg API; updated all calls plus missing `handleSearchAndRead`/`handleReadWithContext` shims. 52/52 passing.
- **e2e fixture EPERM** — removed binary `.fastembed_cache` directory from ContractMaster test fixture that locked on Windows.

### Changed

- **Graph expansion now runs in default hybrid mode** — previously only fired for explicit `search_type='graph'`. Default `graphExpansionDepth=1`; set to 0 to disable, 2 for 2-hop cross-file chains (disabled by default due to scope leaks).
- **Per-source graph scoring** — graph neighbors now inherit `max(source_score) × 0.7` rather than `worstResult × 0.7`. A neighbor of a high-scoring file gets a proportional score; multiple pointing sources take the max.
- **Graph expansion from top-10** (was top-5) — captures neighbors of rank-6 through rank-10 files.
- **`setGraphExpansionDepth(depth)`** public method for tuning/ablation experiments.
- **Multi-chunk boost quality gate** — chunks must score ≥ 0.15 to count toward the multi-chunk boost (cap 0.30). Prevents lock files and generated files from accumulating large boosts via many low-score chunks.

### Added

- **Source-file type boost (+0.10)** for `.ts`, `.js`, `.py`, `.cs`, `.go`, etc.
- **Test-file penalty (−0.15)** for files matching `*.test.*`, `*.spec.*`, `__tests__/`.
- **Doc/config penalty (−0.05)** for `.md`, `.yaml`, `.lock`, `.json` config files.
- **Real-index benchmark harness** (`scripts/real-bench.js`) — runs full production indexing pipeline on real codebases (Conclave TS, ImperialCommander2 C#) and measures MRR/P@1/P@3/R@5/F1@3 per ablation mode. Reproduces in ~10 minutes: `npm run build && node scripts/real-bench.js`.
- **`file-scanner-config.json` copy step** in `npm run build` — JSON config is no longer silently dropped by `tsc`.
- **ADR-009** (type boost/penalty rationale), **ADR-010** (packages dir removal), **ADR-011** (graph expansion ablation methodology).
- **Search quality research section** in README — 4-mode ablation table, per-layer analysis, pipeline diagram, known limitations.

### Benchmark results (v2.0.0, n=18 queries, 2 real codebases)

| Configuration | MRR | P@1 | R@5 |
|---|---|---|---|
| BM25 + embed + RAPTOR (no graph) | **75.2%** | 61.1% | 91.7% |
| + graph 1-hop | 74.9% | 61.1% | 91.7% |
| No RAPTOR control | 74.9% | 61.1% | 91.7% |

RAPTOR contributes +0.3% MRR on symbol queries; its primary value is on abstract/package-level queries not represented in this benchmark. Graph is neutral on ranking but essential for dependency analysis.

---

## [1.11.2] - 2026-03-03

### Fixed

- **Chocolatey: pin `nodejs-lts` dependency to Node 22 LTS (`[22.0.0, 23.0.0)`)** to ensure prebuilt binaries for `better-sqlite3` and `tree-sitter` are available. Node 24, while now LTS, does not yet have prebuilt native addon binaries, causing `npm install` to time out during Chocolatey package verification.
- **Chocolatey: increase `npm install` timeout** from 300 s to 600 s as a safety net for slow network conditions.
- **GitHub Actions: fix plugin branch sync** — `git merge master` → `git merge origin/master` so the step works correctly in detached-HEAD (tag) checkout context.

---

## [1.11.1] - 2026-03-03

### Fixed

- **`resetStorageManager()` double-close guard** (`src/storage/storage-manager.ts`):
  The singleton reference is now always nulled inside a `try/finally` block, even when
  `closeAll()` throws a "connection not open" error. This prevented the test runner
  (and any sequential programmatic init/reset cycle) from obtaining a fresh instance
  after the first suite had already torn down its SQLite connection.

### Internal

- **Multi-language search accuracy benchmark** — Suite 2 added to
  `tests/benchmarks/search-accuracy.benchmark.ts` covering TypeScript (JWT middleware,
  generic repository, EventBus), Python (async repository, Pydantic schema, auth decorator)
  and Go (HTTP handler, goroutine worker pool). 10 curated ground-truth queries (8 language-
  specific + 2 cross-language) lock in R@5 = 1.0 and MRR = 1.0 for FTS / hybrid / graph
  across all paradigms. Combined benchmark: **104 tests**, baseline persisted in
  `tests/benchmarks/multilang-baseline.json`. Any future change that drops recall by > 0.15
  on any (query × mode) cell will fail the CI gate automatically.
- Graph-mode sort-order assertion scoped to FTS / hybrid only; Graph RAG hop-expansion
  produces non-monotone similarity sequences by design.

## [1.11.0] - 2026-03-03

### Added

- **Real `search_type` routing** (`src/cli/commands/services/semantic-search-orchestrator.ts`):
  The `search_type` parameter advertised by the MCP `search` tool now actually controls the search
  algorithm instead of being silently ignored.
  - `'vector'` → pure embedding cosine-similarity search via `searchByVector()`, no BM25 or path scoring
  - `'fts'` → pure MiniSearch BM25 text search via `searchByText()`, no vector similarity
  - `'hybrid'` → unchanged: vector + BM25 + path-match fused with RRF (default)
  - `'graph'` → hybrid results followed by 1-hop Graph RAG expansion (see below)

- **Graph RAG expansion** (`expandWithGraphNeighbors`):
  When `search_type='graph'`, CodeSeeker now performs hybrid search and then follows code-relationship
  edges in the knowledge graph to surface structurally connected files the vector index might miss.
  - Loads all `file` nodes for the project, builds an in-memory `filePath → nodeId` map
  - For each of the top-5 vector hits, calls `getNeighbors()` to find 1-hop related files via
    `imports`, `calls`, `extends`, `implements`, and other graph edge types
  - Neighbor files not already in the result set are appended at a discounted score
    (30% below the lowest-ranked vector result, minimum 0.05)
  - Fully graceful: if the graph store is empty or unavailable, returns the hybrid results unchanged

- **Shared `processRawResults()` helper**: All three search paths (`vector`, `fts`, `hybrid`) now
  use a single deduplication + multi-chunk-boost + SemanticResult mapping pipeline, eliminating
  code duplication and ensuring consistent scoring behaviour across modes.

- **Graph store wired into orchestrator**: `StorageManager.getGraphStore()` is now called during
  `initStorage()` so the knowledge graph is available for search expansion without a separate
  initialisation step.

### Changed

- `performSemanticSearch(query, projectPath)` → `performSemanticSearch(query, projectPath, searchType?)`;
  `searchType` defaults to `'hybrid'` — fully backward-compatible.
- `mcp-server.ts`: `search_type` parameter is now forwarded to `performSemanticSearch` instead of
  being used only as a cache-key discriminator.

## [1.10.0] - 2026-03-02

### Added

- **RAPTOR hierarchical indexing** (`src/cli/services/search/raptor-indexing-service.ts`):
  Exploits the natural class → file → directory → project hierarchy of source code to generate
  *directory summary nodes* (L2) and a *project root node* (L3) embedded directly in the vector store.
  - L2 nodes are created by mean-pooling all chunk embeddings within a directory — no extra LLM calls
  - L3 node is the mean of all L2 embeddings, representing the entire project
  - Both levels live in the same vector pool as file chunks and surface automatically:
    abstract queries ("what does the auth package do?") find L2/L3 nodes; concrete queries
    ("find JWT refresh logic") find precise chunks as before
  - Incremental drift detection on every `sync`: **structural hash** pre-filter (O(n log n))
    + **cosine distance** against pooled child-file embeddings skips regeneration when drift < 5%
  - New `phase: 'raptor'` in `IndexingProgress` type; RAPTOR runs as a non-blocking phase after graph
  - Results surface with `type: 'directory-summary'` or `type: 'root-summary'` for traceability

- **RAPTOR smoke test** (`scripts/test-raptor.mjs`): 25 unit assertions covering IDs, mean pooling,
  cosine similarity, drift threshold, structural hashing, directory grouping, and path helpers

- **Storage interface additions** (`IVectorStore`):
  - `getById(id)` — single document fetch for drift comparison
  - `getFileEmbeddings(projectId, filePaths)` — batch chunk embedding fetch for mean-pooling
  - `getFilePathsForDir(projectId, dirPath)` — directory-scoped file enumeration
  - `deleteByFilePathPrefix(projectId, prefix)` — prefix purge for clean reindex
  - Implemented in both `SQLiteVectorStore` and `PostgresVectorStore`

### Changed

- **Search RRF weights**: Removed `PATH_WEIGHT` as a separate dimension (was 15% flat bonus
  added *after* RRF, which corrupted rankings). Path signal is properly captured inside
  `MiniSearch` via `boost: { filePath: 2 }` — the right place. Weights are now 50% vector
  / 50% text, eliminating the double-counting and rank corruption.

- **RAPTOR-aware deduplication in search orchestrator**: RAPTOR nodes bypass the multi-chunk
  score-boost logic (which is meaningless for synthetic nodes) and are rendered with a
  descriptive type rather than a file-based type.

## [1.9.0] - 2026-03-01

### Changed

- **MCP tool consolidation**: Reduced from 12 tools to 3 unified tools (`search`, `analyze`, `index`)
  - Old tools (`search_code`, `find_and_read`, `get_code_relationships`, `get_file_context`,
    `get_coding_standards`, `find_duplicates`, `find_dead_code`, `index_project`,
    `notify_file_changes`, `manage_index`, `list_projects`) are replaced by action-dispatched tools
  - **`search`** dispatches to query mode, read+search mode, or filepath mode via `query`/`filepath`/`read` params
  - **`analyze`** dispatches via `action`: `dependencies`, `duplicates`, `dead_code`, `standards`
  - **`index`** dispatches via `action`: `init`, `sync`, `status`, `parsers`, `exclude`
  - Reduces tool-list cognitive load for AI assistants; each tool covers a complete functional area

### Added

- **Integration test suite** (`tests/mcp/mcp-tools-integration.test.ts`): 52 new tests covering all 12
  private MCP handlers via mock-seeded SQLite+Graphology storage without downloading embeddings
  - Full coverage of `search`, `analyze`, and `index` tool routing
  - Error path tests (missing params, unknown projects, nonexistent files, security validation)
  - Exclusion lifecycle tests (add → list → remove pattern)

- **MCP smoke-test script** (`scripts/smoke-test-mcp.js`): 16-point end-to-end sanity check
  against built `dist/` output; supports `--quick` flag to skip heavy indexing

### Fixed

- **`mcp-server.test.ts` describe labels**: Updated all describe blocks to use new tool/action
  naming conventions (`index (status action)`, `search simulation`, etc.)
- **`postinstall.test.ts` tool name references**: Aligned with consolidated 3-tool API
  (e.g. `search({query})`, `analyze({action: "dependencies", filepath})`)

## [1.8.2] - 2026-02-19

### Fixed

- **find_duplicates MCP tool**: Fixed undefined error when no duplicates found
- **find_dead_code MCP tool**: Fixed undefined error when no dead code found
- **Chocolatey automated testing**: Made npm install fully non-interactive
  - Set `CI=true` and npm config environment variables
  - Added `--no-progress --no-fund --no-audit` flags
- **Dead code removal**: Removed unused analyzeDuplicateCode function

## [1.8.1] - 2026-02-18

### Fixed

- **Chocolatey install hang**: Improved non-interactive detection in postinstall script
  - Added additional Chocolatey environment variable checks
  - Added stdout.isTTY check to prevent hangs during moderation tests

## [1.8.0] - 2026-02-16

### Added

- **find_duplicates MCP tool**: Detect duplicate code patterns across your codebase
  - Uses semantic similarity and hash comparison
  - Returns similarity scores, file paths, and line numbers
  - Configurable similarity threshold

- **find_dead_code MCP tool**: Identify unused code through knowledge graph analysis
  - Detects orphan functions/classes with no incoming references
  - Identifies god classes with too many methods
  - Returns file paths, line numbers, and confidence scores

- **MCP Registry support**: CodeSeeker now listed in the official MCP Registry
  - Added `mcpName` field to package.json
  - Created server.json manifest for registry publishing
  - Automated publishing via GitHub Actions release workflow

- **GitHub Actions release workflow**: Automated publishing on version tags
  - Publishes to npm, Homebrew, Chocolatey, Snap, and MCP Registry
  - Creates GitHub Release with installation instructions

### Fixed

- **Project auto-detection**: Fixed bug where CodeSeeker would search wrong index when multiple projects are indexed
  - Now requires explicit `project` parameter when multiple projects exist
  - Returns clear error message listing available projects
  - Single-project scenarios still work with auto-detection

### Changed

- **Snap confinement**: Changed from classic to strict confinement
  - Uses `home`, `network`, `removable-media` plugs
  - More secure sandbox model

## [1.7.1] - 2026-01-20

### Added

- **npm postinstall script**: Automatically configures AI assistant instruction files on package install
  - Searches for user-level agent instruction files (~/.claude/CLAUDE.md, ~/.cursor/rules, etc.)
  - Prompts for permission before modifying files (skips in CI/non-interactive mode)
  - Falls back to suggesting `codeseeker init` if user declines
  - Supports: Claude, Cursor, Copilot, Windsurf, Gemini, Grok, Cody, and more

### Changed

- **Renamed CodeMind → CodeSeeker** in all root documentation files
  - CODESEEKER.md, CONTRIBUTING.md, SECURITY.md, PROMOTION.md
  - deploy/scripts/README.md, deploy/kubernetes/README.md
  - Environment variables now use `CODESEEKER_` prefix in docs

### Fixed

- Postinstall script handles non-interactive environments gracefully (CI/CD pipelines)

## [1.7.0] - 2026-01-12

### Added

- **Query result caching**: Search results cached for 5 minutes using ICacheStore interface
  - Works with both embedded (LRU-cache) and server (Redis) storage modes
  - Cache automatically invalidated on file sync/index operations
  - `fromCache` indicator in search responses

- **Improved error messages**: All MCP tool errors now include actionable troubleshooting guidance
  - Pattern-based detection for common issues (ENOENT, EACCES, timeout, connection, memory)
  - Specific suggestions for each error type

- **Encoding detection**: Safe file reading with automatic encoding detection
  - UTF-8, UTF-16 LE/BE, BOM detection
  - Binary file detection and skipping
  - Fallback to latin1 for non-UTF-8 text files

- **Graph incremental deletion**: `deleteByFilePaths()` method for surgical graph cleanup
  - Deletes only nodes related to changed files (not entire project)
  - Implemented in both embedded (Graphology) and server (Neo4j) modes

## [1.4.0] - 2026-01-10

### Breaking Changes

- **Project Renamed**: CodeMind → CodeSeeker
  - CLI command: `codemind` → `codeseeker`
  - MCP server name: `codemind` → `codeseeker`
  - Config directory: `.codemind/` → `.codeseeker/`
  - Instruction file: `CODEMIND.md` → `CODESEEKER.md`
  - npm package: `codemind-enhanced-cli` → `codeseeker-cli`

### Added

- **Install Command**: New `codeseeker install` for easy MCP configuration
  - `codeseeker install --copilot` - VS Code + GitHub Copilot
  - `codeseeker install --cursor` - Cursor IDE
  - `codeseeker install --visual-studio` - Visual Studio
  - `codeseeker install --windsurf` - Windsurf IDE
  - `codeseeker install --global` - Install to user settings
  - `codeseeker install --list` - List current configurations

- **Unified MCP Guidance**: All AI agent instruction files now receive the same comprehensive MCP tool guidance
  - CLAUDE.md is now treated as an agent instruction file
  - Supports: AGENTS.md, .cursorrules, COPILOT.md, GEMINI.md, GROK.md, CODY.md, and more
  - Single init step configures all detected agent files

- **GitHub Actions**: Automated npm publishing with provenance on release

### Changed

- Streamlined init flow with unified agent file configuration step
- Updated all documentation and references from CodeMind to CodeSeeker

### Migration

1. Uninstall old package: `npm uninstall -g codemind-enhanced-cli`
2. Install new package: `npm install -g codeseeker-cli`
3. Update MCP configs to use `codeseeker` instead of `codemind`
4. Re-run init in your projects: `codeseeker init`

---

> **Note on the entries below.** Everything from here down belongs to the pre-rename
> `codemind` history and an older numbering scheme (2025 dates, including a separate
> `[2.1.0]` and `[2.0.0]`). It is kept verbatim for provenance and does not continue the
> version series above. Released CodeSeeker versions are the 2026-dated entries.

## [Unreleased]

### Added

- **Auto-Detected Coding Standards**: CodeSeeker now automatically detects and generates coding standards from your codebase
  - **Pattern Detection**: Analyzes indexed code to identify common patterns (validation, error handling, logging, testing)
  - **Standards File**: Auto-generates `.codeseeker/coding-standards.json` during `codeseeker init`
  - **Incremental Updates**: Standards update automatically when pattern-related files change
  - **MCP Tool**: New `get_coding_standards` tool exposes standards to Claude via MCP
  - **CLI Access**: Standards used in natural language queries (via `-c` command)
  - **Pattern Categories**:
    - Validation (email, phone, URL patterns)
    - Error handling (try-catch, error responses)
    - Logging (console, structured logging)
    - Testing (setup, assertions)
  - **Smart Recommendations**: Each pattern includes usage count, confidence level, rationale, and alternatives
  - **Example**: "Use `validator.isEmail()` (found in 5 files, high confidence) instead of regex"

- **Claude CLI Passthrough**: Seamless integration with Claude CLI commands
  - Detect and forward Claude CLI commands (login, logout, version, etc.)
  - Automatic passthrough with `stdio: 'inherit'` for interactive commands
  - Returns user to CodeSeeker REPL after command completion
  - Usage: Simply type `claude login` or any Claude CLI command in CodeSeeker

### Fixed

- **MCP Server Project Detection & Indexing Guidance**: Fixed MCP server to properly detect projects and guide users through indexing
  - **Project Detection**: Made `project` parameter required with clear guidance to pass current working directory
  - **Auto-detection**: Added `findProjectPath()` helper that walks up directory tree looking for `.codeseeker/project.json`
  - **Index Status Check**: MCP now detects if project is not indexed and provides helpful error with exact `index_project` command to run
  - **Improved Descriptions**: Updated tool descriptions to guide Claude to use `index_project` before `search_code` when needed
  - **Better Error Messages**: Empty search results now explain possible causes (no matches, try different terms, may need reindexing)
  - Resolves issue where MCP server was searching in its own startup directory instead of the client's project

### Changed

- **Intent-Based Adaptive Context**: GraphRAG-optimized snippet sizing
  - **Adaptive chunking**: Snippet size adapts to task complexity (15-80 lines based on intent)
  - **Bug fixes** (intent: fix): 80 lines (~512-1024 tokens) for full context
  - **Analysis/Explanation** (intent: analyze/explain): 40 lines (~256-512 tokens)
  - **Modifications** (intent: modify/create): 20 lines (~128-256 tokens) for signatures
  - **General queries**: No snippets (Claude decides what to read)
  - **Large files** (>1000 lines): No preview to avoid token bloat
  - **"Pitch" system**: Intent-specific guidance tells Claude WHEN and WHY to use Read tool
  - Follows 2025 RAG best practices for chunk sizing and context window utilization
  - Balances GraphRAG pre-computation benefits with token efficiency

### Fixed

- **Animated Spinner**: Improved UX during Claude processing
  - Minimal "Waiting for Claude..." spinner until Claude starts responding
  - **Passes through Claude's actual thinking messages** instead of generic verbs
  - Shows Claude's real-time reasoning and internal thought process
  - **TTY Detection**: Only use animated spinner in interactive terminals
  - Non-TTY environments (logs, pipes) show static "⏳ Waiting for Claude..." message
  - Prevents massive output pollution in non-interactive contexts
- **Error Handling**: Comprehensive Claude CLI error detection
  - Authentication errors (not logged in)
  - Rate limiting (429, too many requests)
  - Usage limits (quota exceeded, billing)
  - Network errors (connection, timeout)
  - Server errors (500, 502, 503)
  - User-friendly error messages with actionable guidance
- **Approval Menu**: Simplified file modification confirmation
  - Reduced from 4 options to 3
  - Removed redundant "(keep context)" clarification
- **Test Cleanup**: Fixed open handles in integration tests
  - Added `destroy()` method to SessionManagementService
  - Properly clears setInterval timers
  - Allows Jest to exit cleanly

## [2.1.0] - 2025-12-21

### Added

- **Three Operating Modes**: Complete CodeSeeker ecosystem
  - **CLI**: Direct command-line interface with natural language queries
  - **MCP Server**: Model Context Protocol for Claude Desktop/Code integration
  - **VSCode Extension**: Real-time file sync with status bar UI

- **MCP Server Implementation**: 6 tools for Claude integration
  - `search_code` - Semantic search across indexed projects
  - `get_file_context` - File content with related code chunks
  - `get_code_relationships` - Navigate code dependency graph
  - `list_projects` - View indexed projects
  - `index_project` - Index new projects
  - `notify_file_changes` - Incremental or full reindex with `full_reindex` flag

- **VSCode Extension**: Automatic file synchronization
  - Auto-sync on file save (configurable debounce)
  - Status bar indicator with sync status
  - Commands: Sync Now, Full Reindex, Toggle Auto-Sync
  - Smart exclusions (node_modules, .git, dist)

- **Embedded Storage Mode** (Default): Zero-setup local storage
  - SQLite + better-sqlite3 for vector search
  - Graphology for in-memory code graph
  - LRU-cache for query caching
  - Platform-specific data directories (Windows/macOS/Linux)

- **Server Storage Adapters**: Production-ready database connectors
  - PostgreSQL with pgvector for scalable vector search
  - Neo4j for advanced graph queries
  - Redis for distributed caching

- **Kubernetes Templates**: Production deployment manifests
  - PostgreSQL, Neo4j, Redis YAML configurations
  - PersistentVolumeClaims for data persistence
  - Health checks and resource limits
  - Located in `deploy/kubernetes/`

- **Database Setup Scripts**: Manual installation support
  - `setup-postgres.sql` - pgvector, HNSW index, hybrid_search function
  - `setup-neo4j.cypher` - Node indexes for fast lookups
  - Located in `deploy/scripts/`

- **E2E Test Infrastructure**: Dual-mode testing
  - `CODEMIND_TEST_STORAGE_MODE` environment variable (embedded/server)
  - MockClaudeExecutor for offline CI/CD testing
  - 188 tests passing across all test suites

- **Comprehensive Testing Guide**: `docs/TESTING_GUIDE.md`
  - CLI testing with ContractMaster-Test sample queries
  - MCP server setup and example conversations
  - VSCode extension installation and usage

### Changed

- **Documentation Overhaul**: Embedded mode now default and recommended
  - Docker Compose marked as experimental
  - Manual installation recommended for server mode
  - Clear guidance on when to upgrade to server mode (100K+ files, teams)

- **Storage Mode Detection**: Auto-selects embedded or server
  - Environment variables: `CODEMIND_STORAGE_MODE`, `CODEMIND_DATA_DIR`
  - Config file support: `~/.codeseeker/storage.json`

### Fixed

- Test configuration properly supports both embedded and server modes
- Cleanup utilities handle embedded data deletion
- Environment variable passing to child processes in E2E tests

## [2.0.0] - 2025-12-19

### Added

- **LLM Abstraction Layer**: Provider-agnostic interface (`ILLMExecutor`) enabling:
  - Mock LLM executor for CI/CD testing without API calls
  - Easy provider switching (Claude CLI, future providers)
  - Execution logging and statistics tracking

- **Platform Detection**: Automatic detection of project technologies with official documentation URLs
  - Detects from package.json, config files, docker-compose.yml
  - 42 platforms supported across 6 categories
  - Auto-generates platform section in CODEMIND.md

- **Hybrid Search**: True hybrid search combining multiple methods with RRF fusion:
  - Vector Similarity (pgvector) for semantic understanding (50% weight)
  - PostgreSQL Full-Text Search (FTS) with synonym expansion (35% weight)
  - File Path Matching for directory/filename patterns (15% weight)

- **Task Decomposition**: Intelligent splitting of complex queries:
  - Automatic detection of multi-part requests
  - Sub-task context filtering by task type
  - Dependency-aware execution ordering

- **11-Step Core Cycle**: Complete workflow orchestration:
  1. Query Analysis
  2. Task Decomposition
  3. User Clarification
  4. Hybrid Search
  5. Code Relationship Analysis
  6. Sub-Task Context Generation
  7. Enhanced Context Building
  8. Claude Code Execution
  9. File Modification Approval
  10. Build/Test Verification
  11. Database Sync

### Changed

- Refactored command routing system following SOLID principles
- Reduced CommandRouter from 921 lines to ~200 lines
- Created 6 focused services with single responsibilities
- Improved token optimization in context building

### Fixed

- Search toggle UX improvements
- Database availability check timeout issues
- ESLint configuration for ESLint 9.x

## [1.0.0] - 2025-08-27

### Added

- Initial release of CodeSeeker CLI
- Claude Code CLI integration
- Semantic search with PostgreSQL pgvector
- Knowledge graph with Neo4j
- CODEMIND.md instruction file support
- Interactive project setup wizard
- Docker-based infrastructure

---

[2.1.0]: https://github.com/jghiringhelli/codeseeker/compare/v2.0.1...v2.1.0
[2.0.1]: https://github.com/jghiringhelli/codeseeker/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/jghiringhelli/codeseeker/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/jghiringhelli/codeseeker/releases/tag/v1.0.0
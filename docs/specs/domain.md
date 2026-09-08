# CodeSeeker — Domain Language

*Version 1.0 · 2026-09-07*

The vocabulary this project uses, defined once. A term defined here means this and only
this, in code, in documents, and in tool responses. If a concept needs a name that is not
here, add it here first.

Terms are grouped by the layer they belong to. Where a term is borrowed from the wider
field, that is stated — borrowed terms keep their standard meaning and are not redefined.

---

## Project and index

**Project.** A directory that has been indexed, registered with an id (an MD5 of its
absolute path), a name, and a path. All queries resolve against exactly one project. The
project is the unit of isolation: two projects never share chunks, nodes, or standards.

**Index.** The persisted artifacts for one project: chunks with embeddings, the knowledge
graph, RAPTOR summaries, coding standards, and the exclusion list. Lives under
`.codeseeker/` in embedded mode. An index is *stale* when files have changed since it was
built; nothing detects staleness automatically.

**Chunk.** A contiguous span of one source file, produced by splitting at symbol
boundaries and capped at a maximum line count. The unit of retrieval — searches return
chunks, deduplicated to one per file. Carries `lineStart`, `lineEnd`, and where the span
corresponds to a declaration, `symbolName` and `symbolType`.

**Boundary.** A line where a symbol declaration begins. Detected per language. Chunking
splits at boundaries first and by size second, so a chunk usually corresponds to one
function, method or class.

**Overlap.** Lines from the preceding chunk prepended to a chunk's `content` without
moving its `lineStart`. Preserves context across a split. Applied at the first chunk of a
new segment only — not between sub-chunks of a single long segment.

**Exclusion.** A glob a project has declared should not be indexed. Persisted to
`.codeseeker/exclusions.json`, respected on the next full reindex. Distinct from the
built-in default exclusions, which apply to every project.

---

## Retrieval

**BM25.** The standard ranking function, provided by MiniSearch. Used here over chunk
text with camelCase tokenisation, so `UserService` is findable as `user` and `service`.
Borrowed term, standard meaning.

**Embedding.** A 384-dimension float vector produced from text by a local ONNX model.
Two texts with similar meaning have a high cosine similarity between their embeddings,
whether or not they share words.

**Reciprocal Rank Fusion (RRF).** The method for combining two ranked lists without
tuning weights: a document's fused score is the sum over lists of `1/(k + rank)`, with
k=60. Borrowed term, standard meaning. CodeSeeker fuses BM25 and vector rankings, each
weighted 0.50.

**Hybrid search.** The default retrieval mode: BM25 and vector, fused with RRF, then the
RAPTOR cascade, then scoring adjustments, then graph expansion. Contrast with `fts`
(BM25 only) and `vector` (embeddings only), which exist for diagnosis and ablation.

**RAPTOR node.** A synthetic chunk representing a directory rather than a file, whose
embedding is the mean of the embeddings of the files in that directory. Stored with a
`__raptor__/` path prefix. Answers queries about a module that no individual file
answers well.

**Cascade.** The post-filter that narrows results to one directory when that directory's
RAPTOR node scores at or above the threshold. A confidence gate, not a retrieval track —
RAPTOR is deliberately not a third RRF dimension (ADR-0005).

**Graph expansion.** Adding structurally connected files to a result set by following
graph edges from the top-ranked results, scoring each neighbour as a fraction of the score
of the result that reached it.

**Score.** A number in 0..1 attached to a result. Comparable within one response, not
across responses or projects. It is a ranking signal, not a probability or a confidence.

---

## Knowledge graph

**Node.** An entity in the graph: a file, class, function, or method. Carries a
`filePath` (absolute) and a `relativePath` property (project-relative). The project root
is also stored as a node with `type: 'file'` and the `isProjectRoot` flag — it is not a
source file and must be excluded from file listings.

**Edge.** A directed relationship between nodes: `imports`, `exports`, `calls`,
`extends`, `implements`, `contains`, `uses`, `depends_on`.

**Reliable edge.** An edge derived from AST parsing — import and export edges for
TypeScript and JavaScript. Trustworthy.

**Approximate edge.** An edge derived from regex heuristics — call edges, and everything
in languages without an AST parser. Misses dynamic dispatch, callbacks and event
handlers. Never present an approximate edge as though it were reliable (ADR-0008).

**Orphaned file.** A file no other file in the project imports. A candidate for removal,
not a conclusion: entry points, CLI scripts and plugins are orphaned by design, and
symbols consumed by external packages appear unreferenced.

**Seed.** The starting node or nodes for a traversal, given either as a file path or as a
query resolved semantically.

---

## Tool surface

**Sentinel tool.** The single MCP tool, `codeseeker`, that routes by an `action` key
instead of exposing one tool per capability. Named for the sentinel navigational tree
pattern it belongs to: a bounded surface that keeps the reader's context small. The
architectural constitution under `.claude/` is the other half of the same idea.

**Action.** The routing key: `search`, `sym`, `graph`, `analyze`, `index`. Each has its
own nested parameter group; a call fills exactly one.

**Summary result.** The default response shape: path, score, line range and signature —
no file content. The caller reads the file itself if it wants the body (ADR-0003).

**Project-relative path.** Every path in every response. Relative to the project root,
forward-slashed, ready to hand to a file-reading tool without transformation.

---

## Analysis

**Coding standard.** A pattern the project already uses often enough to be treated as its
convention — a validation library, an error-handling shape, a logging call. Detected by
scanning indexed chunks, not declared. Confidence reflects how dominant the pattern is
against its alternatives.

**Duplicate.** Two code blocks whose embeddings exceed a similarity threshold. Semantic,
not textual: a copy-pasted function with renamed variables is a duplicate; two functions
that share a common prefix are not.

**Dead code.** An exported symbol nothing imports, or a file nothing references. Always a
candidate, never a verdict — see *orphaned file*.

---

## Storage

**Embedded mode.** The default. SQLite for vectors and graph, MiniSearch for text, all
under `.codeseeker/`. Single machine, no services, nothing leaves the machine.

**Server mode.** PostgreSQL with pgvector, plus Neo4j. For a shared index across a team
or a corpus too large for one machine. Deployed by the customer on their own
infrastructure.

**Storage manager.** The composition root that hands out an `IVectorStore`, `IGraphStore`
and `IProjectStore` for the configured mode. Every consumer depends on the interface, so
the mode is a deployment decision rather than a code path.

---

## Terms deliberately not used

- **"Semantic search"** on its own, to mean the whole pipeline. It names one of four
  layers. Say *hybrid search* for the pipeline, *vector search* for the layer.
- **"AST"** for languages parsed by regex. C#, Go, Rust and the rest use pattern
  matching; calling that AST parsing overstates what the graph knows.
- **"Automatic"** for indexing. There is no auto-index (contract C4). Say *background* —
  which indexing is — and never *automatic*, which it is not.

# Architecture Decision Records

Full records live in `docs/adrs/` — one file per decision, with context, decision and
consequences. This node is the router: read it to find the decision you need, then read
that file. Do not edit an accepted ADR to match new code; supersede it with a new one.

| # | Decision | Status | File |
|---|---|---|---|
| 0001 | CLI-only integration, no Claude API calls | Accepted | [`0001`](../../docs/adrs/0001-cli-only-integration-no-claude-api-calls.md) |
| 0002 | A single sentinel MCP tool with action routing | Accepted | [`0002`](../../docs/adrs/0002-a-single-sentinel-mcp-tool-with-action-routing.md) |
| 0003 | Summaries by default, full content only on request | Accepted | [`0003`](../../docs/adrs/0003-summaries-by-default-full-content-only-on-request.md) |
| 0004 | Additive symbol-name boost, not multiplicative | Accepted | [`0004`](../../docs/adrs/0004-additive-symbol-name-boost-not-multiplicative.md) |
| 0005 | RAPTOR as a post-filter cascade, not a third RRF weight | Accepted | [`0005`](../../docs/adrs/0005-raptor-as-a-post-filter-cascade-not-a-third-rrf-weight.md) |
| 0006 | A canonical navigational tree for the constitution | Accepted | [`0006`](../../docs/adrs/0006-a-canonical-navigational-tree-for-the-architectural-constitu.md) |
| 0007 | Dead-code analysis exempts exports and entry points | Accepted | [`0007`](../../docs/adrs/0007-dead-code-analysis-exempts-exports-and-entry-points.md) |
| 0008 | Graph edges: imports reliable, calls approximate | Accepted | [`0008`](../../docs/adrs/0008-graph-edges-imports-are-reliable-calls-are-approximate.md) |
| 0009 | Source-file boost and test-file penalty in ranking | Accepted | [`0009`](../../docs/adrs/0009-source-file-boost-and-test-file-penalty-in-ranking.md) |
| 0010 | Do not exclude `packages/` from indexing | Accepted | [`0010`](../../docs/adrs/0010-do-not-exclude-packages-from-indexing.md) |
| 0011 | Graph expansion: depth 1, per-source scoring, top 10 | Accepted | [`0011`](../../docs/adrs/0011-graph-expansion-depth-1-per-source-scoring-from-the-top-10.md) |
| 0012 | The document cascade governs public-surface changes | **Proposed** | [`0012`](../../docs/adrs/0012-the-document-cascade-governs-changes-to-the-public-surface.md) |

## Read these before

| If you are about to… | Read |
|---|---|
| Add an MCP tool, or change the tool schema | 0002, 0012 |
| Change search scoring or ranking | 0004, 0005, 0009, 0011 |
| Change what gets indexed or excluded | 0010 |
| Change dead-code or dependency analysis | 0007, 0008 |
| Change how the CLI talks to an LLM | 0001 |
| Restructure `.claude/` or CLAUDE.md | 0006 |
| Change exported types, CLI flags, or the tool schema | 0012 |

## Writing a new one

Copy the shape of an existing file: Status, Date, Context, Decision, Consequences.

Context states the forces, including the option that looks obvious and why it fails.
Consequences names the negative ones too — an ADR that only lists benefits is a
advertisement, not a record. Where a decision was measured, give the number.

Add the row here. Never renumber. To reverse a decision, write a new ADR that supersedes
the old one and set the old one's status to `Superseded by NNNN`.

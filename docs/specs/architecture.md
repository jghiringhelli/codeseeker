# CodeSeeker — Mandated Architecture

*Version 1.0 · 2026-09-07*

This document states the architecture a change **must** conform to. It is not a
description of how the system works — that is `docs/technical/architecture.md`, which
walks the pipelines and the data shapes. Read that one to understand the system; read
this one before changing it.

Everything here is a rule. Where a rule is currently violated, the violation is named
with its scale, because a rule that quietly does not hold is worse than no rule.

---

## 1. Layers and dependency direction

```
  src/mcp/          MCP server: the sentinel tool, its handlers
  src/cli/          CLI surface, command routing, orchestration
       ├ commands/  handlers and orchestration services
       └ services/  data/ · analysis/ · search/ · monitoring/ · project/ · integration/ · claude/ · llm/ · setup/
  src/core/         interfaces, factories, shared errors
  src/storage/      embedded/ (SQLite + MiniSearch) · server/ (Postgres + Neo4j)
  src/integrations/ the claude CLI boundary
  src/shared/       cross-cutting utilities, AST helpers
```

**Rules.**

1. `src/storage/` depends on nothing above it. It defines `IVectorStore`,
   `IGraphStore`, `IProjectStore` in `src/storage/interfaces.ts` and implements them
   twice. No storage implementation may import from `src/cli/` or `src/mcp/`.
2. Consumers depend on the storage **interfaces**, never on a concrete store. Acquire a
   store through `getStorageManager()`, which is the composition root. A file that
   imports `sqlite-vector-store` directly outside `src/storage/` is a defect.
3. `src/mcp/` and `src/cli/` are peer surfaces. Neither imports the other. Shared logic
   moves down into `src/cli/services/` or `src/core/`, not sideways.
4. All model inference crosses exactly one boundary: `src/integrations/claude/`. No
   other directory may spawn the `claude` binary or call a model API (ADR-0001, C2).

## 2. The tool surface is frozen at one tool

The MCP server exposes one tool. Adding a second is a change to `docs/specs/spec.md`
(requirement R1) and needs an ADR superseding ADR-0002 — not a pull request that adds a
`registerTool` call.

New capability arrives as a new `action`, or as a parameter on an existing action.

## 3. Project resolution is centralised

Every handler that needs a project MUST call `resolveProject()` or
`resolveIndexedProject()`. No handler implements its own lookup, and none falls back to
`process.cwd()`.

This rule exists because it was broken. `sym` and `graph` each carried a private copy
that fell back to the working directory; an MCP server's working directory belongs to
its launcher, so both actions reported "Project not indexed" for a project `search`
resolved without trouble. That was GitHub issue #2, open for five months.

Enforced by gate `no-divergent-project-resolution`.

## 4. Responses are shaped for a token-paying reader

- Summaries by default; content only on `full: true` (ADR-0003).
- Every path project-relative and forward-slashed.
- Any truncated list states the full count and labels itself a sample
  (gate `no-silent-truncation-in-diagnostics`, from issue #3).
- Any analysis states its own limitations beside its findings (ADR-0008).

## 5. Degradation is visible

A subsystem that fails produces a response that says so. Never a partial result shaped
like a complete one, never a silent skip. An empty index reports as an empty index, not
as zero results.

The counter-example this rule comes from: `packages/` was in the default exclusion list,
so every pnpm monorepo indexed zero source files and reported success (ADR-0010).

## 6. SOLID, concretely

The principle names below are only useful as specific obligations:

- **Single responsibility.** One reason to change per class. The practical test is the
  file-length gate: a 2,264-line class has many reasons to change.
- **Dependency inversion.** Constructor injection, depend on the interface. Enforced
  structurally by rule 1.2 above.
- **Interface segregation.** `IVectorStore`, `IGraphStore` and `IProjectStore` are
  separate on purpose. Do not merge them into one storage interface.
- **Open/closed.** A new language parser is a new implementation of the parser
  interface, not a new branch in a switch.

## 7. Where the architecture is currently violated

Named, with scale, because an unstated violation is worse than a stated one.

| Violation | Scale | Consequence |
|---|---|---|
| Files over 300 lines | 144 of 338 | The change surface of a unit is not predictable from its boundary declaration. Worst: `user-interaction-service.ts` 2,264; `mcp-server.ts` 1,886; `indexing-service.ts` 1,405. |
| `strict: false` in tsconfig | project-wide | Null-safety is unverified. Being enabled per-file as modules are touched. |
| Retrieval contracts unexercised | R4-R8 | The contract suite covers the tool surface, refusals and errors against a live server, but not ranking behaviour — that needs an indexed fixture. |
| Parser registry overstates support | 8 languages | `index({op:"parsers"})` offers Tree-sitter parsers that the graph builder does not consume. |

The first two are advisory gates with recorded baselines and a ratchet: the count may not
grow. See `.forgecraft/project-gates.yaml`.

## 8. Forbidden

- A second top-level MCP tool.
- `fetch()` to any model provider.
- Writing to any path outside `.codeseeker/`.
- Indexing implicitly during a query (contract C4).
- Indexing a system or credential directory (contract C5).
- A storage implementation imported directly outside `src/storage/`.
- A truncated list without its total.
- Presenting a regex-derived edge as though it were AST-derived.

## 9. Before you change

| If you are about to change… | Read first |
|---|---|
| The tool schema | `spec.md` R1–R3, ADR-0002, ADR-0012 |
| Ranking or scoring | `spec.md` R4–R8, ADR-0004, ADR-0005, ADR-0009, ADR-0011 |
| What gets indexed | `spec.md` R11–R15, ADR-0010 |
| Analysis output | `spec.md` R16–R19, ADR-0007, ADR-0008 |
| Storage | rules 1.1–1.2 above, `docs/technical/storage.md` |
| The claude CLI boundary | ADR-0001, contract C2 |

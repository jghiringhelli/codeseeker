# ADR 0002: A single sentinel MCP tool with action routing

- **Status:** Accepted
- **Date:** 2026-09-07

## Context

MCP tool descriptions are re-sent on every request. A server exposing ten tools spends
that budget on every turn, whether or not any tool is called. CodeSeeker previously
exposed eight (`search_code`, `get_file_context`, `get_code_relationships`,
`index_project`, `notify_file_changes`, `get_coding_standards`, `list_projects`,
`install_language_support`).

## Decision

Expose exactly one tool, `codeseeker`, with an `action` routing key
(`search | sym | graph | analyze | index`) and one nested parameter group per action.
Never add a second top-level tool.

The description is deliberately minimal — a wayfinder, not instructions. Claude's own
judgment decides when to call CodeSeeker rather than native grep or Read; a long
description biases it toward calling the tool for tasks where grep is more appropriate.

## Consequences

Positive: per-request token overhead is bounded and does not grow with capability.

Negative: the nested schema is less discoverable than flat tools, and a caller filling
the wrong parameter group gets an error rather than a type mismatch.

Cost paid late: the refactor changed the public tool schema without amending any
document, so README, the install guides, the Claude Code plugin, and the CLI's own
installer output all described the removed API for two releases. The plugin's auto-sync
hooks called `mcp__codeseeker__notify_file_changes` — a tool that no longer existed —
so the "index stays in sync automatically" promise was silently dead. This is the
motivating incident for the document cascade (ADR-0012).

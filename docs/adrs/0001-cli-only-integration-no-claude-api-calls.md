# ADR 0001: CLI-only integration, no Claude API calls

- **Status:** Accepted
- **Date:** 2026-09-07

## Context

CodeSeeker needs an LLM for the interactive CLI mode (`codeseeker -c "..."`). The
obvious implementation is an HTTP client against the Claude API with an API key.

That choice would impose an API key on every user, create a billing relationship
CodeSeeker has no business mediating, and make the tool unusable inside Claude Code —
where the user already has a working, authenticated assistant.

## Decision

All AI interaction routes through the `claude` CLI as a subprocess, via
`ClaudeCodeIntegration` (`src/integrations/claude/claude-cli-integration.ts`) and
ultimately `ClaudeCodeExecutor.execute`. No `fetch()` to the Claude API. No API key.
When the CLI is unavailable, the tool degrades to transparent passthrough rather than
failing.

## Consequences

Positive: no credential handling, no billing surface, works wherever the user's own
`claude` CLI works.

Negative: CodeSeeker cannot control model selection, rate limits, or timeouts as
precisely as an API client could. Subprocess invocation is slower per call.

A single choke point also turned out to be a testing asset: honouring
`CODESEEKER_MOCK_CLAUDE` in `ClaudeCodeExecutor.execute` covers every caller at once.
Before that flag was honoured, the e2e suite spawned the real CLI on every query and
`npm test` never terminated.

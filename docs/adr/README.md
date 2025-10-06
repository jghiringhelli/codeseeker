# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records (ADRs) for the CodeMind project. ADRs document important architectural decisions made during the development of the system.

## Format

Each ADR follows the standard format:
- **Status**: Proposed, Accepted, Superseded, Deprecated
- **Date**: When the decision was made
- **Context**: The situation that led to this decision
- **Decision**: The chosen solution
- **Consequences**: The positive and negative impacts

## Current ADRs

| Number | Title | Status | Date |
|--------|-------|--------|------|
| [001](./001-granular-semantic-embeddings.md) | Granular Semantic Embeddings for Method and Class Level Analysis | Accepted | 2025-01-19 |

## Creating New ADRs

When making significant architectural decisions:

1. Copy the [template](./template.md)
2. Number it sequentially (002, 003, etc.)
3. Fill in all sections thoroughly
4. Update this README with the new entry
5. Get team review before marking as "Accepted"

## Guidelines

- ADRs should be immutable once accepted
- If a decision needs to change, create a new ADR that supersedes the old one
- Include context about why alternatives were rejected
- Document both positive and negative consequences
- Keep language clear and concise
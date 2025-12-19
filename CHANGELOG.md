# Changelog

All notable changes to CodeMind will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

- **Hybrid Search**: True hybrid search combining multiple methods:
  - PostgreSQL Full-Text Search (FTS) with tsvector/tsquery
  - ILIKE pattern matching for exact phrases
  - Weighted merge algorithm (60% FTS, 40% ILIKE)

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

- Initial release of CodeMind CLI
- Claude Code CLI integration
- Semantic search with PostgreSQL pgvector
- Knowledge graph with Neo4j
- CODEMIND.md instruction file support
- Interactive project setup wizard
- Docker-based infrastructure

---

[2.0.0]: https://github.com/jghiringhelli/codemind/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/jghiringhelli/codemind/releases/tag/v1.0.0
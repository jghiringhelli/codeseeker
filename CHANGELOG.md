# Changelog

All notable changes to CodeSeeker will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[2.1.0]: https://github.com/jghiringhelli/codeseeker/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/jghiringhelli/codeseeker/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/jghiringhelli/codeseeker/releases/tag/v1.0.0
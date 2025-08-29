# CodeMind Cleanup Analysis - Three Layer Architecture Focus

**Date**: 2025-08-29  
**Vision**: Focus on core three-layer architecture (CLI → Orchestrator → Planner) with external tools and dashboard

## Core Architecture (KEEP)

### 1. CLI Layer (`src/cli/`)
**Keep**: 
- `codemind.ts` - Main CLI entry point
- `context-optimizer.ts` - Context management for Claude Code
- `intelligent-tool-selector.ts` - Core tool selection logic

**Consolidate**:
- Multiple CLI implementations (`codemind-cli.ts`, `codemind-enhanced-v2.ts`, `multi-llm-cli.ts`)
- Tool selection variants (`enhanced-tool-selector.ts`, `tool-bundle-system.ts`)

### 2. Orchestrator Layer (`src/orchestration/`)
**Keep**:
- `orchestrator-server.ts` - HTTP API server
- `sequential-workflow-orchestrator.ts` - Core orchestration logic  
- `external-tool-manager.ts` - External tools system
- `types.ts` - Core orchestration types

**Review/Simplify**:
- `workflow-orchestrator.ts` vs `sequential-workflow-orchestrator.ts` (duplicate functionality)
- Complex role systems with minimal usage

### 3. Database Layer (`src/database/`)
**Keep**:
- `adapters/postgresql.ts` - Production database adapter
- `schema.postgres.sql` - Core schema
- Database initialization scripts

**Remove**:
- Mock database implementations
- Multiple schema files for different phases

## Components to Remove (Document & Review Later)

### 1. Complex Multi-LLM System
**Files to Remove**:
- `src/shared/llm-providers/` (entire directory)
- `src/cli/multi-llm-cli.ts`
- `MULTI_LLM_SUMMARY.md`

**Reason**: Over-engineered for current needs. Single Claude integration sufficient.

### 2. Advanced Knowledge Graph System
**Files to Remove**:
- `src/knowledge/` (most of directory except basic integration)
- `src/knowledge/graph/semantic-graph.ts`
- `src/knowledge/query/graph-query-engine.ts`
- `src/knowledge/tree/class-traversal-engine.ts`

**Reason**: Complex system with low current utilization. Basic knowledge integration sufficient.

### 3. Auto-Improvement Features  
**Files to Remove**:
- `src/auto-improvement/` (entire directory)
- `src/self-improvement/` (entire directory)
- Auto-improvement related tests

**Reason**: Complex feature that can be added back when core system is stable.

### 4. Advanced Analysis Features
**Files to Remove**:
- `src/features/vector-search/`
- `src/features/solid-principles/`
- `src/features/compilation/`
- `src/features/reconciliation/`
- `src/features/ui-navigation/`
- `src/features/use-cases/`

**Reason**: Specialized features that add complexity without immediate business value.

### 5. MCP Integration (Model Context Protocol)
**Files to Remove**:
- `src/mcp/` (entire directory if exists)
- MCP-related documentation

**Reason**: Advanced integration that can be added back when needed.

### 6. Complex Deployment Configurations
**Files to Remove**:
- `docker-compose.minimal.yml` 
- Multiple Dockerfile variants
- Complex deployment scripts in `scripts/`

**Reason**: Simplify to single production-ready deployment.

### 7. Excessive Documentation
**Files to Consolidate/Remove**:
- Multiple README files
- Redundant architecture documents
- Phase-specific documentation that's outdated

**Keep**: Core architecture docs, setup guides, API reference

### 8. Legacy Features
**Files to Remove**:
- `src/planner/` advanced planning features (keep basic project management)
- Complex workflow definitions beyond basic orchestration
- Advanced caching and context systems

## Consolidation Plan

### Phase 1: Core Architecture (Current)
1. ✅ Database initialization scripts created
2. 🔄 Remove complex multi-LLM system
3. 🔄 Consolidate CLI implementations
4. 🔄 Simplify orchestration layer

### Phase 2: Deployment Simplification
1. Single Docker Compose configuration
2. Streamlined build process
3. Essential scripts only

### Phase 3: Documentation Overhaul  
1. Single comprehensive README
2. Core architecture documentation
3. Setup and usage guides
4. API documentation

## Files/Directories Marked for Removal

```
src/shared/llm-providers/           # Multi-LLM system
src/knowledge/graph/semantic-graph.ts
src/knowledge/query/
src/knowledge/tree/
src/auto-improvement/               # Entire directory
src/self-improvement/               # Entire directory  
src/features/vector-search/
src/features/solid-principles/
src/features/compilation/
src/features/reconciliation/
src/features/ui-navigation/
src/features/use-cases/
src/mcp/                           # If exists
src/analysis/                      # If complex
tests/unit/auto-improvement/
tests/unit/self-improvement/
docs/development/                  # Most files
docs/specifications/               # Most files
MULTI_LLM_SUMMARY.md
ENHANCED-CLI-IMPROVEMENTS.md
docker-compose.minimal.yml
config/tool-bundles.json           # If complex
database/tool-bundles-schema.sql
```

## Benefits of This Cleanup

1. **Reduced Complexity**: Focus on core three-layer architecture
2. **Faster Development**: Less code to maintain and debug
3. **Clearer Vision**: Obvious what the system does and how it works
4. **Better Performance**: Fewer dependencies and less overhead
5. **Easier Deployment**: Simplified configuration and setup

## Migration Strategy

1. **Document Everything**: This file tracks what's removed
2. **Git Branches**: Create branches for removed features before deletion
3. **Test Thoroughly**: Ensure core functionality works after cleanup
4. **Incremental**: Remove features gradually, testing after each removal
5. **Rollback Plan**: Git history allows restoration of any removed feature

---

**Next Steps**: Review this analysis, then proceed with systematic removal and consolidation.
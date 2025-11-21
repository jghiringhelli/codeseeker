# CodeMind Database Schema Analysis

**Date**: 2025-11-18
**Purpose**: Complete analysis of all database tables, fields, and CRUD operations
**Goal**: Centralize database schema and remove tool-based architecture

---

## Executive Summary

CodeMind currently uses **4 database systems** with **68+ tables** across PostgreSQL, Neo4j, Redis, and MongoDB. Many tables were designed for a tool-based architecture that is being simplified. This document analyzes each table and identifies consolidation opportunities.

**Key Findings:**
- 🔴 **Redundant Storage**: Multiple tables store similar data (embeddings, analysis results, configurations)
- 🔴 **Tool-Based Complexity**: Many tables are tool-specific when they could be generic
- 🔴 **Missing Tables**: `tool_configs` and `tool_data` referenced but not created
- 🟡 **Cross-Database Duplication**: Same data types stored across different databases

---

## PostgreSQL Schema Analysis

### 🏢 **Core Project Management Tables**

#### **1. projects** - Central project registry
**Purpose**: Master table for all analyzed projects
**Key Fields**:
- `id` (UUID, PK) - Unique project identifier
- `project_path` (TEXT, UNIQUE) - File system path
- `project_name` (TEXT) - Human readable name
- `project_type` (ENUM) - web_application, api_service, library, etc.
- `languages` (JSONB) - Programming languages detected
- `frameworks` (JSONB) - Frameworks detected
- `total_files`, `total_lines` (INTEGER) - Project size metrics
- `status` (ENUM) - active, archived, analyzing
- `metadata` (JSONB) - Flexible additional data

**CRUD Operations**:
- **Create**: `ProjectManager.createProject()`, `DatabaseManager.initializeProject()`
- **Read**: `ProjectManager.getProject()`, `ProjectIntelligence.getProjectContext()`
- **Update**: `ProjectManager.updateProject()`, Various analyzers update metrics
- **Delete**: `ProjectManager.deleteProject()`

**Relationships**: Parent to most other tables via `project_id` FK

---

#### **2. project_paths** - Project path management
**Purpose**: Track project path changes and aliases
**Key Fields**:
- `project_id` (UUID, FK) - Links to projects table
- `path` (TEXT) - File system path
- `path_type` (ENUM) - primary, alias, historical
- `is_active` (BOOLEAN) - Current validity

**CRUD Operations**:
- **Create**: `ProjectManager.addProjectPath()`
- **Read**: `ProjectManager.resolveProjectPath()`
- **Update**: `ProjectManager.updatePrimaryPath()`
- **Delete**: `ProjectManager.deactivatePath()`

**Assessment**: ✅ **KEEP** - Essential for path tracking

---

### 🧠 **AI Decision and Cache Management**

#### **3. claude_decisions** - AI decision tracking
**Purpose**: Track Claude's decision-making process for learning
**Key Fields**:
- `project_id` (UUID, FK)
- `decision_type` (ENUM) - tool_selection, architecture, refactoring
- `context` (JSONB) - Input context
- `decision` (JSONB) - Decision made
- `reasoning` (TEXT) - Why decision was made
- `confidence` (DECIMAL) - Confidence score
- `outcome` (TEXT) - Success/failure result

**CRUD Operations**:
- **Create**: `ClaudeIntegration.recordDecision()`, `IntelligentTaskOrchestrator.logDecision()`
- **Read**: `ClaudeIntegration.getDecisionHistory()`, Analytics queries
- **Update**: `ClaudeIntegration.updateOutcome()`
- **Delete**: Automatic cleanup (30+ days)

**Assessment**: ✅ **KEEP** - Important for AI learning

---

#### **4. cache_entries** - Multi-level caching
**Purpose**: Performance optimization through caching
**Key Fields**:
- `cache_key` (TEXT, UNIQUE) - Cache identifier
- `data` (JSONB) - Cached data
- `content_hash` (TEXT) - For change detection
- `expires_at` (TIMESTAMPTZ) - TTL support
- `cache_type` (TEXT) - Category grouping

**CRUD Operations**:
- **Create**: `CacheManager.set()`, `LocalCacheManager.store()`
- **Read**: `CacheManager.get()`, `LocalCacheManager.retrieve()`
- **Update**: `CacheManager.set()` (with new expiry)
- **Delete**: `CacheManager.delete()`, Automatic expiration cleanup

**Assessment**: ✅ **KEEP** - Critical for performance

---

### 🔍 **Semantic Search and Embeddings**

#### **5. semantic_search_embeddings** - Vector embeddings storage
**Purpose**: Store text embeddings for semantic search
**Key Fields**:
- `project_id` (UUID, FK)
- `file_path` (TEXT) - Source file
- `content_type` (TEXT) - code, documentation, etc.
- `content_text` (TEXT) - Original text
- `content_hash` (TEXT) - Change detection
- `embedding` (VECTOR(384)) - OpenAI embedding vector
- `metadata` (JSONB) - Additional context

**CRUD Operations**:
- **Create**: `EmbeddingService.generateEmbedding()`, `SemanticSearchService.indexContent()`
- **Read**: `SemanticSearchService.search()`, `VectorSearchEngine.query()`
- **Update**: `EmbeddingService.updateEmbedding()` (when content changes)
- **Delete**: `SemanticSearchService.clearIndex()`

**Assessment**: ✅ **KEEP** - Core functionality

#### **6. code_embeddings** - Duplicate embeddings table
**Purpose**: Same as semantic_search_embeddings but different structure
**Key Fields**: Similar to semantic_search_embeddings but with `chunk_index`

**CRUD Operations**: Same as semantic_search_embeddings

**Assessment**: 🔴 **CONSOLIDATE** - Merge with semantic_search_embeddings

---

### 🚀 **Workflow and Orchestration**

#### **7. orchestration_processes** - AI workflow tracking
**Purpose**: Track complex multi-role AI workflows
**Key Fields**:
- `project_id` (UUID, FK)
- `process_name` (TEXT) - Workflow identifier
- `process_type` (ENUM) - feature, defect, tech_debt, analysis
- `workflow_id`, `execution_id` (TEXT) - Unique identifiers
- `status` (ENUM) - pending, running, completed, failed
- `progress_percent` (INTEGER) - Completion percentage
- `metadata` (JSONB) - Workflow data

**CRUD Operations**:
- **Create**: `IntelligentTaskOrchestrator.startWorkflow()`
- **Read**: `WorkflowOrchestrationAdapter.getActiveProcesses()`
- **Update**: `IntelligentTaskOrchestrator.updateProgress()`
- **Delete**: Automatic cleanup after completion

#### **8. ai_role_activities** - Individual AI role execution
**Purpose**: Track specific AI role activities within workflows
**Key Fields**:
- `process_id` (UUID, FK) - Links to orchestration_processes
- `role_name` (ENUM) - orchestrator, work_classifier, test_designer, etc.
- `activity_type` (ENUM) - analysis, implementation, review, testing
- `input_tokens`, `output_tokens` (INTEGER) - Token usage
- `quality_score` (DECIMAL) - Performance metric

**Assessment**: ✅ **KEEP** - Essential for workflow monitoring

---

### 📊 **Analysis and Pattern Storage**

#### **9. analysis_results** - General analysis storage
**Purpose**: Store results from various code analysis tools
**Key Fields**:
- `project_id` (UUID, FK)
- `file_path` (TEXT) - Analyzed file
- `file_hash` (TEXT) - Change detection
- `analysis_type` (ENUM) - pattern, quality, architecture, tech_stack
- `analysis_result` (JSONB) - Analysis data
- `confidence_score` (DECIMAL)

**CRUD Operations**:
- **Create**: Multiple analyzers - `ProjectStructureAnalyzer`, `ChangeAnalyzer`, etc.
- **Read**: `AnalysisRepository.getAnalysis()`, Dashboard queries
- **Update**: When file changes detected
- **Delete**: When projects removed

**Assessment**: ✅ **KEEP** - Central analysis storage

#### **10. detected_patterns** - Architectural patterns
**Purpose**: Store detected code patterns and antipatterns
**Key Fields**:
- `pattern_type` (ENUM) - architecture, design_pattern, coding_standard
- `pattern_name` (TEXT) - MVC, Observer, Factory, etc.
- `confidence_score` (DECIMAL)
- `evidence` (JSONB) - Supporting evidence

**Assessment**: ✅ **CONSOLIDATE** - Merge into analysis_results

---

### 🔧 **Project Initialization and Setup**

#### **11. initialization_progress** - Setup progress tracking
**Purpose**: Track multi-phase project initialization
**Key Fields**:
- `project_id` (UUID, FK)
- `phase` (ENUM) - project_discovery, pattern_analysis, standards_inference
- `resume_token` (TEXT) - For resumable initialization
- `progress_data` (JSONB) - Phase-specific data

**Assessment**: ✅ **KEEP** - Important for user experience

#### **12. questionnaire_responses** - Setup questionnaire
**Purpose**: Store user responses during project setup
**Key Fields**:
- `project_id` (UUID, FK)
- `category` (ENUM) - architecture, standards, patterns
- `question_id`, `question_text` (TEXT)
- `response` (TEXT) - User answer

**Assessment**: ✅ **KEEP** - User input preservation

---

### 📈 **Metrics and Monitoring**

#### **13. operation_metrics** - Performance tracking
**Purpose**: Track system performance and usage
**Key Fields**:
- `operation_type` (TEXT) - Type of operation
- `duration_ms` (INTEGER) - Execution time
- `files_processed` (INTEGER) - Workload size
- `success` (BOOLEAN) - Operation outcome

**Assessment**: ✅ **KEEP** - Performance optimization

#### **14. system_metrics** - System health
**Purpose**: Track resource usage and system health
**Key Fields**:
- `metric_type` (ENUM) - performance, usage, quality, resource
- `metric_name` (TEXT) - Specific metric identifier
- `metric_value` (DECIMAL) - Metric value
- `timestamp` (TIMESTAMPTZ) - When measured

**Assessment**: ✅ **KEEP** - System monitoring

---

### 🗂️ **Tool-Specific Tables (TO BE REMOVED)**

#### **15-27. Tool-Specific Analysis Tables**
The following tables are designed for the tool-based architecture:

- `tree_navigation_data` - Project tree structure
- `code_duplications` - Duplicate code detection
- `centralization_opportunities` - Code centralization suggestions
- `test_coverage_data` - Test coverage metrics
- `compilation_results` - Build results
- `compilation_issues` - Build errors/warnings
- `solid_violations` - SOLID principles violations
- `ui_components` - UI component analysis
- `ui_navigation_flows` - User flow analysis
- `documentation_structure` - Documentation mapping
- `use_cases` - Use case analysis
- `database_analysis` - Database schema analysis
- `neo4j_sync_status` - Graph database sync status

**CRUD Operations**:
- **Create/Read/Update/Delete**: All through `ToolDatabaseAPI` class methods

**Assessment**: 🔴 **CONSOLIDATE** - Move data into `analysis_results` with `analysis_type` field

---

### 🚀 **Sequential Workflow System**

#### **28. sequential_workflows** - Multi-role workflows
**Purpose**: Master tracking for complex multi-role workflows
**Key Fields**:
- `orchestration_id` (VARCHAR) - Unique workflow identifier
- `workflow_name` (TEXT) - Human readable name
- `original_query` (TEXT) - User's original request
- `workflow_graph` (JSONB) - Complete workflow definition
- `status` (ENUM) - initiated, running, completed, failed

#### **29. workflow_role_executions** - Role-specific execution
**Purpose**: Track individual role executions within workflows

#### **30. workflow_message_log** - Inter-role messaging
**Purpose**: Message queue status for Redis integration

**Assessment**: ✅ **KEEP** - Core orchestration functionality

---

### 🧩 **External Tool Management**

#### **31-36. External Tools Tables**
- `external_tools` - Tool registry
- `tool_installations` - Installation tracking
- `role_tool_permissions` - Permission management
- `tool_approval_history` - User approvals
- `tech_stack_detections` - Detected technologies
- `tool_recommendations` - AI recommendations
- `tool_usage_analytics` - Usage tracking

**CRUD Operations**: Through `ExternalToolManager` and related classes

**Assessment**: ✅ **KEEP** - Important for external tool integration

---

### 🧠 **Idea Planner System**

#### **37-44. Layer 3 Planning Tables**
- `idea_conversations` - Conversation storage
- `roadmaps` - Generated roadmaps
- `business_plans` - Business planning
- `tech_stacks` - Technology recommendations
- `system_architectures` - Architecture planning
- `workflow_specifications` - Workflow generation
- `implementation_progress` - Progress tracking
- `conversation_insights` - AI insights

**Assessment**: ✅ **KEEP** - Separate planning functionality

---

## Redis Schema Analysis

**Purpose**: Message queuing and real-time data
**Key Patterns**:
- `queue:*` - Message queues for role communication
- `cache:*` - Fast-access cache entries
- `session:*` - User session data
- `lock:*` - Distributed locking
- `pubsub:*` - Real-time notifications

**CRUD Operations**:
- **Create/Read/Update/Delete**: Through `RedisMessaging`, `RedisQueue`, `RedisCacheAdapter`

**Assessment**: ✅ **KEEP** - Essential for real-time operations

---

## Neo4j Schema Analysis

**Purpose**: Code relationship graph and semantic knowledge
**Key Node Types**:
- `Project` - Project nodes
- `File` - Source files
- `Class`, `Function`, `Variable` - Code elements
- `Dependency` - Dependencies between elements

**Key Relationships**:
- `CONTAINS` - Project contains files
- `IMPORTS` - File imports another
- `CALLS` - Function calls another
- `EXTENDS` - Class inheritance
- `USES` - Variable usage

**CRUD Operations**:
- **Create/Read/Update/Delete**: Through `SemanticKnowledgeGraph`, `Neo4jGraphStorage`

**Assessment**: ✅ **KEEP** - Unique graph capabilities

---

## MongoDB Schema Analysis

**Purpose**: Document storage and unstructured data (Currently unused in main codebase)
**Collections**:
- `tool_configs` - Tool configurations (referenced but unused)
- `analysis_results` - Analysis storage (duplicate of PostgreSQL)
- `project_intelligence` - Project context (duplicate of PostgreSQL)

**Assessment**: 🔴 **REMOVE** - Duplicates PostgreSQL functionality

---

## Missing Tables Analysis

### **tool_configs** - Referenced but not created
**Referenced In**:
- `ToolConfigRepository.getToolConfig()`
- `ErrorMessages`: "relation 'tool_configs' does not exist"

**Intended Purpose**: Store tool-specific configuration
**Assessment**: 🔴 **REMOVE** - Tool-based architecture being eliminated

### **tool_data** - Referenced but not created
**Referenced In**:
- `ToolDatabaseAPI.saveToolData()`
- `ErrorMessages`: "relation 'tool_data' does not exist"

**Intended Purpose**: Generic tool data storage
**Assessment**: 🔴 **REMOVE** - Consolidate into analysis_results

---

## Database Consolidation Recommendations

### **Phase 1: Remove Tool-Based Architecture**
1. **Delete Tool-Specific Tables**: Remove 13 tool-specific tables
2. **Remove MongoDB**: Eliminate duplicate storage
3. **Fix Missing Tables**: Remove all references to tool_configs/tool_data
4. **Consolidate Analysis Storage**: Use single `analysis_results` table

### **Phase 2: Merge Duplicate Tables**
1. **Embeddings**: Merge `code_embeddings` into `semantic_search_embeddings`
2. **Patterns**: Merge `detected_patterns` into `analysis_results`
3. **Claude Decisions**: Keep separate (already in main schema)

### **Phase 3: Optimize Schema**
1. **Add Indexes**: Ensure all foreign keys have indexes
2. **Add Constraints**: Improve data integrity
3. **Review JSONB Usage**: Ensure appropriate for each use case
4. **Cleanup Views**: Remove views referencing deleted tables

### **Final Schema Size**
- **Before**: 68+ tables across 4 databases
- **After**: ~35 tables (PostgreSQL + Redis + Neo4j only)
- **Reduction**: ~48% fewer tables, eliminate 1 entire database

---

## Implementation Impact Analysis

### **Files Requiring Updates**
1. **Remove Tool Database API**: `src/orchestrator/tool-database-api.ts`
2. **Update Service Classes**: All analyzers to use `analysis_results` table
3. **Remove Tool Configs**: `src/shared/tool-config-repository.ts`
4. **Update Migrations**: New consolidated schema
5. **Fix Command Handlers**: Remove tool-specific data access
6. **Update Documentation**: Reflect new simplified architecture

### **Migration Strategy**
1. **Create Migration Script**: Transfer tool-specific data to `analysis_results`
2. **Update All CRUD Operations**: Point to new consolidated tables
3. **Test Data Integrity**: Ensure no data loss during migration
4. **Deploy Incrementally**: Tool-by-tool migration to reduce risk

This consolidation will significantly simplify the database architecture while maintaining all essential functionality.
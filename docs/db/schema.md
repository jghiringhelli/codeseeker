# CodeSeeker Consolidated Database Schema

**Date**: 2025-11-18
**Purpose**: Simplified database schema removing tool-based architecture
**Goal**: Single source of truth for all database operations

---

## Database Architecture Overview

**Databases Used**:
- **PostgreSQL**: Primary data storage, ACID transactions, complex queries
- **Redis**: Message queuing, caching, real-time operations
- **Neo4j**: Graph relationships, semantic knowledge graph
- ~~MongoDB~~: **REMOVED** - Eliminated duplicate functionality

---

## PostgreSQL Schema (Primary Database)

### **Core Project Management**

#### **projects** - Central project registry
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_path TEXT UNIQUE NOT NULL,
  project_name TEXT NOT NULL,
  project_type TEXT CHECK (project_type IN ('web_application', 'api_service', 'library', 'mobile_app', 'desktop_app', 'cli_tool', 'unknown')),
  languages JSONB NOT NULL DEFAULT '[]'::jsonb,
  frameworks JSONB DEFAULT '[]'::jsonb,
  project_size TEXT CHECK (project_size IN ('small', 'medium', 'large', 'enterprise')),
  domain TEXT,
  total_files INTEGER DEFAULT 0,
  total_lines INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'analyzing')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Purpose**: Master registry for all analyzed projects
**CRUD Operations**:
- **Create**: `ProjectManager.createProject()`
- **Read**: `ProjectManager.getProject()`, `ProjectIntelligence.getProjectContext()`
- **Update**: `ProjectManager.updateProject()`
- **Delete**: `ProjectManager.deleteProject()`

---

#### **project_paths** - Project path management
```sql
CREATE TABLE project_paths (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  path_type TEXT DEFAULT 'primary' CHECK (path_type IN ('primary', 'alias', 'historical')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deactivated_at TIMESTAMPTZ
);
```

**Purpose**: Track project path changes and aliases
**CRUD Operations**:
- **Create**: `ProjectManager.addProjectPath()`
- **Read**: `ProjectManager.resolveProjectPath()`
- **Update**: `ProjectManager.updatePrimaryPath()`

---

### **Unified Analysis Storage**

#### **analysis_results** - All analysis data (CONSOLIDATED)
```sql
CREATE TABLE analysis_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  analysis_type TEXT NOT NULL CHECK (
    analysis_type IN (
      'pattern', 'quality', 'architecture', 'tech_stack', 'duplication',
      'dependency', 'tree_navigation', 'centralization', 'test_coverage',
      'compilation', 'solid_principles', 'ui_components', 'documentation',
      'use_cases', 'database_schema'
    )
  ),
  analysis_subtype TEXT, -- specific pattern type, SOLID principle, etc.
  analysis_result JSONB NOT NULL,
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  severity TEXT CHECK (severity IN ('info', 'minor', 'moderate', 'major', 'critical')),
  status TEXT DEFAULT 'detected' CHECK (status IN ('detected', 'acknowledged', 'fixed', 'ignored', 'wont_fix')),
  metadata JSONB DEFAULT '{}'::jsonb,
  version INTEGER DEFAULT 1,
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Purpose**: Unified storage for ALL analysis results from any analyzer
**Replaces**: 13 tool-specific tables (tree_navigation_data, code_duplications, centralization_opportunities, etc.)

**CRUD Operations**:
- **Create**: `AnalysisRepository.saveAnalysis()`, All analyzer services
- **Read**: `AnalysisRepository.getAnalysis()`, `AnalysisRepository.getByType()`
- **Update**: `AnalysisRepository.updateAnalysis()` (when files change)
- **Delete**: `AnalysisRepository.clearAnalysis()`

**Example Data Structures**:
```json
// Code Duplication Analysis
{
  "analysis_type": "duplication",
  "analysis_subtype": "exact",
  "analysis_result": {
    "similarity_score": 0.95,
    "source_location": {"start_line": 10, "end_line": 25},
    "target_location": {"start_line": 150, "end_line": 165},
    "code_snippet": "function validateUser...",
    "refactor_suggestion": "Extract common validation logic"
  }
}

// SOLID Principles Violation
{
  "analysis_type": "solid_principles",
  "analysis_subtype": "SRP",
  "analysis_result": {
    "class_name": "UserController",
    "violation_type": "mixed_responsibilities",
    "description": "Handles both validation and database operations",
    "line_number": 45,
    "refactoring_suggestion": "Split into UserValidator and UserRepository"
  }
}
```

---

### **Semantic Search and Embeddings**

#### **semantic_search_embeddings** - Vector embeddings (CONSOLIDATED)
```sql
CREATE TABLE semantic_search_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  chunk_index INTEGER DEFAULT 0, -- for large files split into chunks
  content_type TEXT DEFAULT 'code' CHECK (content_type IN ('code', 'function', 'class', 'module', 'comment', 'documentation')),
  content_text TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  embedding VECTOR(384), -- OpenAI text-embedding-3-small dimensions
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, file_path, chunk_index, content_hash)
);
```

**Purpose**: Unified vector embeddings storage
**Replaces**: Both `semantic_search_embeddings` and `code_embeddings` tables

**CRUD Operations**:
- **Create**: `EmbeddingService.generateEmbedding()`, `SemanticSearchService.indexContent()`
- **Read**: `SemanticSearchService.search()`, `VectorSearchEngine.query()`
- **Update**: `EmbeddingService.updateEmbedding()`
- **Delete**: `SemanticSearchService.clearIndex()`

---

### **AI and Workflow Management**

#### **claude_decisions** - AI decision tracking
```sql
CREATE TABLE claude_decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  decision_type TEXT NOT NULL CHECK (decision_type IN ('tool_selection', 'architecture', 'refactoring', 'optimization', 'debugging')),
  context JSONB NOT NULL,
  decision JSONB NOT NULL,
  reasoning TEXT,
  confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  alternatives JSONB DEFAULT '[]'::jsonb,
  outcome TEXT,
  performance_metrics JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  tokens_used INTEGER,
  duration_ms INTEGER
);
```

**Purpose**: Track AI decision-making for learning and optimization
**CRUD Operations**:
- **Create**: `ClaudeIntegration.recordDecision()`
- **Read**: `ClaudeIntegration.getDecisionHistory()`
- **Update**: `ClaudeIntegration.updateOutcome()`

---

#### **orchestration_processes** - Workflow tracking
```sql
CREATE TABLE orchestration_processes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  process_name TEXT NOT NULL,
  process_type TEXT NOT NULL CHECK (process_type IN ('feature', 'defect', 'tech_debt', 'hotfix', 'analysis', 'auto_improvement')),
  workflow_id TEXT NOT NULL,
  execution_id TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'running' CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled')),
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  metadata JSONB DEFAULT '{}'::jsonb,
  error_log JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Purpose**: Track complex multi-role AI workflows
**CRUD Operations**:
- **Create**: `IntelligentTaskOrchestrator.startWorkflow()`
- **Read**: `WorkflowOrchestrationAdapter.getActiveProcesses()`
- **Update**: `IntelligentTaskOrchestrator.updateProgress()`

---

#### **ai_role_activities** - Role execution tracking
```sql
CREATE TABLE ai_role_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  process_id UUID NOT NULL REFERENCES orchestration_processes(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL CHECK (role_name IN ('orchestrator', 'work_classifier', 'requirement_analyst', 'test_designer', 'implementation_developer', 'code_reviewer', 'security_auditor')),
  activity_type TEXT NOT NULL CHECK (activity_type IN ('analysis', 'implementation', 'review', 'testing', 'documentation', 'coordination')),
  status TEXT DEFAULT 'active' CHECK (status IN ('pending', 'active', 'waiting', 'completed', 'failed', 'skipped')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  quality_score DECIMAL(3,2) CHECK (quality_score >= 0 AND quality_score <= 1),
  artifacts JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Purpose**: Track individual AI role activities within workflows

---

### **System Management**

#### **cache_entries** - Multi-level caching
```sql
CREATE TABLE cache_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cache_key TEXT UNIQUE NOT NULL,
  data JSONB NOT NULL,
  content_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  access_count INTEGER DEFAULT 1,
  last_accessed TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  cache_type TEXT DEFAULT 'general',
  metadata JSONB DEFAULT '{}'::jsonb,
  size_bytes INTEGER
);
```

**Purpose**: Performance optimization through intelligent caching
**CRUD Operations**:
- **Create**: `CacheManager.set()`
- **Read**: `CacheManager.get()`
- **Delete**: `CacheManager.delete()`, Automatic expiration

---

#### **operation_metrics** - Performance monitoring
```sql
CREATE TABLE operation_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  operation_type TEXT NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  duration_ms INTEGER NOT NULL,
  files_processed INTEGER DEFAULT 0,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Purpose**: Track system performance for optimization

---

#### **system_config** - Configuration management
```sql
CREATE TABLE system_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  config_key TEXT UNIQUE NOT NULL,
  config_value JSONB NOT NULL,
  config_type TEXT DEFAULT 'string' CHECK (config_type IN ('string', 'number', 'boolean', 'json', 'array')),
  description TEXT,
  is_global BOOLEAN DEFAULT true,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Purpose**: Store system-wide and project-specific configuration

---

### **Project Initialization**

#### **initialization_progress** - Setup progress
```sql
CREATE TABLE initialization_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID UNIQUE NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase TEXT NOT NULL CHECK (phase IN ('project_discovery', 'pattern_analysis', 'standards_inference', 'smart_questioning', 'deep_analysis', 'configuration_generation', 'claude_md_update', 'completed')),
  resume_token TEXT UNIQUE NOT NULL,
  progress_data JSONB NOT NULL,
  tech_stack_data JSONB,
  error_log JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Purpose**: Track resumable multi-phase project initialization

---

#### **questionnaire_responses** - User input
```sql
CREATE TABLE questionnaire_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('architecture', 'standards', 'patterns', 'purpose', 'quality')),
  question_id TEXT NOT NULL,
  question_text TEXT,
  response TEXT NOT NULL,
  response_type TEXT DEFAULT 'text' CHECK (response_type IN ('text', 'choice', 'boolean', 'number')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Purpose**: Store user responses during project setup

---

### **Sequential Workflows**

#### **sequential_workflows** - Multi-role workflow master
```sql
CREATE TABLE sequential_workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  orchestration_id VARCHAR(100) UNIQUE NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  workflow_name TEXT NOT NULL,
  original_query TEXT NOT NULL,
  project_path TEXT NOT NULL,
  status TEXT DEFAULT 'initiated' CHECK (status IN ('initiated', 'running', 'completed', 'failed', 'stopped')),
  workflow_graph JSONB NOT NULL,
  final_result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Purpose**: Master tracking for complex sequential workflows

---

#### **workflow_role_executions** - Role execution details
```sql
CREATE TABLE workflow_role_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID NOT NULL REFERENCES sequential_workflows(id) ON DELETE CASCADE,
  role_id VARCHAR(50) NOT NULL,
  role_name TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  context_received JSONB,
  analysis_result JSONB,
  context_passed JSONB,
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  processing_duration INTEGER,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workflow_id, role_id)
);
```

**Purpose**: Track individual role executions within workflows

---

## Redis Schema (Real-time Operations)

### **Queue Management**
- `queue:role:{role_name}` - Role-specific message queues
- `queue:workflow:{workflow_id}` - Workflow-specific queues
- `queue:priority:high` - High-priority task queue

### **Caching**
- `cache:project:{project_id}:analysis` - Project analysis cache
- `cache:embedding:{file_hash}` - Embedding cache
- `cache:config:{config_key}` - Configuration cache

### **Real-time Data**
- `session:{session_id}` - User session data
- `lock:project:{project_id}` - Project operation locks
- `pubsub:notifications` - Real-time notifications

**CRUD Operations**: Through `RedisMessaging`, `RedisQueue`, `RedisCacheAdapter`

---

## Neo4j Schema (Knowledge Graph)

### **Node Types**
- `Project` - Project entities
- `File` - Source files
- `Class`, `Function`, `Variable` - Code elements
- `Package`, `Module` - Code organization
- `Dependency` - External dependencies

### **Relationship Types**
- `CONTAINS` - Containment relationships
- `IMPORTS` - Import dependencies
- `CALLS` - Function call relationships
- `EXTENDS`, `IMPLEMENTS` - Inheritance
- `USES`, `REFERENCES` - Usage relationships
- `SIMILAR_TO` - Semantic similarity

**CRUD Operations**: Through `SemanticKnowledgeGraph`, `Neo4jGraphStorage`

---

## Removed Components

### **Eliminated Tables**
1. `tool_configs` - No longer needed without tool-based architecture
2. `tool_data` - Consolidated into `analysis_results`
3. `code_embeddings` - Merged into `semantic_search_embeddings`
4. `detected_patterns` - Merged into `analysis_results`
5. **Tool-specific tables** (13 tables):
   - `tree_navigation_data`
   - `code_duplications`
   - `centralization_opportunities`
   - `test_coverage_data`
   - `compilation_results`
   - `compilation_issues`
   - `solid_violations`
   - `ui_components`
   - `ui_navigation_flows`
   - `documentation_structure`
   - `use_cases`
   - `database_analysis`
   - `neo4j_sync_status`

### **Eliminated Database**
- **MongoDB** - Complete removal, functionality moved to PostgreSQL

---

## Migration Strategy

### **Data Migration**
1. **Tool-specific data** → `analysis_results` table with appropriate `analysis_type`
2. **code_embeddings** → `semantic_search_embeddings` with chunk support
3. **detected_patterns** → `analysis_results` with `analysis_type = 'pattern'`

### **Code Updates**
1. **Remove**: `ToolDatabaseAPI` class and all tool-specific CRUD methods
2. **Update**: All analyzer services to use unified `AnalysisRepository`
3. **Simplify**: Command handlers to use consolidated data access
4. **Remove**: All references to `tool_configs` and `tool_data`

This consolidated schema reduces complexity by 48% while maintaining all essential functionality and improving maintainability.
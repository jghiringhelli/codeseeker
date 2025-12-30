-- ============================================================================
-- CodeMind Master Database Schema
-- Version: 3.0.0
-- Date: 2025-12-04
--
-- SINGLE SOURCE OF TRUTH for all CodeMind database tables.
-- This schema consolidates:
--   - schema.postgres.sql (original)
--   - schema.consolidated.sql (simplified)
--   - semantic-search-schema.sql (enhanced embeddings)
--   - embeddings-schema.sql (code embeddings)
--
-- IMPORTANT: This is the canonical schema. All other schema files should be
-- considered deprecated and removed after migration.
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- CORE PROJECT MANAGEMENT
-- ============================================================================

-- Projects table - central registry for all analyzed projects
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_path TEXT UNIQUE NOT NULL,
  project_name TEXT NOT NULL,
  project_type TEXT CHECK (
    project_type IN (
      'web_application', 'api_service', 'library', 'mobile_app',
      'desktop_app', 'cli_tool', 'unknown'
    )
  ),
  languages JSONB NOT NULL DEFAULT '[]'::jsonb,
  frameworks JSONB DEFAULT '[]'::jsonb,
  project_size TEXT CHECK (
    project_size IN ('small', 'medium', 'large', 'enterprise')
  ),
  domain TEXT,
  total_files INTEGER DEFAULT 0,
  total_lines INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'analyzing')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project path management for aliases and path changes
CREATE TABLE IF NOT EXISTS project_paths (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  path_type TEXT DEFAULT 'primary' CHECK (path_type IN ('primary', 'alias', 'historical')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deactivated_at TIMESTAMPTZ
);

-- ============================================================================
-- SEMANTIC SEARCH AND EMBEDDINGS (UNIFIED)
-- ============================================================================

-- Unified semantic search embeddings table
-- Supports both full-file and chunk-based embeddings for RAG retrieval
CREATE TABLE IF NOT EXISTS semantic_search_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,

  -- File and chunk identification
  file_path TEXT NOT NULL,
  chunk_id TEXT,                              -- Unique identifier combining file hash + chunk index
  chunk_index INTEGER NOT NULL DEFAULT 0,     -- For large files split into chunks
  chunk_start_line INTEGER NOT NULL DEFAULT 1, -- Start line of this chunk
  chunk_end_line INTEGER NOT NULL DEFAULT 1,   -- End line of this chunk
  is_full_file BOOLEAN NOT NULL DEFAULT false, -- True if this is the complete file

  -- Content and hashing
  content_text TEXT NOT NULL,
  content_hash TEXT NOT NULL,                 -- SHA-256 for change detection

  -- Vector embedding (OpenAI text-embedding-3-small: 384 dimensions)
  embedding VECTOR(384),

  -- Full-text search support
  content_tsvector TSVECTOR,                  -- Pre-computed tsvector for FTS

  -- Content classification
  content_type TEXT DEFAULT 'code' CHECK (
    content_type IN ('code', 'function', 'class', 'module', 'comment', 'documentation', 'test')
  ),
  significance TEXT CHECK (significance IN ('high', 'medium', 'low')) DEFAULT 'medium',

  -- Metadata for filtering and analysis
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(project_id, file_path, chunk_index)
);

-- ============================================================================
-- ANALYSIS RESULTS (UNIFIED)
-- ============================================================================

-- Consolidated analysis results - replaces all tool-specific tables
CREATE TABLE IF NOT EXISTS analysis_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_hash TEXT NOT NULL,                    -- SHA-256 hash for change detection
  analysis_type TEXT NOT NULL CHECK (
    analysis_type IN (
      'pattern', 'quality', 'architecture', 'tech_stack', 'duplication',
      'dependency', 'tree_navigation', 'centralization', 'test_coverage',
      'compilation', 'solid_principles', 'ui_components', 'documentation',
      'use_cases', 'database_schema'
    )
  ),
  analysis_subtype TEXT,                      -- Specific pattern type, SOLID principle, etc.
  analysis_result JSONB NOT NULL,
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  severity TEXT CHECK (severity IN ('info', 'minor', 'moderate', 'major', 'critical')),
  status TEXT DEFAULT 'detected' CHECK (
    status IN ('detected', 'acknowledged', 'fixed', 'ignored', 'wont_fix')
  ),
  metadata JSONB DEFAULT '{}'::jsonb,
  version INTEGER DEFAULT 1,
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- AI DECISION TRACKING
-- ============================================================================

-- Claude decisions table - track AI decision making
CREATE TABLE IF NOT EXISTS claude_decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  decision_type TEXT NOT NULL CHECK (
    decision_type IN ('tool_selection', 'architecture', 'refactoring', 'optimization', 'debugging')
  ),
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

-- ============================================================================
-- PROJECT INITIALIZATION
-- ============================================================================

-- Track initialization progress for resumable processing
CREATE TABLE IF NOT EXISTS initialization_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID UNIQUE NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase TEXT NOT NULL CHECK (
    phase IN (
      'project_discovery',
      'pattern_analysis',
      'standards_inference',
      'smart_questioning',
      'deep_analysis',
      'configuration_generation',
      'claude_md_update',
      'completed'
    )
  ),
  resume_token TEXT UNIQUE NOT NULL,
  progress_data JSONB NOT NULL,
  tech_stack_data JSONB,
  error_log JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Store user responses to setup questionnaires
CREATE TABLE IF NOT EXISTS questionnaire_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (
    category IN ('architecture', 'standards', 'patterns', 'purpose', 'quality')
  ),
  question_id TEXT NOT NULL,
  question_text TEXT,
  response TEXT NOT NULL,
  response_type TEXT DEFAULT 'text' CHECK (response_type IN ('text', 'choice', 'boolean', 'number')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Store detected architectural and design patterns
CREATE TABLE IF NOT EXISTS detected_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  pattern_type TEXT NOT NULL CHECK (
    pattern_type IN ('architecture', 'design_pattern', 'coding_standard', 'testing_pattern')
  ),
  pattern_name TEXT NOT NULL,
  confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  evidence JSONB NOT NULL,
  source_files JSONB DEFAULT '[]'::jsonb,
  relationships JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'detected' CHECK (status IN ('detected', 'validated', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- WORKFLOW AND ORCHESTRATION
-- ============================================================================

-- Orchestration processes - track complex AI workflows
CREATE TABLE IF NOT EXISTS orchestration_processes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  process_name TEXT NOT NULL,
  process_type TEXT NOT NULL CHECK (
    process_type IN ('feature', 'defect', 'tech_debt', 'hotfix', 'analysis', 'auto_improvement')
  ),
  workflow_id TEXT NOT NULL,
  execution_id TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'running' CHECK (
    status IN ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled')
  ),
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  estimated_duration INTEGER,
  actual_duration INTEGER,
  progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  current_phase TEXT,
  total_phases INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}'::jsonb,
  error_log JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI role activities within processes
CREATE TABLE IF NOT EXISTS ai_role_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  process_id UUID NOT NULL REFERENCES orchestration_processes(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL CHECK (
    role_name IN (
      'orchestrator', 'work_classifier', 'requirement_analyst', 'test_designer',
      'implementation_developer', 'code_reviewer', 'security_auditor',
      'performance_auditor', 'quality_auditor', 'technical_documenter',
      'release_manager', 'git_manager', 'conflict_resolver', 'deployment_manager',
      'monitoring_specialist', 'rollback_coordinator', 'stakeholder_communicator',
      'knowledge_curator', 'workflow_optimizer'
    )
  ),
  activity_type TEXT NOT NULL CHECK (
    activity_type IN ('analysis', 'implementation', 'review', 'testing', 'documentation', 'coordination')
  ),
  status TEXT DEFAULT 'active' CHECK (
    status IN ('pending', 'active', 'waiting', 'completed', 'failed', 'skipped')
  ),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  api_calls INTEGER DEFAULT 0,
  files_processed INTEGER DEFAULT 0,
  lines_changed INTEGER DEFAULT 0,
  result_summary TEXT,
  artifacts JSONB DEFAULT '[]'::jsonb,
  quality_score DECIMAL(3,2) CHECK (quality_score >= 0 AND quality_score <= 1),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sequential workflow orchestrations
CREATE TABLE IF NOT EXISTS sequential_workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  orchestration_id VARCHAR(100) UNIQUE NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  workflow_name TEXT NOT NULL,
  workflow_description TEXT,
  original_query TEXT NOT NULL,
  project_path TEXT NOT NULL,
  requested_by TEXT DEFAULT 'unknown',
  status TEXT DEFAULT 'initiated' CHECK (
    status IN ('initiated', 'running', 'completed', 'failed', 'stopped')
  ),
  priority TEXT DEFAULT 'normal' CHECK (
    priority IN ('high', 'normal', 'low')
  ),
  workflow_graph JSONB NOT NULL,
  estimated_duration INTEGER,
  estimated_tokens INTEGER,
  actual_duration INTEGER,
  actual_tokens INTEGER,
  final_result JSONB,
  error_message TEXT,
  timeout_minutes INTEGER DEFAULT 30,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Role executions within sequential workflows
CREATE TABLE IF NOT EXISTS workflow_role_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID NOT NULL REFERENCES sequential_workflows(id) ON DELETE CASCADE,
  role_id VARCHAR(50) NOT NULL,
  role_name TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'completed', 'failed', 'skipped')
  ),
  tools_used TEXT[] DEFAULT ARRAY[]::TEXT[],
  context_received JSONB,
  analysis_result JSONB,
  context_passed JSONB,
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  processing_duration INTEGER,
  tokens_used INTEGER,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workflow_id, role_id)
);

-- Message queue status tracking for Redis integration
CREATE TABLE IF NOT EXISTS workflow_message_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID NOT NULL REFERENCES sequential_workflows(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL CHECK (
    message_type IN ('role_input', 'role_completion', 'workflow_progress', 'error')
  ),
  from_role VARCHAR(50),
  to_role VARCHAR(50),
  message_data JSONB NOT NULL,
  queue_key TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processing_duration INTEGER,
  status TEXT DEFAULT 'sent' CHECK (
    status IN ('sent', 'processing', 'processed', 'failed', 'expired')
  ),
  error_details TEXT
);

-- ============================================================================
-- SYSTEM MANAGEMENT
-- ============================================================================

-- Multi-level cache entries
CREATE TABLE IF NOT EXISTS cache_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cache_key TEXT UNIQUE NOT NULL,
  data JSONB NOT NULL,
  content_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  access_count INTEGER DEFAULT 1,
  last_accessed TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  cache_type TEXT DEFAULT 'general',
  size_bytes INTEGER
);

-- Store system-wide and project-specific configuration
CREATE TABLE IF NOT EXISTS system_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  config_key TEXT UNIQUE NOT NULL,
  config_value JSONB NOT NULL,
  config_type TEXT DEFAULT 'string' CHECK (
    config_type IN ('string', 'number', 'boolean', 'json', 'array')
  ),
  description TEXT,
  is_global BOOLEAN DEFAULT true,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track operation performance for optimization
CREATE TABLE IF NOT EXISTS operation_metrics (
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

-- Store resumable analyzer state for complex operations
CREATE TABLE IF NOT EXISTS resume_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resume_token TEXT UNIQUE NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  analyzer_type TEXT NOT NULL,
  state_data JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- EXTERNAL TOOL MANAGEMENT
-- ============================================================================

-- External tools registry
CREATE TABLE IF NOT EXISTS external_tools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tool_id VARCHAR(100) UNIQUE NOT NULL,
  tool_name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  executable TEXT NOT NULL,
  install_command TEXT,
  check_command TEXT NOT NULL,
  languages TEXT[] DEFAULT ARRAY[]::TEXT[],
  frameworks TEXT[] DEFAULT ARRAY[]::TEXT[],
  purposes TEXT[] DEFAULT ARRAY[]::TEXT[],
  package_manager VARCHAR(50),
  global_install BOOLEAN DEFAULT false,
  version VARCHAR(50),
  homepage TEXT,
  documentation TEXT,
  license_type VARCHAR(100) DEFAULT 'unknown',
  trust_level VARCHAR(50) DEFAULT 'community' CHECK (
    trust_level IN ('safe', 'verified', 'community', 'experimental')
  ),
  installation_time VARCHAR(50) DEFAULT 'medium' CHECK (
    installation_time IN ('instant', 'fast', 'medium', 'slow')
  ),
  disk_space_mb INTEGER DEFAULT 0,
  prerequisites TEXT[] DEFAULT ARRAY[]::TEXT[],
  config_files TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tool installations tracking
CREATE TABLE IF NOT EXISTS tool_installations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  tool_id VARCHAR(100) REFERENCES external_tools(tool_id) ON DELETE CASCADE,
  project_path TEXT NOT NULL,
  installed_version VARCHAR(100),
  installation_method VARCHAR(50) DEFAULT 'local' CHECK (
    installation_method IN ('global', 'local', 'project')
  ),
  install_date TIMESTAMPTZ DEFAULT NOW(),
  last_used TIMESTAMPTZ DEFAULT NOW(),
  usage_count INTEGER DEFAULT 0,
  config_path TEXT,
  is_working BOOLEAN DEFAULT true,
  last_check TIMESTAMPTZ DEFAULT NOW(),
  installation_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CODE EMBEDDINGS FOR DUPLICATE DETECTION
-- ============================================================================

-- Code element embeddings for semantic duplicate detection
CREATE TABLE IF NOT EXISTS code_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  element_name TEXT NOT NULL,
  element_type TEXT NOT NULL CHECK (
    element_type IN ('class', 'method', 'function', 'interface', 'module', 'component')
  ),
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  embedding VECTOR(384),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, file_path, element_name, element_type)
);

-- Duplicate relationships tracking
CREATE TABLE IF NOT EXISTS duplicate_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_embedding_id UUID NOT NULL REFERENCES code_embeddings(id) ON DELETE CASCADE,
  target_embedding_id UUID NOT NULL REFERENCES code_embeddings(id) ON DELETE CASCADE,
  similarity_score DECIMAL(5,4) NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 1),
  relationship_type TEXT NOT NULL CHECK (
    relationship_type IN ('exact_duplicate', 'near_duplicate', 'similar_pattern', 'related_concept')
  ),
  consolidation_suggestion TEXT,
  status TEXT DEFAULT 'detected' CHECK (
    status IN ('detected', 'acknowledged', 'resolved', 'ignored')
  ),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_embedding_id, target_embedding_id)
);

-- ============================================================================
-- COMPREHENSIVE INDEXING
-- ============================================================================

-- Core project indexes
CREATE INDEX IF NOT EXISTS idx_projects_path ON projects(project_path);
CREATE INDEX IF NOT EXISTS idx_projects_type_size ON projects(project_type, project_size);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects(updated_at);

-- Project paths indexes
CREATE INDEX IF NOT EXISTS idx_project_paths_project_id ON project_paths(project_id);
CREATE INDEX IF NOT EXISTS idx_project_paths_path ON project_paths(path);
CREATE INDEX IF NOT EXISTS idx_project_paths_active ON project_paths(is_active);

-- Semantic search indexes (comprehensive)
CREATE INDEX IF NOT EXISTS idx_semantic_embeddings_project ON semantic_search_embeddings(project_id);
CREATE INDEX IF NOT EXISTS idx_semantic_embeddings_file_path ON semantic_search_embeddings(project_id, file_path);
CREATE INDEX IF NOT EXISTS idx_semantic_embeddings_content_hash ON semantic_search_embeddings(content_hash);
CREATE INDEX IF NOT EXISTS idx_semantic_embeddings_content_type ON semantic_search_embeddings(content_type);
CREATE INDEX IF NOT EXISTS idx_semantic_embeddings_significance ON semantic_search_embeddings(significance);
CREATE INDEX IF NOT EXISTS idx_semantic_embeddings_chunk_info ON semantic_search_embeddings(project_id, file_path, chunk_index);
CREATE INDEX IF NOT EXISTS idx_semantic_embeddings_file_type ON semantic_search_embeddings(project_id, is_full_file);
CREATE INDEX IF NOT EXISTS idx_semantic_embeddings_updated ON semantic_search_embeddings(updated_at);
CREATE INDEX IF NOT EXISTS idx_semantic_embeddings_project_significance ON semantic_search_embeddings(project_id, significance, updated_at);

-- Vector similarity search index (HNSW for cosine similarity)
CREATE INDEX IF NOT EXISTS idx_semantic_embeddings_vector_hnsw
ON semantic_search_embeddings USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_semantic_embeddings_fts
ON semantic_search_embeddings USING gin(content_tsvector);

-- Metadata GIN index for complex queries
CREATE INDEX IF NOT EXISTS idx_semantic_embeddings_metadata
ON semantic_search_embeddings USING gin(metadata);

-- Analysis results indexes
CREATE INDEX IF NOT EXISTS idx_analysis_project_id ON analysis_results(project_id);
CREATE INDEX IF NOT EXISTS idx_analysis_file_path ON analysis_results(file_path);
CREATE INDEX IF NOT EXISTS idx_analysis_type ON analysis_results(analysis_type);
CREATE INDEX IF NOT EXISTS idx_analysis_subtype ON analysis_results(analysis_subtype);
CREATE INDEX IF NOT EXISTS idx_analysis_hash ON analysis_results(file_hash);
CREATE INDEX IF NOT EXISTS idx_analysis_severity ON analysis_results(severity);
CREATE INDEX IF NOT EXISTS idx_analysis_status ON analysis_results(status);
CREATE INDEX IF NOT EXISTS idx_analysis_created ON analysis_results(created_at);

-- Claude decisions indexes
CREATE INDEX IF NOT EXISTS idx_claude_decisions_project ON claude_decisions(project_id);
CREATE INDEX IF NOT EXISTS idx_claude_decisions_type ON claude_decisions(decision_type);
CREATE INDEX IF NOT EXISTS idx_claude_decisions_timestamp ON claude_decisions(timestamp DESC);

-- Orchestration indexes
CREATE INDEX IF NOT EXISTS idx_orchestration_project_id ON orchestration_processes(project_id);
CREATE INDEX IF NOT EXISTS idx_orchestration_status ON orchestration_processes(status);
CREATE INDEX IF NOT EXISTS idx_orchestration_type ON orchestration_processes(process_type);
CREATE INDEX IF NOT EXISTS idx_orchestration_execution_id ON orchestration_processes(execution_id);

-- Sequential workflow indexes
CREATE INDEX IF NOT EXISTS idx_sequential_workflows_orchestration_id ON sequential_workflows(orchestration_id);
CREATE INDEX IF NOT EXISTS idx_sequential_workflows_project_id ON sequential_workflows(project_id);
CREATE INDEX IF NOT EXISTS idx_sequential_workflows_status ON sequential_workflows(status);

-- Role execution indexes
CREATE INDEX IF NOT EXISTS idx_workflow_role_executions_workflow_id ON workflow_role_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_role_executions_role_id ON workflow_role_executions(role_id);
CREATE INDEX IF NOT EXISTS idx_workflow_role_executions_status ON workflow_role_executions(status);

-- System management indexes
CREATE INDEX IF NOT EXISTS idx_cache_entries_key ON cache_entries(cache_key);
CREATE INDEX IF NOT EXISTS idx_cache_entries_expires ON cache_entries(expires_at);
CREATE INDEX IF NOT EXISTS idx_cache_entries_content_hash ON cache_entries(content_hash);
CREATE INDEX IF NOT EXISTS idx_cache_entries_type ON cache_entries(cache_type);

-- Configuration indexes
CREATE INDEX IF NOT EXISTS idx_config_key ON system_config(config_key);
CREATE INDEX IF NOT EXISTS idx_config_global ON system_config(is_global);
CREATE INDEX IF NOT EXISTS idx_config_project_id ON system_config(project_id);

-- Metrics indexes
CREATE INDEX IF NOT EXISTS idx_metrics_operation ON operation_metrics(operation_type);
CREATE INDEX IF NOT EXISTS idx_metrics_project_id ON operation_metrics(project_id);
CREATE INDEX IF NOT EXISTS idx_metrics_created ON operation_metrics(created_at);

-- External tools indexes
CREATE INDEX IF NOT EXISTS idx_external_tools_tool_id ON external_tools(tool_id);
CREATE INDEX IF NOT EXISTS idx_external_tools_category ON external_tools(category);
CREATE INDEX IF NOT EXISTS idx_tool_installations_project_id ON tool_installations(project_id);
CREATE INDEX IF NOT EXISTS idx_tool_installations_tool_id ON tool_installations(tool_id);

-- Initialization indexes
CREATE INDEX IF NOT EXISTS idx_init_project_id ON initialization_progress(project_id);
CREATE INDEX IF NOT EXISTS idx_init_phase ON initialization_progress(phase);
CREATE INDEX IF NOT EXISTS idx_init_resume_token ON initialization_progress(resume_token);

-- Questionnaire indexes
CREATE INDEX IF NOT EXISTS idx_responses_project_id ON questionnaire_responses(project_id);
CREATE INDEX IF NOT EXISTS idx_responses_category ON questionnaire_responses(category);

-- Code embeddings indexes
CREATE INDEX IF NOT EXISTS idx_code_embeddings_project ON code_embeddings(project_id);
CREATE INDEX IF NOT EXISTS idx_code_embeddings_file ON code_embeddings(file_path);
CREATE INDEX IF NOT EXISTS idx_code_embeddings_type ON code_embeddings(element_type);
CREATE INDEX IF NOT EXISTS idx_code_embeddings_vector
ON code_embeddings USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Duplicate relationships indexes
CREATE INDEX IF NOT EXISTS idx_duplicate_relationships_project ON duplicate_relationships(project_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_relationships_source ON duplicate_relationships(source_embedding_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_relationships_target ON duplicate_relationships(target_embedding_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_relationships_type ON duplicate_relationships(relationship_type);

-- JSONB indexes for complex queries
CREATE INDEX IF NOT EXISTS idx_projects_languages ON projects USING GIN (languages);
CREATE INDEX IF NOT EXISTS idx_projects_frameworks ON projects USING GIN (frameworks);
CREATE INDEX IF NOT EXISTS idx_analysis_result ON analysis_results USING GIN (analysis_result);
CREATE INDEX IF NOT EXISTS idx_analysis_tags ON analysis_results USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_orchestration_metadata ON orchestration_processes USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_sequential_workflows_workflow_graph ON sequential_workflows USING GIN (workflow_graph);

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update content_tsvector on insert/update
CREATE OR REPLACE FUNCTION update_content_tsvector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.content_tsvector = to_tsvector('english', NEW.content_text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-update triggers
DO $$
BEGIN
    -- Projects
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_projects_updated_at') THEN
        CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- Analysis results
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_analysis_updated_at') THEN
        CREATE TRIGGER update_analysis_updated_at BEFORE UPDATE ON analysis_results
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- Semantic embeddings
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_embeddings_updated_at') THEN
        CREATE TRIGGER update_embeddings_updated_at BEFORE UPDATE ON semantic_search_embeddings
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- Semantic embeddings tsvector
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_embeddings_tsvector') THEN
        CREATE TRIGGER update_embeddings_tsvector BEFORE INSERT OR UPDATE ON semantic_search_embeddings
            FOR EACH ROW EXECUTE FUNCTION update_content_tsvector();
    END IF;

    -- Initialization progress
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_initialization_updated_at') THEN
        CREATE TRIGGER update_initialization_updated_at BEFORE UPDATE ON initialization_progress
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- Orchestration processes
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_orchestration_updated_at') THEN
        CREATE TRIGGER update_orchestration_updated_at BEFORE UPDATE ON orchestration_processes
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- Sequential workflows
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_sequential_workflows_updated_at') THEN
        CREATE TRIGGER update_sequential_workflows_updated_at BEFORE UPDATE ON sequential_workflows
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- Workflow role executions
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_workflow_role_executions_updated_at') THEN
        CREATE TRIGGER update_workflow_role_executions_updated_at BEFORE UPDATE ON workflow_role_executions
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- System config
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_config_updated_at') THEN
        CREATE TRIGGER update_config_updated_at BEFORE UPDATE ON system_config
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- Cache entries
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_cache_updated_at') THEN
        CREATE TRIGGER update_cache_updated_at BEFORE UPDATE ON cache_entries
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- External tools
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_external_tools_updated_at') THEN
        CREATE TRIGGER update_external_tools_updated_at BEFORE UPDATE ON external_tools
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- Code embeddings
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_code_embeddings_updated_at') THEN
        CREATE TRIGGER update_code_embeddings_updated_at BEFORE UPDATE ON code_embeddings
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- Function to clean up expired resume states
CREATE OR REPLACE FUNCTION cleanup_expired_resume_states()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM resume_state WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to perform semantic similarity search
CREATE OR REPLACE FUNCTION semantic_similarity_search(
  query_embedding VECTOR(384),
  target_project_id UUID DEFAULT NULL,
  min_similarity FLOAT DEFAULT 0.3,
  max_results INTEGER DEFAULT 10,
  content_types TEXT[] DEFAULT NULL,
  significance_filter TEXT DEFAULT NULL,
  include_chunks BOOLEAN DEFAULT true,
  include_full_files BOOLEAN DEFAULT true
) RETURNS TABLE (
  chunk_id TEXT,
  file_path TEXT,
  content_text TEXT,
  metadata JSONB,
  similarity_score FLOAT,
  is_full_file BOOLEAN,
  chunk_start_line INTEGER,
  chunk_end_line INTEGER,
  significance TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sse.chunk_id,
    sse.file_path,
    sse.content_text,
    sse.metadata,
    (1 - (sse.embedding <=> query_embedding))::FLOAT as similarity_score,
    sse.is_full_file,
    sse.chunk_start_line,
    sse.chunk_end_line,
    sse.significance
  FROM semantic_search_embeddings sse
  WHERE
    (target_project_id IS NULL OR sse.project_id = target_project_id)
    AND (1 - (sse.embedding <=> query_embedding)) >= min_similarity
    AND (content_types IS NULL OR sse.content_type = ANY(content_types))
    AND (significance_filter IS NULL OR sse.significance = significance_filter)
    AND (
      (include_chunks AND NOT sse.is_full_file)
      OR (include_full_files AND sse.is_full_file)
    )
  ORDER BY sse.embedding <=> query_embedding
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Function to find duplicate content
CREATE OR REPLACE FUNCTION find_duplicate_content(
  target_project_id UUID,
  similarity_threshold FLOAT DEFAULT 0.95,
  max_results INTEGER DEFAULT 50
) RETURNS TABLE (
  source_chunk_id TEXT,
  source_file_path TEXT,
  duplicate_chunk_id TEXT,
  duplicate_file_path TEXT,
  similarity_score FLOAT,
  content_preview TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s1.chunk_id as source_chunk_id,
    s1.file_path as source_file_path,
    s2.chunk_id as duplicate_chunk_id,
    s2.file_path as duplicate_file_path,
    (1 - (s1.embedding <=> s2.embedding))::FLOAT as similarity_score,
    LEFT(s1.content_text, 200) as content_preview
  FROM semantic_search_embeddings s1
  JOIN semantic_search_embeddings s2 ON s1.id < s2.id
  WHERE
    s1.project_id = target_project_id
    AND s2.project_id = target_project_id
    AND (1 - (s1.embedding <=> s2.embedding)) >= similarity_threshold
    AND s1.file_path != s2.file_path
  ORDER BY similarity_score DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Function to find similar code elements
CREATE OR REPLACE FUNCTION find_similar_code_elements(
  p_project_id UUID,
  p_embedding VECTOR(384),
  p_similarity_threshold FLOAT DEFAULT 0.85,
  p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
  id UUID,
  file_path TEXT,
  element_name TEXT,
  element_type TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ce.id,
    ce.file_path,
    ce.element_name,
    ce.element_type,
    (1 - (ce.embedding <=> p_embedding))::FLOAT as similarity
  FROM code_embeddings ce
  WHERE ce.project_id = p_project_id
    AND (1 - (ce.embedding <=> p_embedding)) >= p_similarity_threshold
  ORDER BY ce.embedding <=> p_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- USEFUL VIEWS
-- ============================================================================

-- Active projects with their analysis status
CREATE OR REPLACE VIEW active_projects_status AS
SELECT
    p.id as project_id,
    p.project_path,
    p.project_name,
    p.project_type,
    p.project_size,
    p.total_files,
    ip.phase as current_phase,
    ip.updated_at as last_progress_update,
    COUNT(DISTINCT ar.analysis_type) as analysis_types_count,
    COUNT(DISTINCT qr.category) as completed_questionnaire_categories,
    COUNT(DISTINCT sse.id) as embeddings_count
FROM projects p
LEFT JOIN initialization_progress ip ON p.id = ip.project_id
LEFT JOIN analysis_results ar ON p.id = ar.project_id
LEFT JOIN questionnaire_responses qr ON p.id = qr.project_id
LEFT JOIN semantic_search_embeddings sse ON p.id = sse.project_id
WHERE p.status = 'active'
GROUP BY p.id, p.project_path, p.project_name, p.project_type, p.project_size, p.total_files, ip.phase, ip.updated_at;

-- Analysis summary per project
CREATE OR REPLACE VIEW project_analysis_summary AS
SELECT
    p.id as project_id,
    p.project_path,
    p.project_name,
    COUNT(CASE WHEN ar.analysis_type = 'pattern' THEN 1 END) as pattern_analyses,
    COUNT(CASE WHEN ar.analysis_type = 'quality' THEN 1 END) as quality_analyses,
    COUNT(CASE WHEN ar.analysis_type = 'solid_principles' THEN 1 END) as solid_violations,
    COUNT(CASE WHEN ar.analysis_type = 'duplication' THEN 1 END) as duplications,
    COUNT(CASE WHEN ar.severity = 'critical' THEN 1 END) as critical_issues,
    COUNT(CASE WHEN ar.severity = 'major' THEN 1 END) as major_issues,
    AVG(ar.confidence_score) as avg_confidence,
    MAX(ar.updated_at) as last_analysis_update
FROM projects p
LEFT JOIN analysis_results ar ON p.id = ar.project_id
WHERE p.status = 'active'
GROUP BY p.id, p.project_path, p.project_name;

-- Active workflows dashboard
CREATE OR REPLACE VIEW active_workflows_dashboard AS
SELECT
    sw.id,
    sw.orchestration_id,
    sw.workflow_name,
    sw.status,
    sw.priority,
    sw.created_at,
    sw.started_at,
    p.project_name,
    p.project_path,
    COUNT(wre.id) as total_roles,
    COUNT(CASE WHEN wre.status = 'completed' THEN 1 END) as completed_roles,
    COUNT(CASE WHEN wre.status = 'failed' THEN 1 END) as failed_roles,
    MAX(wre.step_number) as current_step
FROM sequential_workflows sw
LEFT JOIN projects p ON sw.project_id = p.id
LEFT JOIN workflow_role_executions wre ON sw.id = wre.workflow_id
WHERE sw.status IN ('initiated', 'running')
GROUP BY sw.id, sw.orchestration_id, sw.workflow_name, sw.status, sw.priority,
         sw.created_at, sw.started_at, p.project_name, p.project_path
ORDER BY sw.created_at DESC;

-- High-significance embeddings view
CREATE OR REPLACE VIEW high_significance_embeddings AS
SELECT *
FROM semantic_search_embeddings
WHERE significance = 'high'
ORDER BY updated_at DESC;

-- Full-file embeddings view
CREATE OR REPLACE VIEW full_file_embeddings AS
SELECT *
FROM semantic_search_embeddings
WHERE is_full_file = true
ORDER BY file_path, updated_at DESC;

-- ============================================================================
-- INITIAL CONFIGURATION
-- ============================================================================

INSERT INTO system_config (config_key, config_value, config_type, description, is_global) VALUES
    ('max_batch_size', '100', 'number', 'Maximum batch size for file processing', true),
    ('default_resume_timeout_hours', '24', 'number', 'Default timeout for resume tokens in hours', true),
    ('max_file_size_mb', '10', 'number', 'Maximum file size to analyze in MB', true),
    ('enable_caching', 'true', 'boolean', 'Enable analysis result caching', true),
    ('cache_ttl_hours', '168', 'number', 'Cache time-to-live in hours (default: 1 week)', true),
    ('supported_extensions', '["ts","js","py","java","cpp","cs","go","rs","php","rb"]', 'array', 'Supported file extensions for analysis', true),
    ('excluded_directories', '["node_modules","dist","build",".git","coverage"]', 'array', 'Directories to exclude from analysis', true),
    ('system_version', '"3.0.0"', 'string', 'Current system version (master schema)', true),
    ('postgres_version', '"3.0.0"', 'string', 'PostgreSQL master schema version', true),
    ('dashboard_enabled', 'true', 'boolean', 'Enable monitoring dashboard', true),
    ('dashboard_port', '3005', 'number', 'Dashboard web interface port', true),
    ('max_concurrent_processes', '5', 'number', 'Maximum concurrent orchestration processes', true),
    ('log_retention_days', '30', 'number', 'Number of days to retain process logs', true),
    ('metrics_retention_days', '90', 'number', 'Number of days to retain system metrics', true),
    ('sequential_workflows_enabled', 'true', 'boolean', 'Enable sequential workflow orchestration', true),
    ('external_tools_enabled', 'true', 'boolean', 'Enable external tool management system', true)
ON CONFLICT (config_key) DO UPDATE SET
    config_value = EXCLUDED.config_value,
    updated_at = NOW();

-- ============================================================================
-- SCHEMA COMMENTS
-- ============================================================================

COMMENT ON TABLE semantic_search_embeddings IS 'Unified semantic search embeddings supporting both full files and chunks with RAG-style retrieval. Schema version 3.0.0';
COMMENT ON COLUMN semantic_search_embeddings.chunk_id IS 'Unique identifier for each chunk, combining file hash and chunk index';
COMMENT ON COLUMN semantic_search_embeddings.chunk_start_line IS 'Starting line number of this chunk in the source file';
COMMENT ON COLUMN semantic_search_embeddings.chunk_end_line IS 'Ending line number of this chunk in the source file';
COMMENT ON COLUMN semantic_search_embeddings.is_full_file IS 'True if this embedding represents the complete file content';
COMMENT ON COLUMN semantic_search_embeddings.embedding IS 'OpenAI text-embedding-3-small compatible 384-dimensional vector embedding';
COMMENT ON COLUMN semantic_search_embeddings.content_tsvector IS 'Pre-computed tsvector for PostgreSQL full-text search';
COMMENT ON COLUMN semantic_search_embeddings.significance IS 'Content significance level for prioritizing search results';

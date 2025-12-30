-- PostgreSQL Schema for CodeMind Intelligent Code Auxiliary System
-- Multi-project support with comprehensive indexing and constraints

-- Enable UUID extension for generating unique IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROJECT MANAGEMENT
-- ============================================

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

-- Claude decisions table - track AI decision making
CREATE TABLE IF NOT EXISTS claude_decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  decision_type TEXT NOT NULL,
  context JSONB NOT NULL,
  decision JSONB NOT NULL,
  outcome JSONB,
  performance_metrics JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  confidence DECIMAL(3,2),
  tokens_used INTEGER,
  duration_ms INTEGER
);

-- Multi-level cache entries table
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

-- Index for cache performance
CREATE INDEX IF NOT EXISTS idx_cache_entries_key ON cache_entries(cache_key);
CREATE INDEX IF NOT EXISTS idx_cache_entries_expires ON cache_entries(expires_at);
CREATE INDEX IF NOT EXISTS idx_cache_entries_content_hash ON cache_entries(content_hash);
CREATE INDEX IF NOT EXISTS idx_cache_entries_type ON cache_entries(cache_type);

-- Semantic search embeddings table
CREATE TABLE IF NOT EXISTS semantic_search_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  content_type TEXT DEFAULT 'code',
  content_text TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  embedding VECTOR(384), -- OpenAI text-embedding-3-small dimensions
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for semantic search performance
CREATE INDEX IF NOT EXISTS idx_semantic_embeddings_project ON semantic_search_embeddings(project_id);
CREATE INDEX IF NOT EXISTS idx_semantic_embeddings_file_path ON semantic_search_embeddings(file_path);
CREATE INDEX IF NOT EXISTS idx_semantic_embeddings_content_hash ON semantic_search_embeddings(content_hash);
CREATE INDEX IF NOT EXISTS idx_semantic_embeddings_content_type ON semantic_search_embeddings(content_type);

-- Vector similarity search index (HNSW)
CREATE INDEX IF NOT EXISTS idx_semantic_embeddings_vector 
ON semantic_search_embeddings USING hnsw (embedding vector_cosine_ops);

-- ============================================
-- INITIALIZATION AND PROGRESS TRACKING
-- ============================================

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

-- ============================================
-- PATTERN DETECTION AND ANALYSIS
-- ============================================

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
  relationships JSONB DEFAULT '[]'::jsonb, -- Links to other patterns
  status TEXT DEFAULT 'detected' CHECK (status IN ('detected', 'validated', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SMART QUESTIONNAIRE SYSTEM
-- ============================================

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

-- ============================================
-- ANALYSIS RESULTS STORAGE
-- ============================================

-- Store various types of analysis results
CREATE TABLE IF NOT EXISTS analysis_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_hash TEXT NOT NULL, -- SHA-256 hash for change detection
  analysis_type TEXT NOT NULL CHECK (
    analysis_type IN ('pattern', 'quality', 'architecture', 'tech_stack', 'duplication', 'dependency')
  ),
  analysis_result JSONB NOT NULL,
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  version INTEGER DEFAULT 1,
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RESUME STATE MANAGEMENT
-- ============================================

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

-- ============================================
-- SYSTEM CONFIGURATION
-- ============================================

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

-- ============================================
-- PERFORMANCE AND ANALYTICS
-- ============================================

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

-- ============================================
-- PROJECT PATH MANAGEMENT
-- ============================================

-- Track project path changes and aliases
CREATE TABLE IF NOT EXISTS project_paths (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  path_type TEXT DEFAULT 'primary' CHECK (path_type IN ('primary', 'alias', 'historical')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deactivated_at TIMESTAMPTZ
);

-- ============================================
-- COMPREHENSIVE INDEXING
-- ============================================

-- Projects indexes
CREATE INDEX IF NOT EXISTS idx_projects_path ON projects(project_path);
CREATE INDEX IF NOT EXISTS idx_projects_type_size ON projects(project_type, project_size);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects(updated_at);

-- Claude decisions indexes
CREATE INDEX IF NOT EXISTS idx_claude_decisions_project ON claude_decisions(project_id);
CREATE INDEX IF NOT EXISTS idx_claude_decisions_type ON claude_decisions(decision_type);
CREATE INDEX IF NOT EXISTS idx_claude_decisions_timestamp ON claude_decisions(timestamp DESC);

-- Initialization progress indexes
CREATE INDEX IF NOT EXISTS idx_init_project_id ON initialization_progress(project_id);
CREATE INDEX IF NOT EXISTS idx_init_phase ON initialization_progress(phase);
CREATE INDEX IF NOT EXISTS idx_init_resume_token ON initialization_progress(resume_token);

-- Pattern detection indexes
CREATE INDEX IF NOT EXISTS idx_patterns_project_id ON detected_patterns(project_id);
CREATE INDEX IF NOT EXISTS idx_patterns_type ON detected_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_patterns_confidence ON detected_patterns(confidence_score);
CREATE INDEX IF NOT EXISTS idx_patterns_name ON detected_patterns(pattern_name);
CREATE INDEX IF NOT EXISTS idx_patterns_status ON detected_patterns(status);

-- Questionnaire indexes
CREATE INDEX IF NOT EXISTS idx_responses_project_id ON questionnaire_responses(project_id);
CREATE INDEX IF NOT EXISTS idx_responses_category ON questionnaire_responses(category);
CREATE INDEX IF NOT EXISTS idx_responses_question_id ON questionnaire_responses(question_id);

-- Analysis results indexes
CREATE INDEX IF NOT EXISTS idx_analysis_project_id ON analysis_results(project_id);
CREATE INDEX IF NOT EXISTS idx_analysis_file_path ON analysis_results(file_path);
CREATE INDEX IF NOT EXISTS idx_analysis_type ON analysis_results(analysis_type);
CREATE INDEX IF NOT EXISTS idx_analysis_hash ON analysis_results(file_hash);
CREATE INDEX IF NOT EXISTS idx_analysis_created ON analysis_results(created_at);

-- Resume state indexes
CREATE INDEX IF NOT EXISTS idx_resume_token ON resume_state(resume_token);
CREATE INDEX IF NOT EXISTS idx_resume_project_id ON resume_state(project_id);
CREATE INDEX IF NOT EXISTS idx_resume_expires ON resume_state(expires_at);

-- Configuration indexes
CREATE INDEX IF NOT EXISTS idx_config_key ON system_config(config_key);
CREATE INDEX IF NOT EXISTS idx_config_global ON system_config(is_global);
CREATE INDEX IF NOT EXISTS idx_config_project_id ON system_config(project_id);

-- Metrics indexes
CREATE INDEX IF NOT EXISTS idx_metrics_operation ON operation_metrics(operation_type);
CREATE INDEX IF NOT EXISTS idx_metrics_project_id ON operation_metrics(project_id);
CREATE INDEX IF NOT EXISTS idx_metrics_created ON operation_metrics(created_at);

-- Project paths indexes
CREATE INDEX IF NOT EXISTS idx_project_paths_project_id ON project_paths(project_id);
CREATE INDEX IF NOT EXISTS idx_project_paths_path ON project_paths(path);
CREATE INDEX IF NOT EXISTS idx_project_paths_active ON project_paths(is_active);

-- JSONB indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_projects_languages ON projects USING GIN (languages);
CREATE INDEX IF NOT EXISTS idx_projects_frameworks ON projects USING GIN (frameworks);
CREATE INDEX IF NOT EXISTS idx_patterns_evidence ON detected_patterns USING GIN (evidence);
CREATE INDEX IF NOT EXISTS idx_patterns_source_files ON detected_patterns USING GIN (source_files);
CREATE INDEX IF NOT EXISTS idx_analysis_result ON analysis_results USING GIN (analysis_result);

-- ============================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-update triggers (idempotent)
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_initialization_updated_at ON initialization_progress;
CREATE TRIGGER update_initialization_updated_at BEFORE UPDATE ON initialization_progress
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_patterns_updated_at ON detected_patterns;
CREATE TRIGGER update_patterns_updated_at BEFORE UPDATE ON detected_patterns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_config_updated_at ON system_config;
CREATE TRIGGER update_config_updated_at BEFORE UPDATE ON system_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- CLEANUP FUNCTIONS
-- ============================================

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

-- ============================================
-- DATABASE ANALYSIS STORAGE
-- ============================================

-- Database analysis results for each project
CREATE TABLE IF NOT EXISTS database_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  connection_info JSONB NOT NULL, -- Database connections discovered
  schema_data JSONB NOT NULL, -- Full schema information
  relationships JSONB NOT NULL DEFAULT '[]'::jsonb, -- Table relationships
  query_patterns JSONB NOT NULL DEFAULT '[]'::jsonb, -- Common query patterns
  performance_metrics JSONB NOT NULL DEFAULT '{}'::jsonb, -- Performance analysis
  documentation JSONB NOT NULL DEFAULT '{}'::jsonb, -- Human-readable docs
  last_analyzed TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Database schema summary for quick reference
CREATE TABLE IF NOT EXISTS database_schema_summary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  database_name TEXT NOT NULL,
  database_type TEXT NOT NULL CHECK (database_type IN ('postgresql', 'mysql', 'sqlite', 'mongodb')),
  table_count INTEGER DEFAULT 0,
  relationship_count INTEGER DEFAULT 0,
  estimated_size BIGINT DEFAULT 0, -- in bytes
  complexity_score DECIMAL(4,2) DEFAULT 0.0, -- 0-100 complexity rating
  optimization_opportunities JSONB DEFAULT '[]'::jsonb,
  critical_tables JSONB DEFAULT '[]'::jsonb, -- Most important tables
  last_analyzed TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Query performance tracking
CREATE TABLE IF NOT EXISTS query_performance_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  query_pattern TEXT NOT NULL,
  query_type TEXT CHECK (query_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'UNKNOWN')),
  tables_involved TEXT[] DEFAULT '{}',
  avg_duration_ms DECIMAL(10,3),
  execution_count INTEGER DEFAULT 1,
  optimization_suggestion TEXT,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Database relationship mapping for visual representation
CREATE TABLE IF NOT EXISTS database_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  from_table TEXT NOT NULL,
  from_column TEXT NOT NULL,
  to_table TEXT NOT NULL,
  to_column TEXT NOT NULL,
  relationship_type TEXT CHECK (relationship_type IN ('one-to-one', 'one-to-many', 'many-to-many')),
  cardinality_from INTEGER DEFAULT 1,
  cardinality_to INTEGER DEFAULT 1,
  constraint_name TEXT,
  is_enforced BOOLEAN DEFAULT true,
  business_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for database analysis tables
CREATE INDEX IF NOT EXISTS idx_database_analysis_project_id ON database_analysis(project_id);
CREATE INDEX IF NOT EXISTS idx_database_analysis_last_analyzed ON database_analysis(last_analyzed);
CREATE INDEX IF NOT EXISTS idx_database_schema_summary_project_id ON database_schema_summary(project_id);
CREATE INDEX IF NOT EXISTS idx_query_performance_project_id ON query_performance_log(project_id);
CREATE INDEX IF NOT EXISTS idx_query_performance_pattern ON query_performance_log(query_pattern);
CREATE INDEX IF NOT EXISTS idx_database_relationships_project_id ON database_relationships(project_id);
CREATE INDEX IF NOT EXISTS idx_database_relationships_tables ON database_relationships(from_table, to_table);

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- Active projects with their initialization status
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
    COUNT(dp.id) as detected_patterns_count,
    COUNT(DISTINCT qr.category) as completed_questionnaire_categories
FROM projects p
LEFT JOIN initialization_progress ip ON p.id = ip.project_id
LEFT JOIN detected_patterns dp ON p.id = dp.project_id AND dp.status = 'detected'
LEFT JOIN questionnaire_responses qr ON p.id = qr.project_id
WHERE p.status = 'active'
GROUP BY p.id, p.project_path, p.project_name, p.project_type, p.project_size, p.total_files, ip.phase, ip.updated_at;

-- Pattern analysis summary per project
CREATE OR REPLACE VIEW project_pattern_summary AS
SELECT 
    p.id as project_id,
    p.project_path,
    p.project_name,
    COUNT(CASE WHEN dp.pattern_type = 'architecture' THEN 1 END) as architecture_patterns,
    COUNT(CASE WHEN dp.pattern_type = 'design_pattern' THEN 1 END) as design_patterns,
    COUNT(CASE WHEN dp.pattern_type = 'coding_standard' THEN 1 END) as coding_standards,
    COUNT(CASE WHEN dp.pattern_type = 'testing_pattern' THEN 1 END) as testing_patterns,
    AVG(dp.confidence_score) as avg_confidence,
    MAX(dp.updated_at) as last_pattern_update
FROM projects p
LEFT JOIN detected_patterns dp ON p.id = dp.project_id AND dp.status = 'detected'
WHERE p.status = 'active'
GROUP BY p.id, p.project_path, p.project_name;

-- ============================================
-- PROCESS MONITORING AND ORCHESTRATION
-- ============================================

-- Track active AI orchestration processes and workflows
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
  estimated_duration INTEGER, -- in seconds
  actual_duration INTEGER,    -- in seconds
  progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  current_phase TEXT,
  total_phases INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}'::jsonb,
  error_log JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track individual AI roles and their activities within processes
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
  artifacts JSONB DEFAULT '[]'::jsonb, -- files created, modified, etc.
  quality_score DECIMAL(3,2) CHECK (quality_score >= 0 AND quality_score <= 1),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Store comprehensive process logs for debugging and monitoring
CREATE TABLE IF NOT EXISTS process_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  process_id UUID REFERENCES orchestration_processes(id) ON DELETE CASCADE,
  role_activity_id UUID REFERENCES ai_role_activities(id) ON DELETE CASCADE,
  log_level TEXT NOT NULL CHECK (
    log_level IN ('debug', 'info', 'warn', 'error', 'fatal')
  ),
  message TEXT NOT NULL,
  context JSONB DEFAULT '{}'::jsonb,
  stack_trace TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Track system metrics and performance indicators
CREATE TABLE IF NOT EXISTS system_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric_type TEXT NOT NULL CHECK (
    metric_type IN ('performance', 'usage', 'quality', 'resource', 'business')
  ),
  metric_name TEXT NOT NULL,
  metric_value DECIMAL(15,6) NOT NULL,
  metric_unit TEXT,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  process_id UUID REFERENCES orchestration_processes(id) ON DELETE SET NULL,
  tags JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Store accomplishment summaries and achievements
CREATE TABLE IF NOT EXISTS accomplishments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  process_id UUID REFERENCES orchestration_processes(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (
    category IN ('code_improvement', 'quality_gate', 'security_fix', 'performance_gain', 'architecture_enhancement', 'automation', 'documentation')
  ),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  impact_level TEXT NOT NULL CHECK (
    impact_level IN ('minor', 'moderate', 'significant', 'major', 'critical')
  ),
  quantitative_metrics JSONB DEFAULT '{}'::jsonb, -- lines saved, time reduced, etc.
  before_state JSONB DEFAULT '{}'::jsonb,
  after_state JSONB DEFAULT '{}'::jsonb,
  files_affected JSONB DEFAULT '[]'::jsonb,
  beneficiaries JSONB DEFAULT '[]'::jsonb, -- teams, users affected
  status TEXT DEFAULT 'achieved' CHECK (
    status IN ('in_progress', 'achieved', 'validated', 'reverted')
  ),
  achieved_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track workflow node states for complex orchestration visualization
CREATE TABLE IF NOT EXISTS workflow_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  process_id UUID NOT NULL REFERENCES orchestration_processes(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  node_type TEXT NOT NULL CHECK (
    node_type IN ('start', 'task', 'decision', 'parallel', 'join', 'end', 'error_handler')
  ),
  node_name TEXT NOT NULL,
  parent_node_id TEXT,
  dependencies JSONB DEFAULT '[]'::jsonb, -- list of node_ids this depends on
  status TEXT DEFAULT 'pending' CHECK (
    status IN ('pending', 'running', 'completed', 'failed', 'skipped', 'waiting')
  ),
  assigned_role TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  input_data JSONB DEFAULT '{}'::jsonb,
  output_data JSONB DEFAULT '{}'::jsonb,
  error_info JSONB DEFAULT '{}'::jsonb,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  position_x INTEGER DEFAULT 0, -- for visual layout
  position_y INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MONITORING INDEXES
-- ============================================

-- Orchestration process indexes
CREATE INDEX IF NOT EXISTS idx_orchestration_project_id ON orchestration_processes(project_id);
CREATE INDEX IF NOT EXISTS idx_orchestration_status ON orchestration_processes(status);
CREATE INDEX IF NOT EXISTS idx_orchestration_type ON orchestration_processes(process_type);
CREATE INDEX IF NOT EXISTS idx_orchestration_execution_id ON orchestration_processes(execution_id);
CREATE INDEX IF NOT EXISTS idx_orchestration_started ON orchestration_processes(started_at);
CREATE INDEX IF NOT EXISTS idx_orchestration_priority ON orchestration_processes(priority);

-- AI role activity indexes
CREATE INDEX IF NOT EXISTS idx_role_activities_process_id ON ai_role_activities(process_id);
CREATE INDEX IF NOT EXISTS idx_role_activities_role ON ai_role_activities(role_name);
CREATE INDEX IF NOT EXISTS idx_role_activities_status ON ai_role_activities(status);
CREATE INDEX IF NOT EXISTS idx_role_activities_started ON ai_role_activities(started_at);
CREATE INDEX IF NOT EXISTS idx_role_activities_type ON ai_role_activities(activity_type);

-- Process logs indexes
CREATE INDEX IF NOT EXISTS idx_process_logs_process_id ON process_logs(process_id);
CREATE INDEX IF NOT EXISTS idx_process_logs_level ON process_logs(log_level);
CREATE INDEX IF NOT EXISTS idx_process_logs_timestamp ON process_logs(timestamp);

-- System metrics indexes
CREATE INDEX IF NOT EXISTS idx_metrics_type ON system_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_metrics_name ON system_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_metrics_project_id ON system_metrics(project_id);
CREATE INDEX IF NOT EXISTS idx_metrics_process_id ON system_metrics(process_id);
CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON system_metrics(timestamp);

-- Accomplishments indexes
CREATE INDEX IF NOT EXISTS idx_accomplishments_project_id ON accomplishments(project_id);
CREATE INDEX IF NOT EXISTS idx_accomplishments_process_id ON accomplishments(process_id);
CREATE INDEX IF NOT EXISTS idx_accomplishments_category ON accomplishments(category);
CREATE INDEX IF NOT EXISTS idx_accomplishments_impact ON accomplishments(impact_level);
CREATE INDEX IF NOT EXISTS idx_accomplishments_achieved ON accomplishments(achieved_at);

-- Workflow nodes indexes
CREATE INDEX IF NOT EXISTS idx_workflow_nodes_process_id ON workflow_nodes(process_id);
CREATE INDEX IF NOT EXISTS idx_workflow_nodes_node_id ON workflow_nodes(node_id);
CREATE INDEX IF NOT EXISTS idx_workflow_nodes_status ON workflow_nodes(status);
CREATE INDEX IF NOT EXISTS idx_workflow_nodes_parent ON workflow_nodes(parent_node_id);
CREATE INDEX IF NOT EXISTS idx_workflow_nodes_role ON workflow_nodes(assigned_role);

-- JSONB indexes for complex queries
CREATE INDEX IF NOT EXISTS idx_orchestration_metadata ON orchestration_processes USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_role_activities_artifacts ON ai_role_activities USING GIN (artifacts);
CREATE INDEX IF NOT EXISTS idx_metrics_tags ON system_metrics USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_accomplishments_metrics ON accomplishments USING GIN (quantitative_metrics);
CREATE INDEX IF NOT EXISTS idx_workflow_dependencies ON workflow_nodes USING GIN (dependencies);

-- ============================================
-- MONITORING TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS update_orchestration_updated_at ON orchestration_processes;
CREATE TRIGGER update_orchestration_updated_at BEFORE UPDATE ON orchestration_processes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_role_activities_updated_at ON ai_role_activities;
CREATE TRIGGER update_role_activities_updated_at BEFORE UPDATE ON ai_role_activities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_workflow_nodes_updated_at ON workflow_nodes;
CREATE TRIGGER update_workflow_nodes_updated_at BEFORE UPDATE ON workflow_nodes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- MONITORING VIEWS
-- ============================================

-- Active processes dashboard view
CREATE OR REPLACE VIEW dashboard_active_processes AS
SELECT 
    op.id,
    op.execution_id,
    op.process_name,
    op.process_type,
    op.status,
    op.priority,
    op.progress_percent,
    op.current_phase,
    op.total_phases,
    p.project_name,
    p.project_path,
    op.started_at,
    op.estimated_duration,
    EXTRACT(EPOCH FROM (NOW() - op.started_at))::INTEGER as running_duration_seconds,
    COUNT(ara.id) as active_roles,
    COUNT(CASE WHEN ara.status = 'completed' THEN 1 END) as completed_activities,
    COUNT(CASE WHEN ara.status = 'failed' THEN 1 END) as failed_activities,
    SUM(ara.input_tokens) as total_input_tokens,
    SUM(ara.output_tokens) as total_output_tokens,
    AVG(ara.quality_score) as avg_quality_score
FROM orchestration_processes op
LEFT JOIN projects p ON op.project_id = p.id
LEFT JOIN ai_role_activities ara ON op.id = ara.process_id
WHERE op.status IN ('running', 'paused')
GROUP BY op.id, p.project_name, p.project_path
ORDER BY op.priority DESC, op.started_at DESC;

-- System health metrics view
CREATE OR REPLACE VIEW dashboard_system_health AS
SELECT 
    COUNT(CASE WHEN op.status = 'running' THEN 1 END) as active_processes,
    COUNT(CASE WHEN op.status = 'failed' THEN 1 END) as failed_processes_today,
    COUNT(CASE WHEN op.status = 'completed' AND op.completed_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as completed_today,
    AVG(CASE WHEN op.status = 'completed' THEN op.actual_duration END) as avg_process_duration,
    SUM(ara.input_tokens) as total_input_tokens_today,
    SUM(ara.output_tokens) as total_output_tokens_today,
    COUNT(DISTINCT ara.role_name) as active_roles_today,
    AVG(ara.quality_score) as avg_quality_score_today,
    COUNT(acc.id) as accomplishments_today,
    COUNT(CASE WHEN pl.log_level = 'error' THEN 1 END) as error_count_today
FROM orchestration_processes op
LEFT JOIN ai_role_activities ara ON op.id = ara.process_id AND ara.started_at >= NOW() - INTERVAL '24 hours'
LEFT JOIN accomplishments acc ON op.id = acc.process_id AND acc.achieved_at >= NOW() - INTERVAL '24 hours'
LEFT JOIN process_logs pl ON op.id = pl.process_id AND pl.timestamp >= NOW() - INTERVAL '24 hours'
WHERE op.started_at >= NOW() - INTERVAL '24 hours' OR op.status IN ('running', 'paused');

-- Recent accomplishments view
CREATE OR REPLACE VIEW dashboard_recent_accomplishments AS
SELECT 
    acc.id,
    acc.title,
    acc.description,
    acc.category,
    acc.impact_level,
    acc.quantitative_metrics,
    p.project_name,
    p.project_path,
    op.process_name,
    acc.achieved_at,
    acc.files_affected
FROM accomplishments acc
LEFT JOIN projects p ON acc.project_id = p.id
LEFT JOIN orchestration_processes op ON acc.process_id = op.id
WHERE acc.achieved_at >= NOW() - INTERVAL '7 days'
ORDER BY acc.achieved_at DESC
LIMIT 50;

-- ============================================
-- INITIAL SYSTEM CONFIGURATION
-- ============================================

INSERT INTO system_config (config_key, config_value, config_type, description, is_global) VALUES
    ('max_batch_size', '100', 'number', 'Maximum batch size for file processing', true),
    ('default_resume_timeout_hours', '24', 'number', 'Default timeout for resume tokens in hours', true),
    ('max_file_size_mb', '10', 'number', 'Maximum file size to analyze in MB', true),
    ('enable_caching', 'true', 'boolean', 'Enable analysis result caching', true),
    ('cache_ttl_hours', '168', 'number', 'Cache time-to-live in hours (default: 1 week)', true),
    ('supported_extensions', '["ts","js","py","java","cpp","cs","go","rs","php","rb"]', 'array', 'Supported file extensions for analysis', true),
    ('excluded_directories', '["node_modules","dist","build",".git","coverage"]', 'array', 'Directories to exclude from analysis', true),
    ('system_version', '"0.1.0"', 'string', 'Current system version', true),
    ('postgres_version', '"1.0.0"', 'string', 'PostgreSQL schema version', true),
    ('dashboard_enabled', 'true', 'boolean', 'Enable monitoring dashboard', true),
    ('dashboard_port', '3005', 'number', 'Dashboard web interface port', true),
    ('max_concurrent_processes', '5', 'number', 'Maximum concurrent orchestration processes', true),
    ('log_retention_days', '30', 'number', 'Number of days to retain process logs', true),
    ('metrics_retention_days', '90', 'number', 'Number of days to retain system metrics', true)
ON CONFLICT (config_key) DO NOTHING;

-- ============================================
-- SEQUENTIAL WORKFLOW ORCHESTRATION
-- ============================================

-- Sequential workflow orchestrations - master tracking for multi-role workflows
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
  workflow_graph JSONB NOT NULL, -- Complete workflow definition
  estimated_duration INTEGER, -- Milliseconds
  estimated_tokens INTEGER,
  actual_duration INTEGER, -- Milliseconds
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
  role_id VARCHAR(50) NOT NULL, -- architect, security, quality, etc.
  role_name TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'completed', 'failed', 'skipped')
  ),
  tools_used TEXT[] DEFAULT ARRAY[]::TEXT[],
  context_received JSONB, -- Context from previous role
  analysis_result JSONB, -- This role's output
  context_passed JSONB, -- Context passed to next role
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  processing_duration INTEGER, -- Milliseconds
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
  queue_key TEXT NOT NULL, -- Redis queue key
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processing_duration INTEGER, -- Milliseconds
  status TEXT DEFAULT 'sent' CHECK (
    status IN ('sent', 'processing', 'processed', 'failed', 'expired')
  ),
  error_details TEXT
);

-- Performance metrics for role-based processing
CREATE TABLE IF NOT EXISTS role_performance_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id VARCHAR(50) NOT NULL,
  role_name TEXT NOT NULL,
  workflow_id UUID REFERENCES sequential_workflows(id) ON DELETE CASCADE,
  processing_duration INTEGER NOT NULL, -- Milliseconds
  tokens_used INTEGER,
  success BOOLEAN NOT NULL,
  context_size_bytes INTEGER,
  analysis_complexity_score DECIMAL(3,2),
  tools_effectiveness JSONB, -- Tool-specific metrics
  quality_score DECIMAL(3,2) CHECK (quality_score >= 0 AND quality_score <= 1),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Redis queue status monitoring
CREATE TABLE IF NOT EXISTS redis_queue_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  queue_name TEXT NOT NULL, -- role:architect:queue, etc.
  current_length INTEGER NOT NULL,
  messages_processed_today INTEGER DEFAULT 0,
  avg_processing_time_ms INTEGER,
  last_message_at TIMESTAMPTZ,
  queue_health TEXT DEFAULT 'healthy' CHECK (
    queue_health IN ('healthy', 'warning', 'critical', 'offline')
  ),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- CLI usage tracking for both single and sequential modes
CREATE TABLE IF NOT EXISTS codemind_cli_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  usage_type TEXT NOT NULL CHECK (
    usage_type IN ('single_analysis', 'sequential_workflow', 'orchestration_request')
  ),
  user_query TEXT NOT NULL,
  project_path TEXT NOT NULL,
  optimization_mode TEXT DEFAULT 'balanced' CHECK (
    optimization_mode IN ('speed', 'accuracy', 'balanced', 'cost_efficient')
  ),
  context_files_count INTEGER DEFAULT 0,
  estimated_tokens INTEGER,
  actual_tokens INTEGER,
  tools_selected TEXT[] DEFAULT ARRAY[]::TEXT[],
  workflow_id UUID REFERENCES sequential_workflows(id) ON DELETE SET NULL,
  success BOOLEAN,
  error_message TEXT,
  processing_duration INTEGER, -- Milliseconds
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SEQUENTIAL WORKFLOW INDEXES
-- ============================================

-- Sequential workflows indexes
CREATE INDEX IF NOT EXISTS idx_sequential_workflows_orchestration_id ON sequential_workflows(orchestration_id);
CREATE INDEX IF NOT EXISTS idx_sequential_workflows_project_id ON sequential_workflows(project_id);
CREATE INDEX IF NOT EXISTS idx_sequential_workflows_status ON sequential_workflows(status);
CREATE INDEX IF NOT EXISTS idx_sequential_workflows_created_at ON sequential_workflows(created_at);
CREATE INDEX IF NOT EXISTS idx_sequential_workflows_priority ON sequential_workflows(priority);

-- Role executions indexes
CREATE INDEX IF NOT EXISTS idx_workflow_role_executions_workflow_id ON workflow_role_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_role_executions_role_id ON workflow_role_executions(role_id);
CREATE INDEX IF NOT EXISTS idx_workflow_role_executions_status ON workflow_role_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_role_executions_step ON workflow_role_executions(step_number);
CREATE INDEX IF NOT EXISTS idx_workflow_role_executions_started ON workflow_role_executions(processing_started_at);

-- Message log indexes
CREATE INDEX IF NOT EXISTS idx_workflow_message_log_workflow_id ON workflow_message_log(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_message_log_type ON workflow_message_log(message_type);
CREATE INDEX IF NOT EXISTS idx_workflow_message_log_roles ON workflow_message_log(from_role, to_role);
CREATE INDEX IF NOT EXISTS idx_workflow_message_log_status ON workflow_message_log(status);
CREATE INDEX IF NOT EXISTS idx_workflow_message_log_sent_at ON workflow_message_log(sent_at);

-- Performance metrics indexes
CREATE INDEX IF NOT EXISTS idx_role_performance_metrics_role_id ON role_performance_metrics(role_id);
CREATE INDEX IF NOT EXISTS idx_role_performance_metrics_workflow_id ON role_performance_metrics(workflow_id);
CREATE INDEX IF NOT EXISTS idx_role_performance_metrics_success ON role_performance_metrics(success);
CREATE INDEX IF NOT EXISTS idx_role_performance_metrics_created_at ON role_performance_metrics(created_at);

-- Redis queue status indexes
CREATE INDEX IF NOT EXISTS idx_redis_queue_status_queue_name ON redis_queue_status(queue_name);
CREATE INDEX IF NOT EXISTS idx_redis_queue_status_recorded_at ON redis_queue_status(recorded_at);
CREATE INDEX IF NOT EXISTS idx_redis_queue_status_health ON redis_queue_status(queue_health);

-- CLI usage indexes
CREATE INDEX IF NOT EXISTS idx_codemind_cli_usage_project_id ON codemind_cli_usage(project_id);
CREATE INDEX IF NOT EXISTS idx_codemind_cli_usage_type ON codemind_cli_usage(usage_type);
CREATE INDEX IF NOT EXISTS idx_codemind_cli_usage_workflow_id ON codemind_cli_usage(workflow_id);
CREATE INDEX IF NOT EXISTS idx_codemind_cli_usage_created_at ON codemind_cli_usage(created_at);

-- JSONB indexes for complex queries
CREATE INDEX IF NOT EXISTS idx_sequential_workflows_workflow_graph ON sequential_workflows USING GIN (workflow_graph);
CREATE INDEX IF NOT EXISTS idx_workflow_role_executions_result ON workflow_role_executions USING GIN (analysis_result);
CREATE INDEX IF NOT EXISTS idx_workflow_message_log_data ON workflow_message_log USING GIN (message_data);

-- ============================================
-- SEQUENTIAL WORKFLOW TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS update_sequential_workflows_updated_at ON sequential_workflows;
CREATE TRIGGER update_sequential_workflows_updated_at BEFORE UPDATE ON sequential_workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===================================
-- LAYER 3: IDEA PLANNER TABLES
-- ===================================

-- Ideas and Conversations
CREATE TABLE idea_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_title VARCHAR(255) NOT NULL,
    initial_idea TEXT NOT NULL,
    conversation_transcript JSONB NOT NULL, -- Full conversation history
    conversation_status VARCHAR(50) DEFAULT 'active', -- active, completed, archived
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    user_id VARCHAR(100), -- Future: user identification
    tags TEXT[] DEFAULT '{}'::TEXT[] -- For categorization
);

-- Generated Roadmaps
CREATE TABLE roadmaps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES idea_conversations(id) ON DELETE CASCADE,
    roadmap_title VARCHAR(255) NOT NULL,
    description TEXT,
    milestones JSONB NOT NULL, -- Array of milestone objects
    dependencies JSONB DEFAULT '{}'::JSONB, -- Dependency graph
    timeline_weeks INTEGER,
    estimated_hours INTEGER,
    priority_level INTEGER DEFAULT 3, -- 1-5 priority scale
    status VARCHAR(50) DEFAULT 'draft', -- draft, approved, in_progress, completed
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Business Plans
CREATE TABLE business_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES idea_conversations(id) ON DELETE CASCADE,
    plan_title VARCHAR(255) NOT NULL,
    executive_summary TEXT,
    market_analysis JSONB, -- Market size, competitors, opportunities
    revenue_models JSONB, -- Revenue streams and projections
    target_audience JSONB, -- User personas and market segments
    competitive_landscape JSONB, -- Competitor analysis
    financial_projections JSONB, -- Revenue/cost projections
    risk_assessment JSONB, -- Identified risks and mitigation
    success_metrics JSONB, -- KPIs and success criteria
    status VARCHAR(50) DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Technology Stacks
CREATE TABLE tech_stacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES idea_conversations(id) ON DELETE CASCADE,
    stack_name VARCHAR(255) NOT NULL,
    description TEXT,
    frontend_technologies JSONB, -- Technologies with justifications
    backend_technologies JSONB,
    database_technologies JSONB,
    infrastructure_technologies JSONB,
    security_technologies JSONB,
    monitoring_technologies JSONB,
    alternative_considerations JSONB, -- Alternative tech choices
    scalability_notes TEXT,
    estimated_learning_curve INTEGER, -- 1-5 complexity scale
    estimated_development_cost INTEGER,
    justification TEXT, -- Why this stack was chosen
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- System Architectures
CREATE TABLE system_architectures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES idea_conversations(id) ON DELETE CASCADE,
    architecture_name VARCHAR(255) NOT NULL,
    description TEXT,
    components JSONB NOT NULL, -- System components and descriptions
    interfaces JSONB, -- APIs and communication patterns
    data_flows JSONB, -- Data flow diagrams and descriptions
    security_architecture JSONB, -- Security patterns and considerations
    deployment_architecture JSONB, -- Infrastructure and deployment
    scalability_patterns JSONB, -- Scalability considerations
    performance_requirements JSONB, -- Performance targets and constraints
    architecture_decisions JSONB, -- Key architectural decisions and rationale
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Generated Workflow Specifications (for Orchestrator handoff)
CREATE TABLE workflow_specifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES idea_conversations(id) ON DELETE CASCADE,
    roadmap_id UUID REFERENCES roadmaps(id) ON DELETE CASCADE,
    workflow_name VARCHAR(255) NOT NULL,
    description TEXT,
    orchestration_steps JSONB NOT NULL, -- Sequential workflow steps
    role_assignments JSONB NOT NULL, -- Which roles handle which steps
    dependencies JSONB DEFAULT '{}'::JSONB, -- Step dependencies
    estimated_duration INTEGER, -- Minutes
    estimated_tokens INTEGER,
    complexity_score INTEGER, -- 1-10 complexity rating
    auto_generated BOOLEAN DEFAULT true,
    workflow_status VARCHAR(50) DEFAULT 'draft', -- draft, ready, executing, completed
    orchestration_id UUID, -- Links to actual orchestration when executed
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Implementation Progress Tracking
CREATE TABLE implementation_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES idea_conversations(id) ON DELETE CASCADE,
    workflow_specification_id UUID REFERENCES workflow_specifications(id) ON DELETE CASCADE,
    milestone_id VARCHAR(255), -- References milestone from roadmap
    component_name VARCHAR(255),
    progress_percentage INTEGER DEFAULT 0,
    implementation_notes TEXT,
    blockers JSONB DEFAULT '[]'::JSONB,
    completed_tasks JSONB DEFAULT '[]'::JSONB,
    next_tasks JSONB DEFAULT '[]'::JSONB,
    quality_metrics JSONB, -- Code quality, test coverage, etc.
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Conversation AI Insights (for learning and improvement)
CREATE TABLE conversation_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES idea_conversations(id) ON DELETE CASCADE,
    insight_type VARCHAR(100) NOT NULL, -- market_trend, tech_recommendation, risk_factor
    insight_content TEXT NOT NULL,
    confidence_score DECIMAL(3,2), -- 0.00 to 1.00
    source VARCHAR(100), -- claude_analysis, user_input, external_data
    relevance_score INTEGER, -- 1-10 relevance rating
    applied_to_planning BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for Layer 3 tables
CREATE INDEX IF NOT EXISTS idx_idea_conversations_status ON idea_conversations(conversation_status);
CREATE INDEX IF NOT EXISTS idx_idea_conversations_created ON idea_conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_idea_conversations_tags ON idea_conversations USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_roadmaps_conversation ON roadmaps(conversation_id);
CREATE INDEX IF NOT EXISTS idx_roadmaps_status ON roadmaps(status);
CREATE INDEX IF NOT EXISTS idx_business_plans_conversation ON business_plans(conversation_id);
CREATE INDEX IF NOT EXISTS idx_tech_stacks_conversation ON tech_stacks(conversation_id);
CREATE INDEX IF NOT EXISTS idx_system_architectures_conversation ON system_architectures(conversation_id);
CREATE INDEX IF NOT EXISTS idx_workflow_specifications_conversation ON workflow_specifications(conversation_id);
CREATE INDEX IF NOT EXISTS idx_workflow_specifications_status ON workflow_specifications(workflow_status);
CREATE INDEX IF NOT EXISTS idx_implementation_progress_conversation ON implementation_progress(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_insights_conversation ON conversation_insights(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_insights_type ON conversation_insights(insight_type);

-- JSONB indexes for Layer 3 complex queries
CREATE INDEX IF NOT EXISTS idx_idea_conversations_transcript ON idea_conversations USING GIN (conversation_transcript);
CREATE INDEX IF NOT EXISTS idx_roadmaps_milestones ON roadmaps USING GIN (milestones);
CREATE INDEX IF NOT EXISTS idx_business_plans_market_analysis ON business_plans USING GIN (market_analysis);
CREATE INDEX IF NOT EXISTS idx_tech_stacks_technologies ON tech_stacks USING GIN (frontend_technologies, backend_technologies);
CREATE INDEX IF NOT EXISTS idx_system_architectures_components ON system_architectures USING GIN (components);
CREATE INDEX IF NOT EXISTS idx_workflow_specifications_steps ON workflow_specifications USING GIN (orchestration_steps);

DROP TRIGGER IF EXISTS update_workflow_role_executions_updated_at ON workflow_role_executions;
CREATE TRIGGER update_workflow_role_executions_updated_at BEFORE UPDATE ON workflow_role_executions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SEQUENTIAL WORKFLOW VIEWS
-- ============================================

-- Active sequential workflows dashboard view
CREATE OR REPLACE VIEW active_sequential_workflows AS
SELECT 
    sw.id,
    sw.orchestration_id,
    sw.workflow_name,
    sw.status,
    sw.priority,
    sw.created_at,
    sw.started_at,
    sw.estimated_duration,
    sw.actual_duration,
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
         sw.created_at, sw.started_at, sw.estimated_duration, sw.actual_duration,
         p.project_name, p.project_path
ORDER BY sw.created_at DESC;

-- Role performance summary view
CREATE OR REPLACE VIEW role_performance_summary AS
SELECT 
    role_id,
    role_name,
    COUNT(*) as total_executions,
    COUNT(CASE WHEN success = true THEN 1 END) as successful_executions,
    ROUND(AVG(processing_duration)) as avg_duration_ms,
    ROUND(AVG(tokens_used)) as avg_tokens_used,
    ROUND(AVG(quality_score), 2) as avg_quality_score,
    MAX(created_at) as last_execution_at
FROM role_performance_metrics 
GROUP BY role_id, role_name
ORDER BY total_executions DESC;

-- Workflow completion statistics
CREATE OR REPLACE VIEW workflow_completion_stats AS
SELECT 
    DATE_TRUNC('day', created_at) as date,
    status,
    COUNT(*) as workflow_count,
    AVG(actual_duration) as avg_duration_ms,
    AVG(actual_tokens) as avg_tokens_used,
    AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000) as avg_end_to_end_ms
FROM sequential_workflows 
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at), status
ORDER BY date DESC, status;

-- ============================================
-- EXTERNAL TOOL MANAGEMENT SYSTEM
-- ============================================

-- External tools registry - master catalog of all available tools
CREATE TABLE IF NOT EXISTS external_tools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tool_id VARCHAR(100) UNIQUE NOT NULL, -- eslint, pytest, etc.
  tool_name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL, -- linting, testing, security, etc.
  executable TEXT NOT NULL, -- command to run the tool
  install_command TEXT, -- command to install the tool
  check_command TEXT NOT NULL, -- command to verify tool is available
  languages TEXT[] DEFAULT ARRAY[]::TEXT[], -- supported languages
  frameworks TEXT[] DEFAULT ARRAY[]::TEXT[], -- supported frameworks
  purposes TEXT[] DEFAULT ARRAY[]::TEXT[], -- what the tool is used for
  package_manager VARCHAR(50), -- npm, pip, cargo, etc.
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
  disk_space_mb INTEGER DEFAULT 0, -- MB required
  prerequisites TEXT[] DEFAULT ARRAY[]::TEXT[], -- required tools
  config_files TEXT[] DEFAULT ARRAY[]::TEXT[], -- config files it uses
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tool installations - track what's installed where
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
  config_path TEXT, -- path to tool config file
  is_working BOOLEAN DEFAULT true,
  last_check TIMESTAMPTZ DEFAULT NOW(),
  installation_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Role-tool permissions - which roles can use/install which tools
CREATE TABLE IF NOT EXISTS role_tool_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_type VARCHAR(100) NOT NULL, -- from RoleType enum
  tool_id VARCHAR(100) REFERENCES external_tools(tool_id) ON DELETE CASCADE,
  permission VARCHAR(50) DEFAULT 'ask-permission' CHECK (
    permission IN ('allowed', 'auto-approved', 'ask-permission', 'denied')
  ),
  auto_install BOOLEAN DEFAULT false,
  max_usage_per_session INTEGER,
  restrict_to_projects TEXT[], -- project paths where this permission applies
  approved_by VARCHAR(255),
  approval_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role_type, tool_id)
);

-- User approval history for tool installations
CREATE TABLE IF NOT EXISTS tool_approval_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  tool_id VARCHAR(100) REFERENCES external_tools(tool_id) ON DELETE CASCADE,
  role_type VARCHAR(100) NOT NULL,
  request_type VARCHAR(50) NOT NULL CHECK (
    request_type IN ('install', 'execute', 'auto-install-enable')
  ),
  user_decision VARCHAR(50) NOT NULL CHECK (
    user_decision IN ('approved', 'denied', 'approve-once', 'approve-always')
  ),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  decided_at TIMESTAMPTZ DEFAULT NOW(),
  reasoning TEXT,
  remember_decision BOOLEAN DEFAULT false
);

-- Tech stack detection results - cache for detected project technology stacks
CREATE TABLE IF NOT EXISTS tech_stack_detections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  project_path TEXT NOT NULL,
  languages JSONB DEFAULT '{}'::JSONB, -- language -> percentage mapping
  frameworks JSONB DEFAULT '{}'::JSONB, -- framework -> files array mapping
  package_managers TEXT[] DEFAULT ARRAY[]::TEXT[],
  build_tools TEXT[] DEFAULT ARRAY[]::TEXT[],
  test_frameworks TEXT[] DEFAULT ARRAY[]::TEXT[],
  linters TEXT[] DEFAULT ARRAY[]::TEXT[],
  formatters TEXT[] DEFAULT ARRAY[]::TEXT[],
  dependencies JSONB DEFAULT '{}'::JSONB, -- package -> version mapping
  detection_confidence DECIMAL(3,2) DEFAULT 0.8,
  last_scan TIMESTAMPTZ DEFAULT NOW(),
  scan_duration_ms INTEGER,
  file_count_analyzed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tool recommendations - AI-generated suggestions for tools to install
CREATE TABLE IF NOT EXISTS tool_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  tool_id VARCHAR(100) REFERENCES external_tools(tool_id) ON DELETE CASCADE,
  role_type VARCHAR(100) NOT NULL,
  confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  reasons TEXT[] DEFAULT ARRAY[]::TEXT[],
  urgency VARCHAR(50) DEFAULT 'medium' CHECK (
    urgency IN ('low', 'medium', 'high', 'critical')
  ),
  timing VARCHAR(50) DEFAULT 'as-needed' CHECK (
    timing IN ('now', 'project-setup', 'before-coding', 'as-needed')
  ),
  estimated_benefit DECIMAL(3,2) CHECK (estimated_benefit >= 0 AND estimated_benefit <= 1),
  recommendation_status VARCHAR(50) DEFAULT 'pending' CHECK (
    recommendation_status IN ('pending', 'accepted', 'rejected', 'installed', 'ignored')
  ),
  user_feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  acted_on_at TIMESTAMPTZ
);

-- Tool usage analytics - track how tools are being used
CREATE TABLE IF NOT EXISTS tool_usage_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  tool_id VARCHAR(100) REFERENCES external_tools(tool_id) ON DELETE CASCADE,
  role_type VARCHAR(100) NOT NULL,
  usage_type VARCHAR(50) NOT NULL CHECK (
    usage_type IN ('execute', 'install', 'check', 'configure')
  ),
  execution_duration_ms INTEGER,
  success BOOLEAN NOT NULL,
  command_args TEXT,
  output_size_bytes INTEGER,
  error_message TEXT,
  context JSONB DEFAULT '{}'::JSONB,
  used_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- EXTERNAL TOOLS INDEXES
-- ============================================

-- External tools indexes
CREATE INDEX IF NOT EXISTS idx_external_tools_tool_id ON external_tools(tool_id);
CREATE INDEX IF NOT EXISTS idx_external_tools_category ON external_tools(category);
CREATE INDEX IF NOT EXISTS idx_external_tools_trust_level ON external_tools(trust_level);
CREATE INDEX IF NOT EXISTS idx_external_tools_languages ON external_tools USING GIN (languages);
CREATE INDEX IF NOT EXISTS idx_external_tools_frameworks ON external_tools USING GIN (frameworks);
CREATE INDEX IF NOT EXISTS idx_external_tools_purposes ON external_tools USING GIN (purposes);

-- Tool installations indexes
CREATE INDEX IF NOT EXISTS idx_tool_installations_project_id ON tool_installations(project_id);
CREATE INDEX IF NOT EXISTS idx_tool_installations_tool_id ON tool_installations(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_installations_project_path ON tool_installations(project_path);
CREATE INDEX IF NOT EXISTS idx_tool_installations_working ON tool_installations(is_working);

-- Role-tool permissions indexes
CREATE INDEX IF NOT EXISTS idx_role_tool_permissions_role ON role_tool_permissions(role_type);
CREATE INDEX IF NOT EXISTS idx_role_tool_permissions_tool ON role_tool_permissions(tool_id);
CREATE INDEX IF NOT EXISTS idx_role_tool_permissions_permission ON role_tool_permissions(permission);

-- Tech stack detections indexes
CREATE INDEX IF NOT EXISTS idx_tech_stack_detections_project_id ON tech_stack_detections(project_id);
CREATE INDEX IF NOT EXISTS idx_tech_stack_detections_path ON tech_stack_detections(project_path);
CREATE INDEX IF NOT EXISTS idx_tech_stack_detections_last_scan ON tech_stack_detections(last_scan);

-- Tool recommendations indexes
CREATE INDEX IF NOT EXISTS idx_tool_recommendations_project_id ON tool_recommendations(project_id);
CREATE INDEX IF NOT EXISTS idx_tool_recommendations_tool_id ON tool_recommendations(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_recommendations_role ON tool_recommendations(role_type);
CREATE INDEX IF NOT EXISTS idx_tool_recommendations_urgency ON tool_recommendations(urgency);
CREATE INDEX IF NOT EXISTS idx_tool_recommendations_status ON tool_recommendations(recommendation_status);

-- Tool usage analytics indexes
CREATE INDEX IF NOT EXISTS idx_tool_usage_analytics_project_id ON tool_usage_analytics(project_id);
CREATE INDEX IF NOT EXISTS idx_tool_usage_analytics_tool_id ON tool_usage_analytics(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_usage_analytics_role ON tool_usage_analytics(role_type);
CREATE INDEX IF NOT EXISTS idx_tool_usage_analytics_used_at ON tool_usage_analytics(used_at);

-- JSONB indexes for complex queries
CREATE INDEX IF NOT EXISTS idx_tech_stack_languages ON tech_stack_detections USING GIN (languages);
CREATE INDEX IF NOT EXISTS idx_tech_stack_frameworks ON tech_stack_detections USING GIN (frameworks);
CREATE INDEX IF NOT EXISTS idx_tech_stack_dependencies ON tech_stack_detections USING GIN (dependencies);

-- ============================================
-- EXTERNAL TOOLS TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS update_external_tools_updated_at ON external_tools;
CREATE TRIGGER update_external_tools_updated_at BEFORE UPDATE ON external_tools
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_role_tool_permissions_updated_at ON role_tool_permissions;
CREATE TRIGGER update_role_tool_permissions_updated_at BEFORE UPDATE ON role_tool_permissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- EXTERNAL TOOLS VIEWS
-- ============================================

-- Available tools per role view
CREATE OR REPLACE VIEW role_available_tools AS
SELECT 
    rtp.role_type,
    et.tool_id,
    et.tool_name,
    et.category,
    et.description,
    rtp.permission,
    rtp.auto_install,
    et.trust_level,
    et.installation_time,
    et.disk_space_mb
FROM role_tool_permissions rtp
JOIN external_tools et ON rtp.tool_id = et.tool_id
WHERE et.is_active = true AND rtp.permission IN ('allowed', 'auto-approved')
ORDER BY rtp.role_type, et.category, et.tool_name;

-- Project tool installation status
CREATE OR REPLACE VIEW project_tool_status AS
SELECT 
    p.id as project_id,
    p.project_path,
    et.tool_id,
    et.tool_name,
    et.category,
    ti.installed_version,
    ti.is_working,
    ti.last_used,
    ti.usage_count,
    CASE 
        WHEN ti.id IS NOT NULL THEN 'installed'
        ELSE 'not_installed'
    END as installation_status
FROM projects p
CROSS JOIN external_tools et
LEFT JOIN tool_installations ti ON p.id = ti.project_id AND et.tool_id = ti.tool_id
WHERE et.is_active = true
ORDER BY p.project_path, et.category, et.tool_name;

-- Tool recommendation summary
CREATE OR REPLACE VIEW project_tool_recommendations AS
SELECT 
    p.project_name,
    p.project_path,
    tr.role_type,
    et.tool_name,
    et.category,
    tr.confidence_score,
    tr.urgency,
    tr.timing,
    tr.recommendation_status,
    tr.created_at as recommended_at
FROM tool_recommendations tr
JOIN projects p ON tr.project_id = p.id
JOIN external_tools et ON tr.tool_id = et.tool_id
WHERE tr.recommendation_status = 'pending'
ORDER BY tr.urgency DESC, tr.confidence_score DESC, tr.created_at DESC;

-- ============================================
-- SEQUENTIAL WORKFLOW CONFIGURATION
-- ============================================

INSERT INTO system_config (config_key, config_value, config_type, description, is_global) VALUES
    ('sequential_workflows_enabled', 'true', 'boolean', 'Enable sequential workflow orchestration', true),
    ('redis_host', '"codemind-redis"', 'string', 'Redis server host for message queuing', true),
    ('redis_port', '6379', 'number', 'Redis server port', true),
    ('default_workflow_timeout_minutes', '30', 'number', 'Default workflow timeout in minutes', true),
    ('max_workflow_retries', '3', 'number', 'Maximum retries per workflow role', true),
    ('role_processing_timeout_seconds', '300', 'number', 'Timeout for individual role processing', true),
    ('queue_monitoring_interval_seconds', '30', 'number', 'Interval for Redis queue status monitoring', true),
    ('workflow_cleanup_age_days', '7', 'number', 'Age in days after which to cleanup completed workflows', true),
    ('max_concurrent_workflows', '10', 'number', 'Maximum concurrent sequential workflows', true),
    ('role_terminal_workers', '5', 'number', 'Number of role terminal worker instances', true),
    ('external_tools_enabled', 'true', 'boolean', 'Enable external tool management system', true),
    ('auto_tool_recommendations', 'true', 'boolean', 'Enable automatic tool recommendations', true),
    ('tool_permission_timeout_hours', '24', 'number', 'Hours to remember user tool permission decisions', true),
    ('max_tool_installations_per_project', '50', 'number', 'Maximum tools that can be installed per project', true),
    ('tool_usage_analytics', 'true', 'boolean', 'Enable tool usage analytics collection', true)
ON CONFLICT (config_key) DO NOTHING;
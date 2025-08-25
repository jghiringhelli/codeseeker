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
$$ LANGUAGE 'plpgsql';

-- Auto-update triggers
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_initialization_updated_at BEFORE UPDATE ON initialization_progress
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patterns_updated_at BEFORE UPDATE ON detected_patterns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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
$$ LANGUAGE 'plpgsql';

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

CREATE TRIGGER update_orchestration_updated_at BEFORE UPDATE ON orchestration_processes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_role_activities_updated_at BEFORE UPDATE ON ai_role_activities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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
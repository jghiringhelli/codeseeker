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
    ('postgres_version', '"1.0.0"', 'string', 'PostgreSQL schema version', true)
ON CONFLICT (config_key) DO NOTHING;
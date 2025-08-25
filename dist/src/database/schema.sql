-- Intelligent Code Auxiliary System Database Schema
-- SQLite database for storing analysis results, patterns, and progress

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- ============================================
-- INITIALIZATION AND PROGRESS TRACKING
-- ============================================

-- Track initialization progress for resumable processing
CREATE TABLE initialization_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_path TEXT UNIQUE NOT NULL,
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
  progress_data TEXT NOT NULL, -- JSON with ProcessingProgress data
  tech_stack_data TEXT, -- JSON with detected tech stack information
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_initialization_project_path ON initialization_progress(project_path);
CREATE INDEX idx_initialization_resume_token ON initialization_progress(resume_token);
CREATE INDEX idx_initialization_phase ON initialization_progress(phase);

-- ============================================
-- PATTERN DETECTION AND ANALYSIS
-- ============================================

-- Store detected architectural and design patterns
CREATE TABLE detected_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_path TEXT NOT NULL,
  pattern_type TEXT NOT NULL CHECK (
    pattern_type IN ('architecture', 'design_pattern', 'coding_standard', 'testing_pattern')
  ),
  pattern_name TEXT NOT NULL,
  confidence_score REAL NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  evidence TEXT NOT NULL, -- JSON array of Evidence objects
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_patterns_project_path ON detected_patterns(project_path);
CREATE INDEX idx_patterns_type ON detected_patterns(pattern_type);
CREATE INDEX idx_patterns_confidence ON detected_patterns(confidence_score);

-- ============================================
-- SMART QUESTIONNAIRE SYSTEM
-- ============================================

-- Store user responses to setup questionnaires
CREATE TABLE questionnaire_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_path TEXT NOT NULL,
  category TEXT NOT NULL CHECK (
    category IN ('architecture', 'standards', 'patterns', 'purpose', 'quality')
  ),
  question_id TEXT NOT NULL,
  response TEXT NOT NULL,
  metadata TEXT, -- JSON with additional response context
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_responses_project_path ON questionnaire_responses(project_path);
CREATE INDEX idx_responses_category ON questionnaire_responses(category);
CREATE INDEX idx_responses_question_id ON questionnaire_responses(question_id);

-- ============================================
-- ANALYSIS RESULTS STORAGE
-- ============================================

-- Store various types of analysis results
CREATE TABLE analysis_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_path TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_hash TEXT NOT NULL, -- SHA-256 hash of file content for change detection
  analysis_type TEXT NOT NULL CHECK (
    analysis_type IN ('pattern', 'quality', 'architecture', 'tech_stack', 'duplication')
  ),
  analysis_result TEXT NOT NULL, -- JSON with analysis-specific results
  confidence_score REAL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_analysis_project_path ON analysis_results(project_path);
CREATE INDEX idx_analysis_file_path ON analysis_results(file_path);
CREATE INDEX idx_analysis_type ON analysis_results(analysis_type);
CREATE INDEX idx_analysis_hash ON analysis_results(file_hash);

-- ============================================
-- PROJECT METADATA AND CONTEXT
-- ============================================

-- Store project metadata and context information
CREATE TABLE project_metadata (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_path TEXT UNIQUE NOT NULL,
  project_name TEXT NOT NULL,
  project_type TEXT CHECK (
    project_type IN (
      'web_application', 'api_service', 'library', 'mobile_app', 
      'desktop_app', 'cli_tool', 'unknown'
    )
  ),
  languages TEXT NOT NULL, -- JSON array of detected languages
  frameworks TEXT, -- JSON array of detected frameworks
  project_size TEXT CHECK (
    project_size IN ('small', 'medium', 'large', 'enterprise')
  ),
  domain TEXT, -- Business domain (e-commerce, healthcare, etc.)
  total_files INTEGER DEFAULT 0,
  total_lines INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_metadata_project_path ON project_metadata(project_path);
CREATE INDEX idx_metadata_project_type ON project_metadata(project_type);
CREATE INDEX idx_metadata_size ON project_metadata(project_size);

-- ============================================
-- RESUME STATE MANAGEMENT
-- ============================================

-- Store resumable analyzer state for complex operations
CREATE TABLE resume_state (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resume_token TEXT UNIQUE NOT NULL,
  project_path TEXT NOT NULL,
  analyzer_type TEXT NOT NULL,
  state_data TEXT NOT NULL, -- JSON with analyzer-specific state
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_resume_token ON resume_state(resume_token);
CREATE INDEX idx_resume_project_path ON resume_state(project_path);
CREATE INDEX idx_resume_expires ON resume_state(expires_at);

-- ============================================
-- SYSTEM CONFIGURATION AND SETTINGS
-- ============================================

-- Store system-wide and project-specific configuration
CREATE TABLE system_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  config_key TEXT UNIQUE NOT NULL,
  config_value TEXT NOT NULL,
  config_type TEXT DEFAULT 'string' CHECK (
    config_type IN ('string', 'number', 'boolean', 'json')
  ),
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_config_key ON system_config(config_key);

-- ============================================
-- PERFORMANCE AND ANALYTICS
-- ============================================

-- Track operation performance for optimization
CREATE TABLE operation_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation_type TEXT NOT NULL,
  project_path TEXT,
  duration_ms INTEGER NOT NULL,
  files_processed INTEGER DEFAULT 0,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  metadata TEXT, -- JSON with operation-specific metrics
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_metrics_operation_type ON operation_metrics(operation_type);
CREATE INDEX idx_metrics_project_path ON operation_metrics(project_path);
CREATE INDEX idx_metrics_duration ON operation_metrics(duration_ms);
CREATE INDEX idx_metrics_created_at ON operation_metrics(created_at);

-- ============================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- ============================================

-- Auto-update timestamps for initialization_progress
CREATE TRIGGER update_initialization_timestamp 
  AFTER UPDATE ON initialization_progress
  BEGIN
    UPDATE initialization_progress 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE id = NEW.id;
  END;

-- Auto-update timestamps for project_metadata
CREATE TRIGGER update_metadata_timestamp 
  AFTER UPDATE ON project_metadata
  BEGIN
    UPDATE project_metadata 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE id = NEW.id;
  END;

-- ============================================
-- CLEANUP TRIGGERS
-- ============================================

-- Automatically clean up expired resume state
CREATE TRIGGER cleanup_expired_resume_state
  AFTER INSERT ON resume_state
  BEGIN
    DELETE FROM resume_state 
    WHERE expires_at < CURRENT_TIMESTAMP;
  END;

-- ============================================
-- INITIAL SYSTEM CONFIGURATION
-- ============================================

-- Insert default system configuration
INSERT INTO system_config (config_key, config_value, config_type, description) VALUES
  ('max_batch_size', '100', 'number', 'Maximum batch size for file processing'),
  ('default_resume_timeout_hours', '24', 'number', 'Default timeout for resume tokens in hours'),
  ('max_file_size_mb', '10', 'number', 'Maximum file size to analyze in MB'),
  ('enable_caching', 'true', 'boolean', 'Enable analysis result caching'),
  ('cache_ttl_hours', '168', 'number', 'Cache time-to-live in hours (default: 1 week)'),
  ('supported_extensions', '["ts","js","py","java","cpp","cs","go","rs","php","rb"]', 'json', 'Supported file extensions for analysis'),
  ('excluded_directories', '["node_modules","dist","build",".git","coverage"]', 'json', 'Directories to exclude from analysis'),
  ('system_version', '0.1.0', 'string', 'Current system version');

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- View for active initialization processes
CREATE VIEW active_initializations AS
SELECT 
  ip.*,
  pm.project_name,
  pm.project_type,
  pm.total_files
FROM initialization_progress ip
LEFT JOIN project_metadata pm ON ip.project_path = pm.project_path
WHERE ip.phase != 'completed';

-- View for project analysis summary
CREATE VIEW project_analysis_summary AS
SELECT 
  pm.project_path,
  pm.project_name,
  pm.project_type,
  COUNT(DISTINCT dp.pattern_type) as detected_pattern_types,
  COUNT(DISTINCT ar.analysis_type) as analysis_types_completed,
  COUNT(DISTINCT qr.category) as questionnaire_categories_completed,
  MAX(ip.updated_at) as last_activity
FROM project_metadata pm
LEFT JOIN detected_patterns dp ON pm.project_path = dp.project_path
LEFT JOIN analysis_results ar ON pm.project_path = ar.project_path
LEFT JOIN questionnaire_responses qr ON pm.project_path = qr.project_path
LEFT JOIN initialization_progress ip ON pm.project_path = ip.project_path
GROUP BY pm.project_path, pm.project_name, pm.project_type;
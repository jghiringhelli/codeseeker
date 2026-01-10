-- Phase 2 Database Schema Extensions
-- Required tables for Phase 2 features as specified in docs/phases/phase-2.md

-- CLI interaction tracking
-- Tracks all CLI commands for analytics and self-improvement
CREATE TABLE IF NOT EXISTS cli_interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  command TEXT NOT NULL,
  arguments TEXT,
  options TEXT, -- JSON string of options
  project_path TEXT,
  context_size INTEGER,
  response_time INTEGER, -- milliseconds
  success BOOLEAN DEFAULT 1,
  error_message TEXT,
  user_satisfaction INTEGER, -- 1-5 rating if provided
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for performance analysis
CREATE INDEX IF NOT EXISTS idx_cli_interactions_command ON cli_interactions(command);
CREATE INDEX IF NOT EXISTS idx_cli_interactions_created ON cli_interactions(created_at);
CREATE INDEX IF NOT EXISTS idx_cli_interactions_project ON cli_interactions(project_path);

-- Advanced duplications with refactoring
-- Stores detected code duplications and refactoring strategies
CREATE TABLE IF NOT EXISTS advanced_duplications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_path TEXT NOT NULL,
  group_id TEXT NOT NULL, -- Groups related duplicates
  source_block TEXT NOT NULL, -- JSON with location and code
  duplicate_blocks TEXT NOT NULL, -- JSON array of duplicate locations
  similarity_type TEXT NOT NULL CHECK (similarity_type IN ('structural', 'semantic', 'exact')),
  similarity_score REAL NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 1),
  refactoring_strategy TEXT, -- JSON with strategy and effort
  refactoring_approach TEXT, -- extract_method, extract_class, parameterize, etc.
  estimated_effort TEXT, -- low, medium, high
  applied BOOLEAN DEFAULT 0,
  applied_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for duplication queries
CREATE INDEX IF NOT EXISTS idx_duplications_project ON advanced_duplications(project_path);
CREATE INDEX IF NOT EXISTS idx_duplications_group ON advanced_duplications(group_id);
CREATE INDEX IF NOT EXISTS idx_duplications_type ON advanced_duplications(similarity_type);
CREATE INDEX IF NOT EXISTS idx_duplications_score ON advanced_duplications(similarity_score);

-- Tree navigation cache
-- Caches dependency trees for faster navigation
CREATE TABLE IF NOT EXISTS dependency_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_path TEXT NOT NULL,
  root_node TEXT NOT NULL,
  dependency_tree TEXT NOT NULL, -- JSON tree structure
  circular_deps TEXT, -- JSON array of circular dependencies
  tree_depth INTEGER,
  total_nodes INTEGER,
  total_edges INTEGER,
  cache_key TEXT NOT NULL, -- Hash of configuration for cache invalidation
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_path, root_node, cache_key)
);

-- Indexes for tree navigation
CREATE INDEX IF NOT EXISTS idx_dependency_cache_project ON dependency_cache(project_path);
CREATE INDEX IF NOT EXISTS idx_dependency_cache_updated ON dependency_cache(last_updated);

-- Vector embeddings for semantic search
-- Stores code embeddings for similarity search
CREATE TABLE IF NOT EXISTS code_embeddings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_path TEXT NOT NULL,
  file_path TEXT NOT NULL,
  code_hash TEXT NOT NULL, -- SHA256 of code content
  embedding_vector BLOB NOT NULL, -- Serialized vector (e.g., numpy array)
  embedding_model TEXT NOT NULL, -- Model used for embedding
  code_metadata TEXT NOT NULL, -- JSON with context (function, class, etc.)
  code_snippet TEXT, -- Actual code for reference
  language TEXT,
  token_count INTEGER,
  indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_path, file_path, code_hash)
);

-- Indexes for vector search
CREATE INDEX IF NOT EXISTS idx_embeddings_project ON code_embeddings(project_path);
CREATE INDEX IF NOT EXISTS idx_embeddings_file ON code_embeddings(file_path);
CREATE INDEX IF NOT EXISTS idx_embeddings_hash ON code_embeddings(code_hash);
CREATE INDEX IF NOT EXISTS idx_embeddings_indexed ON code_embeddings(indexed_at);

-- Centralization opportunities
-- Tracks scattered configurations that can be centralized
CREATE TABLE IF NOT EXISTS centralization_analysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_path TEXT NOT NULL,
  config_type TEXT NOT NULL CHECK (config_type IN (
    'api_endpoints', 'constants', 'validation_rules', 
    'error_messages', 'feature_flags', 'environment_config',
    'database_config', 'logging_config', 'security_config', 'other'
  )),
  config_name TEXT, -- Identified configuration name
  scattered_locations TEXT NOT NULL, -- JSON array of file locations
  location_count INTEGER NOT NULL,
  consolidation_target TEXT, -- Suggested target location
  consolidation_format TEXT CHECK (consolidation_format IN (
    'json', 'yaml', 'typescript', 'javascript', 'env', 'ini', 'toml'
  )),
  migration_plan TEXT, -- JSON with steps and risks
  benefit_score REAL NOT NULL CHECK (benefit_score >= 0 AND benefit_score <= 10),
  complexity_score REAL NOT NULL CHECK (complexity_score >= 0 AND complexity_score <= 10),
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  status TEXT DEFAULT 'identified' CHECK (status IN (
    'identified', 'planned', 'in_progress', 'applied', 'rejected'
  )),
  applied_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for centralization analysis
CREATE INDEX IF NOT EXISTS idx_centralization_project ON centralization_analysis(project_path);
CREATE INDEX IF NOT EXISTS idx_centralization_type ON centralization_analysis(config_type);
CREATE INDEX IF NOT EXISTS idx_centralization_status ON centralization_analysis(status);
CREATE INDEX IF NOT EXISTS idx_centralization_benefit ON centralization_analysis(benefit_score);

-- Performance metrics for features
-- Tracks performance of each Phase 2 feature
CREATE TABLE IF NOT EXISTS feature_performance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  feature_name TEXT NOT NULL CHECK (feature_name IN (
    'duplication_detection', 'tree_navigation', 'vector_search',
    'centralization_detection', 'context_optimization'
  )),
  project_path TEXT,
  operation TEXT NOT NULL, -- Specific operation within feature
  execution_time INTEGER NOT NULL, -- milliseconds
  memory_used INTEGER, -- bytes
  items_processed INTEGER,
  items_returned INTEGER,
  cache_hit BOOLEAN DEFAULT 0,
  error_occurred BOOLEAN DEFAULT 0,
  error_message TEXT,
  metadata TEXT, -- JSON with additional metrics
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance analysis
CREATE INDEX IF NOT EXISTS idx_performance_feature ON feature_performance(feature_name);
CREATE INDEX IF NOT EXISTS idx_performance_time ON feature_performance(execution_time);
CREATE INDEX IF NOT EXISTS idx_performance_created ON feature_performance(created_at);

-- Self-improvement tracking
-- Tracks when we use our own tools on our codebase
CREATE TABLE IF NOT EXISTS self_improvement (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  feature_used TEXT NOT NULL,
  target_file TEXT NOT NULL,
  improvement_type TEXT NOT NULL CHECK (improvement_type IN (
    'duplication_removed', 'dependency_optimized', 'config_centralized',
    'context_optimized', 'pattern_applied', 'refactoring_applied'
  )),
  before_state TEXT, -- JSON snapshot before change
  after_state TEXT, -- JSON snapshot after change
  metrics_before TEXT, -- JSON with metrics
  metrics_after TEXT, -- JSON with metrics
  improvement_score REAL, -- Calculated improvement
  applied_by TEXT DEFAULT 'codeseeker', -- Tool or user
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for self-improvement tracking
CREATE INDEX IF NOT EXISTS idx_self_improvement_feature ON self_improvement(feature_used);
CREATE INDEX IF NOT EXISTS idx_self_improvement_type ON self_improvement(improvement_type);
CREATE INDEX IF NOT EXISTS idx_self_improvement_created ON self_improvement(created_at);

-- Views for analytics and reporting

-- CLI usage analytics view
CREATE VIEW IF NOT EXISTS cli_usage_stats AS
SELECT 
  command,
  COUNT(*) as usage_count,
  AVG(response_time) as avg_response_time,
  MIN(response_time) as min_response_time,
  MAX(response_time) as max_response_time,
  SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate,
  AVG(user_satisfaction) as avg_satisfaction,
  DATE(created_at) as usage_date
FROM cli_interactions
GROUP BY command, DATE(created_at);

-- Duplication impact view
CREATE VIEW IF NOT EXISTS duplication_impact AS
SELECT 
  project_path,
  similarity_type,
  COUNT(DISTINCT group_id) as duplication_groups,
  AVG(similarity_score) as avg_similarity,
  SUM(CASE WHEN applied = 1 THEN 1 ELSE 0 END) as refactorings_applied,
  COUNT(*) as total_duplicates
FROM advanced_duplications
GROUP BY project_path, similarity_type;

-- Centralization potential view
CREATE VIEW IF NOT EXISTS centralization_potential AS
SELECT 
  project_path,
  config_type,
  COUNT(*) as opportunity_count,
  AVG(benefit_score) as avg_benefit,
  AVG(complexity_score) as avg_complexity,
  SUM(location_count) as total_scattered_locations,
  SUM(CASE WHEN status = 'applied' THEN 1 ELSE 0 END) as applied_count
FROM centralization_analysis
GROUP BY project_path, config_type;

-- Feature performance summary view
CREATE VIEW IF NOT EXISTS feature_performance_summary AS
SELECT 
  feature_name,
  COUNT(*) as total_operations,
  AVG(execution_time) as avg_execution_time,
  MAX(execution_time) as max_execution_time,
  SUM(items_processed) as total_items_processed,
  SUM(CASE WHEN cache_hit = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as cache_hit_rate,
  SUM(CASE WHEN error_occurred = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as error_rate,
  DATE(created_at) as operation_date
FROM feature_performance
GROUP BY feature_name, DATE(created_at);

-- Self-improvement progress view
CREATE VIEW IF NOT EXISTS self_improvement_progress AS
SELECT 
  feature_used,
  improvement_type,
  COUNT(*) as improvements_made,
  AVG(improvement_score) as avg_improvement,
  DATE(created_at) as improvement_date
FROM self_improvement
GROUP BY feature_used, improvement_type, DATE(created_at)
ORDER BY improvement_date DESC;
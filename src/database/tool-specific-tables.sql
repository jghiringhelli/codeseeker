-- ============================================
-- TOOL-SPECIFIC DATA STORAGE TABLES
-- ============================================
-- Dedicated tables for each internal tool to store analysis results

-- Enable vector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- TREE NAVIGATION TOOL
-- ============================================

CREATE TABLE IF NOT EXISTS tree_navigation_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  node_type TEXT NOT NULL CHECK (node_type IN ('file', 'directory', 'class', 'function', 'method', 'variable')),
  node_name TEXT NOT NULL,
  parent_path TEXT,
  depth INTEGER NOT NULL DEFAULT 0,
  children_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb, -- imports, exports, dependencies
  relationships JSONB DEFAULT '[]'::jsonb, -- connections to other nodes
  complexity_score INTEGER DEFAULT 0,
  last_modified TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tree_nav_project ON tree_navigation_data(project_id);
CREATE INDEX idx_tree_nav_path ON tree_navigation_data(file_path);
CREATE INDEX idx_tree_nav_parent ON tree_navigation_data(parent_path);
CREATE INDEX idx_tree_nav_type ON tree_navigation_data(node_type);

-- ============================================
-- DUPLICATION DETECTOR
-- ============================================

CREATE TABLE IF NOT EXISTS code_duplications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  duplication_type TEXT NOT NULL CHECK (duplication_type IN ('exact', 'similar', 'structural', 'semantic')),
  similarity_score DECIMAL(3,2) NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 1),
  source_file TEXT NOT NULL,
  source_start_line INTEGER NOT NULL,
  source_end_line INTEGER NOT NULL,
  target_file TEXT NOT NULL,
  target_start_line INTEGER NOT NULL,
  target_end_line INTEGER NOT NULL,
  code_snippet TEXT,
  tokens_count INTEGER,
  refactor_suggestion TEXT,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT DEFAULT 'detected' CHECK (status IN ('detected', 'acknowledged', 'fixed', 'ignored')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_duplication_project ON code_duplications(project_id);
CREATE INDEX idx_duplication_type ON code_duplications(duplication_type);
CREATE INDEX idx_duplication_score ON code_duplications(similarity_score DESC);
CREATE INDEX idx_duplication_status ON code_duplications(status);

-- ============================================
-- CENTRALIZATION DETECTOR
-- ============================================

CREATE TABLE IF NOT EXISTS centralization_opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  opportunity_type TEXT NOT NULL CHECK (opportunity_type IN ('scattered_logic', 'repeated_pattern', 'cross_cutting_concern', 'shared_utility')),
  pattern_name TEXT NOT NULL,
  occurrences INTEGER NOT NULL DEFAULT 2,
  affected_files TEXT[] NOT NULL,
  centralization_benefit TEXT NOT NULL, -- description of benefit
  suggested_location TEXT, -- where to centralize
  suggested_approach TEXT, -- how to centralize
  complexity_reduction DECIMAL(3,2), -- 0-1 score
  priority TEXT CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT DEFAULT 'identified' CHECK (status IN ('identified', 'in_progress', 'completed', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_centralization_project ON centralization_opportunities(project_id);
CREATE INDEX idx_centralization_type ON centralization_opportunities(opportunity_type);
CREATE INDEX idx_centralization_priority ON centralization_opportunities(priority);

-- ============================================
-- TEST COVERAGE TOOL
-- ============================================

CREATE TABLE IF NOT EXISTS test_coverage_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  coverage_type TEXT NOT NULL CHECK (coverage_type IN ('line', 'branch', 'function', 'statement')),
  total_items INTEGER NOT NULL DEFAULT 0,
  covered_items INTEGER NOT NULL DEFAULT 0,
  coverage_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  uncovered_lines TEXT[], -- line numbers not covered
  test_files TEXT[], -- test files covering this file
  complexity_score INTEGER,
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  last_test_run TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_coverage_project ON test_coverage_data(project_id);
CREATE INDEX idx_coverage_file ON test_coverage_data(file_path);
CREATE INDEX idx_coverage_percentage ON test_coverage_data(coverage_percentage);
CREATE INDEX idx_coverage_risk ON test_coverage_data(risk_level);

-- ============================================
-- COMPILATION VERIFIER
-- ============================================

CREATE TABLE IF NOT EXISTS compilation_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  build_id TEXT NOT NULL,
  build_status TEXT NOT NULL CHECK (build_status IN ('success', 'warning', 'error', 'failed')),
  compiler TEXT NOT NULL, -- tsc, babel, webpack, etc.
  total_files INTEGER DEFAULT 0,
  successful_files INTEGER DEFAULT 0,
  files_with_errors INTEGER DEFAULT 0,
  files_with_warnings INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb, -- detailed error information
  warnings JSONB DEFAULT '[]'::jsonb, -- detailed warning information
  build_time_ms INTEGER,
  output_size_bytes BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compilation_issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  build_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  line_number INTEGER,
  column_number INTEGER,
  issue_type TEXT NOT NULL CHECK (issue_type IN ('syntax', 'type', 'reference', 'import', 'other')),
  severity TEXT NOT NULL CHECK (severity IN ('error', 'warning', 'info')),
  message TEXT NOT NULL,
  suggestion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_compilation_project ON compilation_results(project_id);
CREATE INDEX idx_compilation_status ON compilation_results(build_status);
CREATE INDEX idx_compilation_issues_project ON compilation_issues(project_id);
CREATE INDEX idx_compilation_issues_file ON compilation_issues(file_path);
CREATE INDEX idx_compilation_issues_severity ON compilation_issues(severity);

-- ============================================
-- SOLID PRINCIPLES ANALYZER
-- ============================================

CREATE TABLE IF NOT EXISTS solid_violations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  class_name TEXT,
  principle TEXT NOT NULL CHECK (principle IN ('SRP', 'OCP', 'LSP', 'ISP', 'DIP')),
  violation_type TEXT NOT NULL,
  description TEXT NOT NULL,
  line_number INTEGER,
  severity TEXT CHECK (severity IN ('minor', 'moderate', 'major', 'critical')),
  refactoring_suggestion TEXT,
  estimated_effort TEXT CHECK (estimated_effort IN ('trivial', 'small', 'medium', 'large')),
  status TEXT DEFAULT 'detected' CHECK (status IN ('detected', 'acknowledged', 'fixed', 'wont_fix')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_solid_project ON solid_violations(project_id);
CREATE INDEX idx_solid_file ON solid_violations(file_path);
CREATE INDEX idx_solid_principle ON solid_violations(principle);
CREATE INDEX idx_solid_severity ON solid_violations(severity);

-- ============================================
-- UI NAVIGATION ANALYZER
-- ============================================

CREATE TABLE IF NOT EXISTS ui_components (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  component_name TEXT NOT NULL,
  component_type TEXT NOT NULL CHECK (component_type IN ('page', 'layout', 'widget', 'modal', 'form', 'navigation')),
  file_path TEXT NOT NULL,
  parent_component TEXT,
  children_components TEXT[],
  props JSONB DEFAULT '{}'::jsonb,
  state_management JSONB DEFAULT '{}'::jsonb,
  routes TEXT[], -- associated routes
  dependencies TEXT[], -- other components it depends on
  complexity_score INTEGER,
  accessibility_score DECIMAL(3,2),
  performance_score DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ui_navigation_flows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  flow_name TEXT NOT NULL,
  start_component TEXT NOT NULL,
  end_component TEXT NOT NULL,
  steps JSONB NOT NULL, -- array of navigation steps
  user_actions TEXT[], -- click, submit, navigate, etc.
  complexity TEXT CHECK (complexity IN ('simple', 'moderate', 'complex')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ui_component_project ON ui_components(project_id);
CREATE INDEX idx_ui_component_type ON ui_components(component_type);
CREATE INDEX idx_ui_flow_project ON ui_navigation_flows(project_id);

-- ============================================
-- SEMANTIC SEARCH (Vector Storage)
-- ============================================

CREATE TABLE IF NOT EXISTS code_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  chunk_index INTEGER NOT NULL, -- for large files split into chunks
  content_type TEXT NOT NULL CHECK (content_type IN ('function', 'class', 'module', 'comment', 'documentation')),
  content TEXT NOT NULL,
  embedding vector(384), -- OpenAI text-embedding-3-small dimension
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, file_path, chunk_index)
);

-- Vector similarity search index
CREATE INDEX idx_embeddings_vector ON code_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_embeddings_project ON code_embeddings(project_id);
CREATE INDEX idx_embeddings_file ON code_embeddings(file_path);

-- ============================================
-- DOCUMENTATION MAP ANALYZER
-- ============================================

CREATE TABLE IF NOT EXISTS documentation_structure (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('readme', 'api', 'guide', 'tutorial', 'reference', 'changelog')),
  file_path TEXT NOT NULL,
  title TEXT,
  sections JSONB DEFAULT '[]'::jsonb, -- hierarchical section structure
  links JSONB DEFAULT '[]'::jsonb, -- internal and external links
  code_references TEXT[], -- files referenced in documentation
  completeness_score DECIMAL(3,2),
  quality_score DECIMAL(3,2),
  last_updated TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_doc_project ON documentation_structure(project_id);
CREATE INDEX idx_doc_type ON documentation_structure(doc_type);

-- ============================================
-- USE CASE ANALYZER
-- ============================================

CREATE TABLE IF NOT EXISTS use_cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  use_case_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('user_story', 'feature', 'requirement', 'scenario')),
  description TEXT NOT NULL,
  actors TEXT[], -- user roles involved
  preconditions TEXT[],
  postconditions TEXT[],
  main_flow JSONB NOT NULL, -- steps in the use case
  alternate_flows JSONB DEFAULT '[]'::jsonb,
  related_files TEXT[], -- code files implementing this use case
  test_coverage BOOLEAN DEFAULT false,
  implementation_status TEXT CHECK (implementation_status IN ('planned', 'in_progress', 'implemented', 'deprecated')),
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_use_case_project ON use_cases(project_id);
CREATE INDEX idx_use_case_category ON use_cases(category);
CREATE INDEX idx_use_case_status ON use_cases(implementation_status);

-- ============================================
-- DATABASE SCHEMA ANALYZER
-- ============================================

CREATE TABLE IF NOT EXISTS database_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  schema_name TEXT NOT NULL,
  table_name TEXT NOT NULL,
  column_name TEXT,
  data_type TEXT,
  constraints TEXT[],
  indexes TEXT[],
  relationships JSONB DEFAULT '{}'::jsonb, -- foreign keys, references
  query_patterns JSONB DEFAULT '[]'::jsonb, -- common query patterns
  performance_metrics JSONB DEFAULT '{}'::jsonb,
  optimization_suggestions TEXT[],
  last_analyzed TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_db_analysis_project ON database_analysis(project_id);
CREATE INDEX idx_db_analysis_table ON database_analysis(table_name);
CREATE INDEX idx_db_analysis_schema ON database_analysis(schema_name);

-- ============================================
-- PATTERN DETECTION TOOL
-- ============================================

CREATE TABLE IF NOT EXISTS detected_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  pattern_type TEXT NOT NULL CHECK (pattern_type IN (
    'architecture', 'design', 'coding', 'antipattern', 'best_practice'
  )),
  pattern_name TEXT NOT NULL,
  pattern_category TEXT, -- MVC, Observer, Factory, etc.
  files_involved TEXT[] NOT NULL,
  evidence JSONB DEFAULT '{}'::jsonb, -- code snippets, structure info
  confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  implementation_quality TEXT CHECK (implementation_quality IN ('poor', 'fair', 'good', 'excellent')),
  suggestions TEXT[],
  status TEXT DEFAULT 'detected' CHECK (status IN ('detected', 'verified', 'false_positive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_patterns_project ON detected_patterns(project_id);
CREATE INDEX idx_patterns_type ON detected_patterns(pattern_type);
CREATE INDEX idx_patterns_confidence ON detected_patterns(confidence_score DESC);

-- ============================================
-- CLAUDE DECISIONS TRACKER
-- ============================================

CREATE TABLE IF NOT EXISTS claude_decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  decision_type TEXT NOT NULL CHECK (decision_type IN (
    'tool_selection', 'architecture', 'refactoring', 'optimization', 'debugging'
  )),
  context JSONB NOT NULL, -- user request, codebase state
  decision JSONB NOT NULL, -- what was decided
  reasoning TEXT,
  confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  alternatives JSONB DEFAULT '[]'::jsonb, -- other options considered
  outcome TEXT, -- success, failure, partial
  tokens_used INTEGER,
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_claude_decisions_project ON claude_decisions(project_id);
CREATE INDEX idx_claude_decisions_type ON claude_decisions(decision_type);
CREATE INDEX idx_claude_decisions_confidence ON claude_decisions(confidence DESC);

-- ============================================
-- NEO4J CONNECTION INFO (SEMANTIC GRAPH)
-- ============================================

CREATE TABLE IF NOT EXISTS neo4j_sync_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  last_sync TIMESTAMPTZ,
  nodes_count INTEGER DEFAULT 0,
  relationships_count INTEGER DEFAULT 0,
  sync_status TEXT CHECK (sync_status IN ('pending', 'syncing', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_neo4j_project ON neo4j_sync_status(project_id);

-- ============================================
-- UPDATE TRIGGERS FOR NEW TABLES
-- ============================================

CREATE TRIGGER update_tree_nav_updated_at BEFORE UPDATE ON tree_navigation_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_duplications_updated_at BEFORE UPDATE ON code_duplications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_centralization_updated_at BEFORE UPDATE ON centralization_opportunities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_coverage_updated_at BEFORE UPDATE ON test_coverage_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_solid_updated_at BEFORE UPDATE ON solid_violations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ui_components_updated_at BEFORE UPDATE ON ui_components
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_embeddings_updated_at BEFORE UPDATE ON code_embeddings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_doc_structure_updated_at BEFORE UPDATE ON documentation_structure
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_use_cases_updated_at BEFORE UPDATE ON use_cases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_db_analysis_updated_at BEFORE UPDATE ON database_analysis
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patterns_updated_at BEFORE UPDATE ON detected_patterns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_neo4j_sync_updated_at BEFORE UPDATE ON neo4j_sync_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
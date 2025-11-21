-- Migration Script: Tool-Based to Consolidated Architecture
-- Date: 2025-11-18
-- Purpose: Migrate from tool-specific tables to unified analysis_results table

-- Start transaction
BEGIN;

-- ============================================
-- 1. CREATE CONSOLIDATED SCHEMA
-- ============================================

-- Load the consolidated schema
\i src/database/schema.consolidated.sql

-- ============================================
-- 2. MIGRATE TOOL-SPECIFIC DATA TO analysis_results
-- ============================================

-- Migrate Tree Navigation Data
INSERT INTO analysis_results (
  project_id, file_path, file_hash, analysis_type, analysis_subtype,
  analysis_result, confidence_score, metadata, created_at
)
SELECT
  project_id,
  file_path,
  COALESCE(
    encode(sha256(file_path::bytea), 'hex'),
    'migrated-' || extract(epoch from NOW())::text
  ),
  'tree_navigation',
  node_type,
  jsonb_build_object(
    'node_name', node_name,
    'parent_path', parent_path,
    'depth', depth,
    'children_count', children_count,
    'relationships', relationships,
    'complexity_score', complexity_score,
    'last_modified', last_modified
  ),
  CASE
    WHEN complexity_score > 0 THEN complexity_score / 100.0
    ELSE NULL
  END,
  jsonb_build_object(
    'migrated_from', 'tree_navigation_data',
    'migration_date', NOW(),
    'original_node_type', node_type,
    'original_metadata', metadata
  ),
  created_at
FROM tree_navigation_data
WHERE EXISTS (SELECT 1 FROM tree_navigation_data);

-- Migrate Code Duplications
INSERT INTO analysis_results (
  project_id, file_path, file_hash, analysis_type, analysis_subtype,
  analysis_result, confidence_score, severity, status, metadata, created_at
)
SELECT
  project_id,
  source_file,
  COALESCE(
    encode(sha256((source_file || target_file)::bytea), 'hex'),
    'migrated-' || extract(epoch from NOW())::text
  ),
  'duplication',
  duplication_type,
  jsonb_build_object(
    'similarity_score', similarity_score,
    'source_file', source_file,
    'source_start_line', source_start_line,
    'source_end_line', source_end_line,
    'target_file', target_file,
    'target_start_line', target_start_line,
    'target_end_line', target_end_line,
    'code_snippet', code_snippet,
    'tokens_count', tokens_count,
    'refactor_suggestion', refactor_suggestion
  ),
  similarity_score,
  CASE
    WHEN priority = 'critical' THEN 'critical'
    WHEN priority = 'high' THEN 'major'
    WHEN priority = 'medium' THEN 'moderate'
    WHEN priority = 'low' THEN 'minor'
    ELSE 'info'
  END,
  status,
  jsonb_build_object(
    'migrated_from', 'code_duplications',
    'migration_date', NOW(),
    'original_priority', priority
  ),
  created_at
FROM code_duplications
WHERE EXISTS (SELECT 1 FROM code_duplications);

-- Migrate Centralization Opportunities
INSERT INTO analysis_results (
  project_id, file_path, file_hash, analysis_type, analysis_subtype,
  analysis_result, confidence_score, severity, status, metadata, created_at
)
SELECT
  project_id,
  COALESCE((affected_files->0)::text, 'multiple-files'),
  COALESCE(
    encode(sha256(pattern_name::bytea), 'hex'),
    'migrated-' || extract(epoch from NOW())::text
  ),
  'centralization',
  opportunity_type,
  jsonb_build_object(
    'pattern_name', pattern_name,
    'occurrences', occurrences,
    'affected_files', affected_files,
    'centralization_benefit', centralization_benefit,
    'suggested_location', suggested_location,
    'suggested_approach', suggested_approach,
    'complexity_reduction', complexity_reduction
  ),
  complexity_reduction,
  CASE
    WHEN priority = 'high' THEN 'major'
    WHEN priority = 'medium' THEN 'moderate'
    WHEN priority = 'low' THEN 'minor'
    ELSE 'info'
  END,
  status,
  jsonb_build_object(
    'migrated_from', 'centralization_opportunities',
    'migration_date', NOW(),
    'original_priority', priority
  ),
  created_at
FROM centralization_opportunities
WHERE EXISTS (SELECT 1 FROM centralization_opportunities);

-- Migrate Test Coverage Data
INSERT INTO analysis_results (
  project_id, file_path, file_hash, analysis_type, analysis_subtype,
  analysis_result, confidence_score, severity, metadata, created_at
)
SELECT
  project_id,
  file_path,
  COALESCE(
    encode(sha256(file_path::bytea), 'hex'),
    'migrated-' || extract(epoch from NOW())::text
  ),
  'test_coverage',
  coverage_type,
  jsonb_build_object(
    'total_items', total_items,
    'covered_items', covered_items,
    'coverage_percentage', coverage_percentage,
    'uncovered_lines', uncovered_lines,
    'test_files', test_files,
    'complexity_score', complexity_score,
    'last_test_run', last_test_run
  ),
  CASE
    WHEN coverage_percentage >= 80 THEN 0.9
    WHEN coverage_percentage >= 60 THEN 0.7
    WHEN coverage_percentage >= 40 THEN 0.5
    ELSE 0.3
  END,
  CASE
    WHEN risk_level = 'critical' THEN 'critical'
    WHEN risk_level = 'high' THEN 'major'
    WHEN risk_level = 'medium' THEN 'moderate'
    WHEN risk_level = 'low' THEN 'minor'
    ELSE 'info'
  END,
  jsonb_build_object(
    'migrated_from', 'test_coverage_data',
    'migration_date', NOW(),
    'original_risk_level', risk_level
  ),
  created_at
FROM test_coverage_data
WHERE EXISTS (SELECT 1 FROM test_coverage_data);

-- Migrate Compilation Results
INSERT INTO analysis_results (
  project_id, file_path, file_hash, analysis_type, analysis_subtype,
  analysis_result, confidence_score, severity, status, metadata, created_at
)
SELECT
  cr.project_id,
  COALESCE(ci.file_path, 'build-result'),
  COALESCE(cr.build_id, 'migrated-' || extract(epoch from NOW())::text),
  'compilation',
  COALESCE(ci.issue_type, 'build'),
  jsonb_build_object(
    'build_status', cr.build_status,
    'compiler', cr.compiler,
    'total_files', cr.total_files,
    'successful_files', cr.successful_files,
    'files_with_errors', cr.files_with_errors,
    'files_with_warnings', cr.files_with_warnings,
    'build_time_ms', cr.build_time_ms,
    'output_size_bytes', cr.output_size_bytes,
    'issue_message', ci.message,
    'line_number', ci.line_number,
    'column_number', ci.column_number,
    'suggestion', ci.suggestion
  ),
  CASE
    WHEN cr.build_status = 'success' THEN 0.9
    WHEN cr.build_status = 'warning' THEN 0.7
    WHEN cr.build_status = 'error' THEN 0.3
    ELSE 0.1
  END,
  CASE
    WHEN ci.severity = 'error' THEN 'major'
    WHEN ci.severity = 'warning' THEN 'moderate'
    ELSE 'info'
  END,
  CASE
    WHEN cr.build_status = 'success' THEN 'fixed'
    ELSE 'detected'
  END,
  jsonb_build_object(
    'migrated_from', 'compilation_results',
    'migration_date', NOW(),
    'original_build_id', cr.build_id
  ),
  cr.created_at
FROM compilation_results cr
LEFT JOIN compilation_issues ci ON cr.build_id = ci.build_id
WHERE EXISTS (SELECT 1 FROM compilation_results);

-- Migrate SOLID Violations
INSERT INTO analysis_results (
  project_id, file_path, file_hash, analysis_type, analysis_subtype,
  analysis_result, confidence_score, severity, status, metadata, created_at
)
SELECT
  project_id,
  file_path,
  COALESCE(
    encode(sha256((file_path || class_name || principle)::bytea), 'hex'),
    'migrated-' || extract(epoch from NOW())::text
  ),
  'solid_principles',
  principle,
  jsonb_build_object(
    'class_name', class_name,
    'violation_type', violation_type,
    'description', description,
    'line_number', line_number,
    'refactoring_suggestion', refactoring_suggestion,
    'estimated_effort', estimated_effort
  ),
  CASE
    WHEN severity = 'critical' THEN 0.9
    WHEN severity = 'major' THEN 0.8
    WHEN severity = 'moderate' THEN 0.6
    WHEN severity = 'minor' THEN 0.4
    ELSE 0.5
  END,
  severity,
  status,
  jsonb_build_object(
    'migrated_from', 'solid_violations',
    'migration_date', NOW(),
    'original_estimated_effort', estimated_effort
  ),
  created_at
FROM solid_violations
WHERE EXISTS (SELECT 1 FROM solid_violations);

-- Migrate UI Components
INSERT INTO analysis_results (
  project_id, file_path, file_hash, analysis_type, analysis_subtype,
  analysis_result, confidence_score, metadata, created_at
)
SELECT
  project_id,
  file_path,
  COALESCE(
    encode(sha256((file_path || component_name)::bytea), 'hex'),
    'migrated-' || extract(epoch from NOW())::text
  ),
  'ui_components',
  component_type,
  jsonb_build_object(
    'component_name', component_name,
    'parent_component', parent_component,
    'children_components', children_components,
    'props', props,
    'state_management', state_management,
    'routes', routes,
    'dependencies', dependencies,
    'complexity_score', complexity_score,
    'accessibility_score', accessibility_score,
    'performance_score', performance_score
  ),
  GREATEST(
    COALESCE(accessibility_score, 0),
    COALESCE(performance_score, 0)
  ),
  jsonb_build_object(
    'migrated_from', 'ui_components',
    'migration_date', NOW(),
    'original_complexity_score', complexity_score
  ),
  created_at
FROM ui_components
WHERE EXISTS (SELECT 1 FROM ui_components);

-- Migrate Documentation Structure
INSERT INTO analysis_results (
  project_id, file_path, file_hash, analysis_type, analysis_subtype,
  analysis_result, confidence_score, metadata, created_at
)
SELECT
  project_id,
  file_path,
  COALESCE(
    encode(sha256(file_path::bytea), 'hex'),
    'migrated-' || extract(epoch from NOW())::text
  ),
  'documentation',
  doc_type,
  jsonb_build_object(
    'title', title,
    'sections', sections,
    'links', links,
    'code_references', code_references,
    'completeness_score', completeness_score,
    'quality_score', quality_score,
    'last_updated', last_updated
  ),
  GREATEST(
    COALESCE(completeness_score, 0),
    COALESCE(quality_score, 0)
  ),
  jsonb_build_object(
    'migrated_from', 'documentation_structure',
    'migration_date', NOW()
  ),
  created_at
FROM documentation_structure
WHERE EXISTS (SELECT 1 FROM documentation_structure);

-- Migrate Use Cases
INSERT INTO analysis_results (
  project_id, file_path, file_hash, analysis_type, analysis_subtype,
  analysis_result, confidence_score, severity, status, metadata, created_at
)
SELECT
  project_id,
  COALESCE((related_files->0)::text, 'use-case-' || use_case_name),
  COALESCE(
    encode(sha256(use_case_name::bytea), 'hex'),
    'migrated-' || extract(epoch from NOW())::text
  ),
  'use_cases',
  category,
  jsonb_build_object(
    'use_case_name', use_case_name,
    'description', description,
    'actors', actors,
    'preconditions', preconditions,
    'postconditions', postconditions,
    'main_flow', main_flow,
    'alternate_flows', alternate_flows,
    'related_files', related_files,
    'test_coverage', test_coverage
  ),
  CASE
    WHEN implementation_status = 'implemented' THEN 0.9
    WHEN implementation_status = 'in_progress' THEN 0.6
    WHEN implementation_status = 'planned' THEN 0.3
    ELSE 0.1
  END,
  CASE
    WHEN priority = 'critical' THEN 'critical'
    WHEN priority = 'high' THEN 'major'
    WHEN priority = 'medium' THEN 'moderate'
    WHEN priority = 'low' THEN 'minor'
    ELSE 'info'
  END,
  CASE
    WHEN implementation_status = 'implemented' THEN 'fixed'
    WHEN implementation_status = 'deprecated' THEN 'ignored'
    ELSE 'detected'
  END,
  jsonb_build_object(
    'migrated_from', 'use_cases',
    'migration_date', NOW(),
    'original_priority', priority,
    'original_implementation_status', implementation_status
  ),
  created_at
FROM use_cases
WHERE EXISTS (SELECT 1 FROM use_cases);

-- Migrate Database Analysis
INSERT INTO analysis_results (
  project_id, file_path, file_hash, analysis_type, analysis_subtype,
  analysis_result, confidence_score, metadata, created_at
)
SELECT
  project_id,
  COALESCE(schema_name || '.' || table_name, 'database-analysis'),
  COALESCE(
    encode(sha256((schema_name || table_name || column_name)::bytea), 'hex'),
    'migrated-' || extract(epoch from NOW())::text
  ),
  'database_schema',
  CASE
    WHEN column_name IS NOT NULL THEN 'column'
    WHEN table_name IS NOT NULL THEN 'table'
    ELSE 'schema'
  END,
  jsonb_build_object(
    'schema_name', schema_name,
    'table_name', table_name,
    'column_name', column_name,
    'data_type', data_type,
    'constraints', constraints,
    'indexes', indexes,
    'relationships', relationships,
    'query_patterns', query_patterns,
    'performance_metrics', performance_metrics,
    'optimization_suggestions', optimization_suggestions
  ),
  0.8, -- Default confidence for database analysis
  jsonb_build_object(
    'migrated_from', 'database_analysis',
    'migration_date', NOW(),
    'last_analyzed', last_analyzed
  ),
  created_at
FROM database_analysis
WHERE EXISTS (SELECT 1 FROM database_analysis);

-- ============================================
-- 3. MIGRATE EMBEDDINGS DATA
-- ============================================

-- Migrate from code_embeddings to semantic_search_embeddings (if exists)
INSERT INTO semantic_search_embeddings (
  project_id, file_path, chunk_index, content_type, content_text,
  content_hash, embedding, metadata, created_at, updated_at
)
SELECT
  project_id,
  file_path,
  chunk_index,
  content_type,
  content,
  COALESCE(
    encode(sha256(content::bytea), 'hex'),
    'migrated-' || extract(epoch from NOW())::text
  ),
  embedding,
  jsonb_build_object(
    'migrated_from', 'code_embeddings',
    'migration_date', NOW(),
    'original_metadata', metadata
  ),
  created_at,
  updated_at
FROM code_embeddings
WHERE EXISTS (SELECT 1 FROM code_embeddings);

-- ============================================
-- 4. UPDATE SYSTEM CONFIGURATION
-- ============================================

-- Update system version to indicate migration completion
INSERT INTO system_config (config_key, config_value, config_type, description, is_global)
VALUES (
  'schema_migration_completed',
  '"true"',
  'boolean',
  'Indicates tool-based to consolidated migration completed',
  true
)
ON CONFLICT (config_key) DO UPDATE SET
  config_value = '"true"',
  updated_at = NOW();

-- Record migration timestamp
INSERT INTO system_config (config_key, config_value, config_type, description, is_global)
VALUES (
  'migration_completed_at',
  ('"' || NOW()::text || '"')::jsonb,
  'string',
  'Timestamp when migration to consolidated schema completed',
  true
)
ON CONFLICT (config_key) DO UPDATE SET
  config_value = ('"' || NOW()::text || '"')::jsonb,
  updated_at = NOW();

-- ============================================
-- 5. CREATE BACKUP OF OLD SCHEMA
-- ============================================

-- Create backup schema with old tables for rollback if needed
CREATE SCHEMA IF NOT EXISTS backup_tool_based;

-- Move old tables to backup schema (if they exist)
DO $$
DECLARE
    table_name TEXT;
    old_tables TEXT[] := ARRAY[
        'tree_navigation_data', 'code_duplications', 'centralization_opportunities',
        'test_coverage_data', 'compilation_results', 'compilation_issues',
        'solid_violations', 'ui_components', 'ui_navigation_flows',
        'documentation_structure', 'use_cases', 'database_analysis',
        'detected_patterns', 'claude_decisions', 'neo4j_sync_status'
    ];
BEGIN
    FOREACH table_name IN ARRAY old_tables
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = table_name) THEN
            EXECUTE format('ALTER TABLE public.%I SET SCHEMA backup_tool_based', table_name);
            RAISE NOTICE 'Moved table % to backup schema', table_name;
        END IF;
    END LOOP;
END $$;

-- ============================================
-- 6. VALIDATION
-- ============================================

-- Verify migration results
SELECT
    'Migration Summary' as info,
    (SELECT COUNT(*) FROM analysis_results) as total_analysis_results,
    (SELECT COUNT(*) FROM semantic_search_embeddings) as total_embeddings,
    (SELECT COUNT(DISTINCT analysis_type) FROM analysis_results) as unique_analysis_types;

-- Show analysis type distribution
SELECT
    analysis_type,
    COUNT(*) as count,
    COUNT(DISTINCT project_id) as projects_affected
FROM analysis_results
GROUP BY analysis_type
ORDER BY count DESC;

-- Show migration metadata
SELECT
    metadata->>'migrated_from' as source_table,
    COUNT(*) as migrated_records
FROM analysis_results
WHERE metadata ? 'migrated_from'
GROUP BY metadata->>'migrated_from'
ORDER BY migrated_records DESC;

-- Commit transaction
COMMIT;

-- ============================================
-- 7. POST-MIGRATION CLEANUP (Run separately if needed)
-- ============================================

-- To completely remove backup tables after verification:
-- DROP SCHEMA IF EXISTS backup_tool_based CASCADE;

NOTIFY migration_completed;
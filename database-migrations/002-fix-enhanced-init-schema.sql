-- Migration 002: Fix schema mismatches for enhanced /init integration
-- Addresses issues found during enhanced project initialization testing

-- ============================================
-- 1. Fix analysis_results table
-- ============================================

-- Add missing updated_at column to analysis_results
ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add trigger for updated_at column (drop if exists, then create)
DROP TRIGGER IF EXISTS update_analysis_results_updated_at ON analysis_results;
CREATE TRIGGER update_analysis_results_updated_at BEFORE UPDATE ON analysis_results
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add unique constraint for ON CONFLICT operations
-- Create a composite unique index for project_id + file_path + analysis_type
DROP INDEX IF EXISTS idx_analysis_unique_conflict;
CREATE UNIQUE INDEX IF NOT EXISTS idx_analysis_unique_conflict
    ON analysis_results(project_id, file_path, analysis_type);

-- ============================================
-- 2. Fix semantic_search_embeddings table
-- ============================================

-- Add missing columns that our enhanced init expects
ALTER TABLE semantic_search_embeddings ADD COLUMN IF NOT EXISTS chunk_id TEXT;
ALTER TABLE semantic_search_embeddings ADD COLUMN IF NOT EXISTS model TEXT;
ALTER TABLE semantic_search_embeddings ADD COLUMN IF NOT EXISTS dimensions INTEGER;

-- Update embedding column to use proper name
-- Note: The schema has 'embedding' but our code expects 'embedding_vector'
-- Only rename if the 'embedding' column exists and 'embedding_vector' doesn't
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'semantic_search_embeddings'
               AND column_name = 'embedding')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'semantic_search_embeddings'
                    AND column_name = 'embedding_vector') THEN
        ALTER TABLE semantic_search_embeddings RENAME COLUMN embedding TO embedding_vector;
    END IF;
END $$;

-- Add unique constraint on chunk_id for our ON CONFLICT operations
CREATE UNIQUE INDEX IF NOT EXISTS idx_semantic_embeddings_chunk_id
    ON semantic_search_embeddings(chunk_id);

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_semantic_embeddings_model ON semantic_search_embeddings(model);
CREATE INDEX IF NOT EXISTS idx_semantic_embeddings_dimensions ON semantic_search_embeddings(dimensions);

-- ============================================
-- 3. Add missing analysis_types to check constraint
-- ============================================

-- Drop the old constraint and recreate with new types
ALTER TABLE analysis_results DROP CONSTRAINT IF EXISTS analysis_results_analysis_type_check;

-- Add new constraint with additional analysis types our enhanced init uses
ALTER TABLE analysis_results ADD CONSTRAINT analysis_results_analysis_type_check
    CHECK (analysis_type IN (
        'pattern', 'quality', 'architecture', 'tech_stack', 'duplication', 'dependency',
        'file_discovery', 'semantic_entity', 'processing_stats'
    ));

-- ============================================
-- 4. Update semantic_search_embeddings indexes
-- ============================================

-- Update the vector similarity index to use the renamed column
DROP INDEX IF EXISTS idx_semantic_embeddings_vector;
CREATE INDEX IF NOT EXISTS idx_semantic_embeddings_vector
    ON semantic_search_embeddings USING hnsw (embedding_vector vector_cosine_ops);

-- ============================================
-- 5. Add configuration for enhanced initialization
-- ============================================

-- Add configuration entries for enhanced initialization features
INSERT INTO system_config (config_key, config_value, config_type, description, is_global) VALUES
    ('enhanced_init_enabled', 'true', 'boolean', 'Enable enhanced project initialization with complete data pipeline', true),
    ('semantic_analysis_enabled', 'true', 'boolean', 'Enable semantic graph analysis during initialization', true),
    ('content_processing_enabled', 'true', 'boolean', 'Enable content processing and embedding generation', true),
    ('vector_search_enabled', 'true', 'boolean', 'Enable vector search indexing during initialization', true),
    ('max_files_for_processing', '100', 'number', 'Maximum number of files to process during initialization', true),
    ('max_semantic_entities_to_store', '1000', 'number', 'Maximum semantic entities to store per project', true),
    ('max_vector_embeddings_to_store', '500', 'number', 'Maximum vector embeddings to store per project', true),
    ('tree_sitter_enabled', 'true', 'boolean', 'Enable Tree-sitter semantic analysis', true),
    ('claude_proxy_enabled', 'true', 'boolean', 'Enable Claude Code CLI proxy for unsupported languages', true)
ON CONFLICT (config_key) DO NOTHING;

-- ============================================
-- 6. Create view for enhanced initialization status
-- ============================================

-- Create a view to monitor enhanced initialization status
CREATE OR REPLACE VIEW enhanced_init_status AS
SELECT
    p.id as project_id,
    p.project_name,
    p.project_path,
    p.total_files,
    COUNT(DISTINCT ar1.id) as file_discoveries,
    COUNT(DISTINCT ar2.id) as semantic_entities,
    COUNT(DISTINCT sse.id) as vector_embeddings,
    MAX(ar3.analysis_result->>'processingTime') as last_processing_time,
    p.created_at as project_created,
    MAX(ar1.created_at) as last_analysis_time
FROM projects p
LEFT JOIN analysis_results ar1 ON p.id = ar1.project_id AND ar1.analysis_type = 'file_discovery'
LEFT JOIN analysis_results ar2 ON p.id = ar2.project_id AND ar2.analysis_type = 'semantic_entity'
LEFT JOIN analysis_results ar3 ON p.id = ar3.project_id AND ar3.analysis_type = 'processing_stats'
LEFT JOIN semantic_search_embeddings sse ON p.id = sse.project_id
WHERE p.created_at >= NOW() - INTERVAL '7 days' -- Recent projects only
GROUP BY p.id, p.project_name, p.project_path, p.total_files, p.created_at
ORDER BY p.created_at DESC;

-- ============================================
-- 7. Create cleanup function for enhanced init data
-- ============================================

-- Function to clean up old enhanced initialization data
CREATE OR REPLACE FUNCTION cleanup_enhanced_init_data(days_old INTEGER DEFAULT 30)
RETURNS TABLE(
    deleted_file_discoveries INTEGER,
    deleted_semantic_entities INTEGER,
    deleted_vector_embeddings INTEGER,
    deleted_processing_stats INTEGER
) AS $$
DECLARE
    cutoff_date TIMESTAMPTZ;
    fd_count INTEGER := 0;
    se_count INTEGER := 0;
    ve_count INTEGER := 0;
    ps_count INTEGER := 0;
BEGIN
    cutoff_date := NOW() - INTERVAL '1 day' * days_old;

    -- Delete old file discovery records
    DELETE FROM analysis_results
    WHERE analysis_type = 'file_discovery'
    AND created_at < cutoff_date;
    GET DIAGNOSTICS fd_count = ROW_COUNT;

    -- Delete old semantic entity records
    DELETE FROM analysis_results
    WHERE analysis_type = 'semantic_entity'
    AND created_at < cutoff_date;
    GET DIAGNOSTICS se_count = ROW_COUNT;

    -- Delete old vector embeddings
    DELETE FROM semantic_search_embeddings
    WHERE created_at < cutoff_date;
    GET DIAGNOSTICS ve_count = ROW_COUNT;

    -- Delete old processing stats
    DELETE FROM analysis_results
    WHERE analysis_type = 'processing_stats'
    AND created_at < cutoff_date;
    GET DIAGNOSTICS ps_count = ROW_COUNT;

    RETURN QUERY SELECT fd_count, se_count, ve_count, ps_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. Update schema version
-- ============================================

-- Update schema version to indicate this migration has been applied
UPDATE system_config
SET config_value = '"1.1.0"', updated_at = NOW()
WHERE config_key = 'postgres_version';

-- Log migration completion
INSERT INTO system_config (config_key, config_value, config_type, description, is_global) VALUES
    ('migration_002_applied', 'true', 'boolean', 'Migration 002 (Enhanced Init Schema Fix) has been applied', true),
    ('migration_002_date', to_jsonb(NOW()), 'json', 'Date when migration 002 was applied', true)
ON CONFLICT (config_key) DO UPDATE SET
    config_value = EXCLUDED.config_value,
    updated_at = NOW();

-- ============================================
-- Migration Complete
-- ============================================
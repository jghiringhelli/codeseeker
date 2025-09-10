-- Database Cleanup Script for CodeMind
-- Removes unused and redundant database structures identified in the audit
-- Run this script carefully in non-production environments first

-- ============================================
-- BACKUP COMMANDS (Run these first!)
-- ============================================

-- Create backup of potentially important data before deletion
-- CREATE TABLE semantic_search_embeddings_backup AS SELECT * FROM semantic_search_embeddings;
-- CREATE TABLE questionnaire_responses_backup AS SELECT * FROM questionnaire_responses;
-- CREATE TABLE resume_state_backup AS SELECT * FROM resume_state;

-- ============================================
-- PHASE 1: SAFE DELETIONS (Low Impact)
-- ============================================

-- 1. Remove semantic search embeddings (requires pgvector, likely unused)
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'semantic_search_embeddings') THEN
        EXECUTE 'DROP INDEX IF EXISTS idx_semantic_embeddings_project';
        EXECUTE 'DROP INDEX IF EXISTS idx_semantic_embeddings_file_path';
        EXECUTE 'DROP INDEX IF EXISTS idx_semantic_embeddings_content_hash';
        EXECUTE 'DROP INDEX IF EXISTS idx_semantic_embeddings_content_type';
        EXECUTE 'DROP INDEX IF EXISTS idx_semantic_embeddings_vector';
        EXECUTE 'DROP TABLE semantic_search_embeddings CASCADE';
        RAISE NOTICE 'Removed semantic_search_embeddings table and related indexes';
    END IF;
END $$;

-- 2. Remove questionnaire responses (legacy feature)
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'questionnaire_responses') THEN
        EXECUTE 'DROP INDEX IF EXISTS idx_responses_project_id';
        EXECUTE 'DROP INDEX IF EXISTS idx_responses_category';
        EXECUTE 'DROP INDEX IF EXISTS idx_responses_question_id';
        EXECUTE 'DROP TABLE questionnaire_responses CASCADE';
        RAISE NOTICE 'Removed questionnaire_responses table and related indexes';
    END IF;
END $$;

-- 3. Remove resume state (limited usage)
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'resume_state') THEN
        EXECUTE 'DROP INDEX IF EXISTS idx_resume_token';
        EXECUTE 'DROP INDEX IF EXISTS idx_resume_project_id';
        EXECUTE 'DROP INDEX IF EXISTS idx_resume_expires';
        EXECUTE 'DROP TABLE resume_state CASCADE';
        RAISE NOTICE 'Removed resume_state table and related indexes';
    END IF;
END $$;

-- ============================================
-- PHASE 2: DATABASE ANALYSIS TABLES (Medium Impact)
-- ============================================

-- Warning: Only remove these if database analysis features are not used

-- 4. Remove query performance log
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'query_performance_log') THEN
        EXECUTE 'DROP INDEX IF EXISTS idx_query_performance_project_id';
        EXECUTE 'DROP INDEX IF EXISTS idx_query_performance_pattern';
        EXECUTE 'DROP TABLE query_performance_log CASCADE';
        RAISE NOTICE 'Removed query_performance_log table and related indexes';
    END IF;
END $$;

-- 5. Remove database relationships mapping
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'database_relationships') THEN
        EXECUTE 'DROP INDEX IF EXISTS idx_database_relationships_project_id';
        EXECUTE 'DROP INDEX IF EXISTS idx_database_relationships_tables';
        EXECUTE 'DROP TABLE database_relationships CASCADE';
        RAISE NOTICE 'Removed database_relationships table and related indexes';
    END IF;
END $$;

-- 6. Remove database analysis (if not used)
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'database_analysis') THEN
        EXECUTE 'DROP INDEX IF EXISTS idx_database_analysis_project_id';
        EXECUTE 'DROP INDEX IF EXISTS idx_database_analysis_last_analyzed';
        EXECUTE 'DROP TABLE database_analysis CASCADE';
        RAISE NOTICE 'Removed database_analysis table and related indexes';
    END IF;
END $$;

-- 7. Remove database schema summary
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'database_schema_summary') THEN
        EXECUTE 'DROP INDEX IF EXISTS idx_database_schema_summary_project_id';
        EXECUTE 'DROP TABLE database_schema_summary CASCADE';
        RAISE NOTICE 'Removed database_schema_summary table and related indexes';
    END IF;
END $$;

-- ============================================
-- PHASE 3: CONDITIONAL REMOVALS
-- ============================================

-- 8. Remove claude_decisions if overlapping with orchestration tables
-- Uncomment only if confirmed that decision tracking is handled by orchestration_processes
/*
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'claude_decisions') THEN
        EXECUTE 'DROP INDEX IF EXISTS idx_claude_decisions_project';
        EXECUTE 'DROP INDEX IF EXISTS idx_claude_decisions_type';
        EXECUTE 'DROP INDEX IF EXISTS idx_claude_decisions_timestamp';
        EXECUTE 'DROP TABLE claude_decisions CASCADE';
        RAISE NOTICE 'Removed claude_decisions table and related indexes';
    END IF;
END $$;
*/

-- ============================================
-- PHASE 4: OPTIMIZATION CLEANUPS
-- ============================================

-- Remove unused or rarely-used initialization progress features
-- Uncomment only if initialization progress tracking is no longer needed
/*
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'initialization_progress') THEN
        EXECUTE 'DROP INDEX IF EXISTS idx_init_project_id';
        EXECUTE 'DROP INDEX IF EXISTS idx_init_phase';
        EXECUTE 'DROP INDEX IF EXISTS idx_init_resume_token';
        EXECUTE 'DROP TABLE initialization_progress CASCADE';
        RAISE NOTICE 'Removed initialization_progress table and related indexes';
    END IF;
END $$;
*/

-- ============================================
-- VIEWS CLEANUP
-- ============================================

-- Remove views that depend on deleted tables
DO $$ BEGIN
    -- Remove views that might reference deleted tables
    IF EXISTS (SELECT FROM information_schema.views WHERE table_name = 'active_projects_status') THEN
        EXECUTE 'DROP VIEW IF EXISTS active_projects_status';
        RAISE NOTICE 'Removed active_projects_status view';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.views WHERE table_name = 'project_pattern_summary') THEN
        EXECUTE 'DROP VIEW IF EXISTS project_pattern_summary';
        RAISE NOTICE 'Removed project_pattern_summary view';
    END IF;
END $$;

-- ============================================
-- CLEANUP VERIFICATION
-- ============================================

-- Show remaining table count and sizes
DO $$ 
DECLARE
    table_count INTEGER;
    total_size TEXT;
BEGIN
    SELECT COUNT(*) INTO table_count 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    
    SELECT pg_size_pretty(pg_database_size(current_database())) INTO total_size;
    
    RAISE NOTICE 'Cleanup completed. Remaining tables: %, Database size: %', table_count, total_size;
END $$;

-- List all remaining tables for verification
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ============================================
-- POST-CLEANUP RECOMMENDATIONS
-- ============================================

-- Run VACUUM FULL to reclaim disk space (this will lock tables)
-- VACUUM FULL;

-- Update table statistics
-- ANALYZE;

-- Consider running REINDEX on remaining tables if needed
-- REINDEX DATABASE codemind;
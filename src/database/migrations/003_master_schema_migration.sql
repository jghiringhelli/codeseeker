-- ============================================================================
-- Migration 003: Update to Master Schema v3.0.0
-- Date: 2025-12-04
--
-- This migration adds missing columns to semantic_search_embeddings table
-- to align with the master schema. It's safe to run multiple times.
-- ============================================================================

-- Add chunk_id column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'semantic_search_embeddings' AND column_name = 'chunk_id'
    ) THEN
        ALTER TABLE semantic_search_embeddings ADD COLUMN chunk_id TEXT;
        RAISE NOTICE 'Added chunk_id column';
    END IF;
END $$;

-- Add chunk_start_line column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'semantic_search_embeddings' AND column_name = 'chunk_start_line'
    ) THEN
        ALTER TABLE semantic_search_embeddings ADD COLUMN chunk_start_line INTEGER NOT NULL DEFAULT 1;
        RAISE NOTICE 'Added chunk_start_line column';
    END IF;
END $$;

-- Add chunk_end_line column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'semantic_search_embeddings' AND column_name = 'chunk_end_line'
    ) THEN
        ALTER TABLE semantic_search_embeddings ADD COLUMN chunk_end_line INTEGER NOT NULL DEFAULT 1;
        RAISE NOTICE 'Added chunk_end_line column';
    END IF;
END $$;

-- Add is_full_file column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'semantic_search_embeddings' AND column_name = 'is_full_file'
    ) THEN
        ALTER TABLE semantic_search_embeddings ADD COLUMN is_full_file BOOLEAN NOT NULL DEFAULT false;
        RAISE NOTICE 'Added is_full_file column';
    END IF;
END $$;

-- Add significance column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'semantic_search_embeddings' AND column_name = 'significance'
    ) THEN
        ALTER TABLE semantic_search_embeddings ADD COLUMN significance TEXT DEFAULT 'medium'
            CHECK (significance IN ('high', 'medium', 'low'));
        RAISE NOTICE 'Added significance column';
    END IF;
END $$;

-- Add content_tsvector column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'semantic_search_embeddings' AND column_name = 'content_tsvector'
    ) THEN
        ALTER TABLE semantic_search_embeddings ADD COLUMN content_tsvector TSVECTOR;
        RAISE NOTICE 'Added content_tsvector column';
    END IF;
END $$;

-- Update existing rows with calculated line numbers based on chunk_index
UPDATE semantic_search_embeddings
SET chunk_start_line = COALESCE(chunk_index, 0) * 20 + 1,
    chunk_end_line = COALESCE(chunk_index, 0) * 20 + 20
WHERE chunk_start_line = 1 AND chunk_end_line = 1 AND chunk_index > 0;

-- Generate chunk_id for existing rows that don't have one
UPDATE semantic_search_embeddings
SET chunk_id = file_path || ':' || COALESCE(chunk_index, 0) || ':' || LEFT(content_hash, 8)
WHERE chunk_id IS NULL;

-- Populate content_tsvector for existing rows
UPDATE semantic_search_embeddings
SET content_tsvector = to_tsvector('english', content_text)
WHERE content_tsvector IS NULL;

-- Create new indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_semantic_embeddings_significance
ON semantic_search_embeddings(significance);

CREATE INDEX IF NOT EXISTS idx_semantic_embeddings_chunk_info
ON semantic_search_embeddings(project_id, file_path, chunk_index);

CREATE INDEX IF NOT EXISTS idx_semantic_embeddings_file_type
ON semantic_search_embeddings(project_id, is_full_file);

CREATE INDEX IF NOT EXISTS idx_semantic_embeddings_fts
ON semantic_search_embeddings USING gin(content_tsvector);

-- Create or replace the tsvector update trigger
CREATE OR REPLACE FUNCTION update_content_tsvector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.content_tsvector = to_tsvector('english', NEW.content_text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_embeddings_tsvector') THEN
        CREATE TRIGGER update_embeddings_tsvector
        BEFORE INSERT OR UPDATE ON semantic_search_embeddings
        FOR EACH ROW EXECUTE FUNCTION update_content_tsvector();
        RAISE NOTICE 'Created tsvector update trigger';
    END IF;
END $$;

-- Update schema version
INSERT INTO system_config (config_key, config_value, config_type, description, is_global)
VALUES ('postgres_version', '"3.0.0"', 'string', 'PostgreSQL master schema version', true)
ON CONFLICT (config_key) DO UPDATE SET
    config_value = '"3.0.0"',
    updated_at = NOW();

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 003 completed: semantic_search_embeddings updated to master schema v3.0.0';
END $$;

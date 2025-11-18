-- Unified Semantic Search Schema
-- Consolidates all semantic search functionality into a single, comprehensive table

-- Enable vector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop existing inconsistent tables if they exist
DROP TABLE IF EXISTS code_embeddings CASCADE;
DROP INDEX IF EXISTS idx_semantic_embeddings_vector;

-- Create unified semantic search embeddings table
CREATE TABLE IF NOT EXISTS semantic_search_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,

  -- File and chunk identification
  file_path TEXT NOT NULL,
  chunk_id TEXT NOT NULL,
  chunk_start_line INTEGER NOT NULL DEFAULT 1,
  chunk_end_line INTEGER NOT NULL DEFAULT 1,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  is_full_file BOOLEAN NOT NULL DEFAULT false,

  -- Content and hashing
  content_text TEXT NOT NULL,
  content_hash TEXT NOT NULL,

  -- Vector embedding (OpenAI text-embedding-3-small standard)
  embedding VECTOR(384) NOT NULL,

  -- Metadata for filtering and analysis
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Content classification
  content_type TEXT DEFAULT 'code',
  significance TEXT CHECK (significance IN ('high', 'medium', 'low')) DEFAULT 'medium',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint on chunk ID per project
  UNIQUE(project_id, chunk_id)
);

-- Indexes for optimal performance

-- Primary search index using HNSW for vector similarity
CREATE INDEX IF NOT EXISTS idx_semantic_embeddings_vector_hnsw
ON semantic_search_embeddings
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Alternative index for L2 distance
CREATE INDEX IF NOT EXISTS idx_semantic_embeddings_vector_l2
ON semantic_search_embeddings
USING hnsw (embedding vector_l2_ops)
WITH (m = 16, ef_construction = 64);

-- Project-based filtering
CREATE INDEX IF NOT EXISTS idx_semantic_embeddings_project
ON semantic_search_embeddings(project_id);

-- File-based operations
CREATE INDEX IF NOT EXISTS idx_semantic_embeddings_file_path
ON semantic_search_embeddings(project_id, file_path);

-- Content hash for deduplication
CREATE INDEX IF NOT EXISTS idx_semantic_embeddings_content_hash
ON semantic_search_embeddings(content_hash);

-- Content type filtering
CREATE INDEX IF NOT EXISTS idx_semantic_embeddings_content_type
ON semantic_search_embeddings(content_type);

-- Significance-based filtering
CREATE INDEX IF NOT EXISTS idx_semantic_embeddings_significance
ON semantic_search_embeddings(significance);

-- Chunk identification
CREATE INDEX IF NOT EXISTS idx_semantic_embeddings_chunk_info
ON semantic_search_embeddings(project_id, file_path, chunk_index);

-- Full-file vs chunk filtering
CREATE INDEX IF NOT EXISTS idx_semantic_embeddings_file_type
ON semantic_search_embeddings(project_id, is_full_file);

-- Metadata GIN index for complex queries
CREATE INDEX IF NOT EXISTS idx_semantic_embeddings_metadata
ON semantic_search_embeddings USING gin(metadata);

-- Timestamp-based queries
CREATE INDEX IF NOT EXISTS idx_semantic_embeddings_updated
ON semantic_search_embeddings(updated_at);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_semantic_embeddings_project_significance
ON semantic_search_embeddings(project_id, significance, updated_at);

-- Functions for semantic search operations

/**
 * Function to perform semantic similarity search
 */
CREATE OR REPLACE FUNCTION semantic_similarity_search(
  query_embedding VECTOR(384),
  target_project_id UUID DEFAULT NULL,
  min_similarity FLOAT DEFAULT 0.3,
  max_results INTEGER DEFAULT 10,
  content_types TEXT[] DEFAULT NULL,
  significance_filter TEXT DEFAULT NULL,
  include_chunks BOOLEAN DEFAULT true,
  include_full_files BOOLEAN DEFAULT true
) RETURNS TABLE (
  chunk_id TEXT,
  file_path TEXT,
  content_text TEXT,
  metadata JSONB,
  similarity_score FLOAT,
  is_full_file BOOLEAN,
  chunk_start_line INTEGER,
  chunk_end_line INTEGER,
  significance TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sse.chunk_id,
    sse.file_path,
    sse.content_text,
    sse.metadata,
    (1 - (sse.embedding <=> query_embedding))::FLOAT as similarity_score,
    sse.is_full_file,
    sse.chunk_start_line,
    sse.chunk_end_line,
    sse.significance
  FROM semantic_search_embeddings sse
  WHERE
    (target_project_id IS NULL OR sse.project_id = target_project_id)
    AND (1 - (sse.embedding <=> query_embedding)) >= min_similarity
    AND (content_types IS NULL OR sse.content_type = ANY(content_types))
    AND (significance_filter IS NULL OR sse.significance = significance_filter)
    AND (
      (include_chunks AND NOT sse.is_full_file)
      OR (include_full_files AND sse.is_full_file)
    )
  ORDER BY sse.embedding <=> query_embedding
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

/**
 * Function to find duplicate content across projects
 */
CREATE OR REPLACE FUNCTION find_duplicate_content(
  target_project_id UUID,
  similarity_threshold FLOAT DEFAULT 0.95,
  max_results INTEGER DEFAULT 50
) RETURNS TABLE (
  source_chunk_id TEXT,
  source_file_path TEXT,
  duplicate_chunk_id TEXT,
  duplicate_file_path TEXT,
  similarity_score FLOAT,
  content_preview TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s1.chunk_id as source_chunk_id,
    s1.file_path as source_file_path,
    s2.chunk_id as duplicate_chunk_id,
    s2.file_path as duplicate_file_path,
    (1 - (s1.embedding <=> s2.embedding))::FLOAT as similarity_score,
    LEFT(s1.content_text, 200) as content_preview
  FROM semantic_search_embeddings s1
  JOIN semantic_search_embeddings s2 ON s1.id < s2.id
  WHERE
    s1.project_id = target_project_id
    AND s2.project_id = target_project_id
    AND (1 - (s1.embedding <=> s2.embedding)) >= similarity_threshold
    AND s1.file_path != s2.file_path  -- Different files
  ORDER BY similarity_score DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

/**
 * Function to get project embedding statistics
 */
CREATE OR REPLACE FUNCTION get_project_embedding_stats(
  target_project_id UUID
) RETURNS TABLE (
  total_chunks INTEGER,
  total_files INTEGER,
  full_file_chunks INTEGER,
  partial_chunks INTEGER,
  avg_chunk_size INTEGER,
  total_content_size BIGINT,
  significance_distribution JSONB,
  content_type_distribution JSONB,
  last_updated TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER as total_chunks,
    COUNT(DISTINCT sse.file_path)::INTEGER as total_files,
    COUNT(*) FILTER (WHERE sse.is_full_file)::INTEGER as full_file_chunks,
    COUNT(*) FILTER (WHERE NOT sse.is_full_file)::INTEGER as partial_chunks,
    AVG(LENGTH(sse.content_text))::INTEGER as avg_chunk_size,
    SUM(LENGTH(sse.content_text)) as total_content_size,

    -- Significance distribution
    jsonb_object_agg(
      sse.significance,
      COUNT(*) FILTER (WHERE sse.significance IS NOT NULL)
    ) as significance_distribution,

    -- Content type distribution
    jsonb_object_agg(
      sse.content_type,
      COUNT(*) FILTER (WHERE sse.content_type IS NOT NULL)
    ) as content_type_distribution,

    MAX(sse.updated_at) as last_updated

  FROM semantic_search_embeddings sse
  WHERE sse.project_id = target_project_id
  GROUP BY sse.project_id;
END;
$$ LANGUAGE plpgsql;

/**
 * Function to cleanup old embeddings
 */
CREATE OR REPLACE FUNCTION cleanup_old_embeddings(
  older_than_days INTEGER DEFAULT 30
) RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM semantic_search_embeddings
  WHERE updated_at < NOW() - INTERVAL '%s days' % older_than_days;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_semantic_embeddings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_semantic_embeddings_timestamp
  BEFORE UPDATE ON semantic_search_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION update_semantic_embeddings_timestamp();

-- Views for common query patterns

/**
 * View for high-significance content only
 */
CREATE OR REPLACE VIEW high_significance_embeddings AS
SELECT *
FROM semantic_search_embeddings
WHERE significance = 'high'
ORDER BY updated_at DESC;

/**
 * View for full-file embeddings only
 */
CREATE OR REPLACE VIEW full_file_embeddings AS
SELECT *
FROM semantic_search_embeddings
WHERE is_full_file = true
ORDER BY file_path, updated_at DESC;

/**
 * View for chunk embeddings only
 */
CREATE OR REPLACE VIEW chunk_embeddings AS
SELECT *
FROM semantic_search_embeddings
WHERE is_full_file = false
ORDER BY file_path, chunk_index;

/**
 * View for recent embeddings (last 7 days)
 */
CREATE OR REPLACE VIEW recent_embeddings AS
SELECT *
FROM semantic_search_embeddings
WHERE updated_at >= NOW() - INTERVAL '7 days'
ORDER BY updated_at DESC;

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON semantic_search_embeddings TO codemind;
GRANT USAGE, SELECT ON SEQUENCE semantic_search_embeddings_id_seq TO codemind;
GRANT EXECUTE ON FUNCTION semantic_similarity_search TO codemind;
GRANT EXECUTE ON FUNCTION find_duplicate_content TO codemind;
GRANT EXECUTE ON FUNCTION get_project_embedding_stats TO codemind;
GRANT EXECUTE ON FUNCTION cleanup_old_embeddings TO codemind;
GRANT SELECT ON high_significance_embeddings TO codemind;
GRANT SELECT ON full_file_embeddings TO codemind;
GRANT SELECT ON chunk_embeddings TO codemind;
GRANT SELECT ON recent_embeddings TO codemind;

-- Comments for documentation
COMMENT ON TABLE semantic_search_embeddings IS 'Unified semantic search embeddings supporting both full files and chunks with RAG-style retrieval';
COMMENT ON COLUMN semantic_search_embeddings.chunk_id IS 'Unique identifier for each chunk, combining file hash and chunk index';
COMMENT ON COLUMN semantic_search_embeddings.embedding IS 'OpenAI text-embedding-3-small compatible 384-dimensional vector embedding';
COMMENT ON COLUMN semantic_search_embeddings.significance IS 'Content significance level for prioritizing search results';
COMMENT ON FUNCTION semantic_similarity_search IS 'Primary semantic search function with comprehensive filtering options';
COMMENT ON FUNCTION find_duplicate_content IS 'Identifies potential duplicate code across the project';
COMMENT ON FUNCTION get_project_embedding_stats IS 'Provides comprehensive statistics about project embeddings';

-- Sample queries for testing and documentation

/*
-- Basic semantic search
SELECT * FROM semantic_similarity_search(
  '[0.1, 0.2, ...]'::vector,  -- query embedding
  'project-uuid'::uuid,        -- project filter
  0.7,                         -- minimum similarity
  10                           -- max results
);

-- Search with content type filtering
SELECT * FROM semantic_similarity_search(
  '[0.1, 0.2, ...]'::vector,
  'project-uuid'::uuid,
  0.5,
  20,
  ARRAY['code', 'documentation'], -- content types
  'high'                          -- significance filter
);

-- Find duplicates in project
SELECT * FROM find_duplicate_content('project-uuid'::uuid, 0.9, 25);

-- Get project statistics
SELECT * FROM get_project_embedding_stats('project-uuid'::uuid);

-- High-performance direct query
SELECT
  chunk_id, file_path, content_text,
  1 - (embedding <=> '[0.1,0.2,...]'::vector) as similarity
FROM semantic_search_embeddings
WHERE project_id = 'project-uuid'::uuid
  AND 1 - (embedding <=> '[0.1,0.2,...]'::vector) > 0.7
ORDER BY embedding <=> '[0.1,0.2,...]'::vector
LIMIT 10;
*/
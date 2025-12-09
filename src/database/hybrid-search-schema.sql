-- Hybrid Search Schema Enhancement
-- Adds Full-Text Search (FTS) capability alongside vector embeddings for hybrid retrieval

-- Add tsvector column for full-text search if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'semantic_search_embeddings'
    AND column_name = 'content_tsvector'
  ) THEN
    ALTER TABLE semantic_search_embeddings
    ADD COLUMN content_tsvector TSVECTOR;
  END IF;
END $$;

-- Create GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_semantic_embeddings_fts
ON semantic_search_embeddings USING gin(content_tsvector);

-- Function to generate tsvector from content
CREATE OR REPLACE FUNCTION generate_content_tsvector()
RETURNS TRIGGER AS $$
BEGIN
  -- Use 'english' configuration for stemming and stop word removal
  -- Also index file path components for better searchability
  NEW.content_tsvector :=
    setweight(to_tsvector('english', COALESCE(NEW.file_path, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.content_text, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.metadata::text, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update tsvector on insert/update
DROP TRIGGER IF EXISTS trigger_generate_content_tsvector ON semantic_search_embeddings;
CREATE TRIGGER trigger_generate_content_tsvector
  BEFORE INSERT OR UPDATE OF content_text, file_path, metadata
  ON semantic_search_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION generate_content_tsvector();

-- Update existing rows to populate tsvector
UPDATE semantic_search_embeddings
SET content_tsvector =
  setweight(to_tsvector('english', COALESCE(file_path, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(content_text, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(metadata::text, '')), 'C')
WHERE content_tsvector IS NULL;

/**
 * Hybrid Search Function - Combines Vector Similarity + Full-Text Search
 *
 * This is the recommended search method as it:
 * 1. Uses vector similarity for semantic understanding (concepts, meaning)
 * 2. Uses full-text search for exact/fuzzy term matching (keywords, identifiers)
 * 3. Combines scores with configurable weighting
 *
 * @param query_embedding - Vector embedding of the search query (384 dimensions)
 * @param query_text - Raw text query for full-text search
 * @param target_project_id - Optional project filter
 * @param vector_weight - Weight for vector similarity (0-1, default 0.6)
 * @param fts_weight - Weight for full-text relevance (0-1, default 0.4)
 * @param min_combined_score - Minimum combined score threshold
 * @param max_results - Maximum results to return
 */
CREATE OR REPLACE FUNCTION hybrid_search(
  query_embedding VECTOR(384),
  query_text TEXT,
  target_project_id UUID DEFAULT NULL,
  vector_weight FLOAT DEFAULT 0.6,
  fts_weight FLOAT DEFAULT 0.4,
  min_combined_score FLOAT DEFAULT 0.3,
  max_results INTEGER DEFAULT 15
) RETURNS TABLE (
  id UUID,
  chunk_id TEXT,
  file_path TEXT,
  content_text TEXT,
  metadata JSONB,
  chunk_start_line INTEGER,
  chunk_end_line INTEGER,
  is_full_file BOOLEAN,
  vector_similarity FLOAT,
  fts_rank FLOAT,
  combined_score FLOAT
) AS $$
DECLARE
  search_query TSQUERY;
BEGIN
  -- Parse the query text into a tsquery
  -- Use websearch_to_tsquery for natural language queries
  search_query := websearch_to_tsquery('english', query_text);

  RETURN QUERY
  WITH scored_results AS (
    SELECT
      sse.id,
      sse.chunk_id,
      sse.file_path,
      sse.content_text,
      sse.metadata,
      sse.chunk_start_line,
      sse.chunk_end_line,
      sse.is_full_file,
      -- Vector similarity score (cosine similarity: 1 - cosine distance)
      (1 - (sse.embedding <=> query_embedding))::FLOAT as vector_sim,
      -- Full-text search rank (normalized to 0-1 range)
      COALESCE(ts_rank_cd(sse.content_tsvector, search_query, 32), 0)::FLOAT as fts_score
    FROM semantic_search_embeddings sse
    WHERE
      (target_project_id IS NULL OR sse.project_id = target_project_id)
      AND (
        -- Include if vector is similar OR full-text matches
        (1 - (sse.embedding <=> query_embedding)) > 0.2
        OR sse.content_tsvector @@ search_query
      )
  )
  SELECT
    sr.id,
    sr.chunk_id,
    sr.file_path,
    sr.content_text,
    sr.metadata,
    sr.chunk_start_line,
    sr.chunk_end_line,
    sr.is_full_file,
    sr.vector_sim as vector_similarity,
    sr.fts_score as fts_rank,
    -- Combined score using weighted average
    (sr.vector_sim * vector_weight + sr.fts_score * fts_weight)::FLOAT as combined_score
  FROM scored_results sr
  WHERE (sr.vector_sim * vector_weight + sr.fts_score * fts_weight) >= min_combined_score
  ORDER BY combined_score DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

/**
 * Full-Text Search Only - For when you don't have embeddings
 * Uses PostgreSQL's powerful full-text search with ranking
 */
CREATE OR REPLACE FUNCTION fulltext_search(
  query_text TEXT,
  target_project_id UUID DEFAULT NULL,
  max_results INTEGER DEFAULT 15
) RETURNS TABLE (
  id UUID,
  chunk_id TEXT,
  file_path TEXT,
  content_text TEXT,
  metadata JSONB,
  chunk_start_line INTEGER,
  chunk_end_line INTEGER,
  fts_rank FLOAT,
  headline TEXT
) AS $$
DECLARE
  search_query TSQUERY;
BEGIN
  search_query := websearch_to_tsquery('english', query_text);

  RETURN QUERY
  SELECT
    sse.id,
    sse.chunk_id,
    sse.file_path,
    sse.content_text,
    sse.metadata,
    sse.chunk_start_line,
    sse.chunk_end_line,
    ts_rank_cd(sse.content_tsvector, search_query, 32)::FLOAT as fts_rank,
    ts_headline('english', sse.content_text, search_query,
      'MaxWords=50, MinWords=20, StartSel=>>>, StopSel=<<<') as headline
  FROM semantic_search_embeddings sse
  WHERE
    (target_project_id IS NULL OR sse.project_id = target_project_id)
    AND sse.content_tsvector @@ search_query
  ORDER BY fts_rank DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

/**
 * Phrase Search - For exact phrase matching in code
 * Useful for finding specific function names, class names, etc.
 */
CREATE OR REPLACE FUNCTION phrase_search(
  phrase TEXT,
  target_project_id UUID DEFAULT NULL,
  max_results INTEGER DEFAULT 15
) RETURNS TABLE (
  id UUID,
  chunk_id TEXT,
  file_path TEXT,
  content_text TEXT,
  metadata JSONB,
  chunk_start_line INTEGER,
  chunk_end_line INTEGER,
  match_position INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sse.id,
    sse.chunk_id,
    sse.file_path,
    sse.content_text,
    sse.metadata,
    sse.chunk_start_line,
    sse.chunk_end_line,
    position(lower(phrase) in lower(sse.content_text)) as match_position
  FROM semantic_search_embeddings sse
  WHERE
    (target_project_id IS NULL OR sse.project_id = target_project_id)
    AND sse.content_text ILIKE '%' || phrase || '%'
  ORDER BY
    -- Prioritize file path matches
    CASE WHEN sse.file_path ILIKE '%' || phrase || '%' THEN 0 ELSE 1 END,
    -- Then by position in content (earlier = better)
    position(lower(phrase) in lower(sse.content_text))
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION hybrid_search TO codemind;
GRANT EXECUTE ON FUNCTION fulltext_search TO codemind;
GRANT EXECUTE ON FUNCTION phrase_search TO codemind;

-- Comments
COMMENT ON FUNCTION hybrid_search IS 'Combines vector similarity and full-text search for optimal retrieval. Use this as the primary search method.';
COMMENT ON FUNCTION fulltext_search IS 'PostgreSQL full-text search with ranking and highlighting. Use when embeddings are not available.';
COMMENT ON FUNCTION phrase_search IS 'Exact phrase matching for finding specific identifiers, function names, etc.';

/*
-- Example usage:

-- Hybrid search (recommended)
SELECT * FROM hybrid_search(
  '[0.1, 0.2, ...]'::vector,  -- query embedding
  'authentication middleware',  -- query text
  'project-uuid'::uuid,         -- project filter
  0.6,                          -- vector weight (60%)
  0.4,                          -- fts weight (40%)
  0.3,                          -- min combined score
  15                            -- max results
);

-- Full-text search only
SELECT * FROM fulltext_search(
  'authentication middleware',
  'project-uuid'::uuid,
  15
);

-- Phrase search for identifiers
SELECT * FROM phrase_search(
  'class UserAuthService',
  'project-uuid'::uuid,
  15
);
*/

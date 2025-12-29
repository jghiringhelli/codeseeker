-- CodeMind PostgreSQL Setup Script
-- Run this script as a superuser to set up CodeMind database
--
-- Usage:
--   psql -U postgres -f setup-postgres.sql
--
-- Or for specific host:
--   psql -h localhost -U postgres -f setup-postgres.sql

-- Create CodeMind user
CREATE USER codemind WITH PASSWORD 'codemind123';

-- Create database
CREATE DATABASE codemind OWNER codemind;

-- Connect to the new database
\c codemind

-- Enable pgvector extension (requires superuser)
CREATE EXTENSION IF NOT EXISTS vector;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE codemind TO codemind;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO codemind;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO codemind;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO codemind;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO codemind;

-- Create Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name VARCHAR(255) NOT NULL,
  project_path TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  settings JSONB DEFAULT '{}'
);

-- Create Semantic Search Embeddings table
CREATE TABLE IF NOT EXISTS semantic_search_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  chunk_index INTEGER DEFAULT 0,
  content_text TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  content_hash VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  content_tsvector TSVECTOR
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_embeddings_project
  ON semantic_search_embeddings(project_id);

CREATE INDEX IF NOT EXISTS idx_embeddings_file
  ON semantic_search_embeddings(file_path);

CREATE INDEX IF NOT EXISTS idx_embeddings_hash
  ON semantic_search_embeddings(content_hash);

-- HNSW index for fast vector similarity search
CREATE INDEX IF NOT EXISTS idx_embeddings_vector
  ON semantic_search_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_embeddings_fts
  ON semantic_search_embeddings
  USING gin(content_tsvector);

-- Function to update tsvector on insert/update
CREATE OR REPLACE FUNCTION update_content_tsvector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.content_tsvector :=
    setweight(to_tsvector('english', COALESCE(NEW.file_path, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.content_text, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.metadata::text, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for automatic tsvector updates
DROP TRIGGER IF EXISTS tsvector_update ON semantic_search_embeddings;
CREATE TRIGGER tsvector_update
  BEFORE INSERT OR UPDATE ON semantic_search_embeddings
  FOR EACH ROW EXECUTE FUNCTION update_content_tsvector();

-- Function for hybrid search (FTS + vector)
CREATE OR REPLACE FUNCTION hybrid_search(
  query_text TEXT,
  query_vector vector(1536),
  project_uuid UUID,
  result_limit INTEGER DEFAULT 10,
  fts_weight FLOAT DEFAULT 0.4,
  vector_weight FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  id UUID,
  file_path TEXT,
  content_text TEXT,
  fts_score FLOAT,
  vector_score FLOAT,
  combined_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  WITH fts_results AS (
    SELECT
      s.id,
      ts_rank(s.content_tsvector, plainto_tsquery('english', query_text)) as score
    FROM semantic_search_embeddings s
    WHERE s.project_id = project_uuid
      AND s.content_tsvector @@ plainto_tsquery('english', query_text)
  ),
  vector_results AS (
    SELECT
      s.id,
      1 - (s.embedding <=> query_vector) as score
    FROM semantic_search_embeddings s
    WHERE s.project_id = project_uuid
      AND s.embedding IS NOT NULL
    ORDER BY s.embedding <=> query_vector
    LIMIT result_limit * 3
  )
  SELECT
    s.id,
    s.file_path,
    s.content_text,
    COALESCE(f.score, 0)::FLOAT as fts_score,
    COALESCE(v.score, 0)::FLOAT as vector_score,
    (COALESCE(f.score, 0) * fts_weight + COALESCE(v.score, 0) * vector_weight)::FLOAT as combined_score
  FROM semantic_search_embeddings s
  LEFT JOIN fts_results f ON s.id = f.id
  LEFT JOIN vector_results v ON s.id = v.id
  WHERE s.project_id = project_uuid
    AND (f.id IS NOT NULL OR v.id IS NOT NULL)
  ORDER BY combined_score DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Verify setup
\echo 'CodeMind PostgreSQL setup complete!'
\echo 'Tables created:'
\dt

\echo 'Extensions enabled:'
\dx
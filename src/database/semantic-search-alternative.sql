-- ============================================
-- SEMANTIC SEARCH Alternative (without pgvector)
-- Using text search and similarity functions instead
-- ============================================

CREATE TABLE IF NOT EXISTS code_embeddings_text (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('function', 'class', 'module', 'comment', 'documentation')),
  content TEXT NOT NULL,
  content_tokens TEXT[], -- tokenized content for similarity search
  embedding_json JSONB, -- store embedding as JSON array if needed
  metadata JSONB DEFAULT '{}'::jsonb,
  search_vector tsvector, -- PostgreSQL text search vector
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, file_path, chunk_index)
);

-- Create text search index
CREATE INDEX idx_embeddings_search ON code_embeddings_text USING GIN(search_vector);
CREATE INDEX idx_embeddings_text_project ON code_embeddings_text(project_id);
CREATE INDEX idx_embeddings_text_file ON code_embeddings_text(file_path);

-- Function to update search vector
CREATE OR REPLACE FUNCTION update_search_vector() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', NEW.content);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to maintain search vector
CREATE TRIGGER update_embeddings_search_vector 
  BEFORE INSERT OR UPDATE ON code_embeddings_text
  FOR EACH ROW EXECUTE FUNCTION update_search_vector();

-- Update trigger for timestamps
CREATE TRIGGER update_embeddings_text_updated_at BEFORE UPDATE ON code_embeddings_text
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
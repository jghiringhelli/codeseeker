-- Vector extension initialization for semantic search
-- This script is run after the main schema is created

-- Install pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create semantic search tables
CREATE TABLE IF NOT EXISTS code_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    file_path TEXT NOT NULL,
    content_type VARCHAR(50) NOT NULL, -- 'function', 'class', 'file', 'comment', etc.
    content_text TEXT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    embedding vector(384), -- OpenAI text-embedding-3-small dimension
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_code_embeddings_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Indexes for efficient vector similarity search
CREATE INDEX IF NOT EXISTS idx_code_embeddings_project_id ON code_embeddings(project_id);
CREATE INDEX IF NOT EXISTS idx_code_embeddings_content_type ON code_embeddings(content_type);
CREATE INDEX IF NOT EXISTS idx_code_embeddings_file_path ON code_embeddings(file_path);
CREATE INDEX IF NOT EXISTS idx_code_embeddings_hash ON code_embeddings(content_hash);

-- Vector similarity search index (HNSW for fast approximate search)
CREATE INDEX IF NOT EXISTS idx_code_embeddings_vector ON code_embeddings USING hnsw (embedding vector_cosine_ops);

-- Alternative: IVFFlat index (good for smaller datasets)
-- CREATE INDEX IF NOT EXISTS idx_code_embeddings_vector_ivf ON code_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Semantic search queries table
CREATE TABLE IF NOT EXISTS semantic_search_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    query_text TEXT NOT NULL,
    query_embedding vector(384),
    search_type VARCHAR(50) DEFAULT 'similarity', -- 'similarity', 'semantic', 'hybrid'
    filters JSONB DEFAULT '{}',
    results JSONB DEFAULT '[]',
    result_count INTEGER DEFAULT 0,
    execution_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_semantic_queries_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Indexes for query tracking
CREATE INDEX IF NOT EXISTS idx_semantic_queries_project_id ON semantic_search_queries(project_id);
CREATE INDEX IF NOT EXISTS idx_semantic_queries_created_at ON semantic_search_queries(created_at);

-- Function to calculate cosine similarity
CREATE OR REPLACE FUNCTION cosine_similarity(a vector, b vector)
RETURNS float
AS $$
BEGIN
    RETURN 1 - (a <=> b);
END;
$$ LANGUAGE plpgsql;

-- Function to search similar code
CREATE OR REPLACE FUNCTION search_similar_code(
    p_project_id UUID,
    p_query_embedding vector(384),
    p_content_types TEXT[] DEFAULT NULL,
    p_similarity_threshold float DEFAULT 0.7,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
    id UUID,
    file_path TEXT,
    content_type VARCHAR(50),
    content_text TEXT,
    similarity_score float,
    metadata JSONB
)
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ce.id,
        ce.file_path,
        ce.content_type,
        ce.content_text,
        cosine_similarity(ce.embedding, p_query_embedding) AS similarity_score,
        ce.metadata
    FROM code_embeddings ce
    WHERE 
        ce.project_id = p_project_id
        AND (p_content_types IS NULL OR ce.content_type = ANY(p_content_types))
        AND cosine_similarity(ce.embedding, p_query_embedding) >= p_similarity_threshold
    ORDER BY ce.embedding <=> p_query_embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function for hybrid search (combining text and vector search)
CREATE OR REPLACE FUNCTION hybrid_search_code(
    p_project_id UUID,
    p_query_text TEXT,
    p_query_embedding vector(384),
    p_text_weight float DEFAULT 0.3,
    p_vector_weight float DEFAULT 0.7,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
    id UUID,
    file_path TEXT,
    content_type VARCHAR(50),
    content_text TEXT,
    text_score float,
    vector_score float,
    combined_score float,
    metadata JSONB
)
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ce.id,
        ce.file_path,
        ce.content_type,
        ce.content_text,
        ts_rank_cd(to_tsvector('english', ce.content_text), plainto_tsquery('english', p_query_text)) AS text_score,
        cosine_similarity(ce.embedding, p_query_embedding) AS vector_score,
        (p_text_weight * ts_rank_cd(to_tsvector('english', ce.content_text), plainto_tsquery('english', p_query_text))) + 
        (p_vector_weight * cosine_similarity(ce.embedding, p_query_embedding)) AS combined_score,
        ce.metadata
    FROM code_embeddings ce
    WHERE ce.project_id = p_project_id
    ORDER BY combined_score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Add full-text search index
CREATE INDEX IF NOT EXISTS idx_code_embeddings_fts ON code_embeddings USING gin(to_tsvector('english', content_text));

-- Grant permissions
GRANT ALL ON code_embeddings TO codemind;
GRANT ALL ON semantic_search_queries TO codemind;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO codemind;

-- Log successful vector initialization
INSERT INTO system_logs (level, component, message, metadata)
VALUES ('info', 'database', 'Vector extension and semantic search tables initialized', 
        '{"tables": ["code_embeddings", "semantic_search_queries"], "functions": ["cosine_similarity", "search_similar_code", "hybrid_search_code"]}');
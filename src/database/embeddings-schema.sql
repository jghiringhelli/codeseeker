-- Code Embeddings Schema for Duplicate Detection
-- This extends the existing PostgreSQL schema with embedding support

-- Table for storing code element embeddings
CREATE TABLE IF NOT EXISTS code_embeddings (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    element_name VARCHAR(200) NOT NULL,
    element_type VARCHAR(50) NOT NULL CHECK (element_type IN ('class', 'method', 'function', 'interface', 'module')),
    start_line INTEGER NOT NULL,
    end_line INTEGER NOT NULL,
    code_hash VARCHAR(64) NOT NULL, -- SHA256 hash of the normalized code
    embedding vector(384), -- pgvector embedding (384 dimensions for sentence-transformers)
    metadata JSONB, -- Store additional metadata like complexity, LOC, etc.
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE(project_id, file_path, element_name, element_type)
);

-- Indexes for efficient similarity search
CREATE INDEX IF NOT EXISTS idx_code_embeddings_project_type ON code_embeddings(project_id, element_type);
CREATE INDEX IF NOT EXISTS idx_code_embeddings_file_path ON code_embeddings(file_path);
CREATE INDEX IF NOT EXISTS idx_code_embeddings_hash ON code_embeddings(code_hash);

-- pgvector index for cosine similarity search (requires pgvector extension)
-- This enables fast nearest neighbor search for duplicate detection
CREATE INDEX IF NOT EXISTS idx_code_embeddings_embedding_cosine ON code_embeddings 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Additional index for L2 distance if needed
CREATE INDEX IF NOT EXISTS idx_code_embeddings_embedding_l2 ON code_embeddings 
USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);

-- Table for tracking duplicate relationships and consolidation opportunities
CREATE TABLE IF NOT EXISTS duplicate_relationships (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    source_embedding_id INTEGER NOT NULL,
    target_embedding_id INTEGER NOT NULL,
    similarity_score DECIMAL(5,4) NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 1),
    relationship_type VARCHAR(50) NOT NULL CHECK (relationship_type IN ('duplicate', 'similar', 'refactor_candidate')),
    consolidation_suggestion TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'consolidated', 'dismissed')),
    reviewed_by VARCHAR(100),
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (source_embedding_id) REFERENCES code_embeddings(id) ON DELETE CASCADE,
    FOREIGN KEY (target_embedding_id) REFERENCES code_embeddings(id) ON DELETE CASCADE,
    UNIQUE(source_embedding_id, target_embedding_id)
);

-- Indexes for duplicate relationships
CREATE INDEX IF NOT EXISTS idx_duplicate_relationships_project ON duplicate_relationships(project_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_relationships_similarity ON duplicate_relationships(similarity_score DESC);
CREATE INDEX IF NOT EXISTS idx_duplicate_relationships_status ON duplicate_relationships(status);

-- View for getting duplicate consolidation opportunities
CREATE OR REPLACE VIEW consolidation_opportunities AS
SELECT 
    dr.id,
    dr.project_id,
    se.file_path as source_file,
    se.element_name as source_element,
    se.element_type as source_type,
    te.file_path as target_file,
    te.element_name as target_element,
    te.element_type as target_type,
    dr.similarity_score,
    dr.relationship_type,
    dr.consolidation_suggestion,
    dr.status,
    dr.created_at
FROM duplicate_relationships dr
JOIN code_embeddings se ON dr.source_embedding_id = se.id
JOIN code_embeddings te ON dr.target_embedding_id = te.id
WHERE dr.status = 'pending'
ORDER BY dr.similarity_score DESC, dr.created_at DESC;

-- Function for finding similar code elements
CREATE OR REPLACE FUNCTION find_similar_code_elements(
    query_embedding vector(384),
    project_id_param INTEGER,
    element_type_param VARCHAR(50) DEFAULT NULL,
    exclude_file_path VARCHAR(500) DEFAULT NULL,
    similarity_threshold DECIMAL DEFAULT 0.8,
    max_results INTEGER DEFAULT 10
) RETURNS TABLE (
    id INTEGER,
    file_path VARCHAR(500),
    element_name VARCHAR(200),
    element_type VARCHAR(50),
    similarity_score DECIMAL,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ce.id,
        ce.file_path,
        ce.element_name,
        ce.element_type,
        1 - (ce.embedding <=> query_embedding) as similarity_score,
        ce.metadata
    FROM code_embeddings ce
    WHERE ce.project_id = project_id_param
    AND (element_type_param IS NULL OR ce.element_type = element_type_param)
    AND (exclude_file_path IS NULL OR ce.file_path != exclude_file_path)
    AND (1 - (ce.embedding <=> query_embedding)) >= similarity_threshold
    ORDER BY ce.embedding <=> query_embedding
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Function for updating embeddings and detecting duplicates
CREATE OR REPLACE FUNCTION update_code_embedding_and_detect_duplicates(
    project_id_param INTEGER,
    file_path_param VARCHAR(500),
    element_name_param VARCHAR(200),
    element_type_param VARCHAR(50),
    start_line_param INTEGER,
    end_line_param INTEGER,
    code_hash_param VARCHAR(64),
    embedding_param vector(384),
    metadata_param JSONB DEFAULT NULL
) RETURNS TABLE (
    embedding_id INTEGER,
    duplicate_count INTEGER,
    highest_similarity DECIMAL
) AS $$
DECLARE
    new_embedding_id INTEGER;
    duplicate_count_result INTEGER := 0;
    highest_similarity_result DECIMAL := 0;
    similar_record RECORD;
BEGIN
    -- Insert or update the embedding
    INSERT INTO code_embeddings (
        project_id, file_path, element_name, element_type, 
        start_line, end_line, code_hash, embedding, metadata, updated_at
    )
    VALUES (
        project_id_param, file_path_param, element_name_param, element_type_param,
        start_line_param, end_line_param, code_hash_param, embedding_param, metadata_param, NOW()
    )
    ON CONFLICT (project_id, file_path, element_name, element_type)
    DO UPDATE SET
        start_line = EXCLUDED.start_line,
        end_line = EXCLUDED.end_line,
        code_hash = EXCLUDED.code_hash,
        embedding = EXCLUDED.embedding,
        metadata = EXCLUDED.metadata,
        updated_at = EXCLUDED.updated_at
    RETURNING id INTO new_embedding_id;
    
    -- Find and record similar elements
    FOR similar_record IN
        SELECT ce.id, ce.file_path, ce.element_name, 
               1 - (ce.embedding <=> embedding_param) as sim_score
        FROM code_embeddings ce
        WHERE ce.project_id = project_id_param
        AND ce.id != new_embedding_id
        AND ce.element_type = element_type_param
        AND (1 - (ce.embedding <=> embedding_param)) >= 0.85
        ORDER BY ce.embedding <=> embedding_param
        LIMIT 5
    LOOP
        duplicate_count_result := duplicate_count_result + 1;
        
        IF similar_record.sim_score > highest_similarity_result THEN
            highest_similarity_result := similar_record.sim_score;
        END IF;
        
        -- Insert duplicate relationship
        INSERT INTO duplicate_relationships (
            project_id, source_embedding_id, target_embedding_id,
            similarity_score, relationship_type, consolidation_suggestion
        )
        VALUES (
            project_id_param, new_embedding_id, similar_record.id,
            similar_record.sim_score,
            CASE 
                WHEN similar_record.sim_score >= 0.95 THEN 'duplicate'
                WHEN similar_record.sim_score >= 0.9 THEN 'similar'
                ELSE 'refactor_candidate'
            END,
            CASE 
                WHEN similar_record.sim_score >= 0.95 THEN 
                    'CRITICAL: Consider reusing ' || similar_record.element_name || ' from ' || similar_record.file_path
                WHEN similar_record.sim_score >= 0.9 THEN 
                    'HIGH: Consider extracting common functionality between ' || element_name_param || ' and ' || similar_record.element_name
                ELSE 
                    'MEDIUM: Review for consolidation opportunities'
            END
        )
        ON CONFLICT (source_embedding_id, target_embedding_id) DO UPDATE SET
            similarity_score = EXCLUDED.similarity_score,
            relationship_type = EXCLUDED.relationship_type,
            consolidation_suggestion = EXCLUDED.consolidation_suggestion;
    END LOOP;
    
    RETURN QUERY SELECT new_embedding_id, duplicate_count_result, highest_similarity_result;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON code_embeddings TO codeseeker;
GRANT SELECT, INSERT, UPDATE, DELETE ON duplicate_relationships TO codeseeker;
GRANT SELECT ON consolidation_opportunities TO codeseeker;
GRANT USAGE, SELECT ON SEQUENCE code_embeddings_id_seq TO codeseeker;
GRANT USAGE, SELECT ON SEQUENCE duplicate_relationships_id_seq TO codeseeker;

-- Comments for documentation
COMMENT ON TABLE code_embeddings IS 'Stores semantic embeddings of code elements for duplicate detection';
COMMENT ON TABLE duplicate_relationships IS 'Tracks relationships between similar code elements and consolidation suggestions';
COMMENT ON VIEW consolidation_opportunities IS 'View for retrieving pending code consolidation opportunities';
COMMENT ON FUNCTION find_similar_code_elements IS 'Finds code elements similar to a given embedding vector';
COMMENT ON FUNCTION update_code_embedding_and_detect_duplicates IS 'Updates embeddings and automatically detects duplicates';
-- Vector extension initialization for CodeMind
-- Enables pgvector for semantic search capabilities

-- Create vector extension if not exists
CREATE EXTENSION IF NOT EXISTS vector;

-- Create additional indexes for vector operations if needed
-- This file is loaded after the main schema
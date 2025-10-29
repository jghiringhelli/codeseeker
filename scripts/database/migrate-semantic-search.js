#!/usr/bin/env node

/**
 * Database Migration Script for Unified Semantic Search Schema
 * Migrates from old fragmented tables to unified semantic_search_embeddings table
 */

const { Client } = require('pg');
const path = require('path');
const fs = require('fs');

// Database configuration
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'codemind',
  user: process.env.DB_USER || 'codemind',
  password: process.env.DB_PASSWORD || 'codemind123'
};

async function runMigration() {
  const client = new Client(DB_CONFIG);

  try {
    await client.connect();
    console.log('🔌 Connected to PostgreSQL database');

    // Check if new unified table exists
    const tableCheck = await client.query(`
      SELECT to_regclass('public.semantic_search_embeddings') as table_exists
    `);

    const unifiedTableExists = tableCheck.rows[0].table_exists !== null;

    if (unifiedTableExists) {
      // Check if table has new columns
      const columnCheck = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'semantic_search_embeddings'
        AND column_name IN ('chunk_start_line', 'chunk_end_line', 'chunk_index', 'is_full_file')
      `);

      if (columnCheck.rows.length === 4) {
        console.log('✅ Unified semantic search schema already up to date');
        return;
      }
    }

    console.log('🔄 Starting semantic search schema migration...');

    // Drop old table if it exists and recreate with unified schema
    await client.query('DROP TABLE IF EXISTS semantic_search_embeddings CASCADE');
    console.log('🗑️  Dropped old semantic_search_embeddings table');

    // Create unified table with proper schema
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS semantic_search_embeddings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID,
        file_path TEXT NOT NULL,
        chunk_id TEXT NOT NULL,
        chunk_start_line INTEGER NOT NULL DEFAULT 1,
        chunk_end_line INTEGER NOT NULL DEFAULT 1,
        chunk_index INTEGER NOT NULL DEFAULT 0,
        is_full_file BOOLEAN NOT NULL DEFAULT false,
        content_text TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        embedding VECTOR(1536),
        metadata JSONB DEFAULT '{}'::jsonb,
        content_type TEXT DEFAULT 'code',
        significance TEXT CHECK (significance IN ('high', 'medium', 'low')) DEFAULT 'medium',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(project_id, chunk_id)
      );
    `;

    await client.query(createTableSQL);
    console.log('✅ Created unified semantic_search_embeddings table');

    // Create optimized indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_semantic_project_id ON semantic_search_embeddings(project_id)',
      'CREATE INDEX IF NOT EXISTS idx_semantic_file_path ON semantic_search_embeddings(file_path)',
      'CREATE INDEX IF NOT EXISTS idx_semantic_chunk_id ON semantic_search_embeddings(chunk_id)',
      'CREATE INDEX IF NOT EXISTS idx_semantic_significance ON semantic_search_embeddings(significance)',
      'CREATE INDEX IF NOT EXISTS idx_semantic_created_at ON semantic_search_embeddings(created_at)'
    ];

    for (const indexSQL of indexes) {
      await client.query(indexSQL);
    }
    console.log('✅ Created performance indexes');

    // Try to create vector similarity index if pgvector is available
    try {
      await client.query('CREATE INDEX IF NOT EXISTS idx_semantic_embedding_cosine ON semantic_search_embeddings USING hnsw (embedding vector_cosine_ops)');
      console.log('✅ Created vector similarity index (pgvector)');
    } catch (error) {
      console.log('⚠️  Vector index creation skipped (pgvector extension may not be available)');
    }

    console.log('🎉 Semantic search schema migration completed successfully!');
    console.log('📝 Note: Run project initialization to populate the new schema with data');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run migration if called directly
if (require.main === module) {
  console.log('🚀 Starting semantic search database migration...');
  console.log(`📍 Target database: ${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}`);

  runMigration().catch(error => {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  });
}

module.exports = { runMigration };
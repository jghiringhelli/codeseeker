/**
 * PostgreSQL Vector Store with pgvector
 *
 * Provides vector similarity search using PostgreSQL with:
 * - pgvector extension for vector embeddings
 * - Full-text search using tsvector/tsquery
 * - Hybrid search with RRF (Reciprocal Rank Fusion)
 *
 * Requires PostgreSQL with pgvector extension installed.
 * See docs/STORAGE.md for setup instructions.
 */

import { Pool, PoolClient } from 'pg';
import {
  IVectorStore,
  VectorDocument,
  VectorSearchResult
} from '../interfaces';

export interface PostgresVectorStoreConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  maxConnections?: number;
}

export class PostgresVectorStore implements IVectorStore {
  private pool: Pool;
  private initialized = false;

  constructor(private config: PostgresVectorStoreConfig) {
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      max: config.maxConnections || 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });
  }

  /**
   * Initialize schema (create tables if not exist)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const client = await this.pool.connect();
    try {
      // Check if pgvector extension is available
      await client.query(`CREATE EXTENSION IF NOT EXISTS vector`);

      // Create documents table with vector column
      await client.query(`
        CREATE TABLE IF NOT EXISTS vector_documents (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          file_path TEXT NOT NULL,
          content TEXT NOT NULL,
          embedding vector(1536),
          metadata JSONB,
          content_tsvector TSVECTOR GENERATED ALWAYS AS (
            setweight(to_tsvector('english', file_path), 'A') ||
            setweight(to_tsvector('english', content), 'B')
          ) STORED,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_vd_project ON vector_documents(project_id);
        CREATE INDEX IF NOT EXISTS idx_vd_file ON vector_documents(file_path);
        CREATE INDEX IF NOT EXISTS idx_vd_fts ON vector_documents USING GIN(content_tsvector);
      `);

      // Create vector index (IVFFlat for larger datasets)
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_vd_embedding ON vector_documents
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
      `).catch(() => {
        // IVFFlat requires training data; fall back to HNSW or skip
        console.log('Note: IVFFlat index creation skipped (requires more data)');
      });

      this.initialized = true;
    } finally {
      client.release();
    }
  }

  async upsert(doc: Omit<VectorDocument, 'createdAt' | 'updatedAt'>): Promise<void> {
    await this.initialize();

    const embeddingStr = doc.embedding.length > 0
      ? `[${doc.embedding.join(',')}]`
      : null;

    await this.pool.query(`
      INSERT INTO vector_documents (id, project_id, file_path, content, embedding, metadata, updated_at)
      VALUES ($1, $2, $3, $4, $5::vector, $6, NOW())
      ON CONFLICT (id) DO UPDATE SET
        project_id = EXCLUDED.project_id,
        file_path = EXCLUDED.file_path,
        content = EXCLUDED.content,
        embedding = EXCLUDED.embedding,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    `, [
      doc.id,
      doc.projectId,
      doc.filePath,
      doc.content,
      embeddingStr,
      doc.metadata ? JSON.stringify(doc.metadata) : null
    ]);
  }

  async upsertMany(docs: Array<Omit<VectorDocument, 'createdAt' | 'updatedAt'>>): Promise<void> {
    await this.initialize();

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      for (const doc of docs) {
        const embeddingStr = doc.embedding.length > 0
          ? `[${doc.embedding.join(',')}]`
          : null;

        await client.query(`
          INSERT INTO vector_documents (id, project_id, file_path, content, embedding, metadata, updated_at)
          VALUES ($1, $2, $3, $4, $5::vector, $6, NOW())
          ON CONFLICT (id) DO UPDATE SET
            project_id = EXCLUDED.project_id,
            file_path = EXCLUDED.file_path,
            content = EXCLUDED.content,
            embedding = EXCLUDED.embedding,
            metadata = EXCLUDED.metadata,
            updated_at = NOW()
        `, [
          doc.id,
          doc.projectId,
          doc.filePath,
          doc.content,
          embeddingStr,
          doc.metadata ? JSON.stringify(doc.metadata) : null
        ]);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async searchByVector(embedding: number[], projectId: string, limit = 10): Promise<VectorSearchResult[]> {
    await this.initialize();

    if (embedding.length === 0) return [];

    const embeddingStr = `[${embedding.join(',')}]`;

    const result = await this.pool.query(`
      SELECT
        id, project_id, file_path, content, metadata, created_at, updated_at,
        1 - (embedding <=> $1::vector) as similarity
      FROM vector_documents
      WHERE project_id = $2 AND embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector
      LIMIT $3
    `, [embeddingStr, projectId, limit]);

    return result.rows.map(row => ({
      document: this.rowToDocument(row),
      score: parseFloat(row.similarity) || 0,
      matchType: 'vector' as const
    }));
  }

  async searchByText(query: string, projectId: string, limit = 10): Promise<VectorSearchResult[]> {
    await this.initialize();

    // Convert query to tsquery format
    const tsQuery = query
      .split(/\s+/)
      .filter(word => word.length > 2)
      .join(' | ');

    if (!tsQuery) return [];

    const result = await this.pool.query(`
      SELECT
        id, project_id, file_path, content, metadata, created_at, updated_at,
        ts_rank_cd(content_tsvector, to_tsquery('english', $1)) as rank
      FROM vector_documents
      WHERE project_id = $2
        AND content_tsvector @@ to_tsquery('english', $1)
      ORDER BY rank DESC
      LIMIT $3
    `, [tsQuery, projectId, limit]);

    return result.rows.map(row => ({
      document: this.rowToDocument(row),
      score: parseFloat(row.rank) || 0,
      matchType: 'fts' as const
    }));
  }

  async searchHybrid(query: string, embedding: number[], projectId: string, limit = 10): Promise<VectorSearchResult[]> {
    await this.initialize();

    const k = 60; // RRF constant
    const results = new Map<string, { doc: VectorDocument; score: number; matchType: 'hybrid' }>();

    // Run vector search and FTS in parallel
    const [vectorResults, ftsResults] = await Promise.all([
      embedding.length > 0 ? this.searchByVector(embedding, projectId, limit * 2) : [],
      this.searchByText(query, projectId, limit * 2)
    ]);

    // Apply RRF fusion
    vectorResults.forEach((result, rank) => {
      const rrfScore = 1 / (k + rank + 1);
      const existing = results.get(result.document.id);
      if (existing) {
        existing.score += rrfScore;
      } else {
        results.set(result.document.id, {
          doc: result.document,
          score: rrfScore,
          matchType: 'hybrid'
        });
      }
    });

    ftsResults.forEach((result, rank) => {
      const rrfScore = 1 / (k + rank + 1);
      const existing = results.get(result.document.id);
      if (existing) {
        existing.score += rrfScore;
      } else {
        results.set(result.document.id, {
          doc: result.document,
          score: rrfScore,
          matchType: 'hybrid'
        });
      }
    });

    // Sort by combined score and return top results
    return Array.from(results.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(r => ({
        document: r.doc,
        score: r.score,
        matchType: r.matchType
      }));
  }

  async deleteByProject(projectId: string): Promise<number> {
    await this.initialize();

    const result = await this.pool.query(
      'DELETE FROM vector_documents WHERE project_id = $1',
      [projectId]
    );
    return result.rowCount || 0;
  }

  async delete(id: string): Promise<boolean> {
    await this.initialize();

    const result = await this.pool.query(
      'DELETE FROM vector_documents WHERE id = $1',
      [id]
    );
    return (result.rowCount || 0) > 0;
  }

  async count(projectId: string): Promise<number> {
    await this.initialize();

    const result = await this.pool.query(
      'SELECT COUNT(*) as count FROM vector_documents WHERE project_id = $1',
      [projectId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  async countFiles(projectId: string): Promise<number> {
    await this.initialize();

    const result = await this.pool.query(
      'SELECT COUNT(DISTINCT file_path) as count FROM vector_documents WHERE project_id = $1',
      [projectId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  async getFileMetadata(projectId: string, filePath: string): Promise<{ fileHash: string; indexedAt: string } | null> {
    await this.initialize();

    // Fast indexed query to get file metadata from first chunk
    const result = await this.pool.query(
      `SELECT metadata FROM vector_documents
       WHERE project_id = $1 AND file_path = $2
       LIMIT 1`,
      [projectId, filePath]
    );

    if (result.rows.length === 0 || !result.rows[0].metadata) {
      return null;
    }

    try {
      const metadata = result.rows[0].metadata;
      if (metadata.fileHash && metadata.indexedAt) {
        return { fileHash: metadata.fileHash, indexedAt: metadata.indexedAt };
      }
      return null;
    } catch {
      return null;
    }
  }

  async flush(): Promise<void> {
    // No-op for PostgreSQL (writes are immediate)
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Test connection health
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  private rowToDocument(row: any): VectorDocument {
    return {
      id: row.id,
      projectId: row.project_id,
      filePath: row.file_path,
      content: row.content,
      embedding: [], // Don't return embedding in results to save memory
      metadata: row.metadata || {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}
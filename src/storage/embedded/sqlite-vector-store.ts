/**
 * SQLite-based Vector Store
 *
 * Provides vector similarity search using better-sqlite3 with:
 * - Vector embeddings stored as BLOBs
 * - Cosine similarity computed in JavaScript
 * - Full-text search using MiniSearch (replaces FTS5 for reliability)
 * - Hybrid search with RRF (Reciprocal Rank Fusion)
 * - Automatic disk persistence
 *
 * Zero external dependencies - works immediately after npm install.
 */

import Database, { Database as DatabaseType } from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import {
  IVectorStore,
  VectorDocument,
  VectorSearchResult
} from '../interfaces';
import { MiniSearchTextStore } from './minisearch-text-store';

export class SQLiteVectorStore implements IVectorStore {
  private db: DatabaseType;
  private textStore: MiniSearchTextStore;
  private isDirty = false;
  private flushTimer: NodeJS.Timeout | null = null;
  private dataDir: string;

  constructor(
    dataDir: string,
    private flushIntervalSeconds = 30
  ) {
    this.dataDir = dataDir;
    // Ensure data directory exists
    fs.mkdirSync(dataDir, { recursive: true });

    const dbPath = path.join(dataDir, 'vectors.db');
    this.db = new Database(dbPath);

    // Enable WAL mode for better concurrent performance
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');

    // Initialize MiniSearch for text search (replaces FTS5)
    this.textStore = new MiniSearchTextStore(dataDir, flushIntervalSeconds);

    this.initializeSchema();
    this.startFlushTimer();
  }

  private initializeSchema(): void {
    // Main documents table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        content TEXT NOT NULL,
        embedding BLOB NOT NULL,
        metadata TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);
      CREATE INDEX IF NOT EXISTS idx_documents_file ON documents(file_path);
    `);

    // Note: FTS5 virtual table removed - now using MiniSearch for text search
    // MiniSearch provides better reliability (no sync issues) and synonym support
  }

  private startFlushTimer(): void {
    if (this.flushIntervalSeconds > 0) {
      this.flushTimer = setInterval(() => {
        if (this.isDirty) {
          this.flush().catch(console.error);
        }
      }, this.flushIntervalSeconds * 1000);
    }
  }

  // Serialize embedding to Buffer
  private serializeEmbedding(embedding: number[]): Buffer {
    const buffer = Buffer.alloc(embedding.length * 4);
    for (let i = 0; i < embedding.length; i++) {
      buffer.writeFloatLE(embedding[i], i * 4);
    }
    return buffer;
  }

  // Deserialize Buffer to embedding
  private deserializeEmbedding(buffer: Buffer): number[] {
    const embedding: number[] = [];
    for (let i = 0; i < buffer.length; i += 4) {
      embedding.push(buffer.readFloatLE(i));
    }
    return embedding;
  }

  // Compute cosine similarity between two vectors
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  async upsert(doc: Omit<VectorDocument, 'createdAt' | 'updatedAt'>): Promise<void> {
    const now = new Date().toISOString();
    const embeddingBlob = this.serializeEmbedding(doc.embedding);
    const metadata = doc.metadata ? JSON.stringify(doc.metadata) : null;

    const stmt = this.db.prepare(`
      INSERT INTO documents (id, project_id, file_path, content, embedding, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        file_path = excluded.file_path,
        content = excluded.content,
        embedding = excluded.embedding,
        metadata = excluded.metadata,
        updated_at = excluded.updated_at
    `);

    stmt.run(doc.id, doc.projectId, doc.filePath, doc.content, embeddingBlob, metadata, now, now);

    // Also index in MiniSearch for text search
    await this.textStore.index({
      id: doc.id,
      projectId: doc.projectId,
      filePath: doc.filePath,
      content: doc.content,
      metadata: doc.metadata
    });

    this.isDirty = true;
  }

  async upsertMany(docs: Array<Omit<VectorDocument, 'createdAt' | 'updatedAt'>>): Promise<void> {
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO documents (id, project_id, file_path, content, embedding, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        file_path = excluded.file_path,
        content = excluded.content,
        embedding = excluded.embedding,
        metadata = excluded.metadata,
        updated_at = excluded.updated_at
    `);

    const insertMany = this.db.transaction((documents: typeof docs) => {
      for (const doc of documents) {
        const embeddingBlob = this.serializeEmbedding(doc.embedding);
        const metadata = doc.metadata ? JSON.stringify(doc.metadata) : null;
        stmt.run(doc.id, doc.projectId, doc.filePath, doc.content, embeddingBlob, metadata, now, now);
      }
    });

    insertMany(docs);

    // Also index in MiniSearch for text search
    await this.textStore.indexMany(docs.map(doc => ({
      id: doc.id,
      projectId: doc.projectId,
      filePath: doc.filePath,
      content: doc.content,
      metadata: doc.metadata
    })));

    this.isDirty = true;
  }

  async searchByVector(embedding: number[], projectId: string, limit = 10): Promise<VectorSearchResult[]> {
    // Get all documents for this project
    const stmt = this.db.prepare(`
      SELECT id, project_id, file_path, content, embedding, metadata, created_at, updated_at
      FROM documents
      WHERE project_id = ?
    `);

    const rows = stmt.all(projectId) as Array<{
      id: string;
      project_id: string;
      file_path: string;
      content: string;
      embedding: Buffer;
      metadata: string | null;
      created_at: string;
      updated_at: string;
    }>;

    // Compute similarities
    const results: VectorSearchResult[] = rows.map(row => {
      const docEmbedding = this.deserializeEmbedding(row.embedding);
      const score = this.cosineSimilarity(embedding, docEmbedding);

      return {
        document: {
          id: row.id,
          projectId: row.project_id,
          filePath: row.file_path,
          content: row.content,
          embedding: docEmbedding,
          metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at)
        },
        score,
        matchType: 'vector' as const
      };
    });

    // Sort by score descending and limit
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async searchByText(query: string, projectId: string, limit = 10): Promise<VectorSearchResult[]> {
    // Use MiniSearch for full-text search (replaces FTS5 which had sync issues)
    try {
      const textResults = await this.textStore.searchWithSynonyms(query, projectId, limit);

      // Get full document data with embeddings from SQLite
      const results: VectorSearchResult[] = [];
      for (const textResult of textResults) {
        const row = this.db.prepare(`
          SELECT id, project_id, file_path, content, embedding, metadata, created_at, updated_at
          FROM documents
          WHERE id = ?
        `).get(textResult.document.id) as {
          id: string;
          project_id: string;
          file_path: string;
          content: string;
          embedding: Buffer;
          metadata: string | null;
          created_at: string;
          updated_at: string;
        } | undefined;

        if (row) {
          results.push({
            document: {
              id: row.id,
              projectId: row.project_id,
              filePath: row.file_path,
              content: row.content,
              embedding: this.deserializeEmbedding(row.embedding),
              metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
              createdAt: new Date(row.created_at),
              updatedAt: new Date(row.updated_at)
            },
            score: textResult.score,
            matchType: 'fts' as const
          });
        }
      }

      return results;
    } catch (error) {
      console.warn('[SQLiteVectorStore] Text search failed:', error);
      return [];
    }
  }

  async searchHybrid(
    query: string,
    embedding: number[],
    projectId: string,
    limit = 10
  ): Promise<VectorSearchResult[]> {
    // Check if embedding is valid (non-empty and non-zero magnitude)
    const hasValidEmbedding = embedding.length > 0 &&
      embedding.some(v => Math.abs(v) > 0.0001);

    // Get results from both methods (skip vector search if no valid embedding)
    const [vectorResults, ftsResults] = await Promise.all([
      hasValidEmbedding
        ? this.searchByVector(embedding, projectId, limit * 2)
        : Promise.resolve([]),
      this.searchByText(query, projectId, limit * 2)
    ]);

    // RRF (Reciprocal Rank Fusion) with weights for RANKING
    const VECTOR_WEIGHT = 0.50;
    const FTS_WEIGHT = 0.35;
    const PATH_WEIGHT = 0.15;
    const K = 60; // RRF constant

    // Build maps for quick lookup of original scores
    const vectorScoreMap = new Map<string, number>();
    vectorResults.forEach(result => {
      vectorScoreMap.set(result.document.id, result.score);
    });

    const ftsScoreMap = new Map<string, number>();
    ftsResults.forEach(result => {
      ftsScoreMap.set(result.document.id, result.score);
    });

    const scoreMap = new Map<string, {
      doc: VectorDocument;
      rrfScore: number;
      vectorScore: number;
      ftsScore: number;
      matchTypes: Set<string>
    }>();

    // Process vector results
    vectorResults.forEach((result, rank) => {
      const rrfScore = VECTOR_WEIGHT * (1 / (K + rank + 1));
      const existing = scoreMap.get(result.document.id);
      if (existing) {
        existing.rrfScore += rrfScore;
        existing.vectorScore = result.score;
        existing.matchTypes.add('vector');
      } else {
        scoreMap.set(result.document.id, {
          doc: result.document,
          rrfScore,
          vectorScore: result.score,
          ftsScore: 0,
          matchTypes: new Set(['vector'])
        });
      }
    });

    // Process FTS results
    ftsResults.forEach((result, rank) => {
      const rrfScore = FTS_WEIGHT * (1 / (K + rank + 1));
      const existing = scoreMap.get(result.document.id);
      if (existing) {
        existing.rrfScore += rrfScore;
        existing.ftsScore = result.score;
        existing.matchTypes.add('fts');
      } else {
        scoreMap.set(result.document.id, {
          doc: result.document,
          rrfScore,
          vectorScore: 0,
          ftsScore: result.score,
          matchTypes: new Set(['fts'])
        });
      }
    });

    // Add path matching bonus
    const queryLower = query.toLowerCase();
    for (const [, entry] of scoreMap) {
      const pathLower = entry.doc.filePath.toLowerCase();
      if (pathLower.includes(queryLower) || queryLower.split(/\s+/).some(w => pathLower.includes(w))) {
        entry.rrfScore += PATH_WEIGHT;
        entry.matchTypes.add('path');
      }
    }

    // Sort by RRF score for ranking, but use intuitive display score
    const sortedEntries = Array.from(scoreMap.values())
      .sort((a, b) => b.rrfScore - a.rrfScore)
      .slice(0, limit);

    // Calculate intuitive display scores based on match types and original scores
    // - Vector match: Use cosine similarity (0-1) directly
    // - FTS match: Normalize BM25 to 0-1 range
    // - Both: Boost score for cross-method validation
    // - Final score is ALWAYS capped at 1.0 (100%)
    const results: VectorSearchResult[] = sortedEntries.map(entry => {
      let displayScore = 0;
      let matchSource = '';

      if (entry.matchTypes.has('vector') && entry.matchTypes.has('fts')) {
        // Both methods matched - highest confidence, use vector score + boost
        displayScore = entry.vectorScore * 1.1;
        matchSource = 'semantic+text';
      } else if (entry.matchTypes.has('vector')) {
        // Semantic (vector) only - use cosine similarity directly
        displayScore = entry.vectorScore;
        matchSource = 'semantic';
      } else if (entry.matchTypes.has('fts')) {
        // Text (inverted index) only - normalize BM25 (typically 0-20+) to 0-0.8 range
        displayScore = entry.ftsScore / 10;
        matchSource = 'text';
      }

      // Add small boost for path match
      if (entry.matchTypes.has('path')) {
        displayScore += 0.05;
        matchSource += '+path';
      }

      // ALWAYS cap final score at 1.0 (100%)
      displayScore = Math.min(1.0, displayScore);

      // Debug logging (only in development)
      if (process.env.DEBUG_SEARCH) {
        console.log(`[Search] ${entry.doc.filePath}: ${matchSource} semantic=${entry.vectorScore.toFixed(3)} text=${entry.ftsScore.toFixed(3)} -> display=${displayScore.toFixed(3)}`);
      }

      return {
        document: entry.doc,
        score: displayScore,
        matchType: 'hybrid' as const,
        debug: {
          vectorScore: entry.vectorScore,
          textScore: entry.ftsScore,
          pathMatch: entry.matchTypes.has('path'),
          matchSource
        }
      };
    });

    return results;
  }

  async deleteByProject(projectId: string): Promise<number> {
    const stmt = this.db.prepare('DELETE FROM documents WHERE project_id = ?');
    const result = stmt.run(projectId);

    // Also remove from MiniSearch
    await this.textStore.removeByProject(projectId);

    this.isDirty = true;
    return result.changes;
  }

  async delete(id: string): Promise<boolean> {
    const stmt = this.db.prepare('DELETE FROM documents WHERE id = ?');
    const result = stmt.run(id);

    // Also remove from MiniSearch
    await this.textStore.remove(id);

    this.isDirty = true;
    return result.changes > 0;
  }

  async count(projectId: string): Promise<number> {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM documents WHERE project_id = ?');
    const result = stmt.get(projectId) as { count: number };
    return result.count;
  }

  async countFiles(projectId: string): Promise<number> {
    const stmt = this.db.prepare('SELECT COUNT(DISTINCT file_path) as count FROM documents WHERE project_id = ?');
    const result = stmt.get(projectId) as { count: number };
    return result.count;
  }

  async getFileMetadata(projectId: string, filePath: string): Promise<{ fileHash: string; indexedAt: string } | null> {
    // Fast indexed query to get file metadata from first chunk
    // Returns hash + indexedAt for two-stage change detection:
    // 1. Quick mtime check (~0.1ms) - if file mtime <= indexedAt, skip
    // 2. Hash check only if mtime changed (~1-5ms)
    const stmt = this.db.prepare(`
      SELECT metadata FROM documents
      WHERE project_id = ? AND file_path = ?
      LIMIT 1
    `);
    const result = stmt.get(projectId, filePath) as { metadata: string | null } | undefined;

    if (!result?.metadata) {
      return null;
    }

    try {
      const metadata = JSON.parse(result.metadata);
      if (metadata.fileHash && metadata.indexedAt) {
        return { fileHash: metadata.fileHash, indexedAt: metadata.indexedAt };
      }
      return null;
    } catch {
      return null;
    }
  }

  async flush(): Promise<void> {
    // SQLite with WAL mode auto-persists, but we can checkpoint
    this.db.pragma('wal_checkpoint(PASSIVE)');
    await this.textStore.flush();
    this.isDirty = false;
  }

  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
    await this.textStore.close();
    this.db.close();
  }

  /**
   * Get the underlying text store for synonym management
   */
  getTextStore(): MiniSearchTextStore {
    return this.textStore;
  }
}
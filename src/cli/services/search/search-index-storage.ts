/**
 * Search Index Storage Service - Single Responsibility
 * Handles storage and retrieval of semantic chunks and embeddings
 */

import { DatabaseConnections } from '../../../config/database-config';
import { ISearchIndexStorage, SemanticChunk, SearchQuery, SemanticSearchResult } from '../../../core/interfaces/search-interfaces';

export class SearchIndexStorage implements ISearchIndexStorage {
  constructor(private dbConnections: DatabaseConnections) {}

  async storeChunks(projectId: string, chunks: SemanticChunk[], embeddings: number[][]): Promise<void> {
    const postgres = await this.dbConnections.getPostgresConnection();

    const query = `
      INSERT INTO semantic_search_embeddings (
        chunk_id, project_id, file_path, content, start_line, end_line,
        chunk_index, is_full_file, hash, metadata, embedding
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (chunk_id) DO UPDATE SET
        content = EXCLUDED.content,
        embedding = EXCLUDED.embedding,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    `;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddings[i];

      const values = [
        chunk.id,
        projectId,
        chunk.filePath,
        chunk.content,
        chunk.startLine,
        chunk.endLine,
        chunk.chunkIndex,
        chunk.isFullFile,
        chunk.hash,
        JSON.stringify(chunk.metadata),
        JSON.stringify(embedding)
      ];

      await postgres.query(query, values);
    }
  }

  async retrieveChunks(query: SearchQuery): Promise<SemanticSearchResult[]> {
    const postgres = await this.dbConnections.getPostgresConnection();

    let sqlQuery = `
      SELECT chunk_id, file_path, content, start_line, end_line, chunk_index,
             is_full_file, hash, metadata, embedding
      FROM semantic_search_embeddings
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (query.projectId) {
      sqlQuery += ` AND project_id = $${paramIndex}`;
      params.push(query.projectId);
      paramIndex++;
    }

    if (query.fileTypes && query.fileTypes.length > 0) {
      const fileTypeConditions = query.fileTypes.map(type => {
        const param = `$${paramIndex}`;
        params.push(`%.${type}`);
        paramIndex++;
        return `file_path LIKE ${param}`;
      }).join(' OR ');
      sqlQuery += ` AND (${fileTypeConditions})`;
    }

    sqlQuery += ` ORDER BY updated_at DESC`;

    if (query.maxResults) {
      sqlQuery += ` LIMIT $${paramIndex}`;
      params.push(query.maxResults);
    }

    const result = await postgres.query(sqlQuery, params);

    return result.rows.map(row => ({
      chunk: {
        id: row.chunk_id,
        filePath: row.file_path,
        content: row.content,
        startLine: row.start_line,
        endLine: row.end_line,
        chunkIndex: row.chunk_index,
        isFullFile: row.is_full_file,
        hash: row.hash,
        metadata: this.parseJsonSafely(row.metadata, {})
      },
      relevanceScore: 1.0, // Will be calculated by similarity search
      matchReason: 'database_match',
      embedding: this.parseJsonSafely(row.embedding, [])
    }));
  }

  private parseJsonSafely(jsonString: string, defaultValue: any): any {
    try {
      if (!jsonString || jsonString === 'null' || jsonString === 'undefined') {
        return defaultValue;
      }

      // Handle case where data was stored as "[object Object]"
      if (jsonString === '[object Object]') {
        return defaultValue;
      }

      return JSON.parse(jsonString);
    } catch (error) {
      console.warn(`Failed to parse JSON: ${jsonString}`, error);
      return defaultValue;
    }
  }

  async getIndexStats(projectId?: string): Promise<{
    totalFiles: number;
    totalChunks: number;
    lastUpdated: Date;
    projectSize: number;
  }> {
    const postgres = await this.dbConnections.getPostgresConnection();

    let query = `
      SELECT
        COUNT(DISTINCT file_path) as total_files,
        COUNT(*) as total_chunks,
        MAX(updated_at) as last_updated,
        SUM(LENGTH(content)) as project_size
      FROM semantic_search_embeddings
    `;

    const params: any[] = [];
    if (projectId) {
      query += ' WHERE project_id = $1';
      params.push(projectId);
    }

    const result = await postgres.query(query, params);
    const stats = result.rows[0];

    return {
      totalFiles: parseInt(stats.total_files) || 0,
      totalChunks: parseInt(stats.total_chunks) || 0,
      lastUpdated: stats.last_updated || new Date(),
      projectSize: parseInt(stats.project_size) || 0
    };
  }

  async removeChunks(projectId: string, filePaths: string[]): Promise<void> {
    if (filePaths.length === 0) return;

    const postgres = await this.dbConnections.getPostgresConnection();

    const placeholders = filePaths.map((_, index) => `$${index + 2}`).join(',');
    const query = `
      DELETE FROM semantic_search_embeddings
      WHERE project_id = $1 AND file_path IN (${placeholders})
    `;

    await postgres.query(query, [projectId, ...filePaths]);
  }

  async updateChunkContent(chunkId: string, content: string, embedding: number[]): Promise<void> {
    const postgres = await this.dbConnections.getPostgresConnection();

    const query = `
      UPDATE semantic_search_embeddings
      SET content = $1, embedding_vector = $2, updated_at = NOW()
      WHERE chunk_id = $3
    `;

    await postgres.query(query, [content, JSON.stringify(embedding), chunkId]);
  }
}
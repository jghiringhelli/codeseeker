/**
 * Semantic Search Service
 * SOLID Principles: Single Responsibility - Handle semantic search operations only
 */

import { ISemanticSearchService, IDatabaseConnection } from '../interfaces';

export class SemanticSearchService implements ISemanticSearchService {
  constructor(private db: IDatabaseConnection) {}

  async getSemanticSearchData(projectId: string, filters: any = {}): Promise<any[]> {
    try {
      let query = 'SELECT * FROM semantic_search_embeddings WHERE project_id = $1';
      const params = [projectId];

      if (filters.content_type) {
        query += ` AND content_type = $${params.length + 1}`;
        params.push(filters.content_type);
      }

      if (filters.file_path) {
        query += ` AND file_path ILIKE $${params.length + 1}`;
        params.push(`%${filters.file_path}%`);
      }

      query += ' ORDER BY updated_at DESC';

      if (filters.limit) {
        query += ` LIMIT $${params.length + 1}`;
        params.push(filters.limit);
      }

      const result = await this.db.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting semantic search data:', error);
      return [];
    }
  }

  async saveSemanticSearchData(projectId: string, data: any[]): Promise<any> {
    try {
      for (const item of data) {
        await this.db.query(`
          INSERT INTO semantic_search_embeddings (
            project_id, file_path, content_type, content_text,
            content_hash, embedding, metadata, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          ON CONFLICT (project_id, file_path, content_hash) DO UPDATE SET
          content_text = $4, embedding = $6, metadata = $7, updated_at = NOW()
        `, [
          projectId,
          item.file_path,
          item.content_type,
          item.content_text,
          item.content_hash,
          item.embedding,
          JSON.stringify(item.metadata || {})
        ]);
      }
      return { success: true, processed: data.length };
    } catch (error) {
      console.error('Error saving semantic search data:', error);
      throw error;
    }
  }

  async deleteSemanticSearchData(projectId: string): Promise<void> {
    try {
      await this.db.query('DELETE FROM semantic_search_embeddings WHERE project_id = $1', [projectId]);
    } catch (error) {
      console.error('Error deleting semantic search data:', error);
      throw error;
    }
  }

  async saveSemanticSearch(projectId: string, data: any[]): Promise<any> {
    console.log(`Saving ${data.length} semantic search embeddings for project ${projectId}`);

    const insertPromises = data.map(async (item) => {
      try {
        // Convert embedding array to PostgreSQL vector format if it exists
        let embeddingValue = null;
        if (item.embedding) {
          if (typeof item.embedding === 'string') {
            embeddingValue = item.embedding; // Already formatted
          } else if (Array.isArray(item.embedding)) {
            embeddingValue = `[${item.embedding.join(',')}]`;
          }
        }

        const result = await this.db.query(`
          INSERT INTO code_embeddings (
            project_id, file_path, content_type, content_text, content_hash,
            embedding, metadata, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6::vector, $7, NOW(), NOW())
          RETURNING id
        `, [
          projectId,
          item.file_path,
          item.content_type,
          item.content_text,
          item.content_hash,
          embeddingValue,
          JSON.stringify(item.metadata || {})
        ]);

        return { success: true, id: result.rows[0]?.id };
      } catch (error) {
        console.error(`Failed to insert embedding:`, error);
        return { success: false, error: error.message };
      }
    });

    const results = await Promise.all(insertPromises);
    const successful = results.filter(r => r.success).length;

    return {
      total: data.length,
      inserted: successful,
      errors: results.filter(r => !r.success).length
    };
  }

  async getSemanticSearch(projectId: string, filters: any = {}): Promise<any[]> {
    const conditions = ['project_id = $1'];
    const params = [projectId];
    let paramIndex = 2;

    if (filters.content_type) {
      conditions.push(`content_type = $${paramIndex}`);
      params.push(filters.content_type);
      paramIndex++;
    }

    if (filters.file_path) {
      conditions.push(`file_path LIKE $${paramIndex}`);
      params.push(`%${filters.file_path}%`);
      paramIndex++;
    }

    const limit = parseInt(filters.limit) || 100;
    const offset = parseInt(filters.offset) || 0;

    const query = `
      SELECT id, project_id, file_path, content_type, content_text, content_hash,
             embedding, metadata, created_at, updated_at
      FROM code_embeddings
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(String(limit), String(offset));

    try {
      const result = await this.db.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error querying semantic search data:', error);
      throw error;
    }
  }
}
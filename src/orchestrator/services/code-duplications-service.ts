/**
 * Code Duplications Service
 * SOLID Principles: Single Responsibility - Handle code duplication operations only
 */

import { ICodeDuplicationsService, IDatabaseConnection } from '../interfaces';

export class CodeDuplicationsService implements ICodeDuplicationsService {
  constructor(private db: IDatabaseConnection) {}

  async getDuplications(projectId: string, filters: any = {}): Promise<any[]> {
    const { duplication_type, similarity_threshold, priority, status } = filters;

    let query = 'SELECT * FROM code_duplications WHERE project_id = $1';
    const params: any[] = [projectId];

    if (duplication_type) {
      query += ' AND duplication_type = $' + (params.length + 1);
      params.push(duplication_type);
    }

    if (similarity_threshold) {
      query += ' AND similarity_score >= $' + (params.length + 1);
      params.push(similarity_threshold);
    }

    if (priority) {
      query += ' AND priority = $' + (params.length + 1);
      params.push(priority);
    }

    if (status) {
      query += ' AND status = $' + (params.length + 1);
      params.push(status);
    }

    query += ' ORDER BY similarity_score DESC, priority DESC';

    const result = await this.db.query(query, params);
    return result.rows;
  }

  async saveDuplications(projectId: string, data: any[]): Promise<any> {
    const insertPromises = data.map(async (item) => {
      try {
        const query = `
          INSERT INTO code_duplications
          (project_id, duplication_type, similarity_score, source_file, source_start_line, source_end_line,
           target_file, target_start_line, target_end_line, code_snippet, tokens_count, refactor_suggestion, priority, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          ON CONFLICT (project_id, source_file, source_start_line, target_file, target_start_line)
          DO UPDATE SET
            similarity_score = EXCLUDED.similarity_score,
            refactor_suggestion = EXCLUDED.refactor_suggestion,
            updated_at = NOW()
          RETURNING id
        `;

        const result = await this.db.query(query, [
          projectId,
          item.duplication_type,
          item.similarity_score,
          item.source_file,
          item.source_start_line,
          item.source_end_line,
          item.target_file,
          item.target_start_line,
          item.target_end_line,
          item.code_snippet,
          item.tokens_count || 0,
          item.refactor_suggestion,
          item.priority || 'medium',
          item.status || 'detected'
        ]);

        return { success: true, id: result.rows[0]?.id };
      } catch (error) {
        console.error(`Failed to insert duplication:`, error);
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

  async deleteDuplications(projectId: string): Promise<void> {
    try {
      await this.db.query('DELETE FROM code_duplications WHERE project_id = $1', [projectId]);
    } catch (error) {
      console.error('Error deleting code duplications:', error);
      throw error;
    }
  }

  async getDuplicationStats(projectId: string): Promise<any> {
    try {
      const statsQuery = `
        SELECT
          COUNT(*) as total_duplications,
          COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority,
          COUNT(CASE WHEN priority = 'medium' THEN 1 END) as medium_priority,
          COUNT(CASE WHEN priority = 'low' THEN 1 END) as low_priority,
          AVG(similarity_score) as avg_similarity,
          COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_count,
          COUNT(CASE WHEN status = 'detected' THEN 1 END) as pending_count
        FROM code_duplications
        WHERE project_id = $1
      `;

      const result = await this.db.query(statsQuery, [projectId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error getting duplication stats:', error);
      throw error;
    }
  }
}
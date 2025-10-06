/**
 * Initialization Status Tracker
 *
 * Tracks the progress of project initialization across multiple stages:
 * - Metadata Ready (project registered)
 * - File Discovery Ready (files scanned)
 * - Semantic Entities Ready (entities extracted and stored in Neo4j)
 * - Semantic Relationships Ready (relationships stored in Neo4j)
 * - Vector Embeddings Ready (embeddings stored in PostgreSQL)
 * - Initialization Complete (all stages successful)
 */

import { DatabaseConnections } from '../../../config/database-config';
import { Logger } from '../../../utils/logger';

export interface InitializationStatus {
  projectId: string;
  projectName: string;
  projectPath: string;
  metadataReady: boolean;
  fileDiscoveryReady: boolean;
  semanticEntitiesReady: boolean;
  semanticRelationshipsReady: boolean;
  vectorEmbeddingsReady: boolean;
  initializationComplete: boolean;
  lastAttemptAt: Date;
  completedAt?: Date;
  errorMessage?: string;
  stats: {
    totalFiles?: number;
    entitiesCount?: number;
    relationshipsCount?: number;
    embeddingsCount?: number;
    processingTimeMs?: number;
  };
}

export interface StatusUpdateData {
  stage: 'metadata' | 'file_discovery' | 'semantic_entities' | 'semantic_relationships' | 'vector_embeddings' | 'complete';
  success: boolean;
  errorMessage?: string;
  stats?: any;
}

export class InitializationStatusTracker {
  private dbConnections: DatabaseConnections;
  private logger = Logger.getInstance();

  constructor(dbConnections?: DatabaseConnections) {
    this.dbConnections = dbConnections || new DatabaseConnections();
  }

  /**
   * Initialize tracking for a project
   */
  async initializeProject(projectId: string, projectName: string, projectPath: string): Promise<void> {
    this.logger.info(`📊 Initializing status tracking for project: ${projectName}`);

    try {
      const pgClient = await this.dbConnections.getPostgresConnection();

      await pgClient.query(`
        INSERT INTO initialization_status (
          project_id, project_name, project_path, metadata_ready, last_attempt_at
        ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        ON CONFLICT (project_id) DO UPDATE SET
          project_name = EXCLUDED.project_name,
          project_path = EXCLUDED.project_path,
          last_attempt_at = CURRENT_TIMESTAMP,
          error_message = NULL
      `, [projectId, projectName, projectPath, true]);

      console.log(`  ✅ Status tracking initialized for ${projectName}`);
    } catch (error) {
      this.logger.error(`Failed to initialize status tracking: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update status for a specific stage
   */
  async updateStageStatus(projectId: string, update: StatusUpdateData): Promise<void> {
    this.logger.info(`📊 Updating ${update.stage} status: ${update.success ? 'SUCCESS' : 'FAILED'}`);

    try {
      const pgClient = await this.dbConnections.getPostgresConnection();

      // Build update fields based on stage
      const updateFields = this.getUpdateFields(update.stage, update.success);
      const statsUpdate = update.stats ? JSON.stringify(update.stats) : null;

      let query = `
        UPDATE initialization_status
        SET ${updateFields.join(', ')},
            updated_at = CURRENT_TIMESTAMP,
            last_attempt_at = CURRENT_TIMESTAMP
      `;

      const params = [projectId];

      if (update.errorMessage) {
        query += `, error_message = $${params.length + 1}`;
        params.push(update.errorMessage);
      } else if (update.success) {
        query += `, error_message = NULL`;
      }

      if (statsUpdate) {
        query += `, stats = stats || $${params.length + 1}::jsonb`;
        params.push(statsUpdate);
      }

      if (update.stage === 'complete' && update.success) {
        query += `, completed_at = CURRENT_TIMESTAMP`;
      }

      query += ` WHERE project_id = $1`;

      await pgClient.query(query, params);

      console.log(`  ✅ Updated ${update.stage} status to ${update.success ? 'ready' : 'failed'}`);

      // Check if all stages are complete
      if (update.success) {
        await this.checkCompletionStatus(projectId);
      }

    } catch (error) {
      this.logger.error(`Failed to update ${update.stage} status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get current status for a project
   */
  async getProjectStatus(projectId: string): Promise<InitializationStatus | null> {
    try {
      const pgClient = await this.dbConnections.getPostgresConnection();

      const result = await pgClient.query(`
        SELECT
          project_id as "projectId",
          project_name as "projectName",
          project_path as "projectPath",
          metadata_ready as "metadataReady",
          file_discovery_ready as "fileDiscoveryReady",
          semantic_entities_ready as "semanticEntitiesReady",
          semantic_relationships_ready as "semanticRelationshipsReady",
          vector_embeddings_ready as "vectorEmbeddingsReady",
          initialization_complete as "initializationComplete",
          last_attempt_at as "lastAttemptAt",
          completed_at as "completedAt",
          error_message as "errorMessage",
          stats
        FROM initialization_status
        WHERE project_id = $1
      `, [projectId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        ...row,
        lastAttemptAt: new Date(row.lastAttemptAt),
        completedAt: row.completedAt ? new Date(row.completedAt) : undefined,
        stats: row.stats || {}
      };

    } catch (error) {
      this.logger.error(`Failed to get project status: ${error.message}`);
      return null;
    }
  }

  /**
   * Check if initialization can be resumed (has partial progress)
   */
  async canResumeInitialization(projectId: string): Promise<boolean> {
    const status = await this.getProjectStatus(projectId);
    if (!status) return false;

    // Can resume if any stage is complete but not all stages are complete
    const hasProgress = status.metadataReady || status.fileDiscoveryReady ||
                       status.semanticEntitiesReady || status.semanticRelationshipsReady ||
                       status.vectorEmbeddingsReady;

    return hasProgress && !status.initializationComplete;
  }

  /**
   * Clear error state for retry
   */
  async clearErrorState(projectId: string): Promise<void> {
    try {
      const pgClient = await this.dbConnections.getPostgresConnection();

      await pgClient.query(`
        UPDATE initialization_status
        SET error_message = NULL,
            last_attempt_at = CURRENT_TIMESTAMP
        WHERE project_id = $1
      `, [projectId]);

      console.log(`  🔄 Cleared error state for project ${projectId}`);
    } catch (error) {
      this.logger.error(`Failed to clear error state: ${error.message}`);
    }
  }

  /**
   * Display initialization progress
   */
  async displayProgress(projectId: string): Promise<void> {
    const status = await this.getProjectStatus(projectId);
    if (!status) {
      console.log('  ❌ No initialization status found');
      return;
    }

    console.log(`\n📊 Initialization Progress for ${status.projectName}:`);
    console.log(`  ${status.metadataReady ? '✅' : '❌'} Project metadata`);
    console.log(`  ${status.fileDiscoveryReady ? '✅' : '❌'} File discovery`);
    console.log(`  ${status.semanticEntitiesReady ? '✅' : '❌'} Semantic entities`);
    console.log(`  ${status.semanticRelationshipsReady ? '✅' : '❌'} Semantic relationships`);
    console.log(`  ${status.vectorEmbeddingsReady ? '✅' : '❌'} Vector embeddings`);
    console.log(`  ${status.initializationComplete ? '✅' : '❌'} Complete`);

    if (status.errorMessage) {
      console.log(`  ⚠️ Last error: ${status.errorMessage}`);
    }

    if (status.stats && Object.keys(status.stats).length > 0) {
      console.log(`  📈 Stats: ${JSON.stringify(status.stats, null, 2)}`);
    }
  }

  // Helper methods
  private getUpdateFields(stage: string, success: boolean): string[] {
    const fields = [];

    switch (stage) {
      case 'metadata':
        fields.push(`metadata_ready = ${success}`);
        break;
      case 'file_discovery':
        fields.push(`file_discovery_ready = ${success}`);
        break;
      case 'semantic_entities':
        fields.push(`semantic_entities_ready = ${success}`);
        break;
      case 'semantic_relationships':
        fields.push(`semantic_relationships_ready = ${success}`);
        break;
      case 'vector_embeddings':
        fields.push(`vector_embeddings_ready = ${success}`);
        break;
      case 'complete':
        fields.push(`initialization_complete = ${success}`);
        break;
    }

    return fields;
  }

  private async checkCompletionStatus(projectId: string): Promise<void> {
    try {
      const pgClient = await this.dbConnections.getPostgresConnection();

      // Check if all required stages are complete
      const result = await pgClient.query(`
        SELECT
          metadata_ready AND
          file_discovery_ready AND
          semantic_entities_ready AND
          semantic_relationships_ready AND
          vector_embeddings_ready as all_complete
        FROM initialization_status
        WHERE project_id = $1
      `, [projectId]);

      if (result.rows.length > 0 && result.rows[0].all_complete) {
        await pgClient.query(`
          UPDATE initialization_status
          SET initialization_complete = TRUE,
              completed_at = CURRENT_TIMESTAMP,
              error_message = NULL
          WHERE project_id = $1
        `, [projectId]);

        console.log(`  🎉 Project initialization marked as COMPLETE!`);
      }
    } catch (error) {
      this.logger.error(`Failed to check completion status: ${error.message}`);
    }
  }
}

export default InitializationStatusTracker;
/**
 * Analytics Data Export Pipeline
 * Bridges PostgreSQL operational data to DuckDB analytics storage
 */

import { Pool } from 'pg';
import { AnalyticsDatabase, AnalyticsMetric, CodeQualityMetric, FileChangeEvent } from './analytics-database';
import { Logger, LogLevel } from '../utils/logger';

export interface ExportConfig {
  batchSize: number;
  maxRetries: number;
  exportInterval: number; // minutes
  projectId: string;
}

export class AnalyticsExportPipeline {
  private logger: Logger;
  private pgPool: Pool;
  private analyticsDb: AnalyticsDatabase;
  private config: ExportConfig;
  private lastExportTimestamp: Map<string, Date> = new Map();

  constructor(pgPool: Pool, analyticsDb: AnalyticsDatabase, config: ExportConfig) {
    this.logger = new Logger(LogLevel.INFO, 'AnalyticsExportPipeline');
    this.pgPool = pgPool;
    this.analyticsDb = analyticsDb;
    this.config = config;
  }

  async startPipeline(): Promise<void> {
    await this.analyticsDb.initialize();
    
    // Initial export
    await this.runFullExport();
    
    // Set up periodic exports
    setInterval(async () => {
      try {
        await this.runIncrementalExport();
      } catch (error) {
        this.logger.error(`Incremental export failed: ${error}`);
      }
    }, this.config.exportInterval * 60 * 1000);

    this.logger.info('📊 Analytics export pipeline started');
  }

  private async runFullExport(): Promise<void> {
    this.logger.info('🚀 Starting full analytics export');
    
    await Promise.all([
      this.exportPerformanceMetrics(),
      this.exportCodeQualityMetrics(),
      this.exportFileChangeEvents()
    ]);

    this.logger.info('✅ Full analytics export completed');
  }

  private async runIncrementalExport(): Promise<void> {
    this.logger.info('⚡ Running incremental analytics export');
    
    await Promise.all([
      this.exportPerformanceMetrics(true),
      this.exportCodeQualityMetrics(true),
      this.exportFileChangeEvents(true)
    ]);

    this.logger.info('✅ Incremental analytics export completed');
  }

  private async exportPerformanceMetrics(incremental = false): Promise<void> {
    const tableName = 'performance_metrics';
    let query = `
      SELECT 
        project_id,
        tool_name,
        (data->>'execution_time')::float as execution_time,
        COALESCE((data->>'cache_hit_rate')::float, 0) as cache_hit_rate,
        COALESCE((data->>'memory_usage')::bigint, 0) as memory_usage,
        updated_at as timestamp,
        data as metadata
      FROM tool_data 
      WHERE project_id = $1 
        AND data->>'execution_time' IS NOT NULL
    `;

    const params = [this.config.projectId];

    if (incremental) {
      const lastExport = this.lastExportTimestamp.get(tableName) || new Date(Date.now() - 24 * 60 * 60 * 1000);
      query += ` AND updated_at > $2`;
      params.push(lastExport.toISOString());
    }

    query += ` ORDER BY updated_at DESC`;
    if (!incremental) query += ` LIMIT ${this.config.batchSize}`;

    try {
      const result = await this.pgPool.query(query, params);
      
      for (const row of result.rows) {
        const metric: AnalyticsMetric = {
          project_id: row.project_id,
          tool_name: row.tool_name,
          execution_time: row.execution_time || 0,
          cache_hit_rate: row.cache_hit_rate || 0,
          memory_usage: row.memory_usage,
          timestamp: new Date(row.timestamp),
          metadata: row.metadata
        };

        await this.analyticsDb.insertPerformanceMetric(metric);
      }

      this.lastExportTimestamp.set(tableName, new Date());
      this.logger.info(`📊 Exported ${result.rows.length} performance metrics`);
      
    } catch (error) {
      this.logger.error(`Failed to export performance metrics: ${error}`);
    }
  }

  private async exportCodeQualityMetrics(incremental = false): Promise<void> {
    const tableName = 'code_quality_metrics';
    let query = `
      SELECT DISTINCT
        td.project_id,
        fi.file_path,
        'complexity' as metric_type,
        (td.data->'analysis'->'complexity')::float as metric_value,
        td.tool_name,
        td.updated_at as timestamp,
        td.data as metadata
      FROM tool_data td
      LEFT JOIN file_index fi ON td.project_id = fi.project_id 
      WHERE td.project_id = $1 
        AND td.data->'analysis'->'complexity' IS NOT NULL
    `;

    const params = [this.config.projectId];

    if (incremental) {
      const lastExport = this.lastExportTimestamp.get(tableName) || new Date(Date.now() - 24 * 60 * 60 * 1000);
      query += ` AND td.updated_at > $2`;
      params.push(lastExport.toISOString());
    }

    // Also export SOLID principles violations
    let solidQuery = `
      UNION ALL
      SELECT DISTINCT
        td.project_id,
        COALESCE((td.data->>'file_path'), 'unknown') as file_path,
        'violations' as metric_type,
        jsonb_array_length(COALESCE(td.data->'analysis'->'violations', '[]'::jsonb))::float as metric_value,
        td.tool_name,
        td.updated_at as timestamp,
        td.data as metadata
      FROM tool_data td
      WHERE td.project_id = $1 
        AND td.tool_name = 'solid-principles'
        AND td.data->'analysis'->'violations' IS NOT NULL
    `;

    if (incremental) {
      solidQuery += ` AND td.updated_at > $${params.length}`;
    }

    query += solidQuery + ` ORDER BY timestamp DESC`;
    if (!incremental) query += ` LIMIT ${this.config.batchSize}`;

    try {
      const result = await this.pgPool.query(query, params);
      
      for (const row of result.rows) {
        const metric: CodeQualityMetric = {
          project_id: row.project_id,
          file_path: row.file_path || 'unknown',
          metric_type: row.metric_type,
          metric_value: row.metric_value || 0,
          tool_name: row.tool_name,
          timestamp: new Date(row.timestamp),
          metadata: row.metadata
        };

        await this.analyticsDb.insertCodeQualityMetric(metric);
      }

      this.lastExportTimestamp.set(tableName, new Date());
      this.logger.info(`📊 Exported ${result.rows.length} code quality metrics`);
      
    } catch (error) {
      this.logger.error(`Failed to export code quality metrics: ${error}`);
    }
  }

  private async exportFileChangeEvents(incremental = false): Promise<void> {
    const tableName = 'file_change_events';
    
    // Export from cache_entries table (file operations)
    let query = `
      SELECT 
        $1 as project_id,
        cache_key as file_path,
        'cached' as event_type,
        content_hash,
        size_bytes as file_size,
        created_at as timestamp,
        jsonb_build_object('access_count', access_count, 'cache_type', 'file') as metadata
      FROM cache_entries 
      WHERE cache_key LIKE '%file%'
    `;

    const params = [this.config.projectId];

    if (incremental) {
      const lastExport = this.lastExportTimestamp.get(tableName) || new Date(Date.now() - 24 * 60 * 60 * 1000);
      query += ` AND created_at > $2`;
      params.push(lastExport.toISOString());
    }

    // Also export from file_index (file modifications)
    let fileIndexQuery = `
      UNION ALL
      SELECT 
        project_id,
        file_path,
        CASE 
          WHEN created_at = last_modified THEN 'created'
          ELSE 'modified'
        END as event_type,
        content_hash,
        file_size,
        last_modified as timestamp,
        jsonb_build_object('content_type', content_type, 'language', language) as metadata
      FROM file_index 
      WHERE project_id = $1
    `;

    if (incremental) {
      fileIndexQuery += ` AND last_modified > $${params.length}`;
    }

    query += fileIndexQuery + ` ORDER BY timestamp DESC`;
    if (!incremental) query += ` LIMIT ${this.config.batchSize}`;

    try {
      const result = await this.pgPool.query(query, params);
      
      for (const row of result.rows) {
        const event: FileChangeEvent = {
          project_id: row.project_id,
          file_path: row.file_path,
          event_type: row.event_type,
          content_hash: row.content_hash,
          file_size: row.file_size,
          timestamp: new Date(row.timestamp),
          metadata: row.metadata
        };

        await this.analyticsDb.insertFileChangeEvent(event);
      }

      this.lastExportTimestamp.set(tableName, new Date());
      this.logger.info(`📊 Exported ${result.rows.length} file change events`);
      
    } catch (error) {
      this.logger.error(`Failed to export file change events: ${error}`);
    }
  }

  // Export semantic search metrics
  async exportSemanticMetrics(): Promise<void> {
    const query = `
      SELECT 
        project_id,
        file_path,
        'embeddings' as metric_type,
        CASE WHEN embedding IS NOT NULL THEN 1.0 ELSE 0.0 END as metric_value,
        'semantic-search' as tool_name,
        updated_at as timestamp,
        metadata
      FROM semantic_search_embeddings
      WHERE project_id = $1
      ORDER BY updated_at DESC
      LIMIT ${this.config.batchSize}
    `;

    try {
      const result = await this.pgPool.query(query, [this.config.projectId]);
      
      for (const row of result.rows) {
        const metric: CodeQualityMetric = {
          project_id: row.project_id,
          file_path: row.file_path,
          metric_type: row.metric_type,
          metric_value: row.metric_value,
          tool_name: row.tool_name,
          timestamp: new Date(row.timestamp),
          metadata: row.metadata
        };

        await this.analyticsDb.insertCodeQualityMetric(metric);
      }

      this.logger.info(`📊 Exported ${result.rows.length} semantic search metrics`);
      
    } catch (error) {
      this.logger.error(`Failed to export semantic search metrics: ${error}`);
    }
  }

  // Manual export trigger
  async triggerExport(type: 'full' | 'incremental' = 'incremental'): Promise<void> {
    this.logger.info(`🎯 Manual export triggered: ${type}`);
    
    if (type === 'full') {
      await this.runFullExport();
    } else {
      await this.runIncrementalExport();
    }
    
    // Also export semantic metrics
    await this.exportSemanticMetrics();
  }

  // Get export statistics
  async getExportStats(): Promise<any> {
    const analyticsStats = await this.analyticsDb.getStats();
    
    return {
      ...analyticsStats,
      lastExports: Object.fromEntries(this.lastExportTimestamp),
      exportConfig: this.config,
      pipelineStatus: 'running'
    };
  }

  async close(): Promise<void> {
    await this.analyticsDb.close();
    this.logger.info('📊 Analytics export pipeline stopped');
  }
}

// Factory function for easy setup
export function createAnalyticsExportPipeline(
  projectPath: string, 
  projectId: string,
  pgPool: Pool,
  config?: Partial<ExportConfig>
): AnalyticsExportPipeline {
  const analyticsDb = new AnalyticsDatabase(projectPath);
  const fullConfig: ExportConfig = {
    batchSize: 1000,
    maxRetries: 3,
    exportInterval: 15, // 15 minutes
    projectId,
    ...config
  };

  return new AnalyticsExportPipeline(pgPool, analyticsDb, fullConfig);
}
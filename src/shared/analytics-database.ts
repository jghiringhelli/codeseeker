/**
 * Analytics Database Integration using DuckDB
 * Provides columnar analytics capabilities alongside PostgreSQL
 */

import * as duckdb from 'duckdb';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Logger, LogLevel } from '../utils/logger';

export interface AnalyticsMetric {
  project_id: string;
  tool_name: string;
  execution_time: number;
  cache_hit_rate: number;
  memory_usage?: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface CodeQualityMetric {
  project_id: string;
  file_path: string;
  metric_type: string; // 'complexity', 'coverage', 'violations'
  metric_value: number;
  tool_name: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface FileChangeEvent {
  project_id: string;
  file_path: string;
  event_type: string; // 'modified', 'created', 'deleted', 'cached'
  content_hash?: string;
  file_size?: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export class AnalyticsDatabase {
  private db: duckdb.Database | null = null;
  private connection: duckdb.Connection | null = null;
  private logger: Logger;
  private dbPath: string;
  private initialized = false;

  constructor(projectPath: string) {
    this.logger = new Logger(LogLevel.INFO, 'AnalyticsDatabase');
    this.dbPath = path.join(projectPath, '.codemind', 'analytics.duckdb');
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Ensure directory exists
      const dbDir = path.dirname(this.dbPath);
      await fs.mkdir(dbDir, { recursive: true });

      // Initialize DuckDB
      this.db = new duckdb.Database(this.dbPath);
      this.connection = this.db.connect();

      // Create analytics tables
      await this.createTables();
      
      this.initialized = true;
      this.logger.info(`📊 Analytics database initialized at ${this.dbPath}`);
    } catch (error) {
      this.logger.error(`Failed to initialize analytics database: ${error}`);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.connection) throw new Error('Database not initialized');

    const queries = [
      // Performance metrics table
      `CREATE TABLE IF NOT EXISTS performance_metrics (
        id INTEGER PRIMARY KEY,
        project_id VARCHAR,
        tool_name VARCHAR,
        execution_time DOUBLE,
        cache_hit_rate DOUBLE,
        memory_usage BIGINT,
        timestamp TIMESTAMP,
        metadata JSON
      )`,

      // Code quality metrics table  
      `CREATE TABLE IF NOT EXISTS code_quality_metrics (
        id INTEGER PRIMARY KEY,
        project_id VARCHAR,
        file_path VARCHAR,
        metric_type VARCHAR,
        metric_value DOUBLE,
        tool_name VARCHAR,
        timestamp TIMESTAMP,
        metadata JSON
      )`,

      // File change events table
      `CREATE TABLE IF NOT EXISTS file_change_events (
        id INTEGER PRIMARY KEY,
        project_id VARCHAR,
        file_path VARCHAR,
        event_type VARCHAR,
        content_hash VARCHAR,
        file_size BIGINT,
        timestamp TIMESTAMP,
        metadata JSON
      )`,

      // Create indexes for common queries
      `CREATE INDEX IF NOT EXISTS idx_perf_project_time ON performance_metrics(project_id, timestamp)`,
      `CREATE INDEX IF NOT EXISTS idx_perf_tool_time ON performance_metrics(tool_name, timestamp)`,
      `CREATE INDEX IF NOT EXISTS idx_quality_project_time ON code_quality_metrics(project_id, timestamp)`,
      `CREATE INDEX IF NOT EXISTS idx_quality_file_type ON code_quality_metrics(file_path, metric_type)`,
      `CREATE INDEX IF NOT EXISTS idx_changes_project_time ON file_change_events(project_id, timestamp)`,
      `CREATE INDEX IF NOT EXISTS idx_changes_file_time ON file_change_events(file_path, timestamp)`
    ];

    for (const query of queries) {
      await this.executeQuery(query);
    }
  }

  private executeQuery(query: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (!this.connection) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.connection.all(query, params, (err, result) => {
        if (err) {
          this.logger.error(`Query failed: ${err.message}`);
          reject(err);
        } else {
          resolve(result || []);
        }
      });
    });
  }

  // Insert performance metrics
  async insertPerformanceMetric(metric: AnalyticsMetric): Promise<void> {
    await this.initialize();
    
    const query = `INSERT INTO performance_metrics 
      (project_id, tool_name, execution_time, cache_hit_rate, memory_usage, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)`;
    
    const params = [
      metric.project_id,
      metric.tool_name,
      metric.execution_time,
      metric.cache_hit_rate,
      metric.memory_usage || null,
      metric.timestamp.toISOString(),
      JSON.stringify(metric.metadata || {})
    ];

    await this.executeQuery(query, params);
  }

  // Insert code quality metrics
  async insertCodeQualityMetric(metric: CodeQualityMetric): Promise<void> {
    await this.initialize();
    
    const query = `INSERT INTO code_quality_metrics 
      (project_id, file_path, metric_type, metric_value, tool_name, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)`;
    
    const params = [
      metric.project_id,
      metric.file_path,
      metric.metric_type,
      metric.metric_value,
      metric.tool_name,
      metric.timestamp.toISOString(),
      JSON.stringify(metric.metadata || {})
    ];

    await this.executeQuery(query, params);
  }

  // Insert file change events
  async insertFileChangeEvent(event: FileChangeEvent): Promise<void> {
    await this.initialize();
    
    const query = `INSERT INTO file_change_events 
      (project_id, file_path, event_type, content_hash, file_size, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)`;
    
    const params = [
      event.project_id,
      event.file_path,
      event.event_type,
      event.content_hash || null,
      event.file_size || null,
      event.timestamp.toISOString(),
      JSON.stringify(event.metadata || {})
    ];

    await this.executeQuery(query, params);
  }

  // Analytics queries
  async getPerformanceTrends(projectId: string, hours: number = 24): Promise<any[]> {
    await this.initialize();
    
    const query = `
      SELECT 
        tool_name,
        DATE_TRUNC('hour', timestamp) as hour,
        AVG(execution_time) as avg_execution_time,
        AVG(cache_hit_rate) as avg_cache_hit_rate,
        COUNT(*) as executions
      FROM performance_metrics
      WHERE project_id = ? AND timestamp > (NOW() - INTERVAL '${hours} hours')
      GROUP BY tool_name, DATE_TRUNC('hour', timestamp)
      ORDER BY hour DESC
    `;

    return await this.executeQuery(query, [projectId]);
  }

  async getCodeQualityTrends(projectId: string, metricType?: string): Promise<any[]> {
    await this.initialize();
    
    let query = `
      SELECT 
        metric_type,
        DATE_TRUNC('day', timestamp) as day,
        AVG(metric_value) as avg_value,
        MIN(metric_value) as min_value,
        MAX(metric_value) as max_value,
        COUNT(*) as measurements
      FROM code_quality_metrics
      WHERE project_id = ?
    `;
    
    const params = [projectId];
    
    if (metricType) {
      query += ` AND metric_type = ?`;
      params.push(metricType);
    }
    
    query += `
      GROUP BY metric_type, DATE_TRUNC('day', timestamp)
      ORDER BY day DESC
    `;

    return await this.executeQuery(query, params);
  }

  async getFileActivitySummary(projectId: string, hours: number = 168): Promise<any[]> {
    await this.initialize();
    
    const query = `
      SELECT 
        file_path,
        COUNT(*) as total_events,
        COUNT(CASE WHEN event_type = 'modified' THEN 1 END) as modifications,
        COUNT(CASE WHEN event_type = 'cached' THEN 1 END) as cache_operations,
        MAX(timestamp) as last_activity
      FROM file_change_events
      WHERE project_id = ? AND timestamp > (NOW() - INTERVAL '${hours} hours')
      GROUP BY file_path
      ORDER BY total_events DESC
      LIMIT 50
    `;

    return await this.executeQuery(query, [projectId]);
  }

  async getToolEfficiencyReport(projectId: string): Promise<any[]> {
    await this.initialize();
    
    const query = `
      SELECT 
        tool_name,
        COUNT(*) as total_executions,
        AVG(execution_time) as avg_execution_time,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY execution_time) as median_execution_time,
        AVG(cache_hit_rate) as avg_cache_hit_rate,
        AVG(memory_usage) as avg_memory_usage
      FROM performance_metrics
      WHERE project_id = ?
      GROUP BY tool_name
      ORDER BY avg_execution_time ASC
    `;

    return await this.executeQuery(query, [projectId]);
  }

  // Export data to Parquet (for future Phase 2)
  async exportToParquet(tableName: string, outputPath: string, projectId?: string): Promise<void> {
    await this.initialize();
    
    let query = `COPY (SELECT * FROM ${tableName}`;
    const params: any[] = [];
    
    if (projectId) {
      query += ` WHERE project_id = ?`;
      params.push(projectId);
    }
    
    query += `) TO '${outputPath}' (FORMAT PARQUET)`;
    
    await this.executeQuery(query, params);
    this.logger.info(`📦 Exported ${tableName} to ${outputPath}`);
  }

  // Cleanup old data
  async cleanupOldData(daysToKeep: number = 90): Promise<void> {
    await this.initialize();
    
    const tables = ['performance_metrics', 'code_quality_metrics', 'file_change_events'];
    const cutoffDate = `(NOW() - INTERVAL '${daysToKeep} days')`;
    
    for (const table of tables) {
      const query = `DELETE FROM ${table} WHERE timestamp < ${cutoffDate}`;
      const result = await this.executeQuery(query);
      this.logger.info(`🗑️  Cleaned up old data from ${table}`);
    }
  }

  async close(): Promise<void> {
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.initialized = false;
  }

  // Get database statistics
  async getStats(): Promise<any> {
    await this.initialize();
    
    const queries = [
      `SELECT COUNT(*) as performance_records FROM performance_metrics`,
      `SELECT COUNT(*) as quality_records FROM code_quality_metrics`, 
      `SELECT COUNT(*) as change_records FROM file_change_events`,
      `SELECT pg_size_pretty(pg_database_size(current_database())) as db_size`
    ];

    const results = await Promise.all(
      queries.map(query => this.executeQuery(query))
    );

    return {
      performance_records: results[0][0]?.performance_records || 0,
      quality_records: results[1][0]?.quality_records || 0,
      change_records: results[2][0]?.change_records || 0,
      database_size: results[3][0]?.db_size || 'Unknown'
    };
  }
}
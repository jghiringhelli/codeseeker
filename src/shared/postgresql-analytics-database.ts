/**
 * PostgreSQL Analytics Database Integration
 * Consolidates analytics functionality into PostgreSQL to maintain database separation
 * Replaces DuckDB analytics to ensure database responsibilities are disjoint
 */

import { Logger, LogLevel } from '../utils/logger';
import { DatabaseConnections } from '../config/database-config';

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

export class PostgreSQLAnalyticsDatabase {
  private dbConnections: DatabaseConnections;
  private logger: Logger;
  private initialized = false;

  constructor(projectId?: string) {
    this.logger = new Logger(LogLevel.INFO, 'PostgreSQLAnalyticsDatabase');
    this.dbConnections = new DatabaseConnections();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Get PostgreSQL connection
      const client = await this.dbConnections.getPostgresConnection();

      // Create analytics tables
      await this.createTables();

      this.initialized = true;
      this.logger.info(`📊 PostgreSQL Analytics database initialized`);
    } catch (error) {
      this.logger.error(`Failed to initialize PostgreSQL analytics database: ${error}`);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    const client = await this.dbConnections.getPostgresConnection();

    const queries = [
      // Performance metrics table
      `CREATE TABLE IF NOT EXISTS performance_metrics (
        id SERIAL PRIMARY KEY,
        project_id VARCHAR(255) NOT NULL,
        tool_name VARCHAR(255) NOT NULL,
        execution_time DOUBLE PRECISION NOT NULL,
        cache_hit_rate DOUBLE PRECISION NOT NULL,
        memory_usage BIGINT,
        timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )`,

      // Code quality metrics table
      `CREATE TABLE IF NOT EXISTS code_quality_metrics (
        id SERIAL PRIMARY KEY,
        project_id VARCHAR(255) NOT NULL,
        file_path TEXT NOT NULL,
        metric_type VARCHAR(100) NOT NULL,
        metric_value DOUBLE PRECISION NOT NULL,
        tool_name VARCHAR(255) NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )`,

      // File change events table
      `CREATE TABLE IF NOT EXISTS file_change_events (
        id SERIAL PRIMARY KEY,
        project_id VARCHAR(255) NOT NULL,
        file_path TEXT NOT NULL,
        event_type VARCHAR(50) NOT NULL,
        content_hash VARCHAR(64),
        file_size BIGINT,
        timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )`,

      // Create indexes for common queries
      `CREATE INDEX IF NOT EXISTS idx_perf_project_time ON performance_metrics(project_id, timestamp)`,
      `CREATE INDEX IF NOT EXISTS idx_perf_tool_time ON performance_metrics(tool_name, timestamp)`,
      `CREATE INDEX IF NOT EXISTS idx_quality_project_time ON code_quality_metrics(project_id, timestamp)`,
      `CREATE INDEX IF NOT EXISTS idx_quality_file_type ON code_quality_metrics(file_path, metric_type)`,
      `CREATE INDEX IF NOT EXISTS idx_changes_project_time ON file_change_events(project_id, timestamp)`,
      `CREATE INDEX IF NOT EXISTS idx_changes_file_time ON file_change_events(file_path, timestamp)`,

      // Additional indexes for analytics queries
      `CREATE INDEX IF NOT EXISTS idx_perf_project_tool ON performance_metrics(project_id, tool_name)`,
      `CREATE INDEX IF NOT EXISTS idx_quality_project_metric ON code_quality_metrics(project_id, metric_type)`,
      `CREATE INDEX IF NOT EXISTS idx_changes_project_event ON file_change_events(project_id, event_type)`
    ];

    for (const query of queries) {
      await client.query(query);
    }
  }

  // Insert performance metrics
  async insertPerformanceMetric(metric: AnalyticsMetric): Promise<void> {
    await this.initialize();
    const client = await this.dbConnections.getPostgresConnection();

    const query = `INSERT INTO performance_metrics
      (project_id, tool_name, execution_time, cache_hit_rate, memory_usage, timestamp, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7)`;

    const params = [
      metric.project_id,
      metric.tool_name,
      metric.execution_time,
      metric.cache_hit_rate,
      metric.memory_usage || null,
      metric.timestamp,
      JSON.stringify(metric.metadata || {})
    ];

    await client.query(query, params);
  }

  // Insert code quality metrics
  async insertCodeQualityMetric(metric: CodeQualityMetric): Promise<void> {
    await this.initialize();
    const client = await this.dbConnections.getPostgresConnection();

    const query = `INSERT INTO code_quality_metrics
      (project_id, file_path, metric_type, metric_value, tool_name, timestamp, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7)`;

    const params = [
      metric.project_id,
      metric.file_path,
      metric.metric_type,
      metric.metric_value,
      metric.tool_name,
      metric.timestamp,
      JSON.stringify(metric.metadata || {})
    ];

    await client.query(query, params);
  }

  // Insert file change events
  async insertFileChangeEvent(event: FileChangeEvent): Promise<void> {
    await this.initialize();
    const client = await this.dbConnections.getPostgresConnection();

    const query = `INSERT INTO file_change_events
      (project_id, file_path, event_type, content_hash, file_size, timestamp, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7)`;

    const params = [
      event.project_id,
      event.file_path,
      event.event_type,
      event.content_hash || null,
      event.file_size || null,
      event.timestamp,
      JSON.stringify(event.metadata || {})
    ];

    await client.query(query, params);
  }

  // Analytics queries using PostgreSQL-specific functions
  async getPerformanceTrends(projectId: string, hours: number = 24): Promise<any[]> {
    await this.initialize();
    const client = await this.dbConnections.getPostgresConnection();

    const query = `
      SELECT
        tool_name,
        DATE_TRUNC('hour', timestamp) as hour,
        AVG(execution_time) as avg_execution_time,
        AVG(cache_hit_rate) as avg_cache_hit_rate,
        COUNT(*) as executions
      FROM performance_metrics
      WHERE project_id = $1 AND timestamp > (NOW() - INTERVAL '${hours} hours')
      GROUP BY tool_name, DATE_TRUNC('hour', timestamp)
      ORDER BY hour DESC
    `;

    const result = await client.query(query, [projectId]);
    return result.rows;
  }

  async getCodeQualityTrends(projectId: string, metricType?: string): Promise<any[]> {
    await this.initialize();
    const client = await this.dbConnections.getPostgresConnection();

    let query = `
      SELECT
        metric_type,
        DATE_TRUNC('day', timestamp) as day,
        AVG(metric_value) as avg_value,
        MIN(metric_value) as min_value,
        MAX(metric_value) as max_value,
        COUNT(*) as measurements
      FROM code_quality_metrics
      WHERE project_id = $1
    `;

    const params = [projectId];

    if (metricType) {
      query += ` AND metric_type = $2`;
      params.push(metricType);
    }

    query += `
      GROUP BY metric_type, DATE_TRUNC('day', timestamp)
      ORDER BY day DESC
    `;

    const result = await client.query(query, params);
    return result.rows;
  }

  async getFileActivitySummary(projectId: string, hours: number = 168): Promise<any[]> {
    await this.initialize();
    const client = await this.dbConnections.getPostgresConnection();

    const query = `
      SELECT
        file_path,
        COUNT(*) as total_events,
        COUNT(CASE WHEN event_type = 'modified' THEN 1 END) as modifications,
        COUNT(CASE WHEN event_type = 'cached' THEN 1 END) as cache_operations,
        MAX(timestamp) as last_activity
      FROM file_change_events
      WHERE project_id = $1 AND timestamp > (NOW() - INTERVAL '${hours} hours')
      GROUP BY file_path
      ORDER BY total_events DESC
      LIMIT 50
    `;

    const result = await client.query(query, [projectId]);
    return result.rows;
  }

  async getToolEfficiencyReport(projectId: string): Promise<any[]> {
    await this.initialize();
    const client = await this.dbConnections.getPostgresConnection();

    const query = `
      SELECT
        tool_name,
        COUNT(*) as total_executions,
        AVG(execution_time) as avg_execution_time,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY execution_time) as median_execution_time,
        AVG(cache_hit_rate) as avg_cache_hit_rate,
        AVG(memory_usage) as avg_memory_usage
      FROM performance_metrics
      WHERE project_id = $1
      GROUP BY tool_name
      ORDER BY avg_execution_time ASC
    `;

    const result = await client.query(query, [projectId]);
    return result.rows;
  }

  // Batch insert for better performance
  async insertPerformanceMetricsBatch(metrics: AnalyticsMetric[]): Promise<void> {
    if (metrics.length === 0) return;

    await this.initialize();
    const client = await this.dbConnections.getPostgresConnection();

    // Build values placeholder for batch insert
    const values = metrics.map((_, index) => {
      const offset = index * 7;
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`;
    }).join(', ');

    const query = `INSERT INTO performance_metrics
      (project_id, tool_name, execution_time, cache_hit_rate, memory_usage, timestamp, metadata)
      VALUES ${values}`;

    const params: any[] = [];
    metrics.forEach(metric => {
      params.push(
        metric.project_id,
        metric.tool_name,
        metric.execution_time,
        metric.cache_hit_rate,
        metric.memory_usage || null,
        metric.timestamp,
        JSON.stringify(metric.metadata || {})
      );
    });

    await client.query(query, params);
    this.logger.info(`📊 Batch inserted ${metrics.length} performance metrics`);
  }

  // Cleanup old data
  async cleanupOldData(daysToKeep: number = 90): Promise<void> {
    await this.initialize();
    const client = await this.dbConnections.getPostgresConnection();

    const tables = ['performance_metrics', 'code_quality_metrics', 'file_change_events'];

    for (const table of tables) {
      const query = `DELETE FROM ${table} WHERE timestamp < (NOW() - INTERVAL '${daysToKeep} days')`;
      const result = await client.query(query);
      this.logger.info(`🗑️  Cleaned up ${result.rowCount} old records from ${table}`);
    }
  }

  async close(): Promise<void> {
    // The PostgreSQL connection is managed by DatabaseConnections
    // We don't close it here as it might be shared
    this.initialized = false;
    this.logger.info('📊 PostgreSQL Analytics database closed');
  }

  // Get database statistics using PostgreSQL functions
  async getStats(): Promise<any> {
    await this.initialize();
    const client = await this.dbConnections.getPostgresConnection();

    const queries = [
      `SELECT COUNT(*) as performance_records FROM performance_metrics`,
      `SELECT COUNT(*) as quality_records FROM code_quality_metrics`,
      `SELECT COUNT(*) as change_records FROM file_change_events`,
      `SELECT pg_size_pretty(pg_total_relation_size('performance_metrics') +
                              pg_total_relation_size('code_quality_metrics') +
                              pg_total_relation_size('file_change_events')) as total_analytics_size`
    ];

    const results = await Promise.all(
      queries.map(query => client.query(query))
    );

    return {
      performance_records: parseInt(results[0].rows[0]?.performance_records || '0'),
      quality_records: parseInt(results[1].rows[0]?.quality_records || '0'),
      change_records: parseInt(results[2].rows[0]?.change_records || '0'),
      analytics_size: results[3].rows[0]?.total_analytics_size || 'Unknown'
    };
  }

  // Export data to CSV (alternative to Parquet export)
  async exportToCSV(tableName: string, outputPath: string, projectId?: string): Promise<void> {
    await this.initialize();
    const client = await this.dbConnections.getPostgresConnection();

    let query = `COPY (SELECT * FROM ${tableName}`;
    const params: any[] = [];

    if (projectId) {
      query += ` WHERE project_id = $1`;
      params.push(projectId);
    }

    query += `) TO '${outputPath}' WITH CSV HEADER`;

    await client.query(query, params);
    this.logger.info(`📦 Exported ${tableName} to ${outputPath}`);
  }

  // Get real-time metrics summary
  async getMetricsSummary(projectId: string): Promise<any> {
    await this.initialize();
    const client = await this.dbConnections.getPostgresConnection();

    const query = `
      SELECT
        'performance' as metric_category,
        COUNT(*) as total_records,
        MAX(timestamp) as latest_timestamp,
        COUNT(DISTINCT tool_name) as unique_tools
      FROM performance_metrics
      WHERE project_id = $1
      UNION ALL
      SELECT
        'quality' as metric_category,
        COUNT(*) as total_records,
        MAX(timestamp) as latest_timestamp,
        COUNT(DISTINCT metric_type) as unique_tools
      FROM code_quality_metrics
      WHERE project_id = $1
      UNION ALL
      SELECT
        'file_events' as metric_category,
        COUNT(*) as total_records,
        MAX(timestamp) as latest_timestamp,
        COUNT(DISTINCT event_type) as unique_tools
      FROM file_change_events
      WHERE project_id = $1
    `;

    const result = await client.query(query, [projectId]);
    return result.rows;
  }
}
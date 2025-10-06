/**
 * PostgreSQL Analytics Database Integration
 * Consolidates analytics functionality into PostgreSQL to maintain database separation
 * Replaces DuckDB analytics to ensure database responsibilities are disjoint
 */
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
    metric_type: string;
    metric_value: number;
    tool_name: string;
    timestamp: Date;
    metadata?: Record<string, any>;
}
export interface FileChangeEvent {
    project_id: string;
    file_path: string;
    event_type: string;
    content_hash?: string;
    file_size?: number;
    timestamp: Date;
    metadata?: Record<string, any>;
}
export declare class PostgreSQLAnalyticsDatabase {
    private dbConnections;
    private logger;
    private initialized;
    constructor(projectId?: string);
    initialize(): Promise<void>;
    private createTables;
    insertPerformanceMetric(metric: AnalyticsMetric): Promise<void>;
    insertCodeQualityMetric(metric: CodeQualityMetric): Promise<void>;
    insertFileChangeEvent(event: FileChangeEvent): Promise<void>;
    getPerformanceTrends(projectId: string, hours?: number): Promise<any[]>;
    getCodeQualityTrends(projectId: string, metricType?: string): Promise<any[]>;
    getFileActivitySummary(projectId: string, hours?: number): Promise<any[]>;
    getToolEfficiencyReport(projectId: string): Promise<any[]>;
    insertPerformanceMetricsBatch(metrics: AnalyticsMetric[]): Promise<void>;
    cleanupOldData(daysToKeep?: number): Promise<void>;
    close(): Promise<void>;
    getStats(): Promise<any>;
    exportToCSV(tableName: string, outputPath: string, projectId?: string): Promise<void>;
    getMetricsSummary(projectId: string): Promise<any>;
}
//# sourceMappingURL=postgresql-analytics-database.d.ts.map
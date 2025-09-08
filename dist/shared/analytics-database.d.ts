/**
 * Analytics Database Integration using DuckDB
 * Provides columnar analytics capabilities alongside PostgreSQL
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
export declare class AnalyticsDatabase {
    private db;
    private connection;
    private logger;
    private dbPath;
    private initialized;
    constructor(projectPath: string);
    initialize(): Promise<void>;
    private createTables;
    private executeQuery;
    insertPerformanceMetric(metric: AnalyticsMetric): Promise<void>;
    insertCodeQualityMetric(metric: CodeQualityMetric): Promise<void>;
    insertFileChangeEvent(event: FileChangeEvent): Promise<void>;
    getPerformanceTrends(projectId: string, hours?: number): Promise<any[]>;
    getCodeQualityTrends(projectId: string, metricType?: string): Promise<any[]>;
    getFileActivitySummary(projectId: string, hours?: number): Promise<any[]>;
    getToolEfficiencyReport(projectId: string): Promise<any[]>;
    exportToParquet(tableName: string, outputPath: string, projectId?: string): Promise<void>;
    cleanupOldData(daysToKeep?: number): Promise<void>;
    close(): Promise<void>;
    getStats(): Promise<any>;
}
//# sourceMappingURL=analytics-database.d.ts.map
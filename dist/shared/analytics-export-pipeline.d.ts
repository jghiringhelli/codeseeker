/**
 * Analytics Data Export Pipeline
 * Bridges PostgreSQL operational data to DuckDB analytics storage
 */
import { Pool } from 'pg';
import { PostgreSQLAnalyticsDatabase } from './postgresql-analytics-database';
export interface ExportConfig {
    batchSize: number;
    maxRetries: number;
    exportInterval: number;
    projectId: string;
}
export declare class AnalyticsExportPipeline {
    private logger;
    private pgPool;
    private analyticsDb;
    private config;
    private lastExportTimestamp;
    constructor(pgPool: Pool, analyticsDb: PostgreSQLAnalyticsDatabase, config: ExportConfig);
    startPipeline(): Promise<void>;
    private runFullExport;
    private runIncrementalExport;
    private exportPerformanceMetrics;
    private exportCodeQualityMetrics;
    private exportFileChangeEvents;
    exportSemanticMetrics(): Promise<void>;
    triggerExport(type?: 'full' | 'incremental'): Promise<void>;
    getExportStats(): Promise<any>;
    close(): Promise<void>;
}
export declare function createAnalyticsExportPipeline(projectPath: string, projectId: string, pgPool: Pool, config?: Partial<ExportConfig>): AnalyticsExportPipeline;
//# sourceMappingURL=analytics-export-pipeline.d.ts.map
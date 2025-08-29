import { EventEmitter } from 'events';
/**
 * Database interface for CodeMind
 */
export interface DatabaseConfig {
    type: 'sqlite' | 'postgresql' | 'memory';
    connectionString?: string;
    filePath?: string;
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
}
export interface QueryResult {
    rows: any[];
    rowCount: number;
    fields?: string[];
}
export interface ClaudeDecision {
    id?: string;
    timestamp: Date;
    decision_type: 'auto' | 'minimal' | 'smart' | 'full' | 'intelligent_selection' | 'workflow_optimization' | 'tool_selection' | 'workflow_orchestration';
    context: any;
    decision: any;
    metadata?: any;
    project_id?: string;
}
export interface PerformanceMetric {
    id?: string;
    tool: string;
    operation: string;
    duration: number;
    success: boolean;
    error_message?: string;
    created_at: Date;
}
/**
 * Mock Database implementation for CodeMind
 * This is a simplified version that stores data in memory or files
 */
export declare class Database extends EventEmitter {
    private config;
    private connected;
    private data;
    private dataFile?;
    constructor(config?: DatabaseConfig);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    query(sql: string, params?: any[]): Promise<QueryResult>;
    private handleInsert;
    private handleSelect;
    private handleUpdate;
    private handleDelete;
    private handleCreateTable;
    private parseInsertValues;
    private parseUpdateValues;
    private saveData;
    recordDecision(decision: ClaudeDecision): Promise<void>;
    recordMetric(metric: PerformanceMetric): Promise<void>;
    getRecentDecisions(limit?: number): Promise<ClaudeDecision[]>;
    getPerformanceMetrics(tool?: string): Promise<PerformanceMetric[]>;
    getSystemPerformanceMetrics(): Promise<PerformanceMetric[]>;
    getToolUsageHistory(): Promise<any[]>;
    recordClaudeDecision(decision: ClaudeDecision): Promise<void>;
    getProjectByPath(path: string): Promise<any>;
    initialize(): Promise<void>;
}
export declare const database: Database;
export default Database;
//# sourceMappingURL=database.d.ts.map
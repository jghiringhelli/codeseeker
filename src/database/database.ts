import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs/promises';

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
export class Database extends EventEmitter {
    private config: DatabaseConfig;
    private connected: boolean = false;
    private data: Map<string, any[]> = new Map();
    private dataFile?: string;

    constructor(config?: DatabaseConfig) {
        super();
        this.config = config || { type: 'memory' };
        
        if (this.config.type === 'sqlite' && this.config.filePath) {
            this.dataFile = this.config.filePath;
        }
    }

    async connect(): Promise<void> {
        if (this.connected) return;

        try {
            if (this.dataFile) {
                // Try to load existing data
                try {
                    const data = await fs.readFile(this.dataFile, 'utf-8');
                    const parsed = JSON.parse(data);
                    Object.entries(parsed).forEach(([table, rows]) => {
                        this.data.set(table, rows as any[]);
                    });
                } catch {
                    // File doesn't exist yet, will be created on first write
                }
            }

            this.connected = true;
            this.emit('connected');
            console.log('📗 Database connected');
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        if (!this.connected) return;

        await this.saveData();
        this.connected = false;
        this.emit('disconnected');
        console.log('📕 Database disconnected');
    }

    async query(sql: string, params?: any[]): Promise<QueryResult> {
        if (!this.connected) {
            await this.connect();
        }

        // Simple SQL parsing for basic operations
        const sqlLower = sql.toLowerCase().trim();

        if (sqlLower.startsWith('insert')) {
            return this.handleInsert(sql, params);
        } else if (sqlLower.startsWith('select')) {
            return this.handleSelect(sql, params);
        } else if (sqlLower.startsWith('update')) {
            return this.handleUpdate(sql, params);
        } else if (sqlLower.startsWith('delete')) {
            return this.handleDelete(sql, params);
        } else if (sqlLower.startsWith('create table')) {
            return this.handleCreateTable(sql);
        }

        return { rows: [], rowCount: 0 };
    }

    private async handleInsert(sql: string, params?: any[]): Promise<QueryResult> {
        // Parse table name from INSERT INTO table_name
        const match = sql.match(/insert\s+into\s+(\w+)/i);
        if (!match) throw new Error('Invalid INSERT statement');

        const tableName = match[1];
        if (!this.data.has(tableName)) {
            this.data.set(tableName, []);
        }

        const record = {
            id: Date.now().toString(),
            ...this.parseInsertValues(sql, params)
        };

        this.data.get(tableName)!.push(record);
        await this.saveData();

        return { rows: [record], rowCount: 1 };
    }

    private async handleSelect(sql: string, params?: any[]): Promise<QueryResult> {
        // Parse table name from SELECT ... FROM table_name
        const match = sql.match(/from\s+(\w+)/i);
        if (!match) throw new Error('Invalid SELECT statement');

        const tableName = match[1];
        const rows = this.data.get(tableName) || [];

        // Handle ORDER BY
        if (sql.toLowerCase().includes('order by')) {
            const orderMatch = sql.match(/order\s+by\s+(\w+)(?:\s+(asc|desc))?/i);
            if (orderMatch) {
                const field = orderMatch[1];
                const desc = orderMatch[2]?.toLowerCase() === 'desc';
                rows.sort((a, b) => {
                    const aVal = a[field];
                    const bVal = b[field];
                    const result = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
                    return desc ? -result : result;
                });
            }
        }

        // Handle LIMIT
        let limitedRows = rows;
        if (sql.toLowerCase().includes('limit')) {
            const limitMatch = sql.match(/limit\s+(\d+)/i);
            if (limitMatch) {
                const limit = parseInt(limitMatch[1]);
                limitedRows = rows.slice(0, limit);
            }
        }

        return { rows: limitedRows, rowCount: limitedRows.length };
    }

    private async handleUpdate(sql: string, params?: any[]): Promise<QueryResult> {
        // Simple UPDATE implementation
        const match = sql.match(/update\s+(\w+)\s+set/i);
        if (!match) throw new Error('Invalid UPDATE statement');

        const tableName = match[1];
        const rows = this.data.get(tableName) || [];
        
        // For simplicity, update all rows
        rows.forEach(row => {
            // Apply updates based on SET clause
            Object.assign(row, this.parseUpdateValues(sql, params));
        });

        await this.saveData();
        return { rows: [], rowCount: rows.length };
    }

    private async handleDelete(sql: string, params?: any[]): Promise<QueryResult> {
        // Simple DELETE implementation
        const match = sql.match(/delete\s+from\s+(\w+)/i);
        if (!match) throw new Error('Invalid DELETE statement');

        const tableName = match[1];
        const originalCount = this.data.get(tableName)?.length || 0;
        
        // For simplicity, clear the table
        this.data.set(tableName, []);
        
        await this.saveData();
        return { rows: [], rowCount: originalCount };
    }

    private async handleCreateTable(sql: string): Promise<QueryResult> {
        // Parse table name
        const match = sql.match(/create\s+table(?:\s+if\s+not\s+exists)?\s+(\w+)/i);
        if (!match) throw new Error('Invalid CREATE TABLE statement');

        const tableName = match[1];
        if (!this.data.has(tableName)) {
            this.data.set(tableName, []);
        }

        return { rows: [], rowCount: 0 };
    }

    private parseInsertValues(sql: string, params?: any[]): any {
        // Simple parsing - in real implementation would be more robust
        const values: any = {};
        
        if (params && params.length > 0) {
            // Assume params are in order
            const columns = ['decision_type', 'context', 'decision', 'timestamp'];
            params.forEach((value, index) => {
                if (index < columns.length) {
                    values[columns[index]] = value;
                }
            });
        }

        return values;
    }

    private parseUpdateValues(sql: string, params?: any[]): any {
        // Simple parsing for SET clause
        const values: any = {};
        
        if (params && params.length > 0) {
            // Assume first param is the value to set
            values.updated_at = new Date();
        }

        return values;
    }

    private async saveData(): Promise<void> {
        if (!this.dataFile) return;

        try {
            const data: any = {};
            this.data.forEach((value, key) => {
                data[key] = value;
            });

            await fs.writeFile(this.dataFile, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Failed to save database:', error);
        }
    }

    // Specific methods for CodeMind

    async recordDecision(decision: ClaudeDecision): Promise<void> {
        await this.query(
            `INSERT INTO claude_decisions (decision_type, context, decision, timestamp)
             VALUES ($1, $2, $3, $4)`,
            [decision.decision_type, decision.context, decision.decision, decision.timestamp]
        );
    }

    async recordMetric(metric: PerformanceMetric): Promise<void> {
        await this.query(
            `INSERT INTO performance_metrics (tool, operation, duration, success, error_message, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [metric.tool, metric.operation, metric.duration, metric.success, metric.error_message, metric.created_at]
        );
    }

    async getRecentDecisions(limit: number = 10): Promise<ClaudeDecision[]> {
        const result = await this.query(
            `SELECT * FROM claude_decisions ORDER BY timestamp DESC LIMIT ${limit}`
        );
        return result.rows;
    }

    async getPerformanceMetrics(tool?: string): Promise<PerformanceMetric[]> {
        let sql = 'SELECT * FROM performance_metrics';
        if (tool) {
            sql += ` WHERE tool = '${tool}'`;
        }
        sql += ' ORDER BY created_at DESC';
        
        const result = await this.query(sql);
        return result.rows;
    }

    async getSystemPerformanceMetrics(): Promise<PerformanceMetric[]> {
        return this.getPerformanceMetrics();
    }

    async getToolUsageHistory(): Promise<any[]> {
        const result = await this.query('SELECT * FROM performance_metrics ORDER BY created_at DESC');
        return result.rows;
    }

    async recordClaudeDecision(decision: ClaudeDecision): Promise<void> {
        await this.recordDecision(decision);
    }

    async getProjectByPath(path: string): Promise<any> {
        // Mock implementation - return a basic project structure
        return {
            id: 'mock-project',
            path,
            name: path.split(/[/\\]/).pop(),
            type: 'typescript',
            files: [],
            dependencies: {}
        };
    }

    async initialize(): Promise<void> {
        await this.connect();
        
        // Create tables if they don't exist
        await this.query(`
            CREATE TABLE IF NOT EXISTS claude_decisions (
                id SERIAL PRIMARY KEY,
                decision_type VARCHAR(50),
                context JSONB,
                decision JSONB,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await this.query(`
            CREATE TABLE IF NOT EXISTS performance_metrics (
                id SERIAL PRIMARY KEY,
                tool VARCHAR(100),
                operation VARCHAR(100),
                duration INTEGER,
                success BOOLEAN,
                error_message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }
}

// Export singleton instance
export const database = new Database({
    type: 'sqlite',
    filePath: path.join(process.cwd(), '.codemind', 'database.json')
});

export default Database;
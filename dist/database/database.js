"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.database = exports.Database = void 0;
const events_1 = require("events");
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
/**
 * Mock Database implementation for CodeMind
 * This is a simplified version that stores data in memory or files
 */
class Database extends events_1.EventEmitter {
    config;
    connected = false;
    data = new Map();
    dataFile;
    constructor(config) {
        super();
        this.config = config || { type: 'memory' };
        if (this.config.type === 'sqlite' && this.config.filePath) {
            this.dataFile = this.config.filePath;
        }
    }
    async connect() {
        if (this.connected)
            return;
        try {
            if (this.dataFile) {
                // Try to load existing data
                try {
                    const data = await fs.readFile(this.dataFile, 'utf-8');
                    const parsed = JSON.parse(data);
                    Object.entries(parsed).forEach(([table, rows]) => {
                        this.data.set(table, rows);
                    });
                }
                catch {
                    // File doesn't exist yet, will be created on first write
                }
            }
            this.connected = true;
            this.emit('connected');
            console.log('📗 Database connected');
        }
        catch (error) {
            this.emit('error', error);
            throw error;
        }
    }
    async disconnect() {
        if (!this.connected)
            return;
        await this.saveData();
        this.connected = false;
        this.emit('disconnected');
        console.log('📕 Database disconnected');
    }
    async query(sql, params) {
        if (!this.connected) {
            await this.connect();
        }
        // Simple SQL parsing for basic operations
        const sqlLower = sql.toLowerCase().trim();
        if (sqlLower.startsWith('insert')) {
            return this.handleInsert(sql, params);
        }
        else if (sqlLower.startsWith('select')) {
            return this.handleSelect(sql, params);
        }
        else if (sqlLower.startsWith('update')) {
            return this.handleUpdate(sql, params);
        }
        else if (sqlLower.startsWith('delete')) {
            return this.handleDelete(sql, params);
        }
        else if (sqlLower.startsWith('create table')) {
            return this.handleCreateTable(sql);
        }
        return { rows: [], rowCount: 0 };
    }
    async handleInsert(sql, params) {
        // Parse table name from INSERT INTO table_name
        const match = sql.match(/insert\s+into\s+(\w+)/i);
        if (!match)
            throw new Error('Invalid INSERT statement');
        const tableName = match[1];
        if (!this.data.has(tableName)) {
            this.data.set(tableName, []);
        }
        const record = {
            id: Date.now().toString(),
            ...this.parseInsertValues(sql, params)
        };
        this.data.get(tableName).push(record);
        await this.saveData();
        return { rows: [record], rowCount: 1 };
    }
    async handleSelect(sql, params) {
        // Parse table name from SELECT ... FROM table_name
        const match = sql.match(/from\s+(\w+)/i);
        if (!match)
            throw new Error('Invalid SELECT statement');
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
    async handleUpdate(sql, params) {
        // Simple UPDATE implementation
        const match = sql.match(/update\s+(\w+)\s+set/i);
        if (!match)
            throw new Error('Invalid UPDATE statement');
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
    async handleDelete(sql, params) {
        // Simple DELETE implementation
        const match = sql.match(/delete\s+from\s+(\w+)/i);
        if (!match)
            throw new Error('Invalid DELETE statement');
        const tableName = match[1];
        const originalCount = this.data.get(tableName)?.length || 0;
        // For simplicity, clear the table
        this.data.set(tableName, []);
        await this.saveData();
        return { rows: [], rowCount: originalCount };
    }
    async handleCreateTable(sql) {
        // Parse table name
        const match = sql.match(/create\s+table(?:\s+if\s+not\s+exists)?\s+(\w+)/i);
        if (!match)
            throw new Error('Invalid CREATE TABLE statement');
        const tableName = match[1];
        if (!this.data.has(tableName)) {
            this.data.set(tableName, []);
        }
        return { rows: [], rowCount: 0 };
    }
    parseInsertValues(sql, params) {
        // Simple parsing - in real implementation would be more robust
        const values = {};
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
    parseUpdateValues(sql, params) {
        // Simple parsing for SET clause
        const values = {};
        if (params && params.length > 0) {
            // Assume first param is the value to set
            values.updated_at = new Date();
        }
        return values;
    }
    async saveData() {
        if (!this.dataFile)
            return;
        try {
            const data = {};
            this.data.forEach((value, key) => {
                data[key] = value;
            });
            await fs.writeFile(this.dataFile, JSON.stringify(data, null, 2));
        }
        catch (error) {
            console.error('Failed to save database:', error);
        }
    }
    // Specific methods for CodeMind
    async recordDecision(decision) {
        await this.query(`INSERT INTO claude_decisions (decision_type, context, decision, timestamp)
             VALUES ($1, $2, $3, $4)`, [decision.decision_type, decision.context, decision.decision, decision.timestamp]);
    }
    async recordMetric(metric) {
        await this.query(`INSERT INTO performance_metrics (tool, operation, duration, success, error_message, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)`, [metric.tool, metric.operation, metric.duration, metric.success, metric.error_message, metric.created_at]);
    }
    async getRecentDecisions(limit = 10) {
        const result = await this.query(`SELECT * FROM claude_decisions ORDER BY timestamp DESC LIMIT ${limit}`);
        return result.rows;
    }
    async getPerformanceMetrics(tool) {
        let sql = 'SELECT * FROM performance_metrics';
        if (tool) {
            sql += ` WHERE tool = '${tool}'`;
        }
        sql += ' ORDER BY created_at DESC';
        const result = await this.query(sql);
        return result.rows;
    }
    async getSystemPerformanceMetrics() {
        return this.getPerformanceMetrics();
    }
    async getToolUsageHistory() {
        const result = await this.query('SELECT * FROM performance_metrics ORDER BY created_at DESC');
        return result.rows;
    }
    async recordClaudeDecision(decision) {
        await this.recordDecision(decision);
    }
    async getProjectByPath(path) {
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
    async initialize() {
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
exports.Database = Database;
// Export singleton instance
exports.database = new Database({
    type: 'sqlite',
    filePath: path.join(process.cwd(), '.codemind', 'database.json')
});
exports.default = Database;
//# sourceMappingURL=database.js.map
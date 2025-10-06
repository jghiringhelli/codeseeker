#!/usr/bin/env node
/**
 * Database Schema Analysis Tool
 * Provides structured database context to Claude Code CLI
 *
 * Features:
 * - Schema discovery and relationship mapping
 * - Query pattern analysis
 * - Performance optimization suggestions
 * - Human-readable database documentation
 * - Migration tracking and impact analysis
 */
export interface DatabaseConnection {
    type: 'postgresql' | 'mysql' | 'sqlite' | 'mongodb';
    host?: string;
    port?: number;
    database: string;
    username?: string;
    password?: string;
    url?: string;
}
export interface TableSchema {
    tableName: string;
    columns: ColumnInfo[];
    primaryKeys: string[];
    foreignKeys: ForeignKeyInfo[];
    indexes: IndexInfo[];
    constraints: ConstraintInfo[];
    rowCount?: number;
    estimatedSize?: string;
    description?: string;
}
export interface ColumnInfo {
    columnName: string;
    dataType: string;
    isNullable: boolean;
    defaultValue?: string;
    maxLength?: number;
    precision?: number;
    scale?: number;
    description?: string;
    isUnique: boolean;
    isIndexed: boolean;
}
export interface ForeignKeyInfo {
    constraintName: string;
    columnName: string;
    referencedTable: string;
    referencedColumn: string;
    onDelete?: string;
    onUpdate?: string;
}
export interface IndexInfo {
    indexName: string;
    columns: string[];
    isUnique: boolean;
    indexType: string;
    description?: string;
}
export interface ConstraintInfo {
    constraintName: string;
    constraintType: 'CHECK' | 'UNIQUE' | 'NOT NULL' | 'PRIMARY KEY' | 'FOREIGN KEY';
    definition: string;
}
export interface DatabaseRelationship {
    fromTable: string;
    fromColumn: string;
    toTable: string;
    toColumn: string;
    relationshipType: 'one-to-one' | 'one-to-many' | 'many-to-many';
    cardinality: {
        from: number;
        to: number;
    };
    description?: string;
}
export interface QueryPattern {
    pattern: string;
    frequency: number;
    avgDuration: number;
    tables: string[];
    queryType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
    complexity: 'simple' | 'moderate' | 'complex';
    optimizationSuggestions: string[];
}
export interface DatabaseAnalysis {
    projectId: string;
    connections: DatabaseConnection[];
    schemas: TableSchema[];
    relationships: DatabaseRelationship[];
    queryPatterns: QueryPattern[];
    performance: {
        slowQueries: QueryPattern[];
        missingIndexes: string[];
        redundantIndexes: string[];
        tableSizes: Record<string, number>;
    };
    documentation: {
        overview: string;
        dataFlow: string;
        businessRules: string[];
        commonPatterns: string[];
    };
    lastAnalyzed: Date;
}
export declare class DatabaseSchemaTool {
    private logger;
    private connections;
    constructor();
    /**
     * Analyze project's database schemas and relationships
     */
    analyzeProject(projectPath: string, projectId: string, parameters?: any): Promise<DatabaseAnalysis>;
    /**
     * Discover database connections from project files
     */
    private discoverConnections;
    /**
     * Parse connection information from config files
     */
    private parseConnectionFile;
    /**
     * Extract database schemas from connection
     */
    private extractSchemas;
    /**
     * Extract PostgreSQL schemas
     */
    private extractPostgreSQLSchemas;
    /**
     * Get PostgreSQL column information
     */
    private getPostgreSQLColumns;
    /**
     * Store analysis results in CodeMind database
     */
    private storeAnalysis;
    /**
     * Helper methods for parsing different file formats
     */
    private parseEnvFile;
    private buildConnectionFromEnv;
    private parseConnectionUrl;
    private getPostgreSQLPrimaryKeys;
    private getPostgreSQLForeignKeys;
    private getPostgreSQLIndexes;
    private getPostgreSQLConstraints;
    private getPostgreSQLTableStats;
    private createConnection;
    private analyzeRelationships;
    private extractQueriesFromCode;
    private analyzePerformance;
    private generateDocumentation;
    private extractConnectionsFromJSON;
    private extractConnectionsFromJS;
    private findConnectionsInCode;
    private deduplicateConnections;
}
export default DatabaseSchemaTool;
//# sourceMappingURL=database-schema-tool.d.ts.map
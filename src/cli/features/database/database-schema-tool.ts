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

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { ColoredLogger } from '../../../utils/colored-logger';

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

export class DatabaseSchemaTool {
  private logger: ColoredLogger;
  private connections: Map<string, Pool> = new Map();

  constructor() {
    this.logger = ColoredLogger.getInstance();
  }

  /**
   * Analyze project's database schemas and relationships
   */
  async analyzeProject(
    projectPath: string, 
    projectId: string, 
    parameters: any = {}
  ): Promise<DatabaseAnalysis> {
    this.logger.info('DATABASE_TOOL', `Analyzing database schemas for project: ${projectId}`);

    try {
      // Discover database connections
      const connections = await this.discoverConnections(projectPath);
      
      // Analyze each connection
      const schemas: TableSchema[] = [];
      const relationships: DatabaseRelationship[] = [];
      const queryPatterns: QueryPattern[] = [];

      for (const connection of connections) {
        const pool = await this.createConnection(connection);
        this.connections.set(`${connection.database}`, pool);

        // Extract schema information
        const tableSchemas = await this.extractSchemas(pool, connection);
        schemas.push(...tableSchemas);

        // Analyze relationships
        const tableRelationships = await this.analyzeRelationships(pool, tableSchemas);
        relationships.push(...tableRelationships);

        // Analyze query patterns from code
        const codeQueries = await this.extractQueriesFromCode(projectPath, connection);
        queryPatterns.push(...codeQueries);
      }

      // Performance analysis
      const performance = await this.analyzePerformance(schemas, queryPatterns);

      // Generate documentation
      const documentation = this.generateDocumentation(schemas, relationships, queryPatterns);

      const analysis: DatabaseAnalysis = {
        projectId,
        connections,
        schemas,
        relationships,
        queryPatterns,
        performance,
        documentation,
        lastAnalyzed: new Date()
      };

      // Store analysis in our database
      await this.storeAnalysis(projectId, analysis);

      this.logger.success('DATABASE_TOOL', `Analyzed ${schemas.length} tables, ${relationships.length} relationships`);
      return analysis;

    } catch (error) {
      this.logger.error('DATABASE_TOOL', `Analysis failed: ${error}`);
      throw error;
    }
  }

  /**
   * Discover database connections from project files
   */
  private async discoverConnections(projectPath: string): Promise<DatabaseConnection[]> {
    const connections: DatabaseConnection[] = [];

    try {
      // Check for common config files
      const configFiles = [
        '.env',
        '.env.local', 
        'config/database.js',
        'config/database.json',
        'knexfile.js',
        'database.json',
        'package.json'
      ];

      for (const configFile of configFiles) {
        const filePath = path.join(projectPath, configFile);
        if (fs.existsSync(filePath)) {
          const discoveredConnections = await this.parseConnectionFile(filePath);
          connections.push(...discoveredConnections);
        }
      }

      // Look for database imports in code
      const codeConnections = await this.findConnectionsInCode(projectPath);
      connections.push(...codeConnections);

      // Remove duplicates
      return this.deduplicateConnections(connections);

    } catch (error) {
      this.logger.warning('DATABASE_TOOL', `Connection discovery failed: ${error}`);
      return [];
    }
  }

  /**
   * Parse connection information from config files
   */
  private async parseConnectionFile(filePath: string): Promise<DatabaseConnection[]> {
    const connections: DatabaseConnection[] = [];
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const fileName = path.basename(filePath);

      if (fileName === '.env' || fileName === '.env.local') {
        // Parse environment variables
        const envVars = this.parseEnvFile(content);
        const dbConnection = this.buildConnectionFromEnv(envVars);
        if (dbConnection) connections.push(dbConnection);

      } else if (fileName.endsWith('.json')) {
        // Parse JSON config
        const config = JSON.parse(content);
        const jsonConnections = this.extractConnectionsFromJSON(config);
        connections.push(...jsonConnections);

      } else if (fileName.endsWith('.js')) {
        // Parse JavaScript config (basic extraction)
        const jsConnections = this.extractConnectionsFromJS(content);
        connections.push(...jsConnections);
      }

    } catch (error) {
      this.logger.warning('DATABASE_TOOL', `Failed to parse ${filePath}: ${error}`);
    }

    return connections;
  }

  /**
   * Extract database schemas from connection
   */
  private async extractSchemas(pool: Pool, connection: DatabaseConnection): Promise<TableSchema[]> {
    const schemas: TableSchema[] = [];

    try {
      if (connection.type === 'postgresql') {
        schemas.push(...await this.extractPostgreSQLSchemas(pool));
      }
      // Add support for other database types here

    } catch (error) {
      this.logger.error('DATABASE_TOOL', `Schema extraction failed: ${error}`);
    }

    return schemas;
  }

  /**
   * Extract PostgreSQL schemas
   */
  private async extractPostgreSQLSchemas(pool: Pool): Promise<TableSchema[]> {
    const schemas: TableSchema[] = [];

    // Get all tables
    const tablesQuery = `
      SELECT 
        t.table_name,
        t.table_type,
        obj_description(c.oid) as table_comment
      FROM information_schema.tables t
      LEFT JOIN pg_class c ON c.relname = t.table_name
      WHERE t.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name;
    `;

    const tablesResult = await pool.query(tablesQuery);

    for (const table of tablesResult.rows) {
      const tableName = table.table_name;

      // Get columns
      const columns = await this.getPostgreSQLColumns(pool, tableName);
      
      // Get primary keys
      const primaryKeys = await this.getPostgreSQLPrimaryKeys(pool, tableName);
      
      // Get foreign keys
      const foreignKeys = await this.getPostgreSQLForeignKeys(pool, tableName);
      
      // Get indexes
      const indexes = await this.getPostgreSQLIndexes(pool, tableName);
      
      // Get constraints
      const constraints = await this.getPostgreSQLConstraints(pool, tableName);

      // Get row count and size
      const stats = await this.getPostgreSQLTableStats(pool, tableName);

      schemas.push({
        tableName,
        columns,
        primaryKeys,
        foreignKeys,
        indexes,
        constraints,
        rowCount: stats.rowCount,
        estimatedSize: stats.size,
        description: table.table_comment
      });
    }

    return schemas;
  }

  /**
   * Get PostgreSQL column information
   */
  private async getPostgreSQLColumns(pool: Pool, tableName: string): Promise<ColumnInfo[]> {
    const query = `
      SELECT 
        c.column_name,
        c.data_type,
        c.is_nullable::boolean,
        c.column_default,
        c.character_maximum_length,
        c.numeric_precision,
        c.numeric_scale,
        col_description(pgc.oid, c.ordinal_position) as description,
        CASE WHEN tc.constraint_type = 'UNIQUE' THEN true ELSE false END as is_unique,
        CASE WHEN i.indkey IS NOT NULL THEN true ELSE false END as is_indexed
      FROM information_schema.columns c
      LEFT JOIN pg_class pgc ON pgc.relname = c.table_name
      LEFT JOIN information_schema.table_constraints tc 
        ON tc.table_name = c.table_name 
        AND tc.constraint_type = 'UNIQUE'
      LEFT JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_name = tc.constraint_name
        AND kcu.column_name = c.column_name
      LEFT JOIN pg_index i ON i.indrelid = pgc.oid
      WHERE c.table_name = $1
      ORDER BY c.ordinal_position;
    `;

    const result = await pool.query(query, [tableName]);
    
    return result.rows.map(row => ({
      columnName: row.column_name,
      dataType: row.data_type,
      isNullable: row.is_nullable === 'YES',
      defaultValue: row.column_default,
      maxLength: row.character_maximum_length,
      precision: row.numeric_precision,
      scale: row.numeric_scale,
      description: row.description,
      isUnique: row.is_unique,
      isIndexed: row.is_indexed
    }));
  }

  /**
   * Store analysis results in CodeSeeker database
   */
  private async storeAnalysis(projectId: string, analysis: DatabaseAnalysis): Promise<void> {
    try {
      // Store in our main CodeSeeker database
      const codeseekerPool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'codeseeker',
        user: process.env.DB_USER || 'codeseeker',
        password: process.env.DB_PASSWORD || 'codeseeker123'
      });

      // Create database_analysis table if not exists
      await codeseekerPool.query(`
        CREATE TABLE IF NOT EXISTS database_analysis (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
          analysis_data JSONB NOT NULL,
          schema_summary JSONB NOT NULL,
          performance_metrics JSONB NOT NULL,
          last_analyzed TIMESTAMPTZ DEFAULT NOW(),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // Store the analysis
      await codeseekerPool.query(`
        INSERT INTO database_analysis 
        (project_id, analysis_data, schema_summary, performance_metrics)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (project_id) 
        DO UPDATE SET 
          analysis_data = $2,
          schema_summary = $3,
          performance_metrics = $4,
          last_analyzed = NOW();
      `, [
        projectId,
        JSON.stringify(analysis),
        JSON.stringify({
          tableCount: analysis.schemas.length,
          relationshipCount: analysis.relationships.length,
          queryPatternCount: analysis.queryPatterns.length
        }),
        JSON.stringify(analysis.performance)
      ]);

      await codeseekerPool.end();

    } catch (error) {
      this.logger.error('DATABASE_TOOL', `Failed to store analysis: ${error}`);
    }
  }

  /**
   * Helper methods for parsing different file formats
   */
  private parseEnvFile(content: string): Record<string, string> {
    const envVars: Record<string, string> = {};
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          envVars[key.trim()] = valueParts.join('=').trim().replace(/['"]/g, '');
        }
      }
    }

    return envVars;
  }

  private buildConnectionFromEnv(envVars: Record<string, string>): DatabaseConnection | null {
    // Try different common patterns
    if (envVars.DATABASE_URL) {
      return this.parseConnectionUrl(envVars.DATABASE_URL);
    }

    if (envVars.DB_HOST && envVars.DB_NAME) {
      return {
        type: 'postgresql', // Default assumption
        host: envVars.DB_HOST,
        port: parseInt(envVars.DB_PORT || '5432'),
        database: envVars.DB_NAME || envVars.DB_DATABASE,
        username: envVars.DB_USER || envVars.DB_USERNAME,
        password: envVars.DB_PASSWORD || envVars.DB_PASS
      };
    }

    return null;
  }

  private parseConnectionUrl(url: string): DatabaseConnection {
    // Parse URLs like: postgresql://user:pass@host:port/database
    const urlObj = new URL(url);
    
    return {
      type: urlObj.protocol.replace(':', '') as any,
      host: urlObj.hostname,
      port: parseInt(urlObj.port) || 5432,
      database: urlObj.pathname.slice(1),
      username: urlObj.username,
      password: urlObj.password,
      url
    };
  }

  // Additional helper methods would be implemented here...
  private async getPostgreSQLPrimaryKeys(pool: Pool, tableName: string): Promise<string[]> {
    // Implementation details...
    return [];
  }

  private async getPostgreSQLForeignKeys(pool: Pool, tableName: string): Promise<ForeignKeyInfo[]> {
    // Implementation details...
    return [];
  }

  private async getPostgreSQLIndexes(pool: Pool, tableName: string): Promise<IndexInfo[]> {
    // Implementation details...
    return [];
  }

  private async getPostgreSQLConstraints(pool: Pool, tableName: string): Promise<ConstraintInfo[]> {
    // Implementation details...
    return [];
  }

  private async getPostgreSQLTableStats(pool: Pool, tableName: string): Promise<{rowCount: number, size: string}> {
    // Implementation details...
    return { rowCount: 0, size: '0 bytes' };
  }

  private async createConnection(connection: DatabaseConnection): Promise<Pool> {
    // Implementation details...
    return new Pool({});
  }

  private async analyzeRelationships(pool: Pool, schemas: TableSchema[]): Promise<DatabaseRelationship[]> {
    // Implementation details...
    return [];
  }

  private async extractQueriesFromCode(projectPath: string, connection: DatabaseConnection): Promise<QueryPattern[]> {
    // Implementation details...
    return [];
  }

  private async analyzePerformance(schemas: TableSchema[], queryPatterns: QueryPattern[]): Promise<any> {
    // Implementation details...
    return {};
  }

  private generateDocumentation(schemas: TableSchema[], relationships: DatabaseRelationship[], queryPatterns: QueryPattern[]): any {
    // Implementation details...
    return {};
  }

  private extractConnectionsFromJSON(config: any): DatabaseConnection[] {
    // Implementation details...
    return [];
  }

  private extractConnectionsFromJS(content: string): DatabaseConnection[] {
    // Implementation details...
    return [];
  }

  private async findConnectionsInCode(projectPath: string): Promise<DatabaseConnection[]> {
    // Implementation details...
    return [];
  }

  private deduplicateConnections(connections: DatabaseConnection[]): DatabaseConnection[] {
    // Implementation details...
    return connections;
  }
}

export default DatabaseSchemaTool;
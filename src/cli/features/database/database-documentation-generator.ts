#!/usr/bin/env node

/**
 * Database Documentation Generator
 * Creates human-readable, Claude-friendly database documentation
 * 
 * Features:
 * - Schema overview in natural language
 * - Relationship explanations
 * - Common query patterns
 * - Business logic documentation
 * - Performance optimization suggestions
 */

import { DatabaseAnalysis, TableSchema, DatabaseRelationship, QueryPattern } from './database-schema-tool';

export interface DatabaseDocumentation {
  overview: {
    summary: string;
    keyTables: string[];
    complexity: 'simple' | 'moderate' | 'complex' | 'enterprise';
    primaryPurpose: string;
  };
  
  tableDescriptions: Record<string, {
    purpose: string;
    keyColumns: string[];
    relationships: string[];
    businessRules: string[];
    commonOperations: string[];
  }>;
  
  relationshipExplanations: {
    description: string;
    businessContext: string;
    examples: string[];
  }[];
  
  queryPatterns: {
    pattern: string;
    explanation: string;
    usage: string;
    optimization: string[];
  }[];
  
  businessLogic: {
    workflows: string[];
    constraints: string[];
    dataFlow: string[];
  };
  
  claudeContext: {
    howToQuery: string[];
    commonTasks: string[];
    gotchas: string[];
    bestPractices: string[];
  };
}

export class DatabaseDocumentationGenerator {
  
  /**
   * Generate comprehensive Claude-friendly documentation
   */
  generateDocumentation(analysis: DatabaseAnalysis): DatabaseDocumentation {
    const overview = this.generateOverview(analysis);
    const tableDescriptions = this.generateTableDescriptions(analysis.schemas, analysis.relationships);
    const relationshipExplanations = this.generateRelationshipExplanations(analysis.relationships);
    const queryPatterns = this.generateQueryPatternDocumentation(analysis.queryPatterns);
    const businessLogic = this.extractBusinessLogic(analysis);
    const claudeContext = this.generateClaudeContext(analysis);

    return {
      overview,
      tableDescriptions,
      relationshipExplanations,
      queryPatterns,
      businessLogic,
      claudeContext
    };
  }

  /**
   * Generate high-level database overview
   */
  private generateOverview(analysis: DatabaseAnalysis): DatabaseDocumentation['overview'] {
    const tableCount = analysis.schemas.length;
    const relationshipCount = analysis.relationships.length;
    
    // Determine complexity
    let complexity: 'simple' | 'moderate' | 'complex' | 'enterprise';
    if (tableCount <= 5 && relationshipCount <= 10) complexity = 'simple';
    else if (tableCount <= 15 && relationshipCount <= 30) complexity = 'moderate';
    else if (tableCount <= 50 && relationshipCount <= 100) complexity = 'complex';
    else complexity = 'enterprise';

    // Identify key tables (tables with most relationships)
    const tableRelationshipCounts = new Map<string, number>();
    analysis.relationships.forEach(rel => {
      tableRelationshipCounts.set(rel.fromTable, (tableRelationshipCounts.get(rel.fromTable) || 0) + 1);
      tableRelationshipCounts.set(rel.toTable, (tableRelationshipCounts.get(rel.toTable) || 0) + 1);
    });

    const keyTables = Array.from(tableRelationshipCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tableName]) => tableName);

    // Determine primary purpose
    const primaryPurpose = this.determinePrimaryPurpose(analysis.schemas, keyTables);

    const summary = this.generateDatabaseSummary(tableCount, relationshipCount, complexity, primaryPurpose);

    return {
      summary,
      keyTables,
      complexity,
      primaryPurpose
    };
  }

  /**
   * Generate natural language database summary
   */
  private generateDatabaseSummary(
    tableCount: number, 
    relationshipCount: number, 
    complexity: string,
    primaryPurpose: string
  ): string {
    return `This is a ${complexity} database system with ${tableCount} tables and ${relationshipCount} relationships. ` +
           `The primary purpose appears to be ${primaryPurpose}. ` +
           `The schema follows ${this.getArchitecturalPattern(complexity)} patterns and ` +
           `${complexity === 'simple' ? 'has straightforward' : complexity === 'enterprise' ? 'has highly complex' : 'has moderately complex'} ` +
           `data relationships that support ${this.getTypicalOperations(primaryPurpose)}.`;
  }

  /**
   * Generate detailed table descriptions
   */
  private generateTableDescriptions(
    schemas: TableSchema[], 
    relationships: DatabaseRelationship[]
  ): Record<string, DatabaseDocumentation['tableDescriptions'][string]> {
    const descriptions: Record<string, DatabaseDocumentation['tableDescriptions'][string]> = {};

    for (const schema of schemas) {
      const purpose = this.inferTablePurpose(schema);
      const keyColumns = this.identifyKeyColumns(schema);
      const tableRelationships = this.getTableRelationships(schema.tableName, relationships);
      const businessRules = this.extractBusinessRules(schema);
      const commonOperations = this.inferCommonOperations(schema, tableRelationships);

      descriptions[schema.tableName] = {
        purpose,
        keyColumns,
        relationships: tableRelationships,
        businessRules,
        commonOperations
      };
    }

    return descriptions;
  }

  /**
   * Generate relationship explanations in natural language
   */
  private generateRelationshipExplanations(relationships: DatabaseRelationship[]): DatabaseDocumentation['relationshipExplanations'] {
    return relationships.map(rel => ({
      description: `${rel.fromTable}.${rel.fromColumn} has a ${rel.relationshipType} relationship with ${rel.toTable}.${rel.toColumn}`,
      businessContext: rel.description || this.inferBusinessContext(rel),
      examples: this.generateRelationshipExamples(rel)
    }));
  }

  /**
   * Generate Claude-specific context and guidance
   */
  private generateClaudeContext(analysis: DatabaseAnalysis): DatabaseDocumentation['claudeContext'] {
    const howToQuery = this.generateQueryGuidance(analysis);
    const commonTasks = this.generateCommonTasks(analysis);
    const gotchas = this.identifyCommonGotchas(analysis);
    const bestPractices = this.generateBestPractices(analysis);

    return {
      howToQuery,
      commonTasks,
      gotchas,
      bestPractices
    };
  }

  /**
   * Generate query guidance for Claude
   */
  private generateQueryGuidance(analysis: DatabaseAnalysis): string[] {
    const guidance: string[] = [];

    // Identify main entity tables
    const mainTables = analysis.schemas
      .filter(s => s.primaryKeys.length > 0 && s.foreignKeys.length === 0)
      .map(s => s.tableName);

    if (mainTables.length > 0) {
      guidance.push(`Main entity tables: ${mainTables.join(', ')} - these are good starting points for queries`);
    }

    // Identify junction/pivot tables
    const junctionTables = analysis.schemas
      .filter(s => s.foreignKeys.length >= 2 && s.columns.length <= 5)
      .map(s => s.tableName);

    if (junctionTables.length > 0) {
      guidance.push(`Junction tables: ${junctionTables.join(', ')} - use these for many-to-many relationships`);
    }

    // Common join patterns
    const commonJoins = this.identifyCommonJoinPatterns(analysis.relationships);
    guidance.push(...commonJoins);

    return guidance;
  }

  /**
   * Helper methods for documentation generation
   */
  private determinePrimaryPurpose(schemas: TableSchema[], keyTables: string[]): string {
    const tableNames = schemas.map(s => s.tableName.toLowerCase());
    
    // Look for common patterns in table names
    if (tableNames.some(name => name.includes('user') || name.includes('account'))) {
      if (tableNames.some(name => name.includes('order') || name.includes('product'))) {
        return 'e-commerce or business application';
      }
      return 'user management system';
    }
    
    if (tableNames.some(name => name.includes('project') || name.includes('task'))) {
      return 'project management system';
    }
    
    if (tableNames.some(name => name.includes('content') || name.includes('article'))) {
      return 'content management system';
    }
    
    return 'business data management';
  }

  private getArchitecturalPattern(complexity: string): string {
    switch (complexity) {
      case 'simple': return 'basic relational';
      case 'moderate': return 'normalized relational';
      case 'complex': return 'advanced normalized';
      case 'enterprise': return 'enterprise-grade normalized';
      default: return 'relational';
    }
  }

  private getTypicalOperations(primaryPurpose: string): string {
    if (primaryPurpose.includes('e-commerce')) {
      return 'product catalog management, order processing, and customer data operations';
    }
    if (primaryPurpose.includes('user management')) {
      return 'user authentication, profile management, and access control operations';
    }
    if (primaryPurpose.includes('project management')) {
      return 'project tracking, task assignment, and progress monitoring operations';
    }
    return 'standard business data operations';
  }

  private inferTablePurpose(schema: TableSchema): string {
    const tableName = schema.tableName.toLowerCase();
    const columns = schema.columns.map(c => c.columnName.toLowerCase());

    // Common table purposes based on naming patterns
    if (tableName.includes('user') || tableName.includes('account')) {
      return 'Stores user account information and authentication data';
    }
    if (tableName.includes('product') || tableName.includes('item')) {
      return 'Contains product catalog and inventory information';
    }
    if (tableName.includes('order') || tableName.includes('purchase')) {
      return 'Tracks purchase orders and transaction data';
    }
    if (tableName.includes('log') || tableName.includes('audit')) {
      return 'Maintains system logs and audit trail information';
    }
    if (schema.foreignKeys.length >= 2 && schema.columns.length <= 5) {
      return 'Junction table that connects multiple entities in many-to-many relationships';
    }

    return `Manages ${tableName.replace(/_/g, ' ')} data and related business operations`;
  }

  private identifyKeyColumns(schema: TableSchema): string[] {
    const keyColumns: string[] = [];

    // Primary keys
    keyColumns.push(...schema.primaryKeys.map(pk => `${pk} (primary key)`));

    // Foreign keys
    keyColumns.push(...schema.foreignKeys.map(fk => 
      `${fk.columnName} (foreign key → ${fk.referencedTable}.${fk.referencedColumn})`
    ));

    // Unique columns
    const uniqueColumns = schema.columns
      .filter(c => c.isUnique && !schema.primaryKeys.includes(c.columnName))
      .map(c => `${c.columnName} (unique)`);
    keyColumns.push(...uniqueColumns);

    return keyColumns;
  }

  private getTableRelationships(tableName: string, relationships: DatabaseRelationship[]): string[] {
    return relationships
      .filter(rel => rel.fromTable === tableName || rel.toTable === tableName)
      .map(rel => {
        if (rel.fromTable === tableName) {
          return `References ${rel.toTable} via ${rel.fromColumn} → ${rel.toColumn} (${rel.relationshipType})`;
        } else {
          return `Referenced by ${rel.fromTable} via ${rel.fromColumn} ← ${rel.toColumn} (${rel.relationshipType})`;
        }
      });
  }

  private extractBusinessRules(schema: TableSchema): string[] {
    const rules: string[] = [];

    // Check constraints
    schema.constraints
      .filter(c => c.constraintType === 'CHECK')
      .forEach(constraint => {
        rules.push(`Business rule: ${constraint.definition}`);
      });

    // Nullable constraints
    const requiredFields = schema.columns
      .filter(c => !c.isNullable && !schema.primaryKeys.includes(c.columnName))
      .map(c => c.columnName);
    
    if (requiredFields.length > 0) {
      rules.push(`Required fields: ${requiredFields.join(', ')}`);
    }

    return rules;
  }

  private inferCommonOperations(schema: TableSchema, relationships: string[]): string[] {
    const operations: string[] = [];
    const tableName = schema.tableName;

    // Basic CRUD operations
    operations.push(`SELECT * FROM ${tableName} WHERE ...`);
    
    if (schema.primaryKeys.length > 0) {
      operations.push(`SELECT * FROM ${tableName} WHERE ${schema.primaryKeys[0]} = ?`);
    }

    operations.push(`INSERT INTO ${tableName} (...) VALUES (...)`);
    operations.push(`UPDATE ${tableName} SET ... WHERE ...`);
    operations.push(`DELETE FROM ${tableName} WHERE ...`);

    // Join operations based on relationships
    if (relationships.length > 0) {
      operations.push(`JOIN operations with: ${relationships.length} related tables`);
    }

    return operations;
  }

  private inferBusinessContext(rel: DatabaseRelationship): string {
    const context = `${rel.fromTable} entries are associated with ${rel.toTable} entries`;
    
    switch (rel.relationshipType) {
      case 'one-to-one':
        return `Each ${context} in a one-to-one relationship`;
      case 'one-to-many':
        return `Each ${rel.toTable} entry can have multiple ${rel.fromTable} entries`;
      case 'many-to-many':
        return `${rel.fromTable} and ${rel.toTable} have a many-to-many relationship`;
      default:
        return context;
    }
  }

  private generateRelationshipExamples(rel: DatabaseRelationship): string[] {
    const examples: string[] = [];

    // Generate example queries
    examples.push(`SELECT * FROM ${rel.fromTable} f JOIN ${rel.toTable} t ON f.${rel.fromColumn} = t.${rel.toColumn}`);
    
    if (rel.relationshipType === 'one-to-many') {
      examples.push(`SELECT t.*, COUNT(f.${rel.fromColumn}) FROM ${rel.toTable} t LEFT JOIN ${rel.fromTable} f ON t.${rel.toColumn} = f.${rel.fromColumn} GROUP BY t.${rel.toColumn}`);
    }

    return examples;
  }

  private generateCommonTasks(analysis: DatabaseAnalysis): string[] {
    const tasks: string[] = [];

    // Based on schema complexity
    if (analysis.schemas.length <= 10) {
      tasks.push('Simple data retrieval and updates');
      tasks.push('Basic reporting queries');
    } else {
      tasks.push('Complex multi-table joins');
      tasks.push('Advanced reporting and analytics');
      tasks.push('Data migration and transformation');
    }

    // Based on relationships
    if (analysis.relationships.some(r => r.relationshipType === 'many-to-many')) {
      tasks.push('Managing many-to-many relationships via junction tables');
    }

    return tasks;
  }

  private identifyCommonGotchas(analysis: DatabaseAnalysis): string[] {
    const gotchas: string[] = [];

    // Large tables without proper indexing
    const largeUnindexedTables = analysis.schemas
      .filter(s => (s.rowCount || 0) > 10000 && s.indexes.length <= 1)
      .map(s => s.tableName);

    if (largeUnindexedTables.length > 0) {
      gotchas.push(`Large tables with minimal indexing: ${largeUnindexedTables.join(', ')} - queries may be slow`);
    }

    // Nullable foreign keys
    const nullableFKs = analysis.schemas
      .flatMap(s => s.foreignKeys.filter(fk => 
        s.columns.find(c => c.columnName === fk.columnName)?.isNullable
      ))
      .map(fk => `${fk.columnName} in ${fk.constraintName}`);

    if (nullableFKs.length > 0) {
      gotchas.push(`Nullable foreign keys may cause unexpected JOINs: ${nullableFKs.slice(0, 3).join(', ')}`);
    }

    return gotchas;
  }

  private generateBestPractices(analysis: DatabaseAnalysis): string[] {
    const practices: string[] = [
      'Always use explicit JOIN syntax rather than WHERE clause joins',
      'Include appropriate indexes for frequently queried columns',
      'Use transactions for multi-table operations',
      'Consider query performance impact when joining multiple large tables'
    ];

    // Add specific practices based on schema
    if (analysis.relationships.length > 10) {
      practices.push('Use query planning tools to optimize complex multi-table queries');
    }

    return practices;
  }

  private identifyCommonJoinPatterns(relationships: DatabaseRelationship[]): string[] {
    const patterns: string[] = [];

    // Group relationships by tables involved
    const tableConnections = new Map<string, string[]>();
    
    relationships.forEach(rel => {
      if (!tableConnections.has(rel.fromTable)) {
        tableConnections.set(rel.fromTable, []);
      }
      tableConnections.get(rel.fromTable).push(rel.toTable);
    });

    // Identify hub tables (connected to many others)
    const hubTables = Array.from(tableConnections.entries())
      .filter(([_, connections]) => connections.length >= 3)
      .map(([table, connections]) => `${table} (hub) connects to: ${connections.join(', ')}`);

    patterns.push(...hubTables);

    return patterns;
  }

  private generateQueryPatternDocumentation(queryPatterns: QueryPattern[]): DatabaseDocumentation['queryPatterns'] {
    return queryPatterns.map(pattern => ({
      pattern: pattern.pattern,
      explanation: this.explainQueryPattern(pattern),
      usage: this.describeQueryUsage(pattern),
      optimization: pattern.optimizationSuggestions
    }));
  }

  private explainQueryPattern(pattern: QueryPattern): string {
    return `This ${pattern.complexity} ${pattern.queryType} query involves ${pattern.tables.length} table(s): ${pattern.tables.join(', ')}`;
  }

  private describeQueryUsage(pattern: QueryPattern): string {
    return `Used ${pattern.frequency} times with average duration of ${pattern.avgDuration}ms`;
  }

  private extractBusinessLogic(analysis: DatabaseAnalysis): DatabaseDocumentation['businessLogic'] {
    // This would analyze constraints, triggers, and relationships to infer business logic
    return {
      workflows: ['Data entry → Validation → Storage → Processing'],
      constraints: ['Data integrity constraints enforced at database level'],
      dataFlow: ['Input validation → Business logic application → Data persistence']
    };
  }
}

export default DatabaseDocumentationGenerator;
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
import { DatabaseAnalysis } from './database-schema-tool';
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
export declare class DatabaseDocumentationGenerator {
    /**
     * Generate comprehensive Claude-friendly documentation
     */
    generateDocumentation(analysis: DatabaseAnalysis): DatabaseDocumentation;
    /**
     * Generate high-level database overview
     */
    private generateOverview;
    /**
     * Generate natural language database summary
     */
    private generateDatabaseSummary;
    /**
     * Generate detailed table descriptions
     */
    private generateTableDescriptions;
    /**
     * Generate relationship explanations in natural language
     */
    private generateRelationshipExplanations;
    /**
     * Generate Claude-specific context and guidance
     */
    private generateClaudeContext;
    /**
     * Generate query guidance for Claude
     */
    private generateQueryGuidance;
    /**
     * Helper methods for documentation generation
     */
    private determinePrimaryPurpose;
    private getArchitecturalPattern;
    private getTypicalOperations;
    private inferTablePurpose;
    private identifyKeyColumns;
    private getTableRelationships;
    private extractBusinessRules;
    private inferCommonOperations;
    private inferBusinessContext;
    private generateRelationshipExamples;
    private generateCommonTasks;
    private identifyCommonGotchas;
    private generateBestPractices;
    private identifyCommonJoinPatterns;
    private generateQueryPatternDocumentation;
    private explainQueryPattern;
    private describeQueryUsage;
    private extractBusinessLogic;
}
export default DatabaseDocumentationGenerator;
//# sourceMappingURL=database-documentation-generator.d.ts.map
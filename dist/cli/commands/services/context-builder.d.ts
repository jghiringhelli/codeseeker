/**
 * Context Builder Service
 * Single Responsibility: Build enhanced context for Claude Code prompts
 * Combines semantic search results, graph analysis, and user clarifications
 */
import { QueryAnalysis } from './natural-language-processor';
import { SemanticResult } from './semantic-search-orchestrator';
import { GraphContext } from './graph-analysis-service';
export interface EnhancedContext {
    originalQuery: string;
    clarifications: string[];
    assumptions: string[];
    relevantFiles: Array<{
        path: string;
        type: string;
        similarity: number;
        preview: string;
        startLine?: number;
        endLine?: number;
    }>;
    codeRelationships: Array<{
        from: string;
        to: string;
        type: string;
        fromLocation?: string;
        toLocation?: string;
        fromMethod?: string;
        toMethod?: string;
        line?: number;
    }>;
    packageStructure: string[];
    enhancedPrompt: string;
}
export declare class ContextBuilder {
    /**
     * Build enhanced context from all analysis results
     */
    buildEnhancedContext(originalQuery: string, queryAnalysis: QueryAnalysis, userClarifications: string[], semanticResults: SemanticResult[], graphContext: GraphContext): EnhancedContext;
    /**
     * Extract start line number from class metadata
     */
    private extractLineFromMetadata;
    /**
     * Extract end line number from class metadata
     */
    private extractEndLineFromMetadata;
    /**
     * Format location as file:line for Claude Code navigation
     */
    private formatLocation;
    /**
     * Create enhanced prompt for Claude Code
     * Uses structured prompt engineering: Pre-Search Info → Role → Context → Task → Format → Constraints
     */
    private createEnhancedPrompt;
    /**
     * Get role description based on detected intent
     */
    private getRoleForIntent;
    /**
     * Get expected response format based on intent
     */
    private getFormatForIntent;
    /**
     * Create a meaningful preview of file content
     * Shows ~50 lines - enough to see class signatures, imports, and key methods
     * This reduces Claude's need to Read files, saving tool call tokens
     */
    private createFilePreview;
    /**
     * Generate context statistics for logging
     */
    getContextStats(context: EnhancedContext): {
        filesFound: number;
        relationshipsFound: number;
        assumptionsDetected: number;
        clarificationsProvided: number;
        promptLength: number;
    };
}
//# sourceMappingURL=context-builder.d.ts.map
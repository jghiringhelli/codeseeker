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
    }>;
    codeRelationships: Array<{
        from: string;
        to: string;
        type: string;
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
     * Create enhanced prompt for Claude Code
     */
    private createEnhancedPrompt;
    /**
     * Create a preview of file content
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
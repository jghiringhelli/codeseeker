/**
 * Analyze Command Handler - Fully Implemented
 * Single Responsibility: Handle natural language code analysis commands
 * Implements the 8-step workflow for enhanced AI interactions
 */
import { BaseCommandHandler } from '../base-command-handler';
import { CommandResult } from '../command-context';
export declare class AnalyzeCommandHandler extends BaseCommandHandler {
    private logger;
    handle(args: string): Promise<CommandResult>;
    /**
     * Execute the 8-step enhanced AI workflow
     */
    private executeEnhancedWorkflow;
    /**
     * Step 1: Detect assumptions in user query using contextual analysis
     */
    private detectAssumptions;
    /**
     * Check if query contains any of the given patterns
     */
    private containsPattern;
    /**
     * Check if a file exists (helper for project structure analysis)
     */
    private fileExists;
    /**
     * Calculate text-based similarity for semantic search
     */
    private calculateTextSimilarity;
    /**
     * Step 2: Clarify the query based on assumptions
     */
    private clarifyQuery;
    /**
     * Step 3: Perform semantic search for relevant code
     * Uses storage abstraction for both embedded and server modes
     */
    private performSemanticSearch;
    /**
     * Step 4: Query knowledge graph for relationships
     * Uses storage abstraction for both embedded and server modes
     */
    private queryKnowledgeGraph;
    /**
     * Step 5: Build enhanced context from all sources
     */
    private buildEnhancedContext;
    /**
     * Step 6: Generate AI analysis using real LLM reasoning
     */
    private generateAIAnalysis;
    /**
     * Build comprehensive analysis prompt from real context
     */
    private buildAnalysisPrompt;
    /**
     * Perform contextual analysis using available data
     */
    private performContextualAnalysis;
    /**
     * Analyze query intent based on real context
     */
    private analyzeQueryIntent;
    /**
     * Generate insights based on actual code content
     */
    private generateCodeInsights;
    /**
     * Generate architectural insights from real relationships
     */
    private generateArchitecturalInsights;
    /**
     * Generate contextual recommendations
     */
    private generateContextualRecommendations;
    /**
     * Calculate confidence based on available data quality
     */
    private calculateConfidenceScore;
    /**
     * Fallback analysis if main analysis fails
     */
    private generateFallbackAnalysis;
    /**
     * Step 8: Prepare comprehensive summary
     */
    private prepareSummary;
    /**
     * Calculate enhancement quality based on available data
     */
    private calculateEnhancementQuality;
    /**
     * Get existing project ID from database or generate fallback
     * Uses storage abstraction for both embedded and server modes
     */
    private generateProjectId;
}
//# sourceMappingURL=analyze-command-handler.d.ts.map
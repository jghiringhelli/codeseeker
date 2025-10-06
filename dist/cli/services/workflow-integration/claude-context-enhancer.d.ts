/**
 * Claude Context Enhancer - SOLID Principles Implementation
 * Single Responsibility: Enhance Claude context using integrated semantic analysis
 * Integrates file scanning, semantic analysis, content processing, and vector search
 * Provides intelligent context optimization for Claude interactions
 */
export interface ContextEnhancementRequest {
    projectPath: string;
    userQuery: string;
    intent: 'overview' | 'coding' | 'architecture' | 'debugging' | 'exploration';
    maxTokens?: number;
    focusAreas?: string[];
    excludePatterns?: string[];
}
export interface ContextEnhancementResult {
    relevantFiles: Array<{
        path: string;
        relevanceScore: number;
        reason: string;
        contentSnippets: string[];
    }>;
    semanticContext: {
        relatedEntities: Array<{
            name: string;
            type: string;
            filePath: string;
            relationships: string[];
        }>;
        keyRelationships: Array<{
            source: string;
            target: string;
            type: string;
            confidence: number;
        }>;
    };
    searchResults: Array<{
        content: string;
        similarity: number;
        filePath: string;
        startLine: number;
        endLine: number;
    }>;
    contextSummary: {
        totalFiles: number;
        relevantFiles: number;
        tokenEstimate: number;
        processingTime: number;
        confidenceScore: number;
    };
    enhancedPrompt: string;
}
export interface ClaudeContextConfig {
    enableSemanticSearch: boolean;
    enableGraphTraversal: boolean;
    vectorStore: 'memory' | 'postgresql';
    embeddingModel: 'openai' | 'local';
    maxContextFiles: number;
    maxTokensPerFile: number;
    minRelevanceThreshold: number;
    includeRelationships: boolean;
    optimizeForIntent: boolean;
}
/**
 * Claude Context Enhancer - Orchestrates all semantic services
 */
export declare class ClaudeContextEnhancer {
    private fileScanner;
    private semanticGraphService;
    private contentProcessor;
    private vectorSearchEngine;
    private config;
    private isInitialized;
    constructor(config?: Partial<ClaudeContextConfig>, databaseClient?: any);
    /**
     * Initialize the context enhancer with project analysis
     */
    initialize(projectPath: string): Promise<void>;
    /**
     * Enhance context for Claude interaction
     */
    enhanceContext(request: ContextEnhancementRequest): Promise<ContextEnhancementResult>;
    private performSemanticSearch;
    private buildSemanticContext;
    private analyzeFileRelevance;
    private generateEnhancedPrompt;
    private calculateContextSummary;
    /**
     * Get context enhancement statistics
     */
    getStats(): Promise<{
        initialized: boolean;
        config?: undefined;
        indexStats?: undefined;
    } | {
        initialized: boolean;
        config: ClaudeContextConfig;
        indexStats: {
            totalChunks: number;
        };
    }>;
    /**
     * Update configuration at runtime
     */
    updateConfig(newConfig: Partial<ClaudeContextConfig>): void;
    /**
     * Reset and reinitialize
     */
    reset(): Promise<void>;
}
//# sourceMappingURL=claude-context-enhancer.d.ts.map
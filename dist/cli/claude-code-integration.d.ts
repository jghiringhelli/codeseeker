/**
 * Claude Code Integration Service
 * Provides direct integration with Claude Code for AI-powered analysis
 */
export interface ClaudeCodeOptions {
    projectPath: string;
    maxTokens?: number;
    temperature?: number;
    resumeToken?: string;
}
export interface AnalysisResult {
    architecture: {
        type: string;
        patterns: string[];
        frameworks: string[];
        designPrinciples: string[];
    };
    dependencies: {
        files: Array<{
            file: string;
            dependencies: string[];
            type: 'import' | 'require' | 'reference';
        }>;
        relationships: Array<{
            from: string;
            to: string;
            type: string;
            strength: number;
        }>;
    };
    useCases: Array<{
        name: string;
        description: string;
        actors: string[];
        preconditions: string[];
        steps: string[];
        postconditions: string[];
        businessValue: string;
    }>;
    codeQuality: {
        score: number;
        issues: string[];
        recommendations: string[];
    };
    resumeToken: string;
}
export interface ClaudeCodeResponse {
    success: boolean;
    data?: any;
    error?: string;
    tokensUsed?: number;
    resumeToken?: string;
}
export declare class ClaudeCodeIntegration {
    private dbConnections;
    private conversationManager;
    private activeSessions;
    constructor();
    /**
     * Execute Claude Code with a specific prompt and context using conversation management
     */
    executeClaudeCode(prompt: string, context: string, options?: ClaudeCodeOptions): Promise<ClaudeCodeResponse>;
    /**
     * Get or create a conversation session for a project
     */
    private getSessionForProject;
    /**
     * Perform comprehensive project analysis using Claude Code
     */
    analyzeProject(projectPath: string, resumeToken?: string): Promise<AnalysisResult>;
    /**
     * Process user requests through the complete AI pipeline
     */
    processRequest(userRequest: string, projectPath: string, options?: {
        maxTokens?: number;
        projectId?: string;
    }): Promise<ClaudeCodeResponse>;
    /**
     * Build comprehensive project context for Claude Code
     */
    private buildProjectContext;
    /**
     * Detect user intent using AI
     */
    detectUserIntent(userRequest: string): Promise<{
        category: string;
        confidence: number;
        params: Record<string, any>;
    }>;
    /**
     * Transform comprehensive workflow response to legacy format for backwards compatibility
     */
    private transformComprehensiveResponse;
    /**
     * Analyze user request with comprehensive task breakdown (new optimized approach)
     */
    analyzeRequestWithTaskBreakdown(userRequest: string): Promise<{
        intent: {
            category: string;
            confidence: number;
            requiresModifications: boolean;
        };
        taskGroups: Array<{
            groupId: string;
            description: string;
            tasks: string[];
            requiresModifications: boolean;
            complexity: 'simple' | 'medium' | 'complex';
            riskLevel: 'low' | 'medium' | 'high';
            estimatedMinutes: number;
            primaryDomains: string[];
        }>;
        workflow: 'reporting' | 'development';
        reasoning: string;
    }>;
    /**
     * Perform semantic search to find relevant files
     */
    private performSemanticSearch;
    /**
     * Fallback file discovery when semantic search fails or returns no results
     */
    private fallbackFileDiscovery;
    private buildClaudeCodeCommand;
    /**
     * Extract the original user request from a complex prompt for compression context
     */
    private extractOriginalRequest;
    private parseAnalysisResponse;
    private storeAnalysisResults;
    private buildEnhancedContext;
    private decomposeIntoTasks;
    private executeTask;
    private performQualityCheck;
    private improveTaskResult;
    private integrateResults;
    private updateKnowledgeBase;
    private getProjectStructure;
    private getKeyConfigurations;
    private getRecentChanges;
    private getProjectDocumentation;
}
//# sourceMappingURL=claude-code-integration.d.ts.map
/**
 * Enhanced Tool Interface - Maintains all existing functionality while adding database operations
 * Tools remain auto-discoverable, bundleable, intention-based, and fully functional
 */
export interface BaseToolInterface {
    id: string;
    name: string;
    description: string;
    version: string;
    category: string;
    languages: string[];
    frameworks: string[];
    purposes: string[];
    capabilities: Record<string, any>;
    intents: string[];
    keywords: string[];
    bundleCompatible: boolean;
    dependencies: string[];
    performanceImpact: 'minimal' | 'low' | 'medium' | 'high';
    tokenUsage: 'minimal' | 'low' | 'medium' | 'high' | 'variable';
    analyze(projectPath: string, projectId: string, parameters?: any, fileContext?: any): Promise<any>;
    updateKnowledge?(projectId: string, data: any): Promise<void>;
    queryData(projectId: string, filters?: any): Promise<any>;
    saveData(projectId: string, data: any): Promise<any>;
    isApplicable?(projectPath: string, context: any): boolean;
    getRecommendations?(analysisResult: any): string[];
}
export declare abstract class EnhancedAnalysisTool implements BaseToolInterface {
    abstract id: string;
    abstract name: string;
    abstract description: string;
    abstract version: string;
    abstract category: string;
    abstract languages: string[];
    abstract frameworks: string[];
    abstract purposes: string[];
    abstract intents: string[];
    abstract keywords: string[];
    bundleCompatible: boolean;
    dependencies: string[];
    performanceImpact: 'minimal' | 'low' | 'medium' | 'high';
    tokenUsage: 'minimal' | 'low' | 'medium' | 'high' | 'variable';
    capabilities: Record<string, any>;
    /**
     * Main analysis method - combines database query + live analysis
     */
    analyze(projectPath: string, projectId: string, parameters?: any, fileContext?: any): Promise<any>;
    /**
     * Query data from database - acts as interface to database API
     */
    queryData(projectId: string, filters?: any): Promise<any>;
    /**
     * Save data to database - acts as interface to database API
     */
    saveData(projectId: string, data: any): Promise<any>;
    /**
     * Update knowledge (existing method, now also updates database)
     */
    updateKnowledge(projectId: string, data: any): Promise<void>;
    /**
     * Perform the actual analysis - tool-specific implementation
     */
    abstract performAnalysis(projectPath: string, projectId: string, parameters: any): Promise<any>;
    /**
     * Get database tool name for API calls
     */
    abstract getDatabaseToolName(): string;
    /**
     * Check if tool is applicable to the project
     */
    isApplicable(projectPath: string, context: any): boolean;
    /**
     * Generate recommendations from analysis
     */
    getRecommendations(analysisResult: any): string[];
    /**
     * Process cached data into analysis format
     */
    protected processCachedData(cachedData: any[]): any;
    /**
     * Check if cached data is recent enough
     */
    protected isCachedDataRecent(cachedData: any[], maxAge: number): boolean;
    /**
     * Record performance metrics for analytics
     */
    protected recordPerformanceMetric(projectId: string, executionTime: number, cacheHitRate: number, memoryUsage?: number, metadata?: any): Promise<void>;
    /**
     * Record code quality metrics for analytics
     */
    protected recordQualityMetric(projectId: string, filePath: string, metricType: string, metricValue: number, metadata?: any): Promise<void>;
    /**
     * Record file change events for analytics
     */
    protected recordFileEvent(projectId: string, filePath: string, eventType: string, contentHash?: string, fileSize?: number, metadata?: any): Promise<void>;
    /**
     * Perform tool-specific knowledge updates
     */
    protected performKnowledgeUpdate(projectId: string, data: any): Promise<void>;
    /**
     * Get tool metadata for registry
     */
    getMetadata(): {
        id: string;
        name: string;
        description: string;
        version: string;
        category: string;
        languages: string[];
        frameworks: string[];
        purposes: string[];
        capabilities: Record<string, any>;
        intents: string[];
        keywords: string[];
        bundleCompatible: boolean;
        dependencies: string[];
        performanceImpact: "medium" | "low" | "high" | "minimal";
        tokenUsage: "medium" | "low" | "high" | "variable" | "minimal";
    };
    /**
     * Check if tool matches given intent
     */
    matchesIntent(intent: string): boolean;
    /**
     * Check if tool is compatible with project
     */
    isCompatibleWith(projectLanguages: string[], projectFrameworks: string[]): boolean;
}
/**
 * Tool bundle interface - for grouping related tools
 */
export interface ToolBundle {
    id: string;
    name: string;
    description: string;
    tools: string[];
    workflow: {
        sequential?: string[];
        parallel?: string[];
        conditional?: Array<{
            condition: string;
            tools: string[];
        }>;
    };
    intents: string[];
    useCase: string;
}
/**
 * Enhanced tool result with database integration
 */
export interface EnhancedToolResult {
    toolId: string;
    toolName: string;
    source: 'cached' | 'live' | 'fallback';
    data: any;
    analysis: any;
    recommendations?: string[];
    error?: string;
    timestamp: Date;
    fromCache: boolean;
    cachedDataAvailable?: boolean;
    executionTime?: number;
    tokensUsed?: number;
}
//# sourceMappingURL=enhanced-tool-interface.d.ts.map
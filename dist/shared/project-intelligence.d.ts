/**
 * Project Intelligence Repository
 * Stores and manages intelligent project context in MongoDB
 */
export interface ProjectContext {
    languages: string[];
    frameworks: string[];
    projectType: string;
    fileStructure: {
        entryPoints: string[];
        configFiles: string[];
        testDirectories: string[];
    };
    patterns: {
        architectural: string[];
        design: string[];
    };
    complexity: 'low' | 'medium' | 'high';
    recommendedTools: string[];
    metrics?: {
        totalFiles: number;
        totalLines: number;
        testCoverage?: number;
        dependencies: number;
    };
    insights?: string[];
}
export interface ProjectIntelligenceDoc {
    _id?: string;
    projectId: string;
    context: ProjectContext;
    lastUpdated: Date;
    version: number;
    history?: ProjectContext[];
}
export declare class ProjectIntelligence {
    private collection?;
    private logger;
    private cache;
    constructor();
    private ensureConnection;
    /**
     * Update project context with version tracking
     */
    updateProjectContext(projectId: string, context: ProjectContext): Promise<void>;
    /**
     * Get project context with caching
     */
    getProjectContext(projectId: string): Promise<ProjectContext | null>;
    /**
     * Find similar projects based on context
     */
    findSimilarProjects(projectContext: ProjectContext, limit?: number): Promise<ProjectIntelligenceDoc[]>;
    /**
     * Get recommended tools based on project context
     */
    getRecommendedTools(projectId: string): Promise<string[]>;
    /**
     * Learn from successful tool runs
     */
    learnFromToolExecution(projectId: string, toolName: string, success: boolean, executionTime: number, context?: any): Promise<void>;
    /**
     * Analyze project and generate initial context
     */
    analyzeProject(projectId: string, projectPath: string, fileList: string[]): Promise<ProjectContext>;
    /**
     * Get intelligence insights for a project
     */
    getProjectInsights(projectId: string): Promise<string[]>;
    /**
     * Compare two project contexts
     */
    compareProjects(projectId1: string, projectId2: string): Promise<any>;
    private calculateSimilarityScore;
    private updateToolRecommendations;
    private detectLanguages;
    private detectFrameworks;
    private detectProjectType;
    private analyzeFileStructure;
    private detectPatterns;
    private calculateComplexity;
    private countDependencies;
    private generateInitialRecommendations;
    private getDefaultTools;
    private getToolsByProjectType;
    private getToolsByLanguages;
    private getToolsByFrameworks;
    private getToolsByComplexity;
    private findCommonTools;
    /**
     * Clear cache
     */
    clearCache(): void;
}
export declare const projectIntelligence: ProjectIntelligence;
//# sourceMappingURL=project-intelligence.d.ts.map
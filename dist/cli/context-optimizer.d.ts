export interface ContextOptimizationRequest {
    projectPath: string;
    query: string;
    tokenBudget?: number;
    strategy?: 'minimal' | 'smart' | 'full' | 'auto';
    optimization?: 'speed' | 'accuracy' | 'balanced' | 'cost_efficient';
    contextType?: string;
    focusArea?: string;
}
export interface ContextOptimization {
    projectPath: string;
    tokenBudget: number;
    strategy: 'minimal' | 'smart' | 'full' | 'auto';
    estimatedTokens: number;
    priorityFiles: PriorityFile[];
    relevantFiles?: string[];
    projectInfo?: ProjectInfo;
    detectedPatterns?: DetectedPattern[];
    focusArea?: string;
    contextWindow?: string;
}
export interface PriorityFile {
    path: string;
    score: number;
    language: string;
    summary?: string;
    relevantSections?: CodeSection[];
    importance: 'critical' | 'high' | 'medium' | 'low';
}
export interface CodeSection {
    startLine: number;
    endLine: number;
    content: string;
    type: 'function' | 'class' | 'interface' | 'import' | 'export' | 'other';
    relevanceScore: number;
}
export interface ProjectInfo {
    type: 'web-app' | 'api' | 'library' | 'cli' | 'mobile' | 'desktop' | 'other';
    primaryLanguage: string;
    framework?: string;
    packageManager?: 'npm' | 'yarn' | 'pnpm' | 'pip' | 'poetry' | 'cargo' | 'other';
    totalFiles: number;
    totalLinesOfCode: number;
    files?: Array<{
        path: string;
        tokenCount: number;
        language: string;
    }>;
}
export interface DetectedPattern {
    name: string;
    description: string;
    confidence: number;
    files: string[];
}
export interface ProjectAnalysisRequest {
    projectPath: string;
    tokenBudget: number;
    focusArea?: string;
}
export declare class ContextOptimizer {
    private logger;
    private astAnalyzer;
    private cache;
    optimizeContext(request: ContextOptimizationRequest): Promise<ContextOptimization>;
    analyzeProject(request: ProjectAnalysisRequest): Promise<ProjectInfo>;
    private getAllProjectFiles;
    private detectPrimaryLanguage;
    private getLanguageFromExtension;
    private detectProjectType;
    private detectFramework;
    private detectPackageManager;
    private determineStrategy;
    private selectPriorityFiles;
    private scoreFile;
    private getImportanceLevel;
    private smartSelection;
    private estimateFileTokens;
    private extractRelevantSections;
    private isDeclarationLine;
    private getDeclarationType;
    private calculateRelevanceScore;
    private generateFileSummary;
    private estimateTokenUsage;
    private detectPatterns;
    private generateRecommendations;
    private getCacheKey;
    clearCache(): void;
}
export default ContextOptimizer;
//# sourceMappingURL=context-optimizer.d.ts.map
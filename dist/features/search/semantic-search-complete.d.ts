/**
 * Complete Semantic Search Tool Implementation
 */
import { EnhancedAnalysisTool } from '../../shared/enhanced-tool-interface';
export declare class SemanticSearchTool extends EnhancedAnalysisTool {
    id: string;
    name: string;
    description: string;
    version: string;
    category: string;
    languages: string[];
    frameworks: string[];
    purposes: string[];
    intents: string[];
    keywords: string[];
    private logger;
    private openaiApiKey?;
    private cache;
    constructor();
    private initializeCache;
    getDatabaseToolName(): string;
    performAnalysis(projectPath: string, projectId: string, parameters?: any): Promise<any>;
    private extractCodeSegmentsFromFiles;
    private extractCodeSegments;
    private extractFunctions;
    private generateEmbedding;
    private getLanguageFromExtension;
    private generateContentHash;
    private getLanguageStats;
    private getContentTypeStats;
    private generateRecommendations;
    private delay;
    private calculateFileHash;
    private storeEmbeddings;
    isApplicable(projectPath: string, context: any): boolean;
    getRecommendations(analysisResult: any): string[];
}
//# sourceMappingURL=semantic-search-complete.d.ts.map
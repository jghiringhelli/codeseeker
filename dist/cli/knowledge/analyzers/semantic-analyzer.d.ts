/**
 * Semantic Analyzer - Refactored with SOLID Principles
 * SOLID Principles: Single Responsibility, Dependency Inversion
 * Reduced from 938 lines to ~150 lines using service extraction
 */
import { AnalysisResult, SemanticAnalysisConfig, IFileDiscoveryService, IASTAnalysisService, IPatternDetectionService } from './interfaces';
/**
 * Main Semantic Analyzer Coordinator
 * Uses dependency injection for all analysis operations
 */
export declare class SemanticAnalyzer {
    private config;
    private fileDiscovery?;
    private astAnalysis?;
    private patternDetection?;
    private logger;
    private knowledgeGraph;
    constructor(config: SemanticAnalysisConfig, fileDiscovery?: IFileDiscoveryService, astAnalysis?: IASTAnalysisService, patternDetection?: IPatternDetectionService);
    analyzeProject(): Promise<AnalysisResult>;
    private createNodesFromAnalysis;
    private createFileTriads;
    private addPatternToGraph;
    private generateInsights;
    private extractNamespace;
    private extractTags;
}
//# sourceMappingURL=semantic-analyzer.d.ts.map
/**
 * Semantic Analyzer for Knowledge Graph Construction
 *
 * Extracts semantic relationships and creates triads from code analysis.
 * Uses AST parsing, pattern recognition, and semantic similarity detection
 * to build comprehensive knowledge graphs.
 */
import { SemanticKnowledgeGraph } from '../graph/knowledge-graph';
export interface SemanticAnalysisConfig {
    projectPath: string;
    filePatterns: string[];
    includeTests: boolean;
    minConfidence: number;
    enableSemanticSimilarity: boolean;
    enablePatternDetection: boolean;
}
export interface AnalysisResult {
    nodesExtracted: number;
    triadsCreated: number;
    patterns: SemanticPattern[];
    insights: string[];
}
export interface SemanticPattern {
    name: string;
    type: string;
    confidence: number;
    nodes: string[];
    description: string;
}
export declare class SemanticAnalyzer {
    private config;
    private logger;
    private astAnalyzer;
    private knowledgeGraph;
    private fileContents;
    constructor(config: SemanticAnalysisConfig, knowledgeGraph: SemanticKnowledgeGraph);
    analyzeProject(): Promise<AnalysisResult>;
    private discoverFiles;
    private loadFileContents;
    private analyzeFile;
    private createMethodCallTriads;
    private createImportExportTriads;
    private detectSemanticSimilarities;
    private detectSemanticPatterns;
    private createAbstractions;
    private getLanguageFromPath;
    private extractNamespace;
    private extractTags;
    private findOrCreateNode;
    private inferNodeTypeFromName;
    private calculateSimilarity;
    private calculateStructuralSimilarity;
    private stringSimilarity;
    private levenshteinDistance;
    private detectRepositoryPattern;
    private detectServicePattern;
    private detectFactoryPattern;
    private detectObserverPattern;
    private identifyFeatures;
    private extractFeatureName;
}
//# sourceMappingURL=semantic-analyzer.d.ts.map
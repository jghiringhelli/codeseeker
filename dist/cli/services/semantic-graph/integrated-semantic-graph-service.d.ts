/**
 * Integrated Semantic Graph Service - Facade + Strategy Pattern
 * Combines Tree-sitter (fast, accurate) with Claude Code CLI proxy (comprehensive, flexible)
 * Builds complete Neo4j knowledge graph from project files
 */
import { FileInfo } from '../file-scanner/file-scanner-interfaces';
import { SemanticGraphData } from './tree-sitter-semantic-builder';
export interface GraphBuilderConfig {
    useTreeSitter: boolean;
    useClaudeProxy: boolean;
    preferTreeSitter: boolean;
    maxClaudeConcurrency: number;
    treeSitterLanguages: string[];
    claudeProxyCommand?: string;
    skipLargeFiles: boolean;
    maxFileSize: number;
}
export interface IntegratedSemanticResult extends SemanticGraphData {
    processingStrategy: {
        treeSitterFiles: number;
        claudeProxyFiles: number;
        fallbackFiles: number;
        totalProcessingTime: number;
    };
    qualityMetrics: {
        avgConfidence: number;
        highConfidenceEntities: number;
        crossFileRelationships: number;
        languageCoverage: Record<string, 'tree-sitter' | 'claude-proxy' | 'fallback'>;
    };
}
export declare class IntegratedSemanticGraphService {
    private treeSitterBuilder;
    private claudeProxy;
    private config;
    constructor(config?: Partial<GraphBuilderConfig>);
    /**
     * Build comprehensive semantic graph using optimal strategy for each file
     */
    buildGraph(files: FileInfo[]): Promise<IntegratedSemanticResult>;
    private filterFiles;
    private categorizeFiles;
    private shouldUseClaudeProxy;
    private processWithTreeSitter;
    private processWithClaudeProxy;
    private processFallback;
    private mergeResults;
    private calculateQualityMetrics;
    /**
     * Update configuration at runtime
     */
    updateConfig(newConfig: Partial<GraphBuilderConfig>): void;
    /**
     * Get current configuration
     */
    getConfig(): GraphBuilderConfig;
}
//# sourceMappingURL=integrated-semantic-graph-service.d.ts.map
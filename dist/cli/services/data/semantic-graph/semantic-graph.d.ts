/**
 * Consolidated Semantic Graph Service - SOLID Principles Compliant
 * Single Responsibility: Unified semantic graph management with Neo4j and file processing
 * Open/Closed: Extensible through strategy injection for different processors
 * Liskov Substitution: Processors are interchangeable through common interfaces
 * Interface Segregation: Separate interfaces for graph operations and file processing
 * Dependency Inversion: Depends on abstractions, not concrete implementations
 */
import { FileInfo } from '../../monitoring/file-scanning/file-scanner-interfaces';
import { SemanticGraphData } from './tree-sitter-semantic-builder';
export interface IGraphProcessor {
    processFiles(files: FileInfo[]): Promise<SemanticGraphData | null>;
}
export interface IGraphStorage {
    addNode(type: NodeType, properties: Record<string, any>): Promise<string>;
    addRelationship(fromId: string, toId: string, type: RelationshipType, properties?: Record<string, any>): Promise<void>;
    batchCreateNodes(nodes: Array<{
        type: NodeType;
        properties: Record<string, any>;
    }>): Promise<string[]>;
    close(): Promise<void>;
}
export interface IQualityAnalyzer {
    calculateQualityMetrics(result: any, categories: any): any;
    calculateRelevanceScore(node: GraphNode, keywords: string[]): number;
}
export declare class TreeSitterProcessor implements IGraphProcessor {
    private treeSitterBuilder;
    constructor();
    processFiles(files: FileInfo[]): Promise<SemanticGraphData | null>;
}
export declare class ClaudeProxyProcessor implements IGraphProcessor {
    private claudeProxy;
    constructor(claudeProxyCommand?: string);
    processFiles(files: FileInfo[]): Promise<SemanticGraphData | null>;
    private convertClaudeResults;
}
export declare class FallbackProcessor implements IGraphProcessor {
    processFiles(files: FileInfo[]): Promise<SemanticGraphData>;
}
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
export interface GraphNode {
    id: string;
    labels: string[];
    properties: Record<string, any>;
}
export interface GraphRelationship {
    id: string;
    type: string;
    startNodeId: string;
    endNodeId: string;
    properties: Record<string, any>;
}
export interface SemanticSearchResult {
    node: GraphNode;
    relatedNodes: Array<{
        node: GraphNode;
        relationship: string;
    }>;
    relevanceScore: number;
}
export interface ImpactAnalysisResult {
    affectedNodes: GraphNode[];
    relationships: GraphRelationship[];
    impact: {
        codeFiles: number;
        documentation: number;
        tests: number;
        uiComponents: number;
    };
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
}
export interface CrossReferenceResult {
    concept: GraphNode;
    relatedCode: GraphNode[];
    relatedDocs: GraphNode[];
    relatedUI: GraphNode[];
    relatedTests: GraphNode[];
}
export type NodeType = 'Code' | 'Documentation' | 'BusinessConcept' | 'UIComponent' | 'TestCase';
export type RelationshipType = 'IMPORTS' | 'USES' | 'IMPLEMENTS' | 'DESCRIBES' | 'TESTS' | 'DEFINES' | 'RELATES_TO' | 'DEPENDS_ON' | 'CONTAINS' | 'EXTENDS' | 'CONFIGURES' | 'CALLS' | 'OVERRIDES' | 'INHERITS_FROM' | 'AGGREGATES' | 'COMPOSES' | 'ACCESSES' | 'MODIFIES' | 'INSTANTIATES' | 'TYPE_OF' | 'RETURNS';
export interface SearchContext {
    includeTypes?: NodeType[];
    maxDepth?: number;
    domain?: string;
    language?: string;
}
export declare class SemanticGraphService implements IGraphStorage {
    private driver;
    private logger;
    private treeSitterProcessor?;
    private claudeProxyProcessor?;
    private fallbackProcessor;
    private qualityAnalyzer?;
    private config;
    constructor(uri?: string, username?: string, password?: string, treeSitterProcessor?: TreeSitterProcessor, claudeProxyProcessor?: ClaudeProxyProcessor, qualityAnalyzer?: IQualityAnalyzer, config?: Partial<GraphBuilderConfig>);
    initialize(): Promise<void>;
    close(): Promise<void>;
    /**
     * Build comprehensive semantic graph using optimal strategy for each file
     * SOLID: Single Responsibility - focused on coordinating file processing
     */
    buildGraphFromFiles(files: FileInfo[]): Promise<IntegratedSemanticResult>;
    private filterFiles;
    private categorizeFiles;
    private shouldUseClaudeProxy;
    private mergeProcessingResults;
    private calculateDefaultQualityMetrics;
    /**
     * Update configuration at runtime (SOLID: Open/Closed)
     */
    updateConfig(newConfig: Partial<GraphBuilderConfig>): void;
    /**
     * Get current configuration
     */
    getConfig(): GraphBuilderConfig;
    addNode(type: NodeType, properties: Record<string, any>): Promise<string>;
    addRelationship(fromId: string, toId: string, type: RelationshipType, properties?: Record<string, any>): Promise<void>;
    batchCreateNodes(nodes: Array<{
        type: NodeType;
        properties: Record<string, any>;
    }>): Promise<string[]>;
    semanticSearch(query: string, context?: SearchContext): Promise<SemanticSearchResult[]>;
    findRelated(nodeId: string, maxDepth?: number, relationshipTypes?: RelationshipType[]): Promise<GraphNode[]>;
    analyzeImpact(nodeId: string, maxDepth?: number): Promise<ImpactAnalysisResult>;
    findCrossReferences(conceptName: string): Promise<CrossReferenceResult>;
    getGraphStatistics(): Promise<any>;
    private ensureIndexes;
    private convertNeo4jNode;
    private convertNeo4jRelationship;
    private calculateRelevanceScore;
    private calculateRiskLevel;
    /**
     * Inject custom processors for testing or extension
     */
    setTreeSitterProcessor(processor: TreeSitterProcessor): void;
    setClaudeProxyProcessor(processor: ClaudeProxyProcessor): void;
    setQualityAnalyzer(analyzer: IQualityAnalyzer): void;
}
export default SemanticGraphService;
//# sourceMappingURL=semantic-graph.d.ts.map
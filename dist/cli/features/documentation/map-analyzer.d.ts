/**
 * Document Map Analyzer with Semantic Graph Integration
 * Combines documentation analysis with graph-based semantic search
 */
import { SemanticGraphService } from '../../services/data/semantic-graph/semantic-graph';
export interface DocumentMapResult {
    documents: Array<{
        id: string;
        path: string;
        title: string;
        type: string;
        summary: string;
        wordCount: number;
        topics: string[];
        lastModified: Date;
    }>;
    topics: Array<{
        topic: string;
        keywords: string[];
        importance: number;
        documents: string[];
    }>;
    mainClasses: Array<{
        name: string;
        description: string;
        category: string;
        mentions: Array<{
            documentId: string;
            context: string;
        }>;
    }>;
    crossReferences: Array<{
        from: string;
        to: string;
        type: string;
        context: string;
    }>;
}
export interface DocumentMapResultWithSemantics extends DocumentMapResult {
    semanticGraph: {
        totalNodes: number;
        totalRelationships: number;
        conceptClusters: ConceptCluster[];
    };
    crossDomainInsights: CrossDomainInsight[];
}
export interface ConceptCluster {
    conceptName: string;
    relatedDocs: string[];
    relatedCode: string[];
    relatedUI: string[];
    strength: number;
}
export interface CrossDomainInsight {
    concept: string;
    domains: string[];
    connections: Array<{
        from: string;
        to: string;
        type: string;
        strength: number;
    }>;
}
export interface DocumentMapRequest {
    projectPath: string;
    includeTypes?: string[];
    excludePatterns?: string[];
    maxDepth?: number;
}
export declare class DocumentMapAnalyzer {
    private semanticGraph;
    constructor(semanticGraph?: SemanticGraphService);
    analyzeDocumentation(params: DocumentMapRequest): Promise<DocumentMapResult>;
    analyzeDocumentationWithSemantics(params: DocumentMapRequest): Promise<DocumentMapResultWithSemantics>;
    semanticDocumentSearch(query: string, context?: {
        domain?: string;
        includeCode?: boolean;
        maxResults?: number;
    }): Promise<Array<{
        document: any;
        relatedConcepts: string[];
        relatedCode: string[];
        relevanceScore: number;
    }>>;
    private populateSemanticGraph;
    private createSemanticRelationships;
    private extractConceptClusters;
    private findCrossDomainInsights;
    private inferDomain;
    private calculateTopicStrength;
    private calculateClusterStrength;
    private calculateConnectionStrength;
}
export default DocumentMapAnalyzer;
//# sourceMappingURL=map-analyzer.d.ts.map
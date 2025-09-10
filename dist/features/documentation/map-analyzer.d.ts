/**
 * Enhanced Document Map Analyzer with Semantic Graph Integration
 * Combines documentation analysis with graph-based semantic search
 */
import { DocumentMapAnalyzer, DocumentMapRequest, DocumentMapResult } from './map-analyzer';
import { SemanticGraphService } from '../../services/semantic-graph';
export interface EnhancedDocumentMapResult extends DocumentMapResult {
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
export declare class EnhancedDocumentMapAnalyzer extends DocumentMapAnalyzer {
    private semanticGraph;
    constructor(semanticGraph?: SemanticGraphService);
    analyzeDocumentationWithSemantics(params: DocumentMapRequest): Promise<EnhancedDocumentMapResult>;
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
export default EnhancedDocumentMapAnalyzer;
//# sourceMappingURL=map-analyzer.d.ts.map
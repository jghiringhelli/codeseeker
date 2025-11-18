/**
 * Semantic Orchestrator - Enhanced with Graph Intelligence
 * Integrates semantic graph queries into every analysis request
 */
export interface SemanticContextRequest {
    query: string;
    projectPath: string;
    intent?: 'overview' | 'coding' | 'architecture' | 'debugging' | 'research';
    maxResults?: number;
    includeRelated?: boolean;
}
export interface SemanticContextResult {
    query: string;
    intent: string;
    primaryResults: any[];
    relatedConcepts: any[];
    crossDomainInsights: any[];
    graphContext: {
        totalNodes: number;
        totalRelationships: number;
        relevantClusters: string[];
    };
    recommendations: string[];
    mermaidDiagram?: string;
}
export declare class SemanticOrchestrator {
    private semanticGraph;
    private docAnalyzer;
    private treeNavigator;
    private logger;
    constructor();
    initialize(): Promise<void>;
    analyzeWithSemanticContext(request: SemanticContextRequest): Promise<SemanticContextResult>;
    private extractRelatedConcepts;
    private findCrossDomainInsights;
    private performIntentSpecificAnalysis;
    private generateSemanticRecommendations;
    private generateSemanticMermaid;
    private extractRelevantClusters;
    close(): Promise<void>;
}
export default SemanticOrchestrator;
//# sourceMappingURL=semantic-orchestrator.d.ts.map
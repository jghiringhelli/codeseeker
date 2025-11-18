/**
 * Semantic Graph Tool Implementation
 * Core tool that provides semantic understanding of code relationships
 * Used in almost every request for context enhancement
 */
import { InternalTool, ToolMetadata, AnalysisResult, ToolInitResult, ToolUpdateResult } from '../../../shared/tool-interface';
export declare class SemanticGraphTool extends InternalTool {
    private logger;
    private neo4jUrl;
    private graphStorage;
    private semanticGraphService;
    private orchestrator;
    private dbConnections;
    constructor();
    getMetadata(): ToolMetadata;
    initialize(projectId: string): Promise<ToolInitResult>;
    initializeForProject(projectPath: string, projectId: string): Promise<ToolInitResult>;
    analyze(projectPath: string, projectId: string, parameters?: any): Promise<AnalysisResult>;
    analyzeProject(projectPath: string, projectId: string, parameters?: any): Promise<AnalysisResult>;
    update(projectId: string, data: any): Promise<void>;
    updateAfterCliRequest(projectPath: string, projectId: string, cliCommand: string, cliResult: any): Promise<ToolUpdateResult>;
    canAnalyzeProject(projectPath: string): Promise<boolean>;
    getStatus(projectId: string): Promise<{
        initialized: boolean;
        lastAnalysis?: Date;
        recordCount?: number;
        health: 'healthy' | 'warning' | 'error';
    }>;
    private generateKeyNodesFromStats;
    private generateRelationshipsFromStats;
    private extractConceptsFromStats;
    private generateCrossReferencesFromStats;
    private generateImpactAnalysis;
    private generateClusters;
    private generateRecommendations;
    private extractConcepts;
}
//# sourceMappingURL=semantic-graph-tool.d.ts.map
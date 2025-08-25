/**
 * Knowledge Graph Integrator
 *
 * Integrates the semantic knowledge graph with existing CodeMind features
 * to provide enhanced analysis, insights, and cross-feature collaboration.
 */
import { SemanticKnowledgeGraph } from '../graph/knowledge-graph';
import { GraphQueryEngine } from '../query/graph-query-engine';
import { SemanticAnalyzer } from '../analyzers/semantic-analyzer';
import { DuplicationDetector } from '../../features/duplication/detector';
import { TreeNavigator } from '../../features/tree-navigation/navigator';
import { CentralizationDetector } from '../../features/centralization/detector';
import { GitIntegration } from '../../git/git-integration';
import { ContextOptimizer } from '../../cli/context-optimizer';
import { KnowledgeNode } from '../graph/types';
export interface IntegratedAnalysis {
    knowledgeGraphMetrics: {
        nodeCount: number;
        triadCount: number;
        density: number;
        avgClustering: number;
    };
    duplicationsInKnowledge: Array<{
        duplicateGroup: any;
        knowledgeNodes: string[];
        semanticSimilarity: number;
    }>;
    dependencyInsights: Array<{
        node: KnowledgeNode;
        dependencyRisk: number;
        couplingLevel: 'low' | 'medium' | 'high';
        recommendations: string[];
    }>;
    contextOptimizations: Array<{
        feature: string;
        knowledgeContext: KnowledgeNode[];
        relevanceScore: number;
    }>;
    gitIntegrationInsights: Array<{
        commit: string;
        affectedKnowledgeNodes: string[];
        semanticImpact: number;
    }>;
}
export declare class KnowledgeIntegrator {
    private knowledgeGraph;
    private queryEngine;
    private semanticAnalyzer;
    private logger;
    constructor(knowledgeGraph: SemanticKnowledgeGraph, queryEngine: GraphQueryEngine, semanticAnalyzer: SemanticAnalyzer);
    enhanceDuplicationAnalysis(duplicationDetector: DuplicationDetector): Promise<{
        enhancedDuplicates: any[];
        semanticClusters: any[];
    }>;
    enhanceTreeNavigation(treeNavigator: TreeNavigator): Promise<{
        semanticTree: any;
        knowledgeBasedClusters: any[];
        crossReferencePaths: any[];
    }>;
    enhanceCentralizationAnalysis(centralizationDetector: CentralizationDetector): Promise<{
        enhancedOpportunities: any[];
        semanticCentralization: any[];
        knowledgeBasedMigrations: any[];
    }>;
    enhanceGitAnalysis(gitIntegration: GitIntegration): Promise<{
        semanticCommitAnalysis: any[];
        knowledgeImpactMetrics: any;
        evolutionInsights: any[];
    }>;
    enhanceContextOptimization(contextOptimizer: ContextOptimizer, query: string): Promise<{
        knowledgeEnhancedContext: any;
        semanticPriority: any[];
        contextQuality: number;
    }>;
    performIntegratedAnalysis(): Promise<IntegratedAnalysis>;
    private findRelatedKnowledgeNodes;
    private getSemanticContext;
    private generateRefactoringInsights;
    private createDuplicationTriads;
    private findSemanticDuplicationClusters;
    private addSemanticInformationToTree;
    private identifyKnowledgeClusters;
    private findSemanticCrossReferences;
    private mapClusterToTree;
    private calculateGraphDensity;
    private analyzeDuplicationsInKnowledgeGraph;
    private generateDependencyInsights;
    private generateDependencyRecommendations;
    private generateContextOptimizations;
    private generateGitInsights;
    private findConfigurationRelatedNodes;
    private assessSemanticImpactOfCentralization;
    private generateKnowledgeBasedMigrationPath;
    private findSemanticCentralizationOpportunities;
    private generateKnowledgeBasedMigrations;
    private determineMigrationStrategy;
    private estimateMigrationEffort;
    private identifyMigrationPrerequisites;
    private mapChangesToKnowledgeNodes;
    private calculateSemanticImpact;
    private analyzeKnowledgeEvolution;
    private updateKnowledgeGraphFromCommit;
    private calculateKnowledgeImpactMetrics;
    private generateEvolutionInsights;
    private expandSemanticContext;
    private calculateSemanticPriority;
    private calculateContextQuality;
}
//# sourceMappingURL=knowledge-integrator.d.ts.map
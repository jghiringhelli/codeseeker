import { EventEmitter } from 'events';
import { Logger } from '../shared/logger';
import { RoleType } from './types';
export { RoleType };
import { SemanticKnowledgeGraph } from '../knowledge/graph/knowledge-graph';
import { KnowledgeRepository, RAGContext } from '../knowledge/repository/knowledge-repository';
import { ProjectManagementKB } from './project-management-kb';
import { ClassFocusArea, QuickMatch, ClassInsight, ConceptMapping as ClassConceptMapping } from '../knowledge/tree/class-traversal-engine';
export interface RoleKnowledgeContext {
    roleType: RoleType;
    nodeId: string;
    executionId: string;
    step: string;
    inputs: any;
    knowledgePacket: KnowledgePacket;
    contextWindow: RoleContextWindow;
    feedbackLoop: RoleFeedbackLoop;
}
export interface KnowledgePacket {
    triads: {
        relevant: any[];
        patterns: any[];
        dependencies: any[];
        similarities: any[];
    };
    ragContext: RAGContext;
    historical: {
        previousOutcomes: RoleOutcome[];
        learnings: RoleLearning[];
        bestPractices: string[];
        antiPatterns: string[];
    };
    project: {
        currentPhase: any;
        objectives: any[];
        constraints: any[];
        qualityGates: any[];
        riskFactors: any[];
    };
    peers: {
        completedRoles: RoleOutcome[];
        dependentRoles: string[];
        parallelRoles: string[];
        nextRoles: string[];
    };
    domain: {
        expertAdvice: string[];
        researchFindings: string[];
        industryStandards: string[];
        emergingTrends: string[];
    };
    classTraversal: ClassTraversalContext;
}
export interface ClassTraversalContext {
    quickFinds: QuickMatch[];
    classInsights: ClassInsight[];
    conceptMappings: ClassConceptMapping[];
    hierarchyPaths: any[];
    focusArea: ClassFocusArea;
    relevantClasses: string[];
    architecturalPatterns: string[];
    codeUnderstanding: {
        mainConcepts: string[];
        keyRelationships: string[];
        businessRelevantClasses: string[];
        technicalHotspots: string[];
    };
}
export interface RoleContextWindow {
    maxTokens: number;
    compressionLevel: number;
    essentialInfo: any;
    expandedInfo?: any;
    referenceLinks: string[];
    confidence: number;
}
export interface RoleFeedbackLoop {
    inputMetrics: any;
    processMetrics: any;
    outputMetrics: any;
    qualityScores: any;
    improvementSuggestions: string[];
    nextIterationHints: string[];
}
export interface RoleOutcome {
    roleType: RoleType;
    nodeId: string;
    executionId: string;
    timestamp: Date;
    inputs: any;
    outputs: any;
    metrics: RoleMetrics;
    insights: RoleInsight[];
    decisions: RoleDecision[];
    learnings: RoleLearning[];
    duration: number;
    success: boolean;
    qualityScore: number;
}
export interface RoleMetrics {
    executionTime: number;
    memoryUsage: number;
    apiCalls: number;
    accuracy: number;
    completeness: number;
    consistency: number;
    innovation: number;
    businessValue: number;
    riskReduction: number;
    userImpact: number;
    technicalDebt: number;
    knowledgeUtilization: number;
    patternRecognition: number;
    decisionConfidence: number;
    improvementRate: number;
}
export interface RoleInsight {
    type: 'pattern' | 'anomaly' | 'opportunity' | 'risk' | 'optimization';
    description: string;
    evidence: string[];
    confidence: number;
    impact: 'low' | 'medium' | 'high' | 'critical';
    actionable: boolean;
    recommendations: string[];
}
export interface RoleDecision {
    description: string;
    options: string[];
    chosen: string;
    rationale: string;
    confidence: number;
    riskLevel: 'low' | 'medium' | 'high';
    reversible: boolean;
}
export interface RoleLearning {
    category: 'technical' | 'process' | 'domain' | 'team' | 'quality';
    lesson: string;
    context: string;
    applicability: string[];
    confidence: number;
    validation: 'theoretical' | 'empirical' | 'proven';
}
export declare class RoleKnowledgeIntegrator extends EventEmitter {
    private logger;
    private knowledgeGraph;
    private knowledgeRepo;
    private projectKB;
    private classTraversalEngine;
    private roleOutcomes;
    private roleContexts;
    private learningDatabase;
    constructor(logger: Logger, knowledgeGraph: SemanticKnowledgeGraph, knowledgeRepo: KnowledgeRepository, projectKB: ProjectManagementKB, projectPath?: string);
    prepareRoleKnowledge(roleType: RoleType, nodeId: string, executionId: string, step: string, inputs: any): Promise<RoleKnowledgeContext>;
    private buildKnowledgePacket;
    private extractRelevantTriads;
    private generateRoleRAGContext;
    private getHistoricalContext;
    private getProjectContext;
    private getPeerContext;
    private getDomainKnowledge;
    private buildClassTraversalContext;
    private mapRoleToClassFocusArea;
    private getRoleSpecificConcept;
    private shouldIncludeHierarchy;
    private extractRelevantClasses;
    private identifyArchitecturalPatterns;
    private extractKeyRelationships;
    private createContextWindow;
    private extractEssentialInfo;
    recordRoleOutcome(roleType: RoleType, nodeId: string, executionId: string, inputs: any, outputs: any, duration: number, success: boolean): Promise<void>;
    private calculateRoleMetrics;
    private calculateRoleQualityMetrics;
    private calculateBusinessMetrics;
    private calculateLearningMetrics;
    private generateRoleInsights;
    private extractRoleDecisions;
    private generateRoleLearnings;
    private calculateQualityScore;
    private updateLearningDatabase;
    private updateKnowledgeGraph;
    private updateProjectKnowledgeBase;
    private assessRequirementAccuracy;
    private assessRequirementCompleteness;
    private assessRequirementConsistency;
    private assessRequirementInnovation;
    private assessTestConsistency;
    private assessTestInnovation;
    private assessCodeConsistency;
    private assessCodeInnovation;
    private calculateKnowledgeConfidence;
    private extractReferenceLinks;
    private initializeFeedbackLoop;
    private initializeLearningDatabase;
    private getDependentRoles;
    private getParallelRoles;
    private getNextRoles;
    getRoleContext(nodeId: string): Promise<RoleKnowledgeContext | null>;
    getRoleOutcomes(executionId: string, roleType?: RoleType): Promise<RoleOutcome[]>;
    getRoleLearnings(roleType: RoleType): Promise<RoleLearning[]>;
    generateExecutionSummary(executionId: string): Promise<any>;
}
//# sourceMappingURL=role-knowledge-integrator.d.ts.map
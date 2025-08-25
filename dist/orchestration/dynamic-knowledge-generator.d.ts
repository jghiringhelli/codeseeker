import { EventEmitter } from 'events';
import { Logger } from '../shared/logger';
import { RoleType } from './types';
export { RoleType, Action, Warning, Pattern, QualityCheck };
import { RoleKnowledgeContext } from './role-knowledge-integrator';
import { SemanticKnowledgeGraph } from '../knowledge/graph/knowledge-graph';
import { KnowledgeRepository } from '../knowledge/repository/knowledge-repository';
import { ProjectManagementKB } from './project-management-kb';
export interface DynamicContext {
    roleType: RoleType;
    step: string;
    adaptedContent: AdaptedContent;
    reasoning: string[];
    confidenceScore: number;
    compressionRatio: number;
    tokenUsage: number;
    regenerationTriggers: RegenerationTrigger[];
}
export interface AdaptedContent {
    essentials: {
        triads: any[];
        insights: string[];
        patterns: string[];
        decisions: string[];
    };
    contextual: {
        projectStatus: any;
        peerOutcomes: any[];
        historicalLessons: string[];
        riskFactors: string[];
    };
    actionable: {
        recommendedActions: Action[];
        warningSignals: Warning[];
        successPatterns: Pattern[];
        qualityChecks: QualityCheck[];
    };
    learning: {
        similarSituations: Situation[];
        expertAdvice: string[];
        emergingTrends: string[];
        antiPatterns: string[];
    };
}
export interface Action {
    description: string;
    priority: 'immediate' | 'high' | 'medium' | 'low';
    effort: 'minimal' | 'moderate' | 'significant' | 'major';
    confidence: number;
    dependencies: string[];
    expectedOutcome: string;
}
export interface Warning {
    type: 'risk' | 'quality' | 'timeline' | 'resource';
    description: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    indicators: string[];
    mitigationActions: string[];
}
export interface Pattern {
    name: string;
    description: string;
    applicability: string[];
    successRate: number;
    preconditions: string[];
    implementation: string[];
}
export interface QualityCheck {
    name: string;
    description: string;
    criteria: string[];
    automatable: boolean;
    frequency: 'continuous' | 'step' | 'milestone';
}
export interface Situation {
    description: string;
    context: string;
    outcome: 'success' | 'partial' | 'failure';
    keyFactors: string[];
    lessons: string[];
    similarity: number;
}
export interface RegenerationTrigger {
    condition: string;
    threshold: number;
    action: 'refresh' | 'expand' | 'compress' | 'refocus';
}
export declare class DynamicKnowledgeGenerator extends EventEmitter {
    private logger;
    private knowledgeGraph;
    private knowledgeRepo;
    private projectKB;
    private roleSpecializations;
    private contextCache;
    private adaptationRules;
    constructor(logger: Logger, knowledgeGraph: SemanticKnowledgeGraph, knowledgeRepo: KnowledgeRepository, projectKB: ProjectManagementKB);
    generateDynamicContext(roleType: RoleType, step: string, baseContext: RoleKnowledgeContext, constraints: ContextConstraints): Promise<DynamicContext>;
    private adaptContentForRole;
    private extractRoleEssentials;
    private generateContextualInfo;
    private generateActionableKnowledge;
    private extractLearningOpportunities;
    private generateRecommendedActions;
    private identifyWarningSignals;
    private extractSuccessPatterns;
    private defineQualityChecks;
    private applyAdaptationRules;
    private initializeRoleSpecializations;
    private initializeAdaptationRules;
    private shouldRegenerate;
    private evaluateTrigger;
    private calculateContextConfidence;
    private calculateCompressionRatio;
    private estimateTokenUsage;
    private defineRegenerationTriggers;
    private generateAdaptationReasoning;
    private isPeerOutcomeRelevant;
    private isRiskRelevant;
    private getRelevantRoles;
    private findSimilarSituations;
    private evaluateRuleCondition;
    refreshContext(cacheKey: string): Promise<void>;
    getContextStatistics(): Promise<any>;
}
interface ContextConstraints {
    maxTokens?: number;
    minConfidence?: number;
    timeConstraint?: 'relaxed' | 'normal' | 'urgent';
    compressionLevel?: 0 | 1 | 2 | 3;
    focusArea?: string;
    maxTriads?: number;
    maxInsights?: number;
    maxPatterns?: number;
    maxDecisions?: number;
    maxPeerOutcomes?: number;
    maxLessons?: number;
    maxRisks?: number;
}
//# sourceMappingURL=dynamic-knowledge-generator.d.ts.map
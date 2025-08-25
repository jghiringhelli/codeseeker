// Dynamic Knowledge Context Generation Per Role

import { EventEmitter } from 'events';
import { Logger } from '../shared/logger';
import { RoleType, WorkflowExecution } from './types';

export { RoleType, Action, Warning, Pattern, QualityCheck };
import { RoleKnowledgeContext, KnowledgePacket } from './role-knowledge-integrator';
import { KnowledgeFlowStep, KnowledgeFlowMapper } from './knowledge-flow-mapper';
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
  // Core knowledge adapted to role needs
  essentials: {
    triads: any[];
    insights: string[];
    patterns: string[];
    decisions: string[];
  };
  
  // Contextual knowledge
  contextual: {
    projectStatus: any;
    peerOutcomes: any[];
    historicalLessons: string[];
    riskFactors: string[];
  };
  
  // Actionable knowledge
  actionable: {
    recommendedActions: Action[];
    warningSignals: Warning[];
    successPatterns: Pattern[];
    qualityChecks: QualityCheck[];
  };
  
  // Learning knowledge
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

export class DynamicKnowledgeGenerator extends EventEmitter {
  private logger: Logger;
  private knowledgeGraph: SemanticKnowledgeGraph;
  private knowledgeRepo: KnowledgeRepository;
  private projectKB: ProjectManagementKB;
  private roleSpecializations: Map<RoleType, RoleSpecialization> = new Map();
  private contextCache: Map<string, DynamicContext> = new Map();
  private adaptationRules: Map<RoleType, AdaptationRule[]> = new Map();

  constructor(
    logger: Logger,
    knowledgeGraph: SemanticKnowledgeGraph,
    knowledgeRepo: KnowledgeRepository,
    projectKB: ProjectManagementKB
  ) {
    super();
    this.logger = logger;
    this.knowledgeGraph = knowledgeGraph;
    this.knowledgeRepo = knowledgeRepo;
    this.projectKB = projectKB;
    this?.initializeRoleSpecializations();
    this?.initializeAdaptationRules();
  }

  async generateDynamicContext(
    roleType: RoleType,
    step: string,
    baseContext: RoleKnowledgeContext,
    constraints: ContextConstraints
  ): Promise<DynamicContext> {
    const cacheKey = `${roleType}-${step}-${JSON.stringify(constraints)}`;
    
    // Check cache first
    if (this.contextCache?.has(cacheKey) && !this?.shouldRegenerate(cacheKey, constraints)) {
      this.logger.info(`Using cached dynamic context for ${roleType}-${step}`);
      return this.contextCache?.get(cacheKey)!;
    }

    this.logger.info(`Generating dynamic context for ${roleType} in step: ${step}`);
    
    // Get role specialization
    const specialization = this.roleSpecializations?.get(roleType)!;
    
    // Adapt content based on role needs and constraints
    const adaptedContent = await this?.adaptContentForRole(
      baseContext.knowledgePacket,
      roleType,
      step,
      constraints,
      specialization
    );

    // Generate reasoning for the adaptation
    const reasoning = this?.generateAdaptationReasoning(
      roleType,
      adaptedContent,
      constraints
    );

    // Calculate confidence and compression metrics
    const confidenceScore = this?.calculateContextConfidence(adaptedContent, baseContext);
    const compressionRatio = this?.calculateCompressionRatio(baseContext, adaptedContent);
    const tokenUsage = this?.estimateTokenUsage(adaptedContent);

    // Define regeneration triggers
    const regenerationTriggers = this?.defineRegenerationTriggers(roleType, constraints);

    const dynamicContext: DynamicContext = {
      roleType,
      step,
      adaptedContent,
      reasoning,
      confidenceScore,
      compressionRatio,
      tokenUsage,
      regenerationTriggers
    };

    // Cache the context
    this.contextCache?.set(cacheKey, dynamicContext);
    
    this?.emit('dynamic-context-generated', {
      roleType,
      step,
      confidenceScore,
      tokenUsage,
      compressionRatio
    });

    return dynamicContext;
  }

  private async adaptContentForRole(
    knowledgePacket: KnowledgePacket,
    roleType: RoleType,
    step: string,
    constraints: ContextConstraints,
    specialization: RoleSpecialization
  ): Promise<AdaptedContent> {
    // Get adaptation rules for this role
    const rules = this.adaptationRules?.get(roleType) || [];
    
    // Extract essentials based on role focus
    const essentials = await this?.extractRoleEssentials(
      knowledgePacket,
      specialization,
      constraints
    );

    // Generate contextual information
    const contextual = await this?.generateContextualInfo(
      knowledgePacket,
      roleType,
      constraints
    );

    // Create actionable recommendations
    const actionable = await this?.generateActionableKnowledge(
      knowledgePacket,
      roleType,
      step,
      specialization
    );

    // Extract learning opportunities
    const learning = await this?.extractLearningOpportunities(
      knowledgePacket,
      roleType,
      specialization
    );

    // Apply adaptation rules
    return this?.applyAdaptationRules({
      essentials,
      contextual,
      actionable,
      learning
    }, rules, constraints);
  }

  private async extractRoleEssentials(
    packet: KnowledgePacket,
    specialization: RoleSpecialization,
    constraints: ContextConstraints
  ): Promise<any> {
    const essentials = {
      triads: [],
      insights: [],
      patterns: [],
      decisions: []
    };

    // Filter triads based on role focus
    essentials.triads = packet.triads.relevant?.filter(triad =>
      specialization.focusAreas?.some(area => 
        triad.predicate?.includes(area?.toUpperCase())
      )
    ).slice(0, constraints.maxTriads || 10);

    // Extract key insights from RAG context
    if (packet.ragContext.synthesizedKnowledge) {
      const sentences = packet.ragContext.synthesizedKnowledge?.split(/[.!?]+/);
      essentials.insights = sentences
        .filter(sentence => sentence?.length > 20)
        .filter(sentence => 
          specialization.keywords?.some(keyword =>
            sentence?.toLowerCase().includes(keyword?.toLowerCase())
          )
        )
        .slice(0, constraints.maxInsights || 5);
    }

    // Extract relevant patterns
    essentials.patterns = packet.triads.patterns
      .filter(pattern => 
        specialization.relevantPatterns?.includes(pattern.name) ||
        specialization.focusAreas?.some(area => 
          pattern.name?.toLowerCase().includes(area?.toLowerCase())
        )
      )
      .slice(0, constraints.maxPatterns || 3);

    // Extract relevant decisions from peer outcomes
    essentials.decisions = packet.peers.completedRoles
      .flatMap((outcome: any) => outcome.decisions || [])
      .filter((decision: any) => 
        specialization.decisionTypes?.some(type =>
          decision.description?.toLowerCase().includes(type?.toLowerCase())
        )
      )
      .slice(0, constraints.maxDecisions || 5);

    return essentials;
  }

  private async generateContextualInfo(
    packet: KnowledgePacket,
    roleType: RoleType,
    constraints: ContextConstraints
  ): Promise<any> {
    const contextual = {
      projectStatus: {},
      peerOutcomes: [],
      historicalLessons: [],
      riskFactors: []
    };

    // Summarize relevant project status
    contextual.projectStatus = {
      phase: packet.project.currentPhase?.name || 'Unknown',
      progress: packet.project.currentPhase?.progress || 0,
      objectives: packet.project.objectives?.slice(0, 3),
      constraints: packet.project.constraints?.slice(0, 3)
    };

    // Filter peer outcomes to most relevant
    contextual.peerOutcomes = packet.peers.completedRoles
      .filter((outcome: any) => this?.isPeerOutcomeRelevant(outcome, roleType))
      .slice(0, constraints.maxPeerOutcomes || 3);

    // Extract actionable historical lessons
    contextual.historicalLessons = packet.historical.bestPractices
      .filter(practice => practice?.length > 10)
      .slice(0, constraints.maxLessons || 5);

    // Identify relevant risk factors
    contextual.riskFactors = packet.project.riskFactors
      .filter((risk: any) => this?.isRiskRelevant(risk, roleType))
      .slice(0, constraints.maxRisks || 3);

    return contextual;
  }

  private async generateActionableKnowledge(
    packet: KnowledgePacket,
    roleType: RoleType,
    step: string,
    specialization: RoleSpecialization
  ): Promise<any> {
    const actionable = {
      recommendedActions: [],
      warningSignals: [],
      successPatterns: [],
      qualityChecks: []
    };

    // Generate role-specific recommended actions
    actionable.recommendedActions = await this?.generateRecommendedActions(
      packet,
      roleType,
      specialization
    );

    // Identify warning signals based on historical data
    actionable.warningSignals = await this?.identifyWarningSignals(
      packet,
      roleType,
      specialization
    );

    // Extract success patterns from historical data
    actionable.successPatterns = await this?.extractSuccessPatterns(
      packet,
      roleType,
      specialization
    );

    // Define quality checks for this role and step
    actionable.qualityChecks = await this?.defineQualityChecks(
      roleType,
      step,
      specialization
    );

    return actionable;
  }

  private async extractLearningOpportunities(
    packet: KnowledgePacket,
    roleType: RoleType,
    specialization: RoleSpecialization
  ): Promise<any> {
    const learning = {
      similarSituations: [],
      expertAdvice: [],
      emergingTrends: [],
      antiPatterns: []
    };

    // Find similar situations from historical data
    learning.similarSituations = await this?.findSimilarSituations(
      packet,
      roleType,
      specialization
    );

    // Extract expert advice from knowledge repository
    learning.expertAdvice = packet.domain.expertAdvice
      .filter(advice => 
        specialization.keywords?.some(keyword =>
          advice?.toLowerCase().includes(keyword?.toLowerCase())
        )
      )
      .slice(0, 3);

    // Identify emerging trends
    learning.emergingTrends = packet.domain.emergingTrends
      .filter(trend => 
        specialization.focusAreas?.some(area =>
          trend?.toLowerCase().includes(area?.toLowerCase())
        )
      )
      .slice(0, 2);

    // Extract relevant anti-patterns
    learning.antiPatterns = packet.historical.antiPatterns
      .filter(pattern => 
        specialization.keywords?.some(keyword =>
          pattern?.toLowerCase().includes(keyword?.toLowerCase())
        )
      )
      .slice(0, 3);

    return learning;
  }

  private async generateRecommendedActions(
    packet: KnowledgePacket,
    roleType: RoleType,
    specialization: RoleSpecialization
  ): Promise<Action[]> {
    const actions: Action[] = [];

    switch (roleType) {
      case RoleType.REQUIREMENT_ANALYST:
        actions?.push({
          description: 'Review existing system architecture before defining new requirements',
          priority: 'high',
          effort: 'moderate',
          confidence: 0.9,
          dependencies: ['architecture-documentation'],
          expectedOutcome: 'Requirements aligned with existing architecture'
        });
        break;

      case RoleType.TEST_DESIGNER:
        actions?.push({
          description: 'Create test cases for edge cases identified in similar features',
          priority: 'high',
          effort: 'moderate',
          confidence: 0.85,
          dependencies: ['requirement-analysis'],
          expectedOutcome: 'Comprehensive test coverage including edge cases'
        });
        break;

      case RoleType.IMPLEMENTATION_DEVELOPER:
        actions?.push({
          description: 'Follow established architectural patterns for consistency',
          priority: 'high',
          effort: 'minimal',
          confidence: 0.95,
          dependencies: ['architecture-patterns'],
          expectedOutcome: 'Code consistent with existing architecture'
        });
        break;

      case RoleType.SECURITY_AUDITOR:
        actions?.push({
          description: 'Verify input validation for all user-facing interfaces',
          priority: 'immediate',
          effort: 'moderate',
          confidence: 0.95,
          dependencies: ['code-implementation'],
          expectedOutcome: 'All inputs properly validated against injection attacks'
        });
        break;

      default:
        actions?.push({
          description: `Apply ${roleType} best practices from knowledge base`,
          priority: 'medium',
          effort: 'moderate',
          confidence: 0.8,
          dependencies: ['knowledge-base'],
          expectedOutcome: 'Task completed following best practices'
        });
    }

    return actions;
  }

  private async identifyWarningSignals(
    packet: KnowledgePacket,
    roleType: RoleType,
    specialization: RoleSpecialization
  ): Promise<Warning[]> {
    const warnings: Warning[] = [];

    // Analyze historical failures to identify warning patterns
    packet.historical.antiPatterns?.forEach(pattern => {
      if (specialization.keywords?.some(keyword => 
        pattern?.toLowerCase().includes(keyword?.toLowerCase())
      )) {
        warnings?.push({
          type: 'quality',
          description: `Historical issue pattern detected: ${pattern}`,
          severity: 'medium',
          indicators: ['Similar context to past failures'],
          mitigationActions: ['Review historical solutions', 'Apply preventive measures']
        });
      }
    });

    // Check for resource constraints
    if (packet.project.constraints?.some((c: any) => c?.type === 'timeline')) {
      warnings?.push({
        type: 'timeline',
        description: 'Timeline constraints may impact quality',
        severity: 'high',
        indicators: ['Tight deadlines', 'Resource limitations'],
        mitigationActions: ['Prioritize critical features', 'Consider scope reduction']
      });
    }

    return warnings;
  }

  private async extractSuccessPatterns(
    packet: KnowledgePacket,
    roleType: RoleType,
    specialization: RoleSpecialization
  ): Promise<Pattern[]> {
    const patterns: Pattern[] = [];

    // Extract patterns from successful outcomes
    packet.historical.bestPractices?.forEach(practice => {
      patterns?.push({
        name: `Best Practice Pattern`,
        description: practice,
        applicability: [roleType],
        successRate: 0.85,
        preconditions: ['Proper planning', 'Resource availability'],
        implementation: ['Follow established process', 'Monitor progress']
      });
    });

    return patterns?.slice(0, 3);
  }

  private async defineQualityChecks(
    roleType: RoleType,
    step: string,
    specialization: RoleSpecialization
  ): Promise<QualityCheck[]> {
    const checks: QualityCheck[] = [];

    switch (roleType) {
      case RoleType.IMPLEMENTATION_DEVELOPER:
        checks?.push({
          name: 'Code Quality Check',
          description: 'Verify code meets quality standards',
          criteria: ['No code smells', 'Proper error handling', 'Adequate comments'],
          automatable: true,
          frequency: 'continuous'
        });
        break;

      case RoleType.SECURITY_AUDITOR:
        checks?.push({
          name: 'Security Vulnerability Check',
          description: 'Scan for common security vulnerabilities',
          criteria: ['No SQL injection', 'Proper authentication', 'Secure data handling'],
          automatable: true,
          frequency: 'step'
        });
        break;

      default:
        checks?.push({
          name: 'General Quality Check',
          description: 'Ensure output meets basic quality standards',
          criteria: ['Complete deliverable', 'Meets requirements', 'Proper documentation'],
          automatable: false,
          frequency: 'step'
        });
    }

    return checks;
  }

  private applyAdaptationRules(
    content: AdaptedContent,
    rules: AdaptationRule[],
    constraints: ContextConstraints
  ): AdaptedContent {
    let adaptedContent = { ...content };

    rules?.forEach(rule => {
      if (this?.evaluateRuleCondition(rule.condition, content, constraints)) {
        adaptedContent = rule?.transformation(adaptedContent);
      }
    });

    return adaptedContent;
  }

  private initializeRoleSpecializations(): void {
    // Define specializations for each role
    this.roleSpecializations?.set(RoleType.REQUIREMENT_ANALYST, {
      focusAreas: ['requirements', 'stakeholder', 'business', 'functional'],
      keywords: ['requirement', 'stakeholder', 'business rule', 'acceptance criteria', 'user story'],
      relevantPatterns: ['Repository', 'Service Layer', 'MVC'],
      decisionTypes: ['requirement', 'scope', 'priority', 'acceptance'],
      qualityMetrics: ['completeness', 'clarity', 'testability', 'consistency'],
      timeHorizon: 'short',
      riskTolerance: 'low'
    });

    this.roleSpecializations?.set(RoleType.TEST_DESIGNER, {
      focusAreas: ['testing', 'quality', 'validation', 'coverage'],
      keywords: ['test', 'coverage', 'validation', 'quality', 'TDD', 'BDD'],
      relevantPatterns: ['Factory', 'Builder', 'Mock', 'Stub'],
      decisionTypes: ['test strategy', 'coverage', 'automation', 'framework'],
      qualityMetrics: ['coverage', 'effectiveness', 'maintainability', 'execution time'],
      timeHorizon: 'medium',
      riskTolerance: 'low'
    });

    this.roleSpecializations?.set(RoleType.IMPLEMENTATION_DEVELOPER, {
      focusAreas: ['implementation', 'architecture', 'coding', 'design'],
      keywords: ['code', 'implementation', 'architecture', 'design pattern', 'algorithm'],
      relevantPatterns: ['All patterns'],
      decisionTypes: ['architecture', 'implementation', 'technology', 'design'],
      qualityMetrics: ['correctness', 'maintainability', 'performance', 'readability'],
      timeHorizon: 'medium',
      riskTolerance: 'medium'
    });

    this.roleSpecializations?.set(RoleType.SECURITY_AUDITOR, {
      focusAreas: ['security', 'vulnerability', 'compliance', 'risk'],
      keywords: ['security', 'vulnerability', 'authentication', 'authorization', 'encryption'],
      relevantPatterns: ['Authentication', 'Authorization', 'Encryption'],
      decisionTypes: ['security', 'risk', 'compliance', 'mitigation'],
      qualityMetrics: ['security score', 'vulnerability count', 'compliance level'],
      timeHorizon: 'long',
      riskTolerance: 'very low'
    });

    // Add more role specializations...
  }

  private initializeAdaptationRules(): void {
    // Define adaptation rules for each role
    const requirementRules: AdaptationRule[] = [
      {
        condition: 'high_complexity',
        transformation: (content) => ({
          ...content,
          actionable: {
            ...content.actionable,
            recommendedActions: [
              ...content.actionable.recommendedActions,
              {
                description: 'Break down complex requirements into smaller, manageable pieces',
                priority: 'high',
                effort: 'moderate',
                confidence: 0.9,
                dependencies: [],
                expectedOutcome: 'More manageable requirement set'
              } as Action
            ]
          }
        })
      }
    ];

    this.adaptationRules?.set(RoleType.REQUIREMENT_ANALYST, requirementRules);

    // Add rules for other roles...
  }

  // Helper methods
  private shouldRegenerate(cacheKey: string, constraints: ContextConstraints): boolean {
    const context = this.contextCache?.get(cacheKey);
    if (!context) return true;

    return context.regenerationTriggers?.some(trigger => 
      this?.evaluateTrigger(trigger, constraints)
    );
  }

  private evaluateTrigger(trigger: RegenerationTrigger, constraints: ContextConstraints): boolean {
    // Simplified trigger evaluation
    switch (trigger.condition) {
      case 'token_limit_approaching':
        return constraints.maxTokens && constraints.maxTokens < trigger.threshold;
      case 'confidence_too_low':
        return constraints.minConfidence && constraints.minConfidence > trigger.threshold;
      default:
        return false;
    }
  }

  private calculateContextConfidence(content: AdaptedContent, baseContext: RoleKnowledgeContext): number {
    // Calculate confidence based on knowledge completeness and relevance
    const triadsScore = Math.min(1, content.essentials.triads?.length / 10);
    const insightsScore = Math.min(1, content.essentials.insights?.length / 5);
    const ragScore = baseContext.knowledgePacket.ragContext.confidence;
    
    return (triadsScore * 0.3 + insightsScore * 0.3 + ragScore * 0.4);
  }

  private calculateCompressionRatio(baseContext: RoleKnowledgeContext, content: AdaptedContent): number {
    const originalSize = JSON.stringify(baseContext.knowledgePacket).length;
    const compressedSize = JSON.stringify(content).length;
    
    return compressedSize / originalSize;
  }

  private estimateTokenUsage(content: AdaptedContent): number {
    const contentString = JSON.stringify(content);
    return Math.ceil(contentString?.length / 4); // Rough token estimation
  }

  private defineRegenerationTriggers(roleType: RoleType, constraints: ContextConstraints): RegenerationTrigger[] {
    return [
      {
        condition: 'token_limit_approaching',
        threshold: constraints.maxTokens ? constraints?.maxTokens * 0.9 : 8000,
        action: 'compress'
      },
      {
        condition: 'confidence_too_low',
        threshold: 0.7,
        action: 'refresh'
      },
      {
        condition: 'context_stale',
        threshold: 30 * 60 * 1000, // 30 minutes
        action: 'refresh'
      }
    ];
  }

  private generateAdaptationReasoning(
    roleType: RoleType,
    content: AdaptedContent,
    constraints: ContextConstraints
  ): string[] {
    const reasoning = [];
    
    reasoning?.push(`Adapted context for ${roleType} based on role specialization`);
    reasoning?.push(`Selected ${content.essentials.triads?.length} most relevant code relationships`);
    reasoning?.push(`Included ${content.actionable.recommendedActions?.length} actionable recommendations`);
    
    if (constraints.maxTokens) {
      reasoning?.push(`Compressed content to fit ${constraints.maxTokens} token limit`);
    }
    
    return reasoning;
  }

  private isPeerOutcomeRelevant(outcome: any, roleType: RoleType): boolean {
    const relevantRoles = this?.getRelevantRoles(roleType);
    return relevantRoles?.includes(outcome.roleType);
  }

  private isRiskRelevant(risk: any, roleType: RoleType): boolean {
    const specialization = this.roleSpecializations?.get(roleType);
    if (!specialization) return true;
    
    return specialization.focusAreas?.some(area =>
      risk.description?.toLowerCase().includes(area?.toLowerCase())
    );
  }

  private getRelevantRoles(roleType: RoleType): RoleType[] {
    const relevanceMap: Record<RoleType, RoleType[]> = {
      [RoleType.TEST_DESIGNER]: [RoleType.REQUIREMENT_ANALYST],
      [RoleType.IMPLEMENTATION_DEVELOPER]: [RoleType.REQUIREMENT_ANALYST, RoleType.TEST_DESIGNER],
      [RoleType.SECURITY_AUDITOR]: [RoleType.IMPLEMENTATION_DEVELOPER],
      // Add more mappings...
    };
    
    return relevanceMap[roleType] || [];
  }

  private async findSimilarSituations(
    packet: KnowledgePacket,
    roleType: RoleType,
    specialization: RoleSpecialization
  ): Promise<Situation[]> {
    const situations: Situation[] = [];
    
    // Extract situations from historical data
    packet.historical.previousOutcomes?.forEach((outcome: any) => {
      if (outcome?.roleType === roleType && outcome.success) {
        situations?.push({
          description: `Successful ${roleType} execution`,
          context: outcome.inputs?.context || 'Similar context',
          outcome: 'success',
          keyFactors: outcome.insights?.map((i: any) => i.description) || [],
          lessons: outcome.learnings?.map((l: any) => l.lesson) || [],
          similarity: 0.8
        });
      }
    });
    
    return situations?.slice(0, 3);
  }

  private evaluateRuleCondition(
    condition: string,
    content: AdaptedContent,
    constraints: ContextConstraints
  ): boolean {
    switch (condition) {
      case 'high_complexity':
        return content.contextual.projectStatus.progress > 0.7;
      case 'tight_timeline':
        return constraints?.timeConstraint === 'urgent';
      default:
        return false;
    }
  }

  // Public API
  async refreshContext(cacheKey: string): Promise<void> {
    this.contextCache?.delete(cacheKey);
  }

  async getContextStatistics(): Promise<any> {
    return {
      totalCachedContexts: this.contextCache.size,
      roleSpecializations: this.roleSpecializations.size,
      adaptationRules: Array.from(this.adaptationRules?.values()).flat().length
    };
  }
}

// Supporting interfaces
interface RoleSpecialization {
  focusAreas: string[];
  keywords: string[];
  relevantPatterns: string[];
  decisionTypes: string[];
  qualityMetrics: string[];
  timeHorizon: 'short' | 'medium' | 'long';
  riskTolerance: 'very low' | 'low' | 'medium' | 'high';
}

interface AdaptationRule {
  condition: string;
  transformation: (content: AdaptedContent) => AdaptedContent;
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
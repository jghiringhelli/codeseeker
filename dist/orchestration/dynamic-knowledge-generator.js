"use strict";
// ⚠️ DEPRECATED: Legacy Dynamic Knowledge Context Generation Per Role
// This file is part of the legacy parallel orchestration system.
// This file will be removed in a future version.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DynamicKnowledgeGenerator = exports.RoleType = void 0;
const events_1 = require("events");
const types_1 = require("./types");
Object.defineProperty(exports, "RoleType", { enumerable: true, get: function () { return types_1.RoleType; } });
class DynamicKnowledgeGenerator extends events_1.EventEmitter {
    logger;
    knowledgeGraph;
    knowledgeRepo;
    projectKB;
    roleSpecializations = new Map();
    contextCache = new Map();
    adaptationRules = new Map();
    constructor(logger, knowledgeGraph, knowledgeRepo, projectKB) {
        super();
        this.logger = logger;
        this.knowledgeGraph = knowledgeGraph;
        this.knowledgeRepo = knowledgeRepo;
        this.projectKB = projectKB;
        this?.initializeRoleSpecializations();
        this?.initializeAdaptationRules();
    }
    async generateDynamicContext(roleType, step, baseContext, constraints) {
        const cacheKey = `${roleType}-${step}-${JSON.stringify(constraints)}`;
        // Check cache first
        if (this.contextCache?.has(cacheKey) && !this?.shouldRegenerate(cacheKey, constraints)) {
            this.logger.info(`Using cached dynamic context for ${roleType}-${step}`);
            return this.contextCache?.get(cacheKey);
        }
        this.logger.info(`Generating dynamic context for ${roleType} in step: ${step}`);
        // Get role specialization
        const specialization = this.roleSpecializations?.get(roleType);
        // Adapt content based on role needs and constraints
        const adaptedContent = await this?.adaptContentForRole(baseContext.knowledgePacket, roleType, step, constraints, specialization);
        // Generate reasoning for the adaptation
        const reasoning = this?.generateAdaptationReasoning(roleType, adaptedContent, constraints);
        // Calculate confidence and compression metrics
        const confidenceScore = this?.calculateContextConfidence(adaptedContent, baseContext);
        const compressionRatio = this?.calculateCompressionRatio(baseContext, adaptedContent);
        const tokenUsage = this?.estimateTokenUsage(adaptedContent);
        // Define regeneration triggers
        const regenerationTriggers = this?.defineRegenerationTriggers(roleType, constraints);
        const dynamicContext = {
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
    async adaptContentForRole(knowledgePacket, roleType, step, constraints, specialization) {
        // Get adaptation rules for this role
        const rules = this.adaptationRules?.get(roleType) || [];
        // Extract essentials based on role focus
        const essentials = await this?.extractRoleEssentials(knowledgePacket, specialization, constraints);
        // Generate contextual information
        const contextual = await this?.generateContextualInfo(knowledgePacket, roleType, constraints);
        // Create actionable recommendations
        const actionable = await this?.generateActionableKnowledge(knowledgePacket, roleType, step, specialization);
        // Extract learning opportunities
        const learning = await this?.extractLearningOpportunities(knowledgePacket, roleType, specialization);
        // Apply adaptation rules
        return this?.applyAdaptationRules({
            essentials,
            contextual,
            actionable,
            learning
        }, rules, constraints);
    }
    async extractRoleEssentials(packet, specialization, constraints) {
        const essentials = {
            triads: [],
            insights: [],
            patterns: [],
            decisions: []
        };
        // Filter triads based on role focus
        essentials.triads = packet.triads.relevant?.filter(triad => specialization.focusAreas?.some(area => triad.predicate?.includes(area?.toUpperCase()))).slice(0, constraints.maxTriads || 10);
        // Extract key insights from RAG context
        if (packet.ragContext.synthesizedKnowledge) {
            const sentences = packet.ragContext.synthesizedKnowledge?.split(/[.!?]+/);
            essentials.insights = sentences
                .filter(sentence => sentence?.length > 20)
                .filter(sentence => specialization.keywords?.some(keyword => sentence?.toLowerCase().includes(keyword?.toLowerCase())))
                .slice(0, constraints.maxInsights || 5);
        }
        // Extract relevant patterns
        essentials.patterns = packet.triads.patterns
            .filter(pattern => specialization.relevantPatterns?.includes(pattern.name) ||
            specialization.focusAreas?.some(area => pattern.name?.toLowerCase().includes(area?.toLowerCase())))
            .slice(0, constraints.maxPatterns || 3);
        // Extract relevant decisions from peer outcomes
        essentials.decisions = packet.peers.completedRoles
            .flatMap((outcome) => outcome.decisions || [])
            .filter((decision) => specialization.decisionTypes?.some(type => decision.description?.toLowerCase().includes(type?.toLowerCase())))
            .slice(0, constraints.maxDecisions || 5);
        return essentials;
    }
    async generateContextualInfo(packet, roleType, constraints) {
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
            .filter((outcome) => this?.isPeerOutcomeRelevant(outcome, roleType))
            .slice(0, constraints.maxPeerOutcomes || 3);
        // Extract actionable historical lessons
        contextual.historicalLessons = packet.historical.bestPractices
            .filter(practice => practice?.length > 10)
            .slice(0, constraints.maxLessons || 5);
        // Identify relevant risk factors
        contextual.riskFactors = packet.project.riskFactors
            .filter((risk) => this?.isRiskRelevant(risk, roleType))
            .slice(0, constraints.maxRisks || 3);
        return contextual;
    }
    async generateActionableKnowledge(packet, roleType, step, specialization) {
        const actionable = {
            recommendedActions: [],
            warningSignals: [],
            successPatterns: [],
            qualityChecks: []
        };
        // Generate role-specific recommended actions
        actionable.recommendedActions = await this?.generateRecommendedActions(packet, roleType, specialization);
        // Identify warning signals based on historical data
        actionable.warningSignals = await this?.identifyWarningSignals(packet, roleType, specialization);
        // Extract success patterns from historical data
        actionable.successPatterns = await this?.extractSuccessPatterns(packet, roleType, specialization);
        // Define quality checks for this role and step
        actionable.qualityChecks = await this?.defineQualityChecks(roleType, step, specialization);
        return actionable;
    }
    async extractLearningOpportunities(packet, roleType, specialization) {
        const learning = {
            similarSituations: [],
            expertAdvice: [],
            emergingTrends: [],
            antiPatterns: []
        };
        // Find similar situations from historical data
        learning.similarSituations = await this?.findSimilarSituations(packet, roleType, specialization);
        // Extract expert advice from knowledge repository
        learning.expertAdvice = packet.domain.expertAdvice
            .filter(advice => specialization.keywords?.some(keyword => advice?.toLowerCase().includes(keyword?.toLowerCase())))
            .slice(0, 3);
        // Identify emerging trends
        learning.emergingTrends = packet.domain.emergingTrends
            .filter(trend => specialization.focusAreas?.some(area => trend?.toLowerCase().includes(area?.toLowerCase())))
            .slice(0, 2);
        // Extract relevant anti-patterns
        learning.antiPatterns = packet.historical.antiPatterns
            .filter(pattern => specialization.keywords?.some(keyword => pattern?.toLowerCase().includes(keyword?.toLowerCase())))
            .slice(0, 3);
        return learning;
    }
    async generateRecommendedActions(packet, roleType, specialization) {
        const actions = [];
        switch (roleType) {
            case types_1.RoleType.REQUIREMENT_ANALYST:
                actions?.push({
                    description: 'Review existing system architecture before defining new requirements',
                    priority: 'high',
                    effort: 'moderate',
                    confidence: 0.9,
                    dependencies: ['architecture-documentation'],
                    expectedOutcome: 'Requirements aligned with existing architecture'
                });
                break;
            case types_1.RoleType.TEST_DESIGNER:
                actions?.push({
                    description: 'Create test cases for edge cases identified in similar features',
                    priority: 'high',
                    effort: 'moderate',
                    confidence: 0.85,
                    dependencies: ['requirement-analysis'],
                    expectedOutcome: 'Comprehensive test coverage including edge cases'
                });
                break;
            case types_1.RoleType.IMPLEMENTATION_DEVELOPER:
                actions?.push({
                    description: 'Follow established architectural patterns for consistency',
                    priority: 'high',
                    effort: 'minimal',
                    confidence: 0.95,
                    dependencies: ['architecture-patterns'],
                    expectedOutcome: 'Code consistent with existing architecture'
                });
                break;
            case types_1.RoleType.SECURITY_AUDITOR:
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
    async identifyWarningSignals(packet, roleType, specialization) {
        const warnings = [];
        // Analyze historical failures to identify warning patterns
        packet.historical.antiPatterns?.forEach(pattern => {
            if (specialization.keywords?.some(keyword => pattern?.toLowerCase().includes(keyword?.toLowerCase()))) {
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
        if (packet.project.constraints?.some((c) => c?.type === 'timeline')) {
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
    async extractSuccessPatterns(packet, roleType, specialization) {
        const patterns = [];
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
    async defineQualityChecks(roleType, step, specialization) {
        const checks = [];
        switch (roleType) {
            case types_1.RoleType.IMPLEMENTATION_DEVELOPER:
                checks?.push({
                    name: 'Code Quality Check',
                    description: 'Verify code meets quality standards',
                    criteria: ['No code smells', 'Proper error handling', 'Adequate comments'],
                    automatable: true,
                    frequency: 'continuous'
                });
                break;
            case types_1.RoleType.SECURITY_AUDITOR:
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
    applyAdaptationRules(content, rules, constraints) {
        let adaptedContent = { ...content };
        rules?.forEach(rule => {
            if (this?.evaluateRuleCondition(rule.condition, content, constraints)) {
                adaptedContent = rule?.transformation(adaptedContent);
            }
        });
        return adaptedContent;
    }
    initializeRoleSpecializations() {
        // Define specializations for each role
        this.roleSpecializations?.set(types_1.RoleType.REQUIREMENT_ANALYST, {
            focusAreas: ['requirements', 'stakeholder', 'business', 'functional'],
            keywords: ['requirement', 'stakeholder', 'business rule', 'acceptance criteria', 'user story'],
            relevantPatterns: ['Repository', 'Service Layer', 'MVC'],
            decisionTypes: ['requirement', 'scope', 'priority', 'acceptance'],
            qualityMetrics: ['completeness', 'clarity', 'testability', 'consistency'],
            timeHorizon: 'short',
            riskTolerance: 'low'
        });
        this.roleSpecializations?.set(types_1.RoleType.TEST_DESIGNER, {
            focusAreas: ['testing', 'quality', 'validation', 'coverage'],
            keywords: ['test', 'coverage', 'validation', 'quality', 'TDD', 'BDD'],
            relevantPatterns: ['Factory', 'Builder', 'Mock', 'Stub'],
            decisionTypes: ['test strategy', 'coverage', 'automation', 'framework'],
            qualityMetrics: ['coverage', 'effectiveness', 'maintainability', 'execution time'],
            timeHorizon: 'medium',
            riskTolerance: 'low'
        });
        this.roleSpecializations?.set(types_1.RoleType.IMPLEMENTATION_DEVELOPER, {
            focusAreas: ['implementation', 'architecture', 'coding', 'design'],
            keywords: ['code', 'implementation', 'architecture', 'design pattern', 'algorithm'],
            relevantPatterns: ['All patterns'],
            decisionTypes: ['architecture', 'implementation', 'technology', 'design'],
            qualityMetrics: ['correctness', 'maintainability', 'performance', 'readability'],
            timeHorizon: 'medium',
            riskTolerance: 'medium'
        });
        this.roleSpecializations?.set(types_1.RoleType.SECURITY_AUDITOR, {
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
    initializeAdaptationRules() {
        // Define adaptation rules for each role
        const requirementRules = [
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
                            }
                        ]
                    }
                })
            }
        ];
        this.adaptationRules?.set(types_1.RoleType.REQUIREMENT_ANALYST, requirementRules);
        // Add rules for other roles...
    }
    // Helper methods
    shouldRegenerate(cacheKey, constraints) {
        const context = this.contextCache?.get(cacheKey);
        if (!context)
            return true;
        return context.regenerationTriggers?.some(trigger => this?.evaluateTrigger(trigger, constraints));
    }
    evaluateTrigger(trigger, constraints) {
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
    calculateContextConfidence(content, baseContext) {
        // Calculate confidence based on knowledge completeness and relevance
        const triadsScore = Math.min(1, content.essentials.triads?.length / 10);
        const insightsScore = Math.min(1, content.essentials.insights?.length / 5);
        const ragScore = baseContext.knowledgePacket.ragContext.confidence;
        return (triadsScore * 0.3 + insightsScore * 0.3 + ragScore * 0.4);
    }
    calculateCompressionRatio(baseContext, content) {
        const originalSize = JSON.stringify(baseContext.knowledgePacket).length;
        const compressedSize = JSON.stringify(content).length;
        return compressedSize / originalSize;
    }
    estimateTokenUsage(content) {
        const contentString = JSON.stringify(content);
        return Math.ceil(contentString?.length / 4); // Rough token estimation
    }
    defineRegenerationTriggers(roleType, constraints) {
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
    generateAdaptationReasoning(roleType, content, constraints) {
        const reasoning = [];
        reasoning?.push(`Adapted context for ${roleType} based on role specialization`);
        reasoning?.push(`Selected ${content.essentials.triads?.length} most relevant code relationships`);
        reasoning?.push(`Included ${content.actionable.recommendedActions?.length} actionable recommendations`);
        if (constraints.maxTokens) {
            reasoning?.push(`Compressed content to fit ${constraints.maxTokens} token limit`);
        }
        return reasoning;
    }
    isPeerOutcomeRelevant(outcome, roleType) {
        const relevantRoles = this?.getRelevantRoles(roleType);
        return relevantRoles?.includes(outcome.roleType);
    }
    isRiskRelevant(risk, roleType) {
        const specialization = this.roleSpecializations?.get(roleType);
        if (!specialization)
            return true;
        return specialization.focusAreas?.some(area => risk.description?.toLowerCase().includes(area?.toLowerCase()));
    }
    getRelevantRoles(roleType) {
        const relevanceMap = {
            [types_1.RoleType.TEST_DESIGNER]: [types_1.RoleType.REQUIREMENT_ANALYST],
            [types_1.RoleType.IMPLEMENTATION_DEVELOPER]: [types_1.RoleType.REQUIREMENT_ANALYST, types_1.RoleType.TEST_DESIGNER],
            [types_1.RoleType.SECURITY_AUDITOR]: [types_1.RoleType.IMPLEMENTATION_DEVELOPER],
            // Add more mappings as needed...
        };
        return relevanceMap[roleType] || [];
    }
    async findSimilarSituations(packet, roleType, specialization) {
        const situations = [];
        // Extract situations from historical data
        packet.historical.previousOutcomes?.forEach((outcome) => {
            if (outcome?.roleType === roleType && outcome.success) {
                situations?.push({
                    description: `Successful ${roleType} execution`,
                    context: outcome.inputs?.context || 'Similar context',
                    outcome: 'success',
                    keyFactors: outcome.insights?.map((i) => i.description) || [],
                    lessons: outcome.learnings?.map((l) => l.lesson) || [],
                    similarity: 0.8
                });
            }
        });
        return situations?.slice(0, 3);
    }
    evaluateRuleCondition(condition, content, constraints) {
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
    async refreshContext(cacheKey) {
        this.contextCache?.delete(cacheKey);
    }
    async getContextStatistics() {
        return {
            totalCachedContexts: this.contextCache.size,
            roleSpecializations: this.roleSpecializations.size,
            adaptationRules: Array.from(this.adaptationRules?.values()).flat().length
        };
    }
}
exports.DynamicKnowledgeGenerator = DynamicKnowledgeGenerator;
//# sourceMappingURL=dynamic-knowledge-generator.js.map
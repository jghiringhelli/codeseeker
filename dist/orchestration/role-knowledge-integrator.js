"use strict";
// Role-Specific Knowledge Integration System
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleKnowledgeIntegrator = exports.RoleType = void 0;
const events_1 = require("events");
const types_1 = require("./types");
Object.defineProperty(exports, "RoleType", { enumerable: true, get: function () { return types_1.RoleType; } });
const knowledge_repository_1 = require("../knowledge/repository/knowledge-repository");
const class_traversal_engine_1 = __importStar(require("../knowledge/tree/class-traversal-engine"));
class RoleKnowledgeIntegrator extends events_1.EventEmitter {
    logger;
    knowledgeGraph;
    knowledgeRepo;
    projectKB;
    classTraversalEngine;
    roleOutcomes = new Map(); // executionId -> outcomes
    roleContexts = new Map(); // nodeId -> context
    learningDatabase = new Map();
    constructor(logger, knowledgeGraph, knowledgeRepo, projectKB, projectPath) {
        super();
        this.logger = logger;
        this.knowledgeGraph = knowledgeGraph;
        this.knowledgeRepo = knowledgeRepo;
        this.projectKB = projectKB;
        this.classTraversalEngine = new class_traversal_engine_1.default(logger);
        this?.initializeLearningDatabase();
    }
    async prepareRoleKnowledge(roleType, nodeId, executionId, step, inputs) {
        this.logger.info(`Preparing knowledge context for ${roleType} in step: ${step}`);
        // Build comprehensive knowledge packet
        const knowledgePacket = await this?.buildKnowledgePacket(roleType, inputs, executionId);
        // Create role-specific context window
        const contextWindow = await this?.createContextWindow(roleType, knowledgePacket);
        // Initialize feedback loop
        const feedbackLoop = this?.initializeFeedbackLoop(roleType, inputs);
        const context = {
            roleType,
            nodeId,
            executionId,
            step,
            inputs,
            knowledgePacket,
            contextWindow,
            feedbackLoop
        };
        this.roleContexts?.set(nodeId, context);
        this?.emit('knowledge-context-prepared', { roleType, nodeId, contextSize: contextWindow.maxTokens });
        return context;
    }
    async buildKnowledgePacket(roleType, inputs, executionId) {
        const [triads, ragContext, historical, project, peers, domain, classTraversal] = await Promise?.all([
            this?.extractRelevantTriads(roleType, inputs),
            this?.generateRoleRAGContext(roleType, inputs),
            this?.getHistoricalContext(roleType, executionId),
            this?.getProjectContext(executionId),
            this?.getPeerContext(roleType, executionId),
            this?.getDomainKnowledge(roleType, inputs),
            this?.buildClassTraversalContext(roleType, inputs)
        ]);
        return {
            triads,
            ragContext,
            historical,
            project,
            peers,
            domain,
            classTraversal
        };
    }
    async extractRelevantTriads(roleType, inputs) {
        switch (roleType) {
            case types_1.RoleType.REQUIREMENT_ANALYST:
                return {
                    relevant: await this.knowledgeGraph?.findRelationships('REQUIREMENT', 'HAS_DEPENDENCY'),
                    patterns: await this.knowledgeGraph?.findPatterns(['Repository', 'Service Layer']),
                    dependencies: await this.knowledgeGraph?.getNodeDependencies(inputs.featureId),
                    similarities: await this.knowledgeGraph?.findSimilarNodes(inputs.description, 0.8)
                };
            case types_1.RoleType.TEST_DESIGNER:
                return {
                    relevant: await this.knowledgeGraph?.findRelationships('METHOD', 'TESTED_BY'),
                    patterns: await this.knowledgeGraph?.findPatterns(['Factory', 'Builder', 'Mock']),
                    dependencies: await this.knowledgeGraph?.getTestDependencies(inputs.targetCode),
                    similarities: await this.knowledgeGraph?.findSimilarTestPatterns(inputs.requirements)
                };
            case types_1.RoleType.IMPLEMENTATION_DEVELOPER:
                return {
                    relevant: await this.knowledgeGraph?.findRelationships('CLASS', ['EXTENDS', 'IMPLEMENTS', 'USES']),
                    patterns: await this.knowledgeGraph?.detectArchitecturalPatterns(inputs.codebase),
                    dependencies: await this.knowledgeGraph?.analyzeDependencyGraph(inputs.modules),
                    similarities: await this.knowledgeGraph?.findSimilarImplementations(inputs.specification)
                };
            case types_1.RoleType.SECURITY_AUDITOR:
                return {
                    relevant: await this.knowledgeGraph?.findSecurityRelationships(inputs.codeFiles),
                    patterns: await this.knowledgeGraph?.findPatterns(['Authentication', 'Authorization', 'Encryption']),
                    dependencies: await this.knowledgeGraph?.getSecurityDependencies(inputs.dependencies),
                    similarities: await this.knowledgeGraph?.findSimilarSecurityIssues(inputs.vulnerabilityReports)
                };
            case types_1.RoleType.PERFORMANCE_AUDITOR:
                return {
                    relevant: await this.knowledgeGraph?.findPerformanceRelationships(inputs.codeFiles),
                    patterns: await this.knowledgeGraph?.findPatterns(['Caching', 'Lazy Loading', 'Connection Pool']),
                    dependencies: await this.knowledgeGraph?.getPerformanceDependencies(inputs.architecture),
                    similarities: await this.knowledgeGraph?.findSimilarPerformanceIssues(inputs.metrics)
                };
            case types_1.RoleType.QUALITY_AUDITOR:
                return {
                    relevant: await this.knowledgeGraph?.findQualityRelationships(inputs.codeFiles),
                    patterns: await this.knowledgeGraph?.findPatterns(['SOLID', 'DRY', 'KISS']),
                    dependencies: await this.knowledgeGraph?.getQualityDependencies(inputs.modules),
                    similarities: await this.knowledgeGraph?.findSimilarQualityIssues(inputs.metrics)
                };
            default:
                return {
                    relevant: [],
                    patterns: [],
                    dependencies: [],
                    similarities: []
                };
        }
    }
    async generateRoleRAGContext(roleType, inputs) {
        let query = '';
        switch (roleType) {
            case types_1.RoleType.REQUIREMENT_ANALYST:
                query = `requirement analysis best practices for ${inputs.domain || 'software'} domain`;
                break;
            case types_1.RoleType.TEST_DESIGNER:
                query = `test design patterns and strategies for ${inputs.technology || 'modern applications'}`;
                break;
            case types_1.RoleType.IMPLEMENTATION_DEVELOPER:
                query = `implementation patterns and best practices for ${inputs.framework || 'web applications'}`;
                break;
            case types_1.RoleType.SECURITY_AUDITOR:
                query = `security audit checklist and vulnerability patterns for ${inputs.technology || 'web applications'}`;
                break;
            case types_1.RoleType.PERFORMANCE_AUDITOR:
                query = `performance optimization techniques and benchmarking for ${inputs.platform || 'web services'}`;
                break;
            case types_1.RoleType.QUALITY_AUDITOR:
                query = `code quality metrics and improvement strategies for ${inputs.language || 'TypeScript'}`;
                break;
            default:
                query = `${roleType?.toLowerCase()} best practices and guidelines`;
        }
        return await this.knowledgeRepo?.generateRAGContext(query, roleType);
    }
    async getHistoricalContext(roleType, executionId) {
        const previousOutcomes = this.roleOutcomes?.get(executionId)?.filter(o => o?.roleType === roleType) || [];
        const learnings = this.learningDatabase?.get(roleType) || [];
        // Extract best practices and anti-patterns from history
        const bestPractices = learnings
            .filter(l => l?.validation === 'proven' && l.confidence > 0.8)
            .map(l => l.lesson);
        const antiPatterns = previousOutcomes
            .filter(o => o.qualityScore < 0.7)
            .flatMap(o => o.insights?.filter(i => i?.type === 'risk').map(i => i.description));
        return {
            previousOutcomes: previousOutcomes?.slice(-5), // Last 5 outcomes
            learnings: learnings?.slice(-10), // Last 10 learnings
            bestPractices,
            antiPatterns
        };
    }
    async getProjectContext(executionId) {
        const strategicContext = await this.projectKB?.getStrategicContext();
        return {
            currentPhase: strategicContext.currentPhase,
            objectives: strategicContext.activeObjectives || [],
            constraints: strategicContext.constraints || [],
            qualityGates: strategicContext.qualityGates || [],
            riskFactors: strategicContext.highRisks || []
        };
    }
    async getPeerContext(roleType, executionId) {
        const allOutcomes = this.roleOutcomes?.get(executionId) || [];
        return {
            completedRoles: allOutcomes?.filter(o => o.success),
            dependentRoles: this?.getDependentRoles(roleType),
            parallelRoles: this?.getParallelRoles(roleType),
            nextRoles: this?.getNextRoles(roleType)
        };
    }
    async getDomainKnowledge(roleType, inputs) {
        // Search for role-specific domain knowledge
        const searchResults = await this.knowledgeRepo?.searchKnowledge(`${roleType} ${inputs.domain || ''}`, {
            types: [knowledge_repository_1.KnowledgeType.PROFESSIONAL_ADVICE, knowledge_repository_1.KnowledgeType.RESEARCH_PAPER, knowledge_repository_1.KnowledgeType.BEST_PRACTICE],
            limit: 10
        });
        const expertAdvice = searchResults
            .filter(r => r.document?.type === 'PROFESSIONAL_ADVICE')
            .map(r => r.document.title);
        const researchFindings = searchResults
            .filter(r => r.document?.type === 'RESEARCH_PAPER')
            .map(r => r.document.title);
        const industryStandards = searchResults
            .filter(r => r.document?.type === 'BEST_PRACTICE')
            .map(r => r.document.title);
        return {
            expertAdvice,
            researchFindings,
            industryStandards,
            emergingTrends: [] // Would be populated from trend analysis
        };
    }
    async buildClassTraversalContext(roleType, inputs) {
        this.logger.info(`Building class traversal context for ${roleType}`);
        try {
            // Determine focus area based on role type
            const focusArea = this?.mapRoleToClassFocusArea(roleType);
            // Determine project path from inputs or use default
            const projectPath = inputs.projectPath || process?.cwd();
            // Perform quick finds if search terms are provided
            let quickFinds = [];
            if (inputs.searchTerm || inputs.className) {
                const searchTerm = inputs.searchTerm || inputs.className;
                quickFinds = await this.classTraversalEngine?.quickFindClasses(projectPath, searchTerm);
            }
            // Get class insights for the focus area
            const classInsights = await this.classTraversalEngine?.getClassInsights(projectPath, focusArea);
            // Get concept mappings
            const conceptMappings = await this.classTraversalEngine?.getConceptMap(projectPath, inputs.concept || this?.getRoleSpecificConcept(roleType));
            // Get hierarchy paths if relevant for the role
            let hierarchyPaths = [];
            if (this?.shouldIncludeHierarchy(roleType) && inputs.className) {
                hierarchyPaths = await this.classTraversalEngine?.getClassHierarchy(projectPath, inputs.className, 5);
            }
            // Extract relevant classes based on role needs
            const relevantClasses = this?.extractRelevantClasses(roleType, quickFinds, classInsights);
            // Identify architectural patterns
            const architecturalPatterns = this?.identifyArchitecturalPatterns(conceptMappings, classInsights);
            // Build code understanding
            const codeUnderstanding = {
                mainConcepts: conceptMappings?.slice(0, 5).map(cm => cm.concept),
                keyRelationships: this?.extractKeyRelationships(hierarchyPaths, conceptMappings),
                businessRelevantClasses: relevantClasses?.filter(className => quickFinds?.some(qf => qf.classNode?.name === className && qf.classNode.businessRelevance > 0.7)),
                technicalHotspots: classInsights
                    .filter(insight => insight?.severity === 'high' || insight?.severity === 'critical')
                    .map(insight => insight.affectedClasses)
                    .flat()
            };
            return {
                quickFinds: quickFinds?.slice(0, 10), // Limit to top 10
                classInsights: classInsights?.slice(0, 8), // Limit to top 8
                conceptMappings: conceptMappings?.slice(0, 6), // Limit to top 6
                hierarchyPaths,
                focusArea,
                relevantClasses: relevantClasses?.slice(0, 15), // Limit to top 15
                architecturalPatterns,
                codeUnderstanding
            };
        }
        catch (error) {
            this.logger.warn(`Failed to build class traversal context: ${error}`);
            // Return minimal context on error
            return {
                quickFinds: [],
                classInsights: [],
                conceptMappings: [],
                hierarchyPaths: [],
                focusArea: class_traversal_engine_1.ClassFocusArea.ARCHITECTURE,
                relevantClasses: [],
                architecturalPatterns: [],
                codeUnderstanding: {
                    mainConcepts: [],
                    keyRelationships: [],
                    businessRelevantClasses: [],
                    technicalHotspots: []
                }
            };
        }
    }
    mapRoleToClassFocusArea(roleType) {
        const roleToFocusAreaMap = {
            [types_1.RoleType.REQUIREMENT_ANALYST]: class_traversal_engine_1.ClassFocusArea.BUSINESS_LOGIC,
            [types_1.RoleType.TEST_DESIGNER]: class_traversal_engine_1.ClassFocusArea.TESTING,
            [types_1.RoleType.IMPLEMENTATION_DEVELOPER]: class_traversal_engine_1.ClassFocusArea.ARCHITECTURE,
            [types_1.RoleType.SECURITY_AUDITOR]: class_traversal_engine_1.ClassFocusArea.SECURITY,
            [types_1.RoleType.PERFORMANCE_AUDITOR]: class_traversal_engine_1.ClassFocusArea.PERFORMANCE,
            [types_1.RoleType.QUALITY_AUDITOR]: class_traversal_engine_1.ClassFocusArea.ARCHITECTURE,
            [types_1.RoleType.CODE_REVIEWER]: class_traversal_engine_1.ClassFocusArea.ARCHITECTURE,
            [types_1.RoleType.DEVOPS_ENGINEER]: class_traversal_engine_1.ClassFocusArea.ARCHITECTURE,
            [types_1.RoleType.ORCHESTRATOR]: class_traversal_engine_1.ClassFocusArea.ARCHITECTURE,
            // Default mapping for other roles
            [types_1.RoleType.WORK_CLASSIFIER]: class_traversal_engine_1.ClassFocusArea.BUSINESS_LOGIC,
            [types_1.RoleType.COMPILER_BUILDER]: class_traversal_engine_1.ClassFocusArea.ARCHITECTURE,
            [types_1.RoleType.DEPLOYER]: class_traversal_engine_1.ClassFocusArea.ARCHITECTURE,
            [types_1.RoleType.UNIT_TEST_EXECUTOR]: class_traversal_engine_1.ClassFocusArea.TESTING,
            [types_1.RoleType.INTEGRATION_TEST_ENGINEER]: class_traversal_engine_1.ClassFocusArea.TESTING,
            [types_1.RoleType.E2E_TEST_ENGINEER]: class_traversal_engine_1.ClassFocusArea.TESTING,
            [types_1.RoleType.TECHNICAL_DOCUMENTER]: class_traversal_engine_1.ClassFocusArea.ARCHITECTURE,
            [types_1.RoleType.USER_DOCUMENTER]: class_traversal_engine_1.ClassFocusArea.BUSINESS_LOGIC,
            [types_1.RoleType.RELEASE_MANAGER]: class_traversal_engine_1.ClassFocusArea.ARCHITECTURE,
            [types_1.RoleType.COMMITTER]: class_traversal_engine_1.ClassFocusArea.ARCHITECTURE
        };
        return roleToFocusAreaMap[roleType] || class_traversal_engine_1.ClassFocusArea.ARCHITECTURE;
    }
    getRoleSpecificConcept(roleType) {
        const roleToConcept = {
            [types_1.RoleType.REQUIREMENT_ANALYST]: 'business-logic',
            [types_1.RoleType.TEST_DESIGNER]: 'testing',
            [types_1.RoleType.IMPLEMENTATION_DEVELOPER]: 'architecture',
            [types_1.RoleType.SECURITY_AUDITOR]: 'security',
            [types_1.RoleType.PERFORMANCE_AUDITOR]: 'performance',
            [types_1.RoleType.QUALITY_AUDITOR]: 'quality',
            [types_1.RoleType.DEVOPS_ENGINEER]: 'deployment',
            [types_1.RoleType.ORCHESTRATOR]: 'workflow'
        };
        return roleToConcept[roleType] || 'architecture';
    }
    shouldIncludeHierarchy(roleType) {
        const hierarchyRelevantRoles = [
            types_1.RoleType.REQUIREMENT_ANALYST,
            types_1.RoleType.IMPLEMENTATION_DEVELOPER,
            types_1.RoleType.CODE_REVIEWER,
            types_1.RoleType.QUALITY_AUDITOR,
            types_1.RoleType.ORCHESTRATOR
        ];
        return hierarchyRelevantRoles?.includes(roleType);
    }
    extractRelevantClasses(roleType, quickFinds, classInsights) {
        const relevantClasses = new Set();
        // Add classes from quick finds (high relevance matches)
        quickFinds
            .filter(qf => qf.matchScore > 0.7)
            ?.forEach(qf => relevantClasses?.add(qf.classNode.name));
        // Add classes from insights (affected classes)
        classInsights
            .filter(insight => insight?.severity === 'high' ||
            insight?.severity === 'critical' ||
            insight?.category === this?.mapRoleToClassFocusArea(roleType))
            ?.forEach(insight => insight.affectedClasses?.forEach(className => relevantClasses?.add(className)));
        return Array.from(relevantClasses);
    }
    identifyArchitecturalPatterns(conceptMappings, classInsights) {
        const patterns = new Set();
        // Extract patterns from concept mappings
        conceptMappings
            .filter(cm => cm?.category === 'ARCHITECTURAL_PATTERN' || cm?.category === 'BEHAVIORAL_PATTERN')
            ?.forEach(cm => patterns?.add(cm.concept));
        // Extract patterns from insights
        classInsights
            .filter(insight => insight?.type === 'DESIGN_PATTERN_DETECTED')
            ?.forEach(insight => {
            const patternName = insight.title?.match(/(\w+\s+Pattern)/)?.[1];
            if (patternName)
                patterns?.add(patternName);
        });
        return Array.from(patterns);
    }
    extractKeyRelationships(hierarchyPaths, conceptMappings) {
        const relationships = new Set();
        // Extract from hierarchy paths
        hierarchyPaths?.forEach(path => {
            if (path.relationships) {
                path.relationships?.forEach((rel) => relationships?.add(rel));
            }
        });
        // Extract from concept mappings
        conceptMappings?.forEach(cm => {
            if (cm.relatedClasses?.length > 1) {
                relationships?.add(`${cm.concept}-relationship`);
            }
        });
        return Array.from(relationships);
    }
    async createContextWindow(roleType, knowledgePacket) {
        // Role-specific context window sizes and compression strategies
        const roleConfigs = {
            [types_1.RoleType.ORCHESTRATOR]: { maxTokens: 8000, compressionLevel: 0 },
            [types_1.RoleType.REQUIREMENT_ANALYST]: { maxTokens: 6000, compressionLevel: 1 },
            [types_1.RoleType.TEST_DESIGNER]: { maxTokens: 4000, compressionLevel: 1 },
            [types_1.RoleType.IMPLEMENTATION_DEVELOPER]: { maxTokens: 7000, compressionLevel: 0 },
            [types_1.RoleType.SECURITY_AUDITOR]: { maxTokens: 5000, compressionLevel: 1 },
            [types_1.RoleType.PERFORMANCE_AUDITOR]: { maxTokens: 4000, compressionLevel: 2 },
            [types_1.RoleType.QUALITY_AUDITOR]: { maxTokens: 5000, compressionLevel: 1 }
        };
        const config = roleConfigs[roleType] || { maxTokens: 3000, compressionLevel: 2 };
        // Prioritize information based on role needs
        const essentialInfo = this?.extractEssentialInfo(roleType, knowledgePacket);
        // Calculate confidence based on knowledge completeness
        const confidence = this?.calculateKnowledgeConfidence(knowledgePacket);
        return {
            maxTokens: config.maxTokens,
            compressionLevel: config.compressionLevel,
            essentialInfo,
            referenceLinks: this?.extractReferenceLinks(knowledgePacket),
            confidence
        };
    }
    extractEssentialInfo(roleType, packet) {
        switch (roleType) {
            case types_1.RoleType.REQUIREMENT_ANALYST:
                return {
                    projectObjectives: packet.project.objectives,
                    stakeholderConstraints: packet.project.constraints,
                    similarRequirements: packet.triads.similarities?.slice(0, 3),
                    bestPractices: packet.historical.bestPractices?.slice(0, 5),
                    domainExpertise: packet.domain.expertAdvice?.slice(0, 3)
                };
            case types_1.RoleType.TEST_DESIGNER:
                return {
                    testingPatterns: packet.triads.patterns,
                    qualityGates: packet.project.qualityGates,
                    testingBestPractices: packet.historical.bestPractices,
                    relatedTests: packet.triads.relevant?.slice(0, 5),
                    expertAdvice: packet.domain.expertAdvice?.slice(0, 3)
                };
            case types_1.RoleType.IMPLEMENTATION_DEVELOPER:
                return {
                    architecturalPatterns: packet.triads.patterns,
                    codeDependencies: packet.triads.dependencies,
                    implementationGuidance: packet.ragContext.synthesizedKnowledge,
                    bestPractices: packet.historical.bestPractices,
                    antiPatterns: packet.historical.antiPatterns,
                    peerOutcomes: packet.peers.completedRoles?.slice(0, 3)
                };
            case types_1.RoleType.SECURITY_AUDITOR:
                return {
                    securityPatterns: packet.triads.patterns,
                    vulnerabilityHistory: packet.historical.antiPatterns,
                    securityStandards: packet.domain.industryStandards,
                    riskFactors: packet.project.riskFactors,
                    expertGuidance: packet.ragContext.synthesizedKnowledge
                };
            default:
                return {
                    relevantContext: packet.ragContext.synthesizedKnowledge,
                    bestPractices: packet.historical.bestPractices?.slice(0, 3),
                    projectContext: packet.project.currentPhase
                };
        }
    }
    async recordRoleOutcome(roleType, nodeId, executionId, inputs, outputs, duration, success) {
        const context = this.roleContexts?.get(nodeId);
        if (!context)
            return;
        // Calculate comprehensive metrics
        const metrics = await this?.calculateRoleMetrics(roleType, inputs, outputs, duration, context);
        // Generate insights from the execution
        const insights = await this?.generateRoleInsights(roleType, inputs, outputs, context);
        // Extract decisions made during execution
        const decisions = this?.extractRoleDecisions(outputs);
        // Generate learnings from this execution
        const learnings = await this?.generateRoleLearnings(roleType, context, insights, success);
        const outcome = {
            roleType,
            nodeId,
            executionId,
            timestamp: new Date(),
            inputs,
            outputs,
            metrics,
            insights,
            decisions,
            learnings,
            duration,
            success,
            qualityScore: this?.calculateQualityScore(metrics, insights)
        };
        // Store outcome
        if (!this.roleOutcomes?.has(executionId)) {
            this.roleOutcomes?.set(executionId, []);
        }
        this.roleOutcomes?.get(executionId).push(outcome);
        // Update learning database
        this?.updateLearningDatabase(roleType, learnings);
        // Update knowledge graph with new insights
        await this?.updateKnowledgeGraph(outcome);
        // Update project knowledge base
        await this?.updateProjectKnowledgeBase(outcome);
        this.logger.info(`Recorded outcome for ${roleType}: Quality Score ${outcome.qualityScore?.toFixed(2)}`);
        this?.emit('role-outcome-recorded', outcome);
    }
    async calculateRoleMetrics(roleType, inputs, outputs, duration, context) {
        // Base metrics calculation
        const baseMetrics = {
            executionTime: duration,
            memoryUsage: 0, // Would be measured in production
            apiCalls: context.knowledgePacket.ragContext.relevantDocuments?.length
        };
        // Role-specific quality metrics
        const qualityMetrics = await this?.calculateRoleQualityMetrics(roleType, outputs, context);
        // Business impact metrics
        const businessMetrics = this?.calculateBusinessMetrics(roleType, outputs);
        // Learning metrics
        const learningMetrics = this?.calculateLearningMetrics(context);
        return {
            ...baseMetrics,
            ...qualityMetrics,
            ...businessMetrics,
            ...learningMetrics,
            // Ensure required properties exist
            accuracy: qualityMetrics?.accuracy ?? 0,
            completeness: qualityMetrics?.completeness ?? 0,
            consistency: qualityMetrics?.consistency ?? 0
        };
    }
    async calculateRoleQualityMetrics(roleType, outputs, context) {
        switch (roleType) {
            case types_1.RoleType.REQUIREMENT_ANALYST:
                return {
                    accuracy: this?.assessRequirementAccuracy(outputs),
                    completeness: this?.assessRequirementCompleteness(outputs),
                    consistency: this?.assessRequirementConsistency(outputs),
                    innovation: this?.assessRequirementInnovation(outputs)
                };
            case types_1.RoleType.TEST_DESIGNER:
                return {
                    accuracy: outputs.testCoverage || 0.8,
                    completeness: outputs?.testCount / (outputs?.requirementCount * 2) || 0.7,
                    consistency: this?.assessTestConsistency(outputs),
                    innovation: this?.assessTestInnovation(outputs)
                };
            case types_1.RoleType.IMPLEMENTATION_DEVELOPER:
                return {
                    accuracy: 1 - (outputs.errors?.length || 0) / 10,
                    completeness: outputs?.implementedFeatures / outputs.requiredFeatures || 0.9,
                    consistency: this?.assessCodeConsistency(outputs),
                    innovation: this?.assessCodeInnovation(outputs)
                };
            default:
                return {
                    accuracy: 0.8,
                    completeness: 0.8,
                    consistency: 0.8,
                    innovation: 0.5
                };
        }
    }
    calculateBusinessMetrics(roleType, outputs) {
        // Simplified business impact calculation
        const baseValue = 0.7;
        return {
            businessValue: baseValue + (outputs.featuresImplemented || 0) * 0.1,
            riskReduction: baseValue + (outputs.risksAddressed || 0) * 0.15,
            userImpact: baseValue + (outputs.userStoryPoints || 0) * 0.05,
            technicalDebt: Math.max(0, 1 - (outputs.codeComplexity || 5) / 10)
        };
    }
    calculateLearningMetrics(context) {
        return {
            knowledgeUtilization: context.knowledgePacket.ragContext.confidence,
            patternRecognition: context.knowledgePacket.triads.patterns?.length * 0.1,
            decisionConfidence: context.feedbackLoop.outputMetrics?.confidence || 0.8,
            improvementRate: 0.1 // Would be calculated from historical data
        };
    }
    async generateRoleInsights(roleType, inputs, outputs, context) {
        const insights = [];
        // Pattern recognition insights
        if (context.knowledgePacket.triads.patterns?.length > 0) {
            insights?.push({
                type: 'pattern',
                description: `Detected ${context.knowledgePacket.triads.patterns?.length} architectural patterns in the codebase`,
                evidence: context.knowledgePacket.triads.patterns?.map(p => p.name),
                confidence: 0.85,
                impact: 'medium',
                actionable: true,
                recommendations: ['Consider standardizing these patterns across the codebase']
            });
        }
        // Quality insights based on role-specific analysis
        if (roleType === types_1.RoleType.QUALITY_AUDITOR && outputs.qualityScore < 0.8) {
            insights?.push({
                type: 'opportunity',
                description: 'Quality improvement opportunities identified',
                evidence: outputs.qualityIssues || [],
                confidence: 0.9,
                impact: 'high',
                actionable: true,
                recommendations: ['Focus on code complexity reduction', 'Improve test coverage']
            });
        }
        // Risk insights
        if (outputs.errors && outputs.errors?.length > 0) {
            insights?.push({
                type: 'risk',
                description: `${outputs.errors?.length} issues identified that may impact delivery`,
                evidence: outputs.errors?.map((e) => e.message || e),
                confidence: 0.95,
                impact: 'high',
                actionable: true,
                recommendations: ['Address critical errors immediately', 'Review error handling patterns']
            });
        }
        return insights;
    }
    extractRoleDecisions(outputs) {
        if (!outputs.decisions)
            return [];
        return outputs.decisions?.map((decision) => ({
            description: decision.description || 'Decision made',
            options: decision.options || [],
            chosen: decision.chosen || decision.selected,
            rationale: decision.rationale || decision.reasoning,
            confidence: decision.confidence || 0.8,
            riskLevel: decision.riskLevel || 'medium',
            reversible: decision?.reversible !== false
        }));
    }
    async generateRoleLearnings(roleType, context, insights, success) {
        const learnings = [];
        // Learn from successful patterns
        if (success && context.knowledgePacket.triads.patterns?.length > 0) {
            learnings?.push({
                category: 'technical',
                lesson: `Successful application of ${context.knowledgePacket.triads.patterns?.length} architectural patterns`,
                context: `${roleType} execution with high-quality patterns`,
                applicability: [roleType],
                confidence: 0.8,
                validation: 'empirical'
            });
        }
        // Learn from insights
        insights?.forEach(insight => {
            if (insight?.type === 'pattern' && insight.confidence > 0.8) {
                learnings?.push({
                    category: 'technical',
                    lesson: insight.description,
                    context: `Pattern recognition during ${roleType} execution`,
                    applicability: [roleType, types_1.RoleType.ORCHESTRATOR],
                    confidence: insight.confidence,
                    validation: 'empirical'
                });
            }
        });
        // Learn from knowledge utilization
        if (context.knowledgePacket.ragContext.confidence > 0.9) {
            learnings?.push({
                category: 'process',
                lesson: 'High-confidence knowledge retrieval correlates with successful outcomes',
                context: `RAG context utilization in ${roleType}`,
                applicability: [roleType],
                confidence: 0.85,
                validation: 'empirical'
            });
        }
        return learnings;
    }
    calculateQualityScore(metrics, insights) {
        const metricsScore = (metrics?.accuracy * 0.3 +
            metrics?.completeness * 0.25 +
            metrics?.consistency * 0.2 +
            metrics?.businessValue * 0.15 +
            metrics?.knowledgeUtilization * 0.1);
        const insightsPenalty = insights?.filter(i => i?.type === 'risk' && i?.impact === 'high').length * 0.1;
        const insightsBonus = insights?.filter(i => i?.type === 'opportunity' && i?.impact === 'high').length * 0.05;
        return Math.max(0, Math.min(1, metricsScore - insightsPenalty + insightsBonus));
    }
    updateLearningDatabase(roleType, learnings) {
        if (!this.learningDatabase?.has(roleType)) {
            this.learningDatabase?.set(roleType, []);
        }
        const roleLearnings = this.learningDatabase?.get(roleType);
        learnings?.forEach(learning => roleLearnings?.push(learning));
        // Keep only the most recent and highest confidence learnings
        roleLearnings?.sort((a, b) => b?.confidence - a.confidence);
        if (roleLearnings?.length > 100) {
            roleLearnings?.splice(100);
        }
    }
    async updateKnowledgeGraph(outcome) {
        // Add new patterns and relationships discovered during execution
        for (const insight of outcome.insights) {
            if (insight?.type === 'pattern' && insight.confidence > 0.8) {
                // Would add new patterns to knowledge graph
                this?.emit('knowledge-graph-update', { type: 'pattern', data: insight });
            }
        }
    }
    async updateProjectKnowledgeBase(outcome) {
        // Record accomplishment in project KB
        await this.projectKB?.recordAccomplishment({
            workItemId: outcome.executionId,
            type: 'task',
            title: `${outcome.roleType} execution`,
            description: `Completed ${outcome.roleType} with quality score ${outcome.qualityScore?.toFixed(2)}`,
            phaseId: 'current-phase',
            startDate: new Date(Date?.now() - outcome.duration),
            completionDate: outcome.timestamp,
            effort: Math.ceil(outcome?.duration / 3600), // Convert to hours
            quality: {
                codeQuality: outcome.metrics.accuracy,
                testCoverage: outcome.metrics.completeness,
                bugDensity: 1 - outcome.metrics.consistency,
                performanceScore: outcome.metrics.businessValue,
                securityScore: outcome.metrics.riskReduction
            },
            impact: {
                businessValue: outcome.metrics.businessValue,
                userImpact: outcome.metrics.userImpact,
                technicalDebt: outcome.metrics.technicalDebt,
                teamLearning: outcome.metrics.knowledgeUtilization
            },
            lessons: outcome.learnings?.map(l => l.lesson)
        });
    }
    // Helper methods for quality assessment
    assessRequirementAccuracy(outputs) {
        return outputs.accuracyScore || 0.85;
    }
    assessRequirementCompleteness(outputs) {
        return outputs.completenessScore || 0.80;
    }
    assessRequirementConsistency(outputs) {
        return outputs.consistencyScore || 0.90;
    }
    assessRequirementInnovation(outputs) {
        return outputs.innovationScore || 0.60;
    }
    assessTestConsistency(outputs) {
        return outputs.testConsistency || 0.85;
    }
    assessTestInnovation(outputs) {
        return outputs.testInnovation || 0.70;
    }
    assessCodeConsistency(outputs) {
        return 1 - (outputs.styleViolations || 0) / 100;
    }
    assessCodeInnovation(outputs) {
        return outputs.innovativePatterns || 0.60;
    }
    calculateKnowledgeConfidence(packet) {
        const ragConfidence = packet.ragContext.confidence;
        const triadsRelevance = Math.min(1, packet.triads.relevant?.length / 10);
        const historicalRelevance = Math.min(1, packet.historical.previousOutcomes?.length / 5);
        return (ragConfidence * 0.5 + triadsRelevance * 0.3 + historicalRelevance * 0.2);
    }
    extractReferenceLinks(packet) {
        return packet.ragContext.sources?.slice(0, 5);
    }
    initializeFeedbackLoop(roleType, inputs) {
        return {
            inputMetrics: { size: JSON.stringify(inputs).length },
            processMetrics: {},
            outputMetrics: {},
            qualityScores: {},
            improvementSuggestions: [],
            nextIterationHints: []
        };
    }
    initializeLearningDatabase() {
        Object.values(types_1.RoleType)?.forEach(roleType => {
            this.learningDatabase?.set(roleType, []);
        });
    }
    getDependentRoles(roleType) {
        const dependencies = {
            [types_1.RoleType.TEST_DESIGNER]: [types_1.RoleType.REQUIREMENT_ANALYST],
            [types_1.RoleType.IMPLEMENTATION_DEVELOPER]: [types_1.RoleType.TEST_DESIGNER, types_1.RoleType.REQUIREMENT_ANALYST],
            [types_1.RoleType.SECURITY_AUDITOR]: [types_1.RoleType.IMPLEMENTATION_DEVELOPER],
            [types_1.RoleType.PERFORMANCE_AUDITOR]: [types_1.RoleType.IMPLEMENTATION_DEVELOPER],
            [types_1.RoleType.QUALITY_AUDITOR]: [types_1.RoleType.IMPLEMENTATION_DEVELOPER],
            // ... add more dependencies
        };
        return dependencies[roleType] || [];
    }
    getParallelRoles(roleType) {
        const parallel = {
            [types_1.RoleType.SECURITY_AUDITOR]: [types_1.RoleType.PERFORMANCE_AUDITOR, types_1.RoleType.QUALITY_AUDITOR],
            [types_1.RoleType.PERFORMANCE_AUDITOR]: [types_1.RoleType.SECURITY_AUDITOR, types_1.RoleType.QUALITY_AUDITOR],
            [types_1.RoleType.QUALITY_AUDITOR]: [types_1.RoleType.SECURITY_AUDITOR, types_1.RoleType.PERFORMANCE_AUDITOR],
            // ... add more parallel relationships
        };
        return parallel[roleType] || [];
    }
    getNextRoles(roleType) {
        const next = {
            [types_1.RoleType.REQUIREMENT_ANALYST]: [types_1.RoleType.TEST_DESIGNER],
            [types_1.RoleType.TEST_DESIGNER]: [types_1.RoleType.IMPLEMENTATION_DEVELOPER],
            [types_1.RoleType.IMPLEMENTATION_DEVELOPER]: [types_1.RoleType.SECURITY_AUDITOR, types_1.RoleType.PERFORMANCE_AUDITOR, types_1.RoleType.QUALITY_AUDITOR],
            // ... add more next relationships
        };
        return next[roleType] || [];
    }
    // Public API
    async getRoleContext(nodeId) {
        return this.roleContexts?.get(nodeId) || null;
    }
    async getRoleOutcomes(executionId, roleType) {
        const outcomes = this.roleOutcomes?.get(executionId) || [];
        return roleType ? outcomes?.filter(o => o?.roleType === roleType) : outcomes;
    }
    async getRoleLearnings(roleType) {
        return this.learningDatabase?.get(roleType) || [];
    }
    async generateExecutionSummary(executionId) {
        const outcomes = this.roleOutcomes?.get(executionId) || [];
        return {
            totalRoles: outcomes?.length,
            successRate: outcomes?.filter(o => o.success).length / outcomes?.length,
            averageQuality: outcomes?.reduce((sum, o) => sum + o.qualityScore, 0) / outcomes?.length,
            totalInsights: outcomes?.reduce((sum, o) => sum + o.insights?.length, 0),
            totalLearnings: outcomes?.reduce((sum, o) => sum + o.learnings?.length, 0),
            businessValue: outcomes?.reduce((sum, o) => sum + o.metrics.businessValue, 0) / outcomes?.length,
            riskReduction: outcomes?.reduce((sum, o) => sum + o.metrics.riskReduction, 0) / outcomes?.length
        };
    }
}
exports.RoleKnowledgeIntegrator = RoleKnowledgeIntegrator;
//# sourceMappingURL=role-knowledge-integrator.js.map
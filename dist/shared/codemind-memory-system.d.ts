/**
 * CodeMind Memory System
 *
 * Comprehensive memory architecture for tracking CodeMind-Claude Code interactions,
 * preserving context across requests, and enabling intelligent continuation of work.
 *
 * Key Features:
 * - Multi-layered memory hierarchy (immediate, session, project, global)
 * - Interaction pattern learning between CodeMind and Claude Code
 * - Lossless compression with intelligent summarization
 * - Context continuity across requests and sessions
 * - Performance tracking and optimization insights
 */
export interface MemoryCompressionResult {
    original: {
        size: number;
        interactionCount: number;
        tokenCount: number;
    };
    compressed: {
        size: number;
        preservedInteractions: number;
        compressionRatio: number;
    };
    summary: {
        keyPatterns: string[];
        importantOutcomes: string[];
        criticalLearnings: string[];
    };
    lossless: boolean;
}
export interface InteractionMemory {
    id: string;
    timestamp: Date;
    requestId: string;
    sessionId: string;
    codemindRequest: {
        type: 'task' | 'validation' | 'fix' | 'analysis';
        instruction: string;
        context: any;
        priority: 'critical' | 'high' | 'medium' | 'low';
        expectedOutcome: string;
    };
    claudeResponse: {
        success: boolean;
        output: string;
        duration: number;
        tokensUsed: number;
        errorDetails?: string;
        metadata: any;
    };
    effectiveness: number;
    patterns: string[];
    improvements: string[];
}
export interface RequestMemory {
    requestId: string;
    sessionId: string;
    userRequest: string;
    projectPath: string;
    timestamp: Date;
    duration: number;
    context: {
        changedFiles: string[];
        affectedFiles: string[];
        requestType: 'code_modification' | 'analysis' | 'general';
        complexity: number;
        riskLevel: 'low' | 'medium' | 'high' | 'critical';
    };
    interactions: InteractionMemory[];
    outcome: {
        success: boolean;
        tasksCompleted: number;
        tasksFailed: number;
        integrationResult: any;
        branchMerged: boolean;
        filesChanged: string[];
    };
    learnings: {
        effectivePatterns: string[];
        ineffectivePatterns: string[];
        timeEstimateAccuracy: number;
        surprisingChallenges: string[];
        unexpectedSuccesses: string[];
    };
}
export interface SessionMemory {
    sessionId: string;
    projectId: string;
    userId?: string;
    startTime: Date;
    endTime?: Date;
    context: {
        projectState: any;
        workingDirectory: string;
        gitBranch: string;
        lastSnapshot: string;
    };
    requests: RequestMemory[];
    patterns: {
        commonRequestTypes: string[];
        workflowPreferences: any;
        effectiveStrategies: string[];
        recurringChallenges: string[];
    };
    summary: {
        totalRequests: number;
        successRate: number;
        averageRequestTime: number;
        majorChangesImplemented: string[];
        keyLearnings: string[];
    };
}
export interface ProjectMemory {
    projectId: string;
    projectPath: string;
    profile: {
        language: string;
        framework: string;
        architecture: string;
        complexity: 'simple' | 'moderate' | 'complex' | 'enterprise';
        domain: string;
        teamSize?: number;
    };
    performance: {
        totalRequests: number;
        averageSuccessRate: number;
        averageRequestTime: number;
        commonFailurePoints: string[];
        mostEffectivePatterns: string[];
    };
    evolution: {
        majorMilestones: Array<{
            date: Date;
            description: string;
            filesChanged: number;
            impact: 'minor' | 'moderate' | 'major' | 'architectural';
        }>;
        architecturalChanges: Array<{
            date: Date;
            change: string;
            reason: string;
            impact: string;
        }>;
        dependencyEvolution: Array<{
            date: Date;
            added: string[];
            removed: string[];
            updated: string[];
        }>;
    };
    knowledge: {
        codingPatterns: Map<string, number>;
        commonSolutions: Map<string, any>;
        bestPractices: string[];
        antiPatterns: string[];
        projectSpecificKnowledge: any;
    };
}
export interface MemoryCompressionResult {
    original: {
        size: number;
        interactionCount: number;
        tokenCount: number;
    };
    compressed: {
        size: number;
        preservedInteractions: number;
        compressionRatio: number;
    };
    summary: {
        keyPatterns: string[];
        importantOutcomes: string[];
        criticalLearnings: string[];
    };
    lossless: boolean;
}
export interface ContextualContinuation {
    previousRequestContext: {
        whatWasDone: string[];
        howItWasDone: string[];
        challengesEncountered: string[];
        solutionsApplied: string[];
    };
    currentRequestContext: {
        relatedToPrevious: boolean;
        buildingUpon: string[];
        potentialConflicts: string[];
        suggestedApproach: string;
    };
    continuityInstructions: {
        forCodeMind: string[];
        forClaude: string[];
        warningsAndCautions: string[];
    };
}
export declare class CodeMindMemorySystem {
    private logger;
    private postgresql;
    private neo4j;
    private redis;
    private activeInteractions;
    private sessionCache;
    private projectCache;
    constructor();
    /**
     * Initialize memory system for a new request
     */
    initializeRequestMemory(userRequest: string, projectPath: string, sessionId: string): Promise<{
        requestId: string;
        context: ContextualContinuation;
    }>;
    /**
     * Record interaction between CodeMind and Claude Code
     */
    recordInteraction(requestId: string, codemindRequest: InteractionMemory['codemindRequest'], claudeResponse: InteractionMemory['claudeResponse']): Promise<void>;
    /**
     * Complete request memory and perform intelligent summarization
     */
    finalizeRequestMemory(requestId: string, outcome: RequestMemory['outcome'], duration: number): Promise<MemoryCompressionResult>;
    /**
     * Retrieve contextual information for a new request
     */
    getContextForNewRequest(userRequest: string, projectPath: string, sessionId: string): Promise<{
        similarPastRequests: RequestMemory[];
        relevantPatterns: string[];
        suggestedApproach: string;
        potentialChallenges: string[];
        estimatedComplexity: number;
        estimatedDuration: number;
    }>;
    /**
     * Get memory statistics and health metrics
     */
    getMemoryStats(): Promise<{
        storage: {
            activeInteractions: number;
            cachedSessions: number;
            cachedProjects: number;
            totalRequests: number;
            totalInteractions: number;
        };
        performance: {
            averageCompressionRatio: number;
            averageRetrievalTime: number;
            cacheHitRate: number;
            learningEffectiveness: number;
        };
        insights: {
            mostEffectivePatterns: string[];
            commonFailurePoints: string[];
            improvementOpportunities: string[];
        };
    }>;
    private generateRequestId;
    private getSessionIdFromRequest;
    private getOrCreateSessionMemory;
    private getOrCreateProjectMemory;
    private generateProjectId;
    private classifyRequestType;
    private estimateComplexity;
    private generateContextualContinuation;
    private calculateInteractionEffectiveness;
    private extractInteractionPatterns;
    private suggestInteractionImprovements;
    private compressAndSummarize;
    private extractKeyPatterns;
    private extractImportantOutcomes;
    private extractCriticalLearnings;
    private summarizeRoutineInteractions;
    private cacheRequestContext;
    private updateInteractionPatterns;
    private extractLearnings;
    private storeRequestMemoryPersistent;
    private updateProjectKnowledge;
    private updateKnowledgeGraph;
    private getProjectMemory;
    private loadProjectMemoryFromDB;
    private findSimilarRequests;
    private findRelevantPatterns;
    private suggestApproach;
    private predictChallenges;
    private estimateDuration;
}
export default CodeMindMemorySystem;
//# sourceMappingURL=codemind-memory-system.d.ts.map
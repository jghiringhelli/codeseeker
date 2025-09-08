/**
 * Memory-Orchestrator Integration Layer
 *
 * Integrates the CodeMind Memory System with the Task-Specific File Orchestrator
 * to provide intelligent context continuity and learning across requests.
 */
import { OrchestrationResult } from './task-specific-file-orchestrator';
import { ContextualContinuation } from './codemind-memory-system';
export interface MemoryEnhancedOrchestrationOptions {
    useMemoryContext: boolean;
    learnFromInteractions: boolean;
    adaptToProjectPatterns: boolean;
    preserveInteractionHistory: boolean;
    enableSmartContinuation: boolean;
}
export interface MemoryEnhancedResult extends OrchestrationResult {
    memoryContext: {
        requestId: string;
        contextualContinuation: ContextualContinuation;
        interactionsRecorded: number;
        patternsLearned: string[];
        compressionResult: any;
    };
    learningInsights: {
        effectivePatterns: string[];
        improvementSuggestions: string[];
        futureOptimizations: string[];
    };
}
export declare class MemoryEnhancedOrchestrator {
    private logger;
    private orchestrator;
    private memorySystem;
    private sessionId;
    constructor(projectPath: string, sessionId?: string);
    /**
     * Enhanced orchestration with full memory integration
     */
    orchestrateWithMemory(projectPath: string, userRequest: string, options?: {
        force?: boolean;
        skipCycles?: boolean;
        dryRun?: boolean;
        autoRollback?: boolean;
        memory?: MemoryEnhancedOrchestrationOptions;
    }): Promise<MemoryEnhancedResult>;
    /**
     * Run orchestration with memory awareness and interaction tracking
     */
    private runMemoryAwareOrchestration;
    /**
     * Create a memory-aware wrapper around the orchestrator
     */
    private createMemoryAwareWrapper;
    /**
     * Enhance user request with contextual continuation
     */
    private enhanceRequestWithContext;
    /**
     * Finalize memory and extract learning insights
     */
    private finalizeMemoryAndLearnings;
    /**
     * Get memory-enhanced context for a request
     */
    getEnhancedContext(userRequest: string, projectPath: string): Promise<{
        memoryContext: any;
        similarRequests: any[];
        suggestedApproach: string;
        potentialChallenges: string[];
        estimatedComplexity: number;
        estimatedDuration: number;
    }>;
    /**
     * Get memory system statistics
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
    private generateSessionId;
    private createEmptyContext;
    private logContextualContinuation;
    private extractEffectivePatterns;
    private generateImprovementSuggestions;
    private identifyFutureOptimizations;
}
export default MemoryEnhancedOrchestrator;
//# sourceMappingURL=memory-orchestrator-integration.d.ts.map
/**
 * CodeMind Memory System (Legacy Facade)
 * SOLID Principles: Facade Pattern - Provides simplified interface to memory subsystem
 * SOLID Principles: Dependency Inversion Principle - depends on MemorySystem abstraction
 *
 * This class provides backward compatibility for existing CodeMind memory operations
 * while delegating all functionality to the new SOLID-based MemorySystem architecture.
 */
import { MemorySystem } from './memory-system/memory-system';
import { MemoryCompressionResult, InteractionMemory, RequestMemory, SessionMemory, ProjectMemory, ContextualContinuation, MemoryStats } from './memory-system/interfaces/index';
export { MemoryCompressionResult, InteractionMemory, RequestMemory, SessionMemory, ProjectMemory, ContextualContinuation, MemoryStats };
export declare class CodeMindMemorySystem {
    private logger;
    private memorySystem;
    private initialized;
    private sessionId?;
    constructor(memorySystem?: MemorySystem);
    initialize(): Promise<void>;
    close(): Promise<void>;
    /**
     * Store and retrieve interaction with context
     * Main entry point for CodeMind → Claude Code interactions
     */
    storeAndRetrieveInteraction(interaction: InteractionMemory): Promise<ContextualContinuation | null>;
    storeInteraction(interaction: InteractionMemory): Promise<void>;
    storeRequest(request: RequestMemory): Promise<void>;
    storeSession(session: SessionMemory): Promise<void>;
    storeProject(project: ProjectMemory): Promise<void>;
    loadInteraction(id: string): Promise<InteractionMemory | null>;
    loadRequest(requestId: string): Promise<RequestMemory | null>;
    loadSession(sessionId: string): Promise<SessionMemory | null>;
    loadProject(projectId: string): Promise<ProjectMemory | null>;
    getContextForNewRequest(userRequest: string, projectPath: string, sessionId?: string): Promise<ContextualContinuation>;
    findSimilarRequests(userRequest: string, projectMemory: ProjectMemory): Promise<RequestMemory[]>;
    findRelevantPatterns(userRequest: string, projectPath: string): Promise<string[]>;
    getProjectMemory(projectPath: string): Promise<ProjectMemory>;
    getSessionMemory(sessionId: string): Promise<SessionMemory | null>;
    updateInteractionEffectiveness(id: string, effectiveness: number): Promise<void>;
    updateProjectKnowledge(projectId: string, knowledge: ProjectMemory['knowledge']): Promise<void>;
    compressAndSummarize(interactions: InteractionMemory[], outcome: RequestMemory['outcome']): Promise<MemoryCompressionResult>;
    getMemoryStats(): Promise<MemoryStats>;
    analyzeTrends(projectId: string, timeRange: {
        start: Date;
        end: Date;
    }): Promise<{
        requestFrequency: number[];
        successRateOverTime: number[];
        complexityTrends: number[];
        commonPatterns: string[];
    }>;
    generateInsights(projectId: string): Promise<{
        strengths: string[];
        improvements: string[];
        recommendations: string[];
    }>;
    extractKeyPatterns(interactions: InteractionMemory[]): Promise<string[]>;
    extractImportantOutcomes(interactions: InteractionMemory[], outcome: RequestMemory['outcome']): Promise<string[]>;
    extractCriticalLearnings(interactions: InteractionMemory[]): Promise<string[]>;
    calculateInteractionEffectiveness(interaction: InteractionMemory, finalOutcome: RequestMemory['outcome']): Promise<number>;
    extractInteractionPatterns(interaction: InteractionMemory): Promise<string[]>;
    suggestInteractionImprovements(interaction: InteractionMemory): Promise<string[]>;
    optimizeMemoryUsage(): Promise<void>;
    cleanupExpiredSessions(): Promise<void>;
    compressOldInteractions(threshold: Date): Promise<void>;
    initializeRequestMemory(userRequest: string, projectPath: string, sessionId: string): Promise<{
        requestId: string;
        context: ContextualContinuation;
    }>;
    recordInteraction(interaction: InteractionMemory): Promise<void>;
    recordInteraction(requestId: string, codemindRequest: any, claudeResponse: any): Promise<void>;
    finalizeRequestMemory(requestId: string, outcome: string, results: any): Promise<void>;
}
export default CodeMindMemorySystem;
export { MemorySystem };
//# sourceMappingURL=codemind-memory-system.d.ts.map
/**
 * CodeMind Memory System (Legacy Facade)
 * SOLID Principles: Facade Pattern - Provides simplified interface to memory subsystem
 * SOLID Principles: Dependency Inversion Principle - depends on MemorySystem abstraction
 *
 * This class provides backward compatibility for existing CodeMind memory operations
 * while delegating all functionality to the new SOLID-based MemorySystem architecture.
 */

import { Logger } from './logger';
import { MemorySystem } from './memory-system/memory-system';
import {
  MemoryCompressionResult,
  InteractionMemory,
  RequestMemory,
  SessionMemory,
  ProjectMemory,
  ContextualContinuation,
  MemoryStats
} from './memory-system/interfaces/index';

// Re-export all interfaces for backward compatibility
export {
  MemoryCompressionResult,
  InteractionMemory,
  RequestMemory,
  SessionMemory,
  ProjectMemory,
  ContextualContinuation,
  MemoryStats
};

export class CodeMindMemorySystem {
  private logger: Logger;
  private memorySystem: MemorySystem;
  private initialized = false;
  private sessionId?: string;

  constructor(memorySystem?: MemorySystem) {
    this.logger = Logger.getInstance();
    this.memorySystem = memorySystem || new MemorySystem();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.memorySystem.initialize();
      this.initialized = true;
      this.logger.info('🧠 CodeMind memory system initialized (legacy facade)');
    } catch (error) {
      this.logger.warn('⚠️ Memory system initialization failed, using fallback mode');
      this.initialized = true;
    }
  }

  async close(): Promise<void> {
    if (!this.initialized) return;

    try {
      await this.memorySystem.close();
      this.initialized = false;
      this.logger.info('🧠 CodeMind memory system closed (legacy facade)');
    } catch (error) {
      this.logger.error('Failed to close memory system:', error);
    }
  }

  /**
   * Store and retrieve interaction with context
   * Main entry point for CodeMind → Claude Code interactions
   */
  async storeAndRetrieveInteraction(
    interaction: InteractionMemory
  ): Promise<ContextualContinuation | null> {
    await this.initialize();

    try {
      // Delegate to memory system
      return await this.memorySystem.storeAndRetrieveInteraction(interaction);
    } catch (error) {
      this.logger.error('Failed to store and retrieve interaction:', error);
      return null;
    }
  }

  // Storage Operations (delegated to MemorySystem)
  async storeInteraction(interaction: InteractionMemory): Promise<void> {
    return this.memorySystem.storeInteraction(interaction);
  }

  async storeRequest(request: RequestMemory): Promise<void> {
    return this.memorySystem.storeRequest(request);
  }

  async storeSession(session: SessionMemory): Promise<void> {
    return this.memorySystem.storeSession(session);
  }

  async storeProject(project: ProjectMemory): Promise<void> {
    return this.memorySystem.storeProject(project);
  }

  // Retrieval Operations (delegated to MemorySystem)
  async loadInteraction(id: string): Promise<InteractionMemory | null> {
    return this.memorySystem.loadInteraction(id);
  }

  async loadRequest(requestId: string): Promise<RequestMemory | null> {
    return this.memorySystem.loadRequest(requestId);
  }

  async loadSession(sessionId: string): Promise<SessionMemory | null> {
    return this.memorySystem.loadSession(sessionId);
  }

  async loadProject(projectId: string): Promise<ProjectMemory | null> {
    return this.memorySystem.loadProject(projectId);
  }

  async getContextForNewRequest(
    userRequest: string,
    projectPath: string,
    sessionId?: string
  ): Promise<ContextualContinuation> {
    return this.memorySystem.getContextForNewRequest(userRequest, projectPath, sessionId);
  }

  async findSimilarRequests(userRequest: string, projectMemory: ProjectMemory): Promise<RequestMemory[]> {
    return this.memorySystem.findSimilarRequests(userRequest, projectMemory);
  }

  async findRelevantPatterns(userRequest: string, projectPath: string): Promise<string[]> {
    return this.memorySystem.findRelevantPatterns(userRequest, projectPath);
  }

  async getProjectMemory(projectPath: string): Promise<ProjectMemory> {
    return this.memorySystem.getProjectMemory(projectPath);
  }

  async getSessionMemory(sessionId: string): Promise<SessionMemory | null> {
    return this.memorySystem.getSessionMemory(sessionId);
  }

  // Update Operations (delegated to MemorySystem)
  async updateInteractionEffectiveness(id: string, effectiveness: number): Promise<void> {
    return this.memorySystem.updateInteractionEffectiveness(id, effectiveness);
  }

  async updateProjectKnowledge(projectId: string, knowledge: ProjectMemory['knowledge']): Promise<void> {
    return this.memorySystem.updateProjectKnowledge(projectId, knowledge);
  }

  // Optimization Operations (delegated to MemorySystem)
  async compressAndSummarize(
    interactions: InteractionMemory[],
    outcome: RequestMemory['outcome']
  ): Promise<MemoryCompressionResult> {
    return this.memorySystem.compressAndSummarize(interactions, outcome);
  }

  // Analytics Operations (delegated to MemorySystem)
  async getMemoryStats(): Promise<MemoryStats> {
    return this.memorySystem.getMemoryStats();
  }

  async analyzeTrends(projectId: string, timeRange: { start: Date; end: Date }): Promise<{
    requestFrequency: number[];
    successRateOverTime: number[];
    complexityTrends: number[];
    commonPatterns: string[];
  }> {
    return this.memorySystem.analyzeTrends(projectId, timeRange);
  }

  async generateInsights(projectId: string): Promise<{
    strengths: string[];
    improvements: string[];
    recommendations: string[];
  }> {
    return this.memorySystem.generateInsights(projectId);
  }

  // Backward Compatibility Helper Methods
  async extractKeyPatterns(interactions: InteractionMemory[]): Promise<string[]> {
    return this.memorySystem.extractKeyPatterns(interactions);
  }

  async extractImportantOutcomes(interactions: InteractionMemory[], outcome: RequestMemory['outcome']): Promise<string[]> {
    return this.memorySystem.extractImportantOutcomes(interactions, outcome);
  }

  async extractCriticalLearnings(interactions: InteractionMemory[]): Promise<string[]> {
    return this.memorySystem.extractCriticalLearnings(interactions);
  }

  async calculateInteractionEffectiveness(interaction: InteractionMemory, finalOutcome: RequestMemory['outcome']): Promise<number> {
    return this.memorySystem.calculateInteractionEffectiveness(interaction, finalOutcome);
  }

  async extractInteractionPatterns(interaction: InteractionMemory): Promise<string[]> {
    return this.memorySystem.extractInteractionPatterns(interaction);
  }

  async suggestInteractionImprovements(interaction: InteractionMemory): Promise<string[]> {
    return this.memorySystem.suggestInteractionImprovements(interaction);
  }

  async optimizeMemoryUsage(): Promise<void> {
    return this.memorySystem.optimizeMemoryUsage();
  }

  async cleanupExpiredSessions(): Promise<void> {
    return this.memorySystem.cleanupExpiredSessions();
  }

  async compressOldInteractions(threshold: Date): Promise<void> {
    return this.memorySystem.compressOldInteractions(threshold);
  }

  // Additional methods for orchestrator integration
  async initializeRequestMemory(
    userRequest: string,
    projectPath: string,
    sessionId: string
  ): Promise<{ requestId: string; context: ContextualContinuation }> {
    // Generate a unique request ID
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Initialize request memory
    const request: RequestMemory = {
      requestId,
      sessionId,
      userRequest: userRequest,
      projectPath: projectPath,
      timestamp: new Date(),
      duration: 0,
      type: 'general',
      complexity: 1,
      outcome: {
        success: false,
        result: 'pending',
        filesModified: [],
        errorsEncountered: [],
        tokensUsed: 0
      },
      interactions: [],
      learnings: {
        effectivePatterns: [],
        ineffectivePatterns: [],
        timeEstimateAccuracy: 1.0,
        surprisingChallenges: [],
        unexpectedSuccesses: []
      }
    };
    await this.memorySystem.storeRequest(request);

    // Get contextual continuation
    const contextualContinuation = await this.memorySystem.getContextForNewRequest(
      userRequest,
      projectPath,
      sessionId
    );

    return { requestId, context: contextualContinuation };
  }

  async recordInteraction(interaction: InteractionMemory): Promise<void>;
  async recordInteraction(
    requestId: string,
    codemindRequest: any,
    claudeResponse: any
  ): Promise<void>;
  async recordInteraction(
    interactionOrRequestId: InteractionMemory | string,
    codemindRequest?: any,
    claudeResponse?: any
  ): Promise<void> {
    if (typeof interactionOrRequestId === 'string') {
      // Build InteractionMemory from parameters
      const interaction: InteractionMemory = {
        id: `int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        requestId: interactionOrRequestId,
        sessionId: this.sessionId || 'default',
        codemindRequest: codemindRequest,
        claudeResponse: claudeResponse,
        effectiveness: 0.5,
        patterns: [],
        improvements: []
      };
      return this.memorySystem.storeInteraction(interaction);
    } else {
      return this.memorySystem.storeInteraction(interactionOrRequestId);
    }
  }

  async finalizeRequestMemory(
    requestId: string,
    outcome: string,
    results: any
  ): Promise<void> {
    // Update request with final outcome
    const request = await this.memorySystem.loadRequest(requestId);
    if (request) {
      request.outcome = outcome as any;
      request.duration = Date.now() - request.timestamp.getTime();
      await this.memorySystem.storeRequest(request);
    }
  }
}

// Export legacy class and new system for compatibility
export default CodeMindMemorySystem;
export { MemorySystem };
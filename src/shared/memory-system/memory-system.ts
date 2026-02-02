/**
 * Memory System Coordinator
 * SOLID Principles: Dependency Inversion - Depends on abstractions, not concretions
 * Coordinates all memory-related operations using service abstractions
 */

import { Logger } from '../logger';
import {
  IMemoryStorageService,
  IMemoryRetrievalService,
  IMemoryOptimizationService,
  IMemoryAnalyticsService,
  InteractionMemory,
  RequestMemory,
  SessionMemory,
  ProjectMemory,
  ContextualContinuation,
  MemoryStats,
  MemoryCompressionResult
} from './interfaces/index';
import { MemoryStorageService } from './services/memory-storage-service';
import { MemoryRetrievalService } from './services/memory-retrieval-service';
import { MemoryOptimizationService } from './services/memory-optimization-service';
import { MemoryAnalyticsService } from './services/memory-analytics-service';

class MemorySystem {
  private logger: Logger;
  private initialized = false;

  constructor(
    private storageService?: IMemoryStorageService,
    private retrievalService?: IMemoryRetrievalService,
    private optimizationService?: IMemoryOptimizationService,
    private analyticsService?: IMemoryAnalyticsService
  ) {
    this.logger = Logger.getInstance();

    // Initialize services with dependency injection
    this.storageService = this.storageService || new MemoryStorageService();
    this.retrievalService = this.retrievalService || new MemoryRetrievalService(this.storageService);
    this.optimizationService = this.optimizationService || new MemoryOptimizationService(this.storageService);
    this.analyticsService = this.analyticsService || new MemoryAnalyticsService(this.storageService);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.storageService.initialize();
      this.initialized = true;
      this.logger.info('🧠 Memory system initialized');
    } catch (error) {
      this.logger.error('Failed to initialize memory system:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (!this.initialized) return;

    try {
      await this.storageService.close();
      this.initialized = false;
      this.logger.info('🧠 Memory system closed');
    } catch (error) {
      this.logger.error('Failed to close memory system:', error);
      throw error;
    }
  }

  // Storage Operations
  async storeInteraction(interaction: InteractionMemory): Promise<void> {
    await this.ensureInitialized();
    return this.storageService.storeInteraction(interaction);
  }

  async storeRequest(request: RequestMemory): Promise<void> {
    await this.ensureInitialized();
    return this.storageService.storeRequest(request);
  }

  async storeSession(session: SessionMemory): Promise<void> {
    await this.ensureInitialized();
    return this.storageService.storeSession(session);
  }

  async storeProject(project: ProjectMemory): Promise<void> {
    await this.ensureInitialized();
    return this.storageService.storeProject(project);
  }

  async loadInteraction(id: string): Promise<InteractionMemory | null> {
    await this.ensureInitialized();
    return this.storageService.loadInteraction(id);
  }

  async loadRequest(requestId: string): Promise<RequestMemory | null> {
    await this.ensureInitialized();
    return this.storageService.loadRequest(requestId);
  }

  async loadSession(sessionId: string): Promise<SessionMemory | null> {
    await this.ensureInitialized();
    return this.storageService.loadSession(sessionId);
  }

  async loadProject(projectId: string): Promise<ProjectMemory | null> {
    await this.ensureInitialized();
    return this.storageService.loadProject(projectId);
  }

  async updateInteractionEffectiveness(id: string, effectiveness: number): Promise<void> {
    await this.ensureInitialized();
    return this.storageService.updateInteractionEffectiveness(id, effectiveness);
  }

  async updateProjectKnowledge(projectId: string, knowledge: ProjectMemory['knowledge']): Promise<void> {
    await this.ensureInitialized();
    return this.storageService.updateProjectKnowledge(projectId, knowledge);
  }

  // Retrieval Operations
  async getContextForNewRequest(
    userRequest: string,
    projectPath: string,
    sessionId?: string
  ): Promise<ContextualContinuation> {
    await this.ensureInitialized();
    return this.retrievalService.getContextForNewRequest(userRequest, projectPath, sessionId);
  }

  async findSimilarRequests(userRequest: string, projectMemory: ProjectMemory): Promise<RequestMemory[]> {
    await this.ensureInitialized();
    return this.retrievalService.findSimilarRequests(userRequest, projectMemory);
  }

  async findRelevantPatterns(userRequest: string, projectPath: string): Promise<string[]> {
    await this.ensureInitialized();
    return this.retrievalService.findRelevantPatterns(userRequest, projectPath);
  }

  async getProjectMemory(projectPath: string): Promise<ProjectMemory> {
    await this.ensureInitialized();
    return this.retrievalService.getProjectMemory(projectPath);
  }

  async getSessionMemory(sessionId: string): Promise<SessionMemory | null> {
    await this.ensureInitialized();
    return this.retrievalService.getSessionMemory(sessionId);
  }

  // Optimization Operations
  async compressAndSummarize(
    interactions: InteractionMemory[],
    outcome: RequestMemory['outcome']
  ): Promise<MemoryCompressionResult> {
    await this.ensureInitialized();
    return this.optimizationService.compressAndSummarize(interactions, outcome);
  }

  async extractKeyPatterns(interactions: InteractionMemory[]): Promise<string[]> {
    await this.ensureInitialized();
    return this.optimizationService.extractKeyPatterns(interactions);
  }

  async extractImportantOutcomes(interactions: InteractionMemory[], outcome: RequestMemory['outcome']): Promise<string[]> {
    await this.ensureInitialized();
    return this.optimizationService.extractImportantOutcomes(interactions, outcome);
  }

  async extractCriticalLearnings(interactions: InteractionMemory[]): Promise<string[]> {
    await this.ensureInitialized();
    return this.optimizationService.extractCriticalLearnings(interactions);
  }

  async calculateInteractionEffectiveness(interaction: InteractionMemory, finalOutcome: RequestMemory['outcome']): Promise<number> {
    await this.ensureInitialized();
    return this.optimizationService.calculateInteractionEffectiveness(interaction, finalOutcome);
  }

  async extractInteractionPatterns(interaction: InteractionMemory): Promise<string[]> {
    await this.ensureInitialized();
    return this.optimizationService.extractInteractionPatterns(interaction);
  }

  async suggestInteractionImprovements(interaction: InteractionMemory): Promise<string[]> {
    await this.ensureInitialized();
    return this.optimizationService.suggestInteractionImprovements(interaction);
  }

  async optimizeMemoryUsage(): Promise<void> {
    await this.ensureInitialized();
    return this.optimizationService.optimizeMemoryUsage();
  }

  async cleanupExpiredSessions(): Promise<void> {
    await this.ensureInitialized();
    return this.optimizationService.cleanupExpiredSessions();
  }

  async compressOldInteractions(threshold: Date): Promise<void> {
    await this.ensureInitialized();
    return this.optimizationService.compressOldInteractions(threshold);
  }

  // Analytics Operations
  async getMemoryStats(): Promise<MemoryStats> {
    await this.ensureInitialized();
    return this.analyticsService.getMemoryStats();
  }

  async analyzeTrends(projectId: string, timeRange: { start: Date; end: Date }): Promise<{
    requestFrequency: number[];
    successRateOverTime: number[];
    complexityTrends: number[];
    commonPatterns: string[];
  }> {
    await this.ensureInitialized();
    return this.analyticsService.analyzeTrends(projectId, timeRange);
  }

  async generateInsights(projectId: string): Promise<{
    strengths: string[];
    improvements: string[];
    recommendations: string[];
  }> {
    await this.ensureInitialized();
    return this.analyticsService.generateInsights(projectId);
  }

  // Helper Methods
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  // Factory Methods for Testing and Dependency Injection
  static createWithServices(
    storageService: IMemoryStorageService,
    retrievalService: IMemoryRetrievalService,
    optimizationService: IMemoryOptimizationService,
    analyticsService: IMemoryAnalyticsService
  ): MemorySystem {
    return new MemorySystem(storageService, retrievalService, optimizationService, analyticsService);
  }

  static createDefault(): MemorySystem {
    return new MemorySystem();
  }

  // Backward Compatibility Methods (from original CodeSeekerMemorySystem)
  async storeAndRetrieveInteraction(interaction: InteractionMemory): Promise<ContextualContinuation | null> {
    await this.storeInteraction(interaction);

    // Generate context based on the stored interaction
    const projectMemory = await this.getProjectMemory(interaction.sessionId); // Using sessionId as projectPath fallback
    return this.getContextForNewRequest(
      interaction.codeseekerRequest.instruction,
      projectMemory.projectPath,
      interaction.sessionId
    );
  }
}

// Export the main class and convenience factory
export default MemorySystem;
export { MemorySystem };

// Re-export all interfaces for backward compatibility
export * from './interfaces/index';
export * from './services/memory-storage-service';
export * from './services/memory-retrieval-service';
export * from './services/memory-optimization-service';
export * from './services/memory-analytics-service';
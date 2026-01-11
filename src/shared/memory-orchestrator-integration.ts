/**
 * Memory-Orchestrator Integration Layer
 * 
 * Integrates the CodeSeeker Memory System with the Task-Specific File Orchestrator
 * to provide intelligent context continuity and learning across requests.
 */

import { Logger } from './logger';
import { TaskSpecificFileOrchestrator, OrchestrationResult, FileTask } from './task-specific-file-orchestrator';
import { CodeSeekerMemorySystem, InteractionMemory, RequestMemory, ContextualContinuation } from './codeseeker-memory-system';

export interface MemoryOrchestrationOptions {
  useMemoryContext: boolean;
  learnFromInteractions: boolean;
  adaptToProjectPatterns: boolean;
  preserveInteractionHistory: boolean;
  enableSmartContinuation: boolean;
}

export interface MemoryOrchestrationResult extends OrchestrationResult {
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

export class MemoryOrchestrator {
  private logger: Logger;
  private orchestrator: TaskSpecificFileOrchestrator;
  private memorySystem: CodeSeekerMemorySystem;
  private sessionId: string;

  constructor(projectPath: string, sessionId?: string) {
    this.logger = Logger.getInstance();
    this.orchestrator = new TaskSpecificFileOrchestrator(projectPath);
    this.memorySystem = new CodeSeekerMemorySystem();
    this.sessionId = sessionId || this.generateSessionId();
  }

  /**
   * Enhanced orchestration with full memory integration
   */
  async orchestrateWithMemory(
    projectPath: string,
    userRequest: string,
    options: {
      force?: boolean;
      skipCycles?: boolean;
      dryRun?: boolean;
      autoRollback?: boolean;
      memory?: MemoryOrchestrationOptions;
    } = {}
  ): Promise<MemoryOrchestrationResult> {
    const memoryOptions = {
      useMemoryContext: true,
      learnFromInteractions: true,
      adaptToProjectPatterns: true,
      preserveInteractionHistory: true,
      enableSmartContinuation: true,
      ...options.memory
    };

    const startTime = Date.now();

    try {
      this.logger.info('🧠 Starting memory-enhanced orchestration');

      // PHASE 1: Initialize Memory Context
      let requestId: string;
      let contextualContinuation: ContextualContinuation;

      if (memoryOptions.useMemoryContext) {
        const memoryInit = await this.memorySystem.initializeRequestMemory(
          userRequest,
          projectPath,
          this.sessionId
        );
        
        requestId = memoryInit.requestId;
        contextualContinuation = memoryInit.context;

        this.logger.info(`📋 Memory context initialized: ${requestId}`);
        this.logContextualContinuation(contextualContinuation);
      } else {
        requestId = `manual_${Date.now()}`;
        contextualContinuation = this.createEmptyContext();
      }

      // PHASE 2: Enhanced Orchestration with Memory Integration
      const orchestrationResult = await this.runMemoryAwareOrchestration(
        projectPath,
        userRequest,
        requestId,
        contextualContinuation,
        options,
        memoryOptions
      );

      // PHASE 3: Finalize Memory and Extract Learnings
      const memoryFinalization = await this.finalizeMemoryAndLearnings(
        requestId,
        orchestrationResult,
        Date.now() - startTime,
        memoryOptions
      );

      // PHASE 4: Generate Enhanced Result
      const enhancedResult: MemoryOrchestrationResult = {
        ...orchestrationResult,
        memoryContext: {
          requestId,
          contextualContinuation,
          interactionsRecorded: memoryFinalization.interactionsRecorded,
          patternsLearned: memoryFinalization.patternsLearned,
          compressionResult: memoryFinalization.compressionResult
        },
        learningInsights: memoryFinalization.learningInsights
      };

      this.logger.info('🎯 Memory-enhanced orchestration completed');
      return enhancedResult;

    } catch (error: any) {
      this.logger.error('Memory-enhanced orchestration failed:', error.message);
      throw error;
    }
  }

  /**
   * Run orchestration with memory awareness and interaction tracking
   */
  private async runMemoryAwareOrchestration(
    projectPath: string,
    userRequest: string,
    requestId: string,
    contextualContinuation: ContextualContinuation,
    options: any,
    memoryOptions: MemoryOrchestrationOptions
  ): Promise<OrchestrationResult> {

    // Create memory-aware orchestrator wrapper
    const memoryAwareOrchestrator = this.createMemoryAwareWrapper(requestId, memoryOptions);

    // Enhanced user request with contextual continuation
    const enhancedRequest = this.enhanceRequestWithContext(userRequest, contextualContinuation);

    // Run orchestration with interaction tracking
    const result = await memoryAwareOrchestrator.orchestrateRequest(
      projectPath,
      enhancedRequest,
      options
    );

    return result;
  }

  /**
   * Create a memory-aware wrapper around the orchestrator
   */
  private createMemoryAwareWrapper(
    requestId: string,
    memoryOptions: MemoryOrchestrationOptions
  ) {
    const originalOrchestrator = this.orchestrator;
    const memorySystem = this.memorySystem;
    const logger = this.logger;

    // Wrap orchestrator methods to track interactions
    return {
      async orchestrateRequest(projectPath: string, userRequest: string, options: any) {
        // Track the main orchestration request
        if (memoryOptions.learnFromInteractions) {
          await memorySystem.recordInteraction(
            requestId,
            {
              type: 'task',
              instruction: `Orchestrate request: ${userRequest}`,
              context: { projectPath, options },
              priority: 'critical',
              expectedOutcome: 'Complete project implementation'
            },
            {
              success: true,
              output: 'Orchestration started',
              duration: 0,
              tokensUsed: 0,
              metadata: { phase: 'initiation' }
            }
          );
        }

        // Run the actual orchestration
        const result = await originalOrchestrator.orchestrateRequest(projectPath, userRequest, options);

        // Track the orchestration result
        if (memoryOptions.learnFromInteractions) {
          await memorySystem.recordInteraction(
            requestId,
            {
              type: 'task',
              instruction: 'Complete orchestration',
              context: { totalTasks: result.completedTasks.length + result.failedTasks.length },
              priority: 'critical',
              expectedOutcome: 'All tasks completed successfully'
            },
            {
              success: result.success,
              output: result.message,
              duration: 0, // Would be calculated
              tokensUsed: 0, // Would be tracked
              metadata: { 
                completed: result.completedTasks.length,
                failed: result.failedTasks.length,
                integration: result.integrationResult?.success || false
              }
            }
          );
        }

        return result;
      }
    };
  }

  /**
   * Enhance user request with contextual continuation
   */
  private enhanceRequestWithContext(
    userRequest: string,
    contextualContinuation: ContextualContinuation
  ): string {
    const contextualElements = [];

    // Add context about what was done previously
    if (contextualContinuation.previousRequestContext.whatWasDone.length > 0) {
      contextualElements.push(
        `\nRECENT CONTEXT: Previously implemented: ${contextualContinuation.previousRequestContext.whatWasDone.join(', ')}`
      );
    }

    // Add information about building upon previous work
    if (contextualContinuation.currentRequestContext.buildingUpon.length > 0) {
      contextualElements.push(
        `\nBUILDING UPON: This request builds on: ${contextualContinuation.currentRequestContext.buildingUpon.join(', ')}`
      );
    }

    // Add warnings about potential conflicts
    if (contextualContinuation.currentRequestContext.potentialConflicts.length > 0) {
      contextualElements.push(
        `\nPOTENTIAL CONFLICTS: Be aware of: ${contextualContinuation.currentRequestContext.potentialConflicts.join(', ')}`
      );
    }

    // Add suggested approach
    if (contextualContinuation.currentRequestContext.suggestedApproach) {
      contextualElements.push(
        `\nSUGGESTED APPROACH: ${contextualContinuation.currentRequestContext.suggestedApproach}`
      );
    }

    // Add continuity instructions for Claude
    if (contextualContinuation.continuityInstructions.forClaude.length > 0) {
      contextualElements.push(
        `\nCONTINUITY INSTRUCTIONS: ${contextualContinuation.continuityInstructions.forClaude.join('; ')}`
      );
    }

    return userRequest + contextualElements.join('');
  }

  /**
   * Finalize memory and extract learning insights
   */
  private async finalizeMemoryAndLearnings(
    requestId: string,
    orchestrationResult: OrchestrationResult,
    duration: number,
    memoryOptions: MemoryOrchestrationOptions
  ): Promise<{
    interactionsRecorded: number;
    patternsLearned: string[];
    compressionResult: any;
    learningInsights: {
      effectivePatterns: string[];
      improvementSuggestions: string[];
      futureOptimizations: string[];
    };
  }> {

    let interactionsRecorded = 0;
    let patternsLearned: string[] = [];
    let compressionResult = null;

    if (memoryOptions.preserveInteractionHistory) {
      // Finalize memory for this request
      const outcome = {
        success: orchestrationResult.success,
        tasksCompleted: orchestrationResult.completedTasks.length,
        tasksFailed: orchestrationResult.failedTasks.length,
        integrationResult: orchestrationResult.integrationResult,
        branchMerged: orchestrationResult.integrationResult?.branchMerged || false,
        filesChanged: orchestrationResult.completedTasks.map(t => t.filePath)
      };

      compressionResult = await this.memorySystem.finalizeRequestMemory(
        requestId,
        outcome.success ? 'completed' : 'failed',
        outcome
      );

      interactionsRecorded = compressionResult.original.interactionCount;
      patternsLearned = compressionResult.summary.keyPatterns;
    }

    // Extract learning insights
    const learningInsights = {
      effectivePatterns: this.extractEffectivePatterns(orchestrationResult),
      improvementSuggestions: this.generateImprovementSuggestions(orchestrationResult),
      futureOptimizations: this.identifyFutureOptimizations(orchestrationResult)
    };

    return {
      interactionsRecorded,
      patternsLearned,
      compressionResult,
      learningInsights
    };
  }

  /**
   * Get memory-enhanced context for a request
   */
  async getEnhancedContext(
    userRequest: string,
    projectPath: string
  ): Promise<{
    memoryContext: any;
    similarRequests: any[];
    suggestedApproach: string;
    potentialChallenges: string[];
    estimatedComplexity: number;
    estimatedDuration: number;
  }> {
    try {
      const context = await this.memorySystem.getContextForNewRequest(
        userRequest,
        projectPath,
        this.sessionId
      );

      return {
        memoryContext: context,
        similarRequests: context.similarPastRequests,
        suggestedApproach: context.suggestedApproach,
        potentialChallenges: context.potentialChallenges,
        estimatedComplexity: this.complexityToNumber(context.estimatedComplexity),
        estimatedDuration: context.estimatedDuration
      };

    } catch (error: any) {
      this.logger.error('Failed to get enhanced context:', error.message);
      throw error;
    }
  }

  /**
   * Get memory system statistics
   */
  async getMemoryStats() {
    return await this.memorySystem.getMemoryStats();
  }

  // Private helper methods

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  private complexityToNumber(complexity?: 'low' | 'medium' | 'high' | 'critical'): number {
    switch (complexity) {
      case 'low': return 1;
      case 'medium': return 2;
      case 'high': return 3;
      case 'critical': return 4;
      default: return 2; // default to medium
    }
  }

  private createEmptyContext(): ContextualContinuation {
    return {
      requestId: `empty_${Date.now()}`,
      continuationContext: '',
      suggestedApproach: '',
      potentialChallenges: [],
      estimatedDuration: 0,
      estimatedComplexity: 'medium',
      similarPastRequests: [],
      relevantPatterns: [],
      projectContext: {
        recentChanges: [],
        currentFocus: '',
        upcomingMilestones: []
      },
      previousRequestContext: {
        whatWasDone: [],
        howItWasDone: [],
        keyOutcomes: [],
        lessonsLearned: []
      },
      currentRequestContext: {
        userRequest: '',
        projectPath: '',
        sessionId: '',
        startTime: new Date(),
        relatedToPrevious: false,
        buildingUpon: [],
        potentialConflicts: [],
        suggestedApproach: ''
      },
      continuityInstructions: {
        forCodeSeeker: [],
        forClaude: []
      }
    };
  }

  private logContextualContinuation(context: ContextualContinuation): void {
    if (context.previousRequestContext.whatWasDone.length > 0) {
      this.logger.info(`📝 Previous work: ${context.previousRequestContext.whatWasDone.join(', ')}`);
    }
    
    if (context.currentRequestContext.buildingUpon.length > 0) {
      this.logger.info(`🏗️ Building upon: ${context.currentRequestContext.buildingUpon.join(', ')}`);
    }
    
    if (context.currentRequestContext.suggestedApproach) {
      this.logger.info(`💡 Suggested approach: ${context.currentRequestContext.suggestedApproach}`);
    }
  }

  private extractEffectivePatterns(result: OrchestrationResult): string[] {
    const patterns = [];
    
    if (result.success) {
      patterns.push('full-orchestration-success');
    }
    
    if (result.integrationResult?.success) {
      patterns.push('integration-success');
    }
    
    if (result.integrationResult?.compilationFixed) {
      patterns.push('auto-compilation-fix');
    }
    
    return patterns;
  }

  private generateImprovementSuggestions(result: OrchestrationResult): string[] {
    const suggestions = [];
    
    if (result.failedTasks.length > 0) {
      suggestions.push(`Consider breaking down complex tasks (${result.failedTasks.length} failed)`);
    }
    
    if (!result.integrationResult?.success) {
      suggestions.push('Improve integration pipeline robustness');
    }
    
    return suggestions;
  }

  private identifyFutureOptimizations(result: OrchestrationResult): string[] {
    const optimizations = [];
    
    if (result.completedTasks.length > 20) {
      optimizations.push('Consider parallel task execution for large requests');
    }
    
    if (result.integrationResult?.fixesApplied.length > 0) {
      optimizations.push('Improve initial code generation to reduce auto-fixes needed');
    }
    
    return optimizations;
  }
}

export default MemoryOrchestrator;
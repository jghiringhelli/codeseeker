/**
 * Memory Retrieval Service
 * SOLID Principles: Single Responsibility - Handle memory retrieval and context generation only
 */

import { Logger } from '../../logger';
import * as crypto from 'crypto';
import {
  IMemoryRetrievalService,
  IMemoryStorageService,
  ContextualContinuation,
  RequestMemory,
  ProjectMemory,
  SessionMemory
} from '../interfaces/index';

export class MemoryRetrievalService implements IMemoryRetrievalService {
  private logger = Logger.getInstance();

  constructor(private storageService: IMemoryStorageService) {}

  async getContextForNewRequest(
    userRequest: string,
    projectPath: string,
    sessionId?: string
  ): Promise<ContextualContinuation> {
    try {
      this.logger.debug(`Generating context for request: "${userRequest.substring(0, 100)}..."`);

      const requestId = this.generateRequestId(userRequest, sessionId || 'default');

      // Load project memory
      const projectMemory = await this.getProjectMemory(projectPath);

      // Find similar past requests
      const similarRequests = await this.findSimilarRequests(userRequest, projectMemory);

      // Find relevant patterns
      const relevantPatterns = await this.findRelevantPatterns(userRequest, projectPath);

      // Generate contextual suggestions
      const suggestedApproach = await this.suggestApproach(userRequest, similarRequests, relevantPatterns);
      const potentialChallenges = await this.predictChallenges(userRequest, projectMemory, similarRequests);
      const estimatedDuration = await this.estimateDuration(userRequest, projectMemory, similarRequests);

      // Get project context
      const projectContext = await this.getProjectContext(projectMemory, sessionId);

      const continuation: ContextualContinuation = {
        requestId,
        continuationContext: this.generateContinuationContext(userRequest, projectMemory, similarRequests),
        suggestedApproach,
        potentialChallenges,
        estimatedDuration,
        similarPastRequests: similarRequests.slice(0, 5), // Top 5 most similar
        relevantPatterns,
        projectContext
      };

      this.logger.debug(`Generated context with ${similarRequests.length} similar requests and ${relevantPatterns.length} patterns`);

      return continuation;
    } catch (error) {
      this.logger.error('Failed to generate context for new request:', error);
      return this.getDefaultContext(userRequest, projectPath);
    }
  }

  async findSimilarRequests(userRequest: string, projectMemory: ProjectMemory): Promise<RequestMemory[]> {
    try {
      // Simple similarity matching based on keywords and patterns
      const requestKeywords = this.extractKeywords(userRequest.toLowerCase());
      const similarRequests: Array<{ request: RequestMemory; similarity: number }> = [];

      // For now, simulate similarity matching
      // In a real implementation, this would use embeddings or semantic search
      const mockSimilarRequests: RequestMemory[] = [];

      // Calculate similarity scores
      for (const pastRequest of mockSimilarRequests) {
        const pastKeywords = this.extractKeywords(pastRequest.userRequest.toLowerCase());
        const similarity = this.calculateKeywordSimilarity(requestKeywords, pastKeywords);

        if (similarity > 0.3) { // Threshold for similarity
          similarRequests.push({ request: pastRequest, similarity });
        }
      }

      // Sort by similarity and return top matches
      return similarRequests
        .sort((a, b) => b.similarity - a.similarity)
        .map(item => item.request)
        .slice(0, 10);

    } catch (error) {
      this.logger.error('Failed to find similar requests:', error);
      return [];
    }
  }

  async findRelevantPatterns(userRequest: string, projectPath: string): Promise<string[]> {
    try {
      const patterns: string[] = [];
      const requestLower = userRequest.toLowerCase();

      // Pattern matching based on request content
      if (requestLower.includes('add') || requestLower.includes('create')) {
        patterns.push('creation_pattern');
      }
      if (requestLower.includes('fix') || requestLower.includes('debug') || requestLower.includes('error')) {
        patterns.push('debugging_pattern');
      }
      if (requestLower.includes('refactor') || requestLower.includes('improve')) {
        patterns.push('improvement_pattern');
      }
      if (requestLower.includes('test')) {
        patterns.push('testing_pattern');
      }
      if (requestLower.includes('api') || requestLower.includes('endpoint')) {
        patterns.push('api_pattern');
      }
      if (requestLower.includes('database') || requestLower.includes('db')) {
        patterns.push('database_pattern');
      }
      if (requestLower.includes('ui') || requestLower.includes('component')) {
        patterns.push('ui_pattern');
      }

      // Load project-specific patterns
      const projectMemory = await this.getProjectMemory(projectPath);
      const effectivePatterns = projectMemory.performance.mostEffectivePatterns || [];

      // Add project-specific patterns that might be relevant
      patterns.push(...effectivePatterns.filter(pattern =>
        this.isPatternRelevant(pattern, userRequest)
      ));

      return [...new Set(patterns)]; // Remove duplicates
    } catch (error) {
      this.logger.error('Failed to find relevant patterns:', error);
      return [];
    }
  }

  async getProjectMemory(projectPath: string): Promise<ProjectMemory> {
    try {
      const projectId = this.generateProjectId(projectPath);
      let projectMemory = await this.storageService.loadProject(projectId);

      if (!projectMemory) {
        // Create new project memory
        projectMemory = this.createDefaultProjectMemory(projectId, projectPath);
        await this.storageService.storeProject(projectMemory);
      }

      return projectMemory;
    } catch (error) {
      this.logger.error('Failed to get project memory:', error);
      return this.createDefaultProjectMemory(this.generateProjectId(projectPath), projectPath);
    }
  }

  async getSessionMemory(sessionId: string): Promise<SessionMemory | null> {
    try {
      return await this.storageService.loadSession(sessionId);
    } catch (error) {
      this.logger.error(`Failed to get session memory for ${sessionId}:`, error);
      return null;
    }
  }

  private generateRequestId(userRequest: string, sessionId: string): string {
    const hash = crypto.createHash('md5');
    hash.update(userRequest + sessionId + Date.now().toString());
    return hash.digest('hex');
  }

  private generateProjectId(projectPath: string): string {
    const hash = crypto.createHash('md5');
    hash.update(projectPath);
    return hash.digest('hex');
  }

  private extractKeywords(text: string): string[] {
    // Simple keyword extraction
    return text
      .split(/\s+/)
      .filter(word => word.length > 2)
      .filter(word => !this.isStopWord(word))
      .slice(0, 10); // Top 10 keywords
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'can', 'will', 'should', 'could', 'would', 'is', 'are', 'was', 'were', 'be', 'been',
      'have', 'has', 'had', 'do', 'does', 'did', 'this', 'that', 'these', 'those'
    ]);
    return stopWords.has(word.toLowerCase());
  }

  private calculateKeywordSimilarity(keywords1: string[], keywords2: string[]): number {
    if (keywords1.length === 0 || keywords2.length === 0) return 0;

    const set1 = new Set(keywords1);
    const set2 = new Set(keywords2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  private isPatternRelevant(pattern: string, userRequest: string): boolean {
    const requestLower = userRequest.toLowerCase();
    const patternLower = pattern.toLowerCase();

    // Simple relevance matching
    const patternKeywords = patternLower.split('_');
    return patternKeywords.some(keyword => requestLower.includes(keyword));
  }

  private async suggestApproach(
    userRequest: string,
    similarRequests: RequestMemory[],
    patterns: string[]
  ): Promise<string> {
    if (similarRequests.length === 0) {
      return this.generateGenericApproach(userRequest, patterns);
    }

    // Analyze successful similar requests
    const successfulRequests = similarRequests.filter(r => r.outcome.success);

    if (successfulRequests.length > 0) {
      const mostSuccessful = successfulRequests[0];
      return `Based on similar request "${mostSuccessful.userRequest.substring(0, 50)}...", ` +
             `consider following a ${mostSuccessful.type} approach. ` +
             `Previous duration: ${Math.round(mostSuccessful.duration / 1000)}s. ` +
             `Key learnings: ${mostSuccessful.learnings.effectivePatterns.slice(0, 2).join(', ')}.`;
    }

    return this.generateGenericApproach(userRequest, patterns);
  }

  private generateGenericApproach(userRequest: string, patterns: string[]): string {
    const requestLower = userRequest.toLowerCase();

    if (requestLower.includes('add') || requestLower.includes('create')) {
      return 'Start by analyzing existing patterns, then create the new feature incrementally with proper testing.';
    }
    if (requestLower.includes('fix') || requestLower.includes('debug')) {
      return 'Begin by reproducing the issue, identify the root cause, then implement a targeted fix.';
    }
    if (requestLower.includes('refactor')) {
      return 'First ensure comprehensive test coverage, then refactor incrementally while maintaining functionality.';
    }
    if (requestLower.includes('test')) {
      return 'Analyze the code to test, write comprehensive test cases covering edge cases and happy paths.';
    }

    return 'Break down the request into smaller tasks, analyze dependencies, and implement systematically.';
  }

  private async predictChallenges(
    userRequest: string,
    projectMemory: ProjectMemory,
    similarRequests: RequestMemory[]
  ): Promise<string[]> {
    const challenges: string[] = [];
    const requestLower = userRequest.toLowerCase();

    // General challenges based on request type
    if (requestLower.includes('database')) {
      challenges.push('Data migration compatibility', 'Query performance impact');
    }
    if (requestLower.includes('api')) {
      challenges.push('Breaking changes to existing clients', 'Authentication/authorization');
    }
    if (requestLower.includes('refactor')) {
      challenges.push('Maintaining backward compatibility', 'Test coverage gaps');
    }
    if (requestLower.includes('test')) {
      challenges.push('Mocking complex dependencies', 'Test data setup');
    }

    // Project-specific challenges
    if (projectMemory.performance.commonFailurePoints) {
      challenges.push(...projectMemory.performance.commonFailurePoints.slice(0, 2));
    }

    // Challenges from similar requests
    const pastChallenges = similarRequests
      .flatMap(r => r.learnings.surprisingChallenges)
      .slice(0, 3);
    challenges.push(...pastChallenges);

    return [...new Set(challenges)].slice(0, 5); // Top 5 unique challenges
  }

  private async estimateDuration(
    userRequest: string,
    projectMemory: ProjectMemory,
    similarRequests: RequestMemory[]
  ): Promise<number> {
    // Base estimation in seconds
    let estimatedDuration = 300; // 5 minutes default

    // Adjust based on project complexity
    switch (projectMemory.profile.complexity) {
      case 'simple':
        estimatedDuration *= 0.7;
        break;
      case 'moderate':
        estimatedDuration *= 1.0;
        break;
      case 'complex':
        estimatedDuration *= 1.5;
        break;
      case 'enterprise':
        estimatedDuration *= 2.0;
        break;
    }

    // Adjust based on similar requests
    if (similarRequests.length > 0) {
      const avgDuration = similarRequests.reduce((sum, r) => sum + r.duration, 0) / similarRequests.length;
      estimatedDuration = (estimatedDuration + avgDuration) / 2;
    }

    // Adjust based on request type
    const requestLower = userRequest.toLowerCase();
    if (requestLower.includes('refactor') || requestLower.includes('architecture')) {
      estimatedDuration *= 2.0;
    } else if (requestLower.includes('fix') || requestLower.includes('debug')) {
      estimatedDuration *= 1.5;
    } else if (requestLower.includes('test')) {
      estimatedDuration *= 0.8;
    }

    return Math.max(60, Math.min(3600, estimatedDuration)); // Between 1 minute and 1 hour
  }

  private async getProjectContext(projectMemory: ProjectMemory, sessionId?: string): Promise<ContextualContinuation['projectContext']> {
    const recentChanges: string[] = [];
    const currentFocus = 'Development'; // Default
    const upcomingMilestones: string[] = [];

    // Extract recent changes from project evolution
    if (projectMemory.evolution.majorMilestones.length > 0) {
      const recentMilestones = projectMemory.evolution.majorMilestones
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, 3);

      recentChanges.push(...recentMilestones.map(m => m.description));
    }

    // Get session-specific context if available
    if (sessionId) {
      const sessionMemory = await this.getSessionMemory(sessionId);
      if (sessionMemory) {
        recentChanges.push(...sessionMemory.summary.majorChangesImplemented);
      }
    }

    return {
      recentChanges: recentChanges.slice(0, 5),
      currentFocus,
      upcomingMilestones: upcomingMilestones.slice(0, 3)
    };
  }

  private generateContinuationContext(
    userRequest: string,
    projectMemory: ProjectMemory,
    similarRequests: RequestMemory[]
  ): string {
    const context = [];

    context.push(`Project: ${projectMemory.profile.language} ${projectMemory.profile.framework} application`);
    context.push(`Complexity: ${projectMemory.profile.complexity}`);
    context.push(`Success rate: ${Math.round(projectMemory.performance.averageSuccessRate * 100)}%`);

    if (similarRequests.length > 0) {
      context.push(`Similar requests found: ${similarRequests.length}`);
      const successfulCount = similarRequests.filter(r => r.outcome.success).length;
      context.push(`Previous success rate: ${Math.round((successfulCount / similarRequests.length) * 100)}%`);
    }

    if (projectMemory.performance.mostEffectivePatterns.length > 0) {
      context.push(`Effective patterns: ${projectMemory.performance.mostEffectivePatterns.slice(0, 3).join(', ')}`);
    }

    return context.join('; ');
  }

  private createDefaultProjectMemory(projectId: string, projectPath: string): ProjectMemory {
    return {
      projectId,
      projectPath,
      profile: {
        language: 'Unknown',
        framework: 'Unknown',
        architecture: 'Unknown',
        complexity: 'moderate',
        domain: 'Unknown'
      },
      performance: {
        totalRequests: 0,
        averageSuccessRate: 0.8,
        averageRequestTime: 300,
        commonFailurePoints: [],
        mostEffectivePatterns: []
      },
      evolution: {
        majorMilestones: [],
        architecturalChanges: [],
        dependencyEvolution: []
      },
      knowledge: {
        codingPatterns: new Map(),
        commonSolutions: new Map(),
        bestPractices: [],
        antiPatterns: [],
        projectSpecificKnowledge: {}
      }
    };
  }

  private getDefaultContext(userRequest: string, projectPath: string): ContextualContinuation {
    return {
      requestId: this.generateRequestId(userRequest, 'default'),
      continuationContext: `New request for project at ${projectPath}`,
      suggestedApproach: this.generateGenericApproach(userRequest, []),
      potentialChallenges: ['Unfamiliar codebase', 'Dependency complexity'],
      estimatedDuration: 300,
      similarPastRequests: [],
      relevantPatterns: [],
      projectContext: {
        recentChanges: [],
        currentFocus: 'Development',
        upcomingMilestones: []
      }
    };
  }
}
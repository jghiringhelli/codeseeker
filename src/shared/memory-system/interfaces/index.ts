/**
 * Memory System Service Interfaces
 * SOLID Principles: Interface Segregation - Specific interfaces for each memory concern
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

  // CodeMind → Claude Code interaction
  codemindRequest: {
    type: 'task' | 'validation' | 'fix' | 'analysis';
    instruction: string;
    context: any;
    priority: 'critical' | 'high' | 'medium' | 'low';
    expectedOutcome: string;
  };

  // Claude Code response
  claudeResponse: {
    success: boolean;
    output: string;
    duration: number;
    tokensUsed: number;
    errorDetails?: string;
    metadata: any;
  };

  // Learning data
  effectiveness: number; // 0-1 score
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
  type: 'code_modification' | 'analysis' | 'general';
  complexity: number;
  outcome: {
    success: boolean;
    result: string;
    filesModified: string[];
    errorsEncountered: string[];
    tokensUsed: number;
  };
  interactions: InteractionMemory[];
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

  // Session context
  context: {
    projectState: any;
    workingDirectory: string;
    gitBranch: string;
    lastSnapshot: string;
  };

  // All requests in this session
  requests: RequestMemory[];

  // Session patterns
  patterns: {
    commonRequestTypes: string[];
    workflowPreferences: any;
    effectiveStrategies: string[];
    recurringChallenges: string[];
  };

  // Session summary (condensed)
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

  // Project characteristics
  profile: {
    language: string;
    framework: string;
    architecture: string;
    complexity: 'simple' | 'moderate' | 'complex' | 'enterprise';
    domain: string;
    teamSize?: number;
  };

  // Historical performance
  performance: {
    totalRequests: number;
    averageSuccessRate: number;
    averageRequestTime: number;
    commonFailurePoints: string[];
    mostEffectivePatterns: string[];
  };

  // Code evolution tracking
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

  // Knowledge base
  knowledge: {
    codingPatterns: Map<string, number>; // pattern -> effectiveness score
    commonSolutions: Map<string, any>; // problem -> solution approaches
    bestPractices: string[];
    antiPatterns: string[];
    projectSpecificKnowledge: any;
  };
}

export interface ContextualContinuation {
  requestId: string;
  continuationContext: string;
  suggestedApproach: string;
  potentialChallenges: string[];
  estimatedDuration: number;
  estimatedComplexity?: 'low' | 'medium' | 'high' | 'critical';
  similarPastRequests: RequestMemory[];
  relevantPatterns: string[];
  continuityInstructions?: {
    forClaude: string[];
    forCodeMind: string[];
  };
  projectContext: {
    recentChanges: string[];
    currentFocus: string;
    upcomingMilestones: string[];
  };
  previousRequestContext: {
    whatWasDone: string[];
    howItWasDone?: string[];
    keyOutcomes: string[];
    lessonsLearned: string[];
  };
  currentRequestContext: {
    userRequest: string;
    projectPath: string;
    sessionId: string;
    startTime: Date;
    buildingUpon: string[];
    potentialConflicts: string[];
    suggestedApproach?: string;
    challenges?: string[];
    opportunities?: string[];
    relatedToPrevious?: boolean;
  };
}

export interface MemoryStats {
  totalInteractions: number;
  totalRequests: number;
  totalProjects: number;
  totalSessions: number;
  memoryUsage: {
    immediate: number;
    session: number;
    project: number;
    global: number;
    total: number;
  };
  compressionStats: {
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
  };
  performance: {
    averageResponseTime: number;
    successRate: number;
    mostEffectivePatterns: string[];
  };
}

// Service Interfaces (SOLID: Interface Segregation)
export interface IMemoryStorageService {
  initialize(): Promise<void>;
  close(): Promise<void>;

  storeInteraction(interaction: InteractionMemory): Promise<void>;
  storeRequest(request: RequestMemory): Promise<void>;
  storeSession(session: SessionMemory): Promise<void>;
  storeProject(project: ProjectMemory): Promise<void>;

  loadInteraction(id: string): Promise<InteractionMemory | null>;
  loadRequest(requestId: string): Promise<RequestMemory | null>;
  loadSession(sessionId: string): Promise<SessionMemory | null>;
  loadProject(projectId: string): Promise<ProjectMemory | null>;

  updateInteractionEffectiveness(id: string, effectiveness: number): Promise<void>;
  updateProjectKnowledge(projectId: string, knowledge: ProjectMemory['knowledge']): Promise<void>;
}

export interface IMemoryRetrievalService {
  getContextForNewRequest(
    userRequest: string,
    projectPath: string,
    sessionId?: string
  ): Promise<ContextualContinuation>;

  findSimilarRequests(userRequest: string, projectMemory: ProjectMemory): Promise<RequestMemory[]>;
  findRelevantPatterns(userRequest: string, projectPath: string): Promise<string[]>;
  getProjectMemory(projectPath: string): Promise<ProjectMemory>;
  getSessionMemory(sessionId: string): Promise<SessionMemory | null>;
}

export interface IMemoryOptimizationService {
  compressAndSummarize(interactions: InteractionMemory[], outcome: RequestMemory['outcome']): Promise<MemoryCompressionResult>;

  extractKeyPatterns(interactions: InteractionMemory[]): string[];
  extractImportantOutcomes(interactions: InteractionMemory[], outcome: RequestMemory['outcome']): string[];
  extractCriticalLearnings(interactions: InteractionMemory[]): string[];

  calculateInteractionEffectiveness(interaction: InteractionMemory, finalOutcome: RequestMemory['outcome']): number;
  extractInteractionPatterns(interaction: InteractionMemory): string[];
  suggestInteractionImprovements(interaction: InteractionMemory): string[];

  optimizeMemoryUsage(): Promise<void>;
  cleanupExpiredSessions(): Promise<void>;
  compressOldInteractions(threshold: Date): Promise<void>;
}

export interface IMemoryAnalyticsService {
  getMemoryStats(): Promise<MemoryStats>;
  analyzeTrends(projectId: string, timeRange: { start: Date; end: Date }): Promise<{
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
}
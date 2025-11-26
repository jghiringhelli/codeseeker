/**
 * Workflow Orchestrator Interfaces
 * SOLID Principles: Interface Segregation - Separate interfaces for different orchestration concerns
 */

// Core workflow types
export interface UserFeatureRequest {
  query: string;
  userId?: string;
  projectId: string;
  timestamp: number;
}

export interface ProcessedIntent {
  intention: string;
  complexity: 'simple' | 'medium' | 'complex';
  estimatedFiles: number;
  suggestedTools: string[];
  riskLevel: 'low' | 'medium' | 'high';
  primaryDomains: string[];
  timeEstimate: number;
  confidence: number;
}

export interface SubTask {
  id: string;
  description: string;
  files: string[];
  dependencies: string[];
  estimatedTime: number;
  priority: number;
}

export interface QualityCheckResult {
  compilation: { success: boolean; errors: any[] };
  tests: { passed: number; failed: number; coverage: number };
  codeQuality: { solidPrinciples: boolean; security: boolean; architecture: boolean };
  overallScore: number;
  issues?: string[];
  analysisDetails?: {
    linting: { penalty: number; issues: string[] };
    security: { penalty: number; issues: string[] };
    dependencies: { penalty: number; issues: string[] };
    complexity: { penalty: number; issues: string[] };
    testing: { penalty: number; issues: string[]; results: any };
    taskExecution: { penalty: number; issues: string[] };
  };
}

export interface WorkflowResult {
  success: boolean;
  filesModified: string[];
  qualityScore: number;
  gitBranch: string;
  databases: {
    neo4j: { nodesCreated: number; relationshipsCreated: number };
    redis: { filesUpdated: number; hashesUpdated: number };
    postgres: { recordsUpdated: number };
  };
  summary: string;
}

export interface SubTaskResult {
  taskId: string;
  success: boolean;
  filesModified: string[];
  output: string;
  duration: number;
  error?: string;
}

export interface EnhancementContext {
  totalFiles: number;
  contextSize: number;
  relevantFiles: string[];
  relationships: any[];
  searchResults: any[];
}

// Service interfaces following SOLID principles
export interface IIntentAnalysisService {
  analyzeIntentAndSelectTools(request: UserFeatureRequest): Promise<ProcessedIntent>;
  mapComplexity(confidence: number): 'simple' | 'medium' | 'complex';
  estimateFiles(category: string): number;
  suggestTools(category: string): string[];
  assessRisk(category: string): 'low' | 'medium' | 'high';
}

export interface IContextGatheringService {
  gatherSemanticContext(query: string, intent: ProcessedIntent): Promise<EnhancementContext>;
  buildEnhancedContext(searchResults: any[], relationships: any[]): EnhancementContext;
  optimizeContextForTokens(context: EnhancementContext, maxTokens: number): EnhancementContext;
}

export interface IGitWorkflowService {
  createFeatureBranch(workflowId: string, description: string): Promise<string>;
  finalizeChanges(
    branch: string,
    quality: QualityCheckResult,
    results: SubTaskResult[],
    isReport: boolean
  ): Promise<WorkflowResult>;
  rollbackChanges(workflowId: string): Promise<void>;
  commitChanges(branch: string, message: string, files: string[]): Promise<void>;
}

export interface ITaskOrchestrationService {
  splitIntoSubTasks(
    request: UserFeatureRequest,
    intent: ProcessedIntent,
    context: EnhancementContext
  ): Promise<SubTask[]>;
  processAllSubTasks(tasks: SubTask[], context: EnhancementContext): Promise<SubTaskResult[]>;
  executeSubTask(task: SubTask, context: EnhancementContext): Promise<SubTaskResult>;
}

export interface IQualityAssuranceService {
  runQualityChecks(results: SubTaskResult[]): Promise<QualityCheckResult>;
  validateCompilation(filesModified: string[]): Promise<{ success: boolean; errors: any[] }>;
  runTests(projectPath: string): Promise<{ passed: number; failed: number; coverage: number }>;
  checkCodeQuality(filesModified: string[]): Promise<{ solidPrinciples: boolean; security: boolean; architecture: boolean }>;
}

export interface IDatabaseSyncService {
  updateAllDatabases(filesModified: string[], context: EnhancementContext): Promise<{
    neo4j: { nodesCreated: number; relationshipsCreated: number };
    redis: { filesUpdated: number; hashesUpdated: number };
    postgres: { recordsUpdated: number };
  }>;
  updateNeo4jGraph(files: string[]): Promise<{ nodesCreated: number; relationshipsCreated: number }>;
  updateRedisCache(files: string[]): Promise<{ filesUpdated: number; hashesUpdated: number }>;
  updatePostgresRecords(files: string[]): Promise<{ recordsUpdated: number }>;
}

export interface IWorkflowOrchestrator {
  executeFeatureRequest(request: UserFeatureRequest): Promise<WorkflowResult>;
}
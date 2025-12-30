/**
 * Claude Integration Interfaces
 * SOLID Principles: Interface Segregation - Separate interfaces for different responsibilities
 */

// Core types
export interface ClaudeCodeOptions {
  projectPath?: string;
  maxTokens?: number;
  temperature?: number;
  resumeToken?: string;
}

export interface ClaudeCodeResponse {
  success: boolean;
  data?: any;
  error?: string;
  tokensUsed?: number;
  resumeToken?: string;
}

export interface AnalysisResult {
  architecture: {
    type: string;
    patterns: string[];
    frameworks: string[];
    designPrinciples: string[];
  };
  dependencies: {
    files: Array<{
      file: string;
      dependencies: string[];
      type: 'import' | 'require' | 'reference';
    }>;
    relationships: Array<{
      from: string;
      to: string;
      type: string;
      strength: number;
    }>;
  };
  useCases: Array<{
    name: string;
    description: string;
    actors: string[];
    preconditions: string[];
    steps: string[];
    postconditions: string[];
    businessValue: string;
  }>;
  codeQuality: {
    score: number;
    issues: string[];
    recommendations: string[];
  };
  resumeToken: string;
}

export interface ProjectContext {
  structure: string;
  dependencies: string;
  configuration: string;
  readme: string;
  keyFiles: string[];
}

export interface ProcessingResult {
  success: boolean;
  finalPrompt: string;
  chunksProcessed: number;
  tokensUsed: number;
  error?: string;
}

export interface CommandExecutionOptions {
  projectPath?: string;
  maxTokens?: number;
  outputFormat?: string;
  timeout?: number;
}

export interface CommandExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  tokensUsed?: number;
  executionTime?: number;
}

// Service interfaces following SOLID principles
export interface IClaudeExecutionService {
  executeClaudeCode(prompt: string, context: string, options?: ClaudeCodeOptions): Promise<ClaudeCodeResponse>;
  executeCommand(command: string, options?: CommandExecutionOptions): Promise<CommandExecutionResult>;
}

export interface IPromptProcessingService {
  processLargePrompt(prompt: string, projectPath: string, originalRequest: string): Promise<ProcessingResult>;
  chunkPrompt(prompt: string, maxChunkSize: number): string[];
  compressContext(context: string): Promise<string>;
}

export interface IProjectAnalysisService {
  analyzeProject(projectPath: string, resumeToken?: string): Promise<AnalysisResult>;
  buildProjectContext(projectPath: string): Promise<ProjectContext>;
  extractUseCases(projectPath: string, context: string): Promise<AnalysisResult['useCases']>;
  assessCodeQuality(projectPath: string, context: string): Promise<AnalysisResult['codeQuality']>;
}

export interface ISessionManagementService {
  getSessionForProject(projectPath: string): Promise<string>;
  startNewSession(projectPath: string): Promise<string>;
  endSession(sessionId: string): Promise<void>;
  cleanupExpiredSessions(): Promise<void>;
}

export interface IRequestProcessingService {
  processRequest(userRequest: string, projectPath: string, options?: ClaudeCodeOptions): Promise<ClaudeCodeResponse>;
  validateRequest(request: string): { valid: boolean; error?: string };
  sanitizeInput(input: string): string;
}

export interface IContextBuilderService {
  buildProjectContext(projectPath: string): Promise<ProjectContext>;
  buildRequestContext(userRequest: string, projectPath: string): Promise<string>;
  extractKeyFiles(projectPath: string): Promise<string[]>;
  generateStructureOverview(projectPath: string): Promise<string>;
}

export interface IResponseParsingService {
  parseAnalysisResult(response: string): AnalysisResult;
  parseClaudeResponse(response: string): { data: any; tokensUsed?: number };
  validateResponseFormat(response: string): { valid: boolean; error?: string };
  extractStructuredData(response: string): any;
}
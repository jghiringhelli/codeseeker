/**
 * Claude Code Integration Service (SOLID Refactored)
 * SOLID Principles: Dependency Inversion - Coordinator depends on service abstractions
 * Coordinates all Claude Code integration operations using focused services
 */

import { Logger } from '../../utils/logger';
import { DatabaseConnections } from '../../config/database-config';
import {
  ClaudeCodeOptions,
  ClaudeCodeResponse,
  AnalysisResult,
  ProjectContext,
  IClaudeExecutionService,
  IPromptProcessingService,
  IProjectAnalysisService,
  ISessionManagementService,
  IRequestProcessingService,
  IContextBuilderService,
  IResponseParsingService
} from './interfaces/index';
import { ClaudeExecutionService } from './services/claude-execution-service';
import { PromptProcessingService } from './services/prompt-processing-service';
import { ProjectAnalysisService } from './services/project-analysis-service';
import { SessionManagementService } from './services/session-management-service';
import { RequestProcessingService } from './services/request-processing-service';
import { ClaudeResponseParser } from './services/claude-response-parser';
import { ProjectContextBuilder } from './services/project-context-builder';

// Re-export interfaces and types for backward compatibility
export {
  ClaudeCodeOptions,
  ClaudeCodeResponse,
  AnalysisResult,
  ProjectContext
} from './interfaces/index';

class ClaudeCodeIntegration {
  private dbConnections: DatabaseConnections;
  private logger = Logger.getInstance();
  private initialized = false;

  constructor(
    private executionService?: IClaudeExecutionService,
    private promptService?: IPromptProcessingService,
    private analysisService?: IProjectAnalysisService,
    private sessionManager?: ISessionManagementService,
    private requestProcessor?: IRequestProcessingService,
    private contextBuilder?: IContextBuilderService,
    private responseParser?: IResponseParsingService
  ) {
    this.dbConnections = new DatabaseConnections();

    // Initialize services with dependency injection
    this.executionService = this.executionService || new ClaudeExecutionService();
    this.promptService = this.promptService || new PromptProcessingService();
    this.contextBuilder = this.contextBuilder || new ProjectContextBuilder() as unknown as IContextBuilderService;
    this.responseParser = this.responseParser || new ClaudeResponseParser() as unknown as IResponseParsingService;
    this.sessionManager = this.sessionManager || new SessionManagementService();

    this.analysisService = this.analysisService || new ProjectAnalysisService(
      this.executionService,
      this.contextBuilder,
      this.responseParser
    );

    this.requestProcessor = this.requestProcessor || new RequestProcessingService(
      this.executionService,
      this.promptService,
      this.contextBuilder,
      this.sessionManager
    );
  }

  /**
   * Execute Claude Code with a specific prompt and context using centralized command processor
   */
  async executeClaudeCode(
    prompt: string,
    context: string,
    options: ClaudeCodeOptions = {}
  ): Promise<ClaudeCodeResponse> {
    await this.ensureInitialized();

    try {
      this.logger.info('🤖 Executing Claude Code with centralized command processor');

      // Process prompt (handle large prompts)
      const promptResult = await this.promptService!.processLargePrompt(
        prompt,
        options.projectPath || '.',
        prompt
      );

      if (!promptResult.success) {
        return {
          success: false,
          error: `Prompt processing failed: ${promptResult.error}`,
          tokensUsed: promptResult.tokensUsed
        };
      }

      // Execute using Claude Code
      const response = await this.executionService!.executeClaudeCode(
        promptResult.finalPrompt,
        context,
        options
      );

      // Calculate total tokens used
      const totalTokens = (response.tokensUsed || 0) + promptResult.tokensUsed;

      return {
        ...response,
        tokensUsed: totalTokens
      };
    } catch (error) {
      this.logger.error(`❌ Claude Code execution failed: ${error instanceof Error ? error.message : error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Perform comprehensive project analysis using Claude Code
   */
  async analyzeProject(projectPath: string, resumeToken?: string): Promise<AnalysisResult> {
    await this.ensureInitialized();
    return this.analysisService!.analyzeProject(projectPath, resumeToken);
  }

  /**
   * Process user request with enhanced context and prompt optimization
   */
  async processRequest(
    userRequest: string,
    projectPath: string,
    options: ClaudeCodeOptions = {}
  ): Promise<ClaudeCodeResponse> {
    await this.ensureInitialized();
    return this.requestProcessor!.processRequest(userRequest, projectPath, options);
  }

  /**
   * Build comprehensive project context for Claude Code
   */
  async buildProjectContext(projectPath: string): Promise<ProjectContext> {
    await this.ensureInitialized();
    return this.contextBuilder!.buildProjectContext(projectPath);
  }

  // Session Management Operations (delegated to SessionManagementService)
  async getSessionForProject(projectPath: string): Promise<string> {
    await this.ensureInitialized();
    return this.sessionManager!.getSessionForProject(projectPath);
  }

  async startNewSession(projectPath: string): Promise<string> {
    await this.ensureInitialized();
    return this.sessionManager!.startNewSession(projectPath);
  }

  async endSession(sessionId: string): Promise<void> {
    await this.ensureInitialized();
    return this.sessionManager!.endSession(sessionId);
  }

  // Advanced Operations
  async processBatchRequests(
    requests: Array<{ request: string; projectPath: string; options?: ClaudeCodeOptions }>,
    maxConcurrent: number = 3
  ): Promise<ClaudeCodeResponse[]> {
    await this.ensureInitialized();
    return (this.requestProcessor as any).processBatchRequests(requests, maxConcurrent);
  }

  async testConnection(): Promise<{ connected: boolean; version?: string; error?: string }> {
    await this.ensureInitialized();
    return (this.executionService as any).testConnection();
  }

  // Analysis Operations (delegated to ProjectAnalysisService)
  async extractUseCases(projectPath: string, context: string): Promise<AnalysisResult['useCases']> {
    await this.ensureInitialized();
    return this.analysisService!.extractUseCases(projectPath, context);
  }

  async assessCodeQuality(projectPath: string, context: string): Promise<AnalysisResult['codeQuality']> {
    await this.ensureInitialized();
    return this.analysisService!.assessCodeQuality(projectPath, context);
  }

  async detectUserIntentSimple(query: string): Promise<{
    category: string;
    confidence: number;
    requiresModifications: boolean;
    reasoning: string;
  }> {
    await this.ensureInitialized();

    // Use Claude-based intent analysis instead of hardcoded keywords
    try {
      const { ClaudeIntentAnalyzer } = await import('../../cli/commands/services/claude-intent-analyzer');
      const analyzer = ClaudeIntentAnalyzer.getInstance();
      const result = await analyzer.analyzeQuery(query);

      if (result.success && result.analysis) {
        return {
          category: result.analysis.intent,
          confidence: result.analysis.confidence,
          requiresModifications: result.analysis.requiresModifications,
          reasoning: result.analysis.reasoning
        };
      }
    } catch (error) {
      this.logger.debug('Claude intent analysis unavailable, using fallback');
    }

    // Fallback - return general analysis
    return {
      category: 'general',
      confidence: 0.5,
      requiresModifications: false,
      reasoning: 'Intent analysis fallback - Claude unavailable'
    };
  }

  // Prompt Operations (delegated to PromptProcessingService)
  async processLargePrompt(
    prompt: string,
    projectPath: string,
    originalRequest: string
  ): Promise<any> {
    await this.ensureInitialized();
    return this.promptService!.processLargePrompt(prompt, projectPath, originalRequest);
  }

  validatePromptSize(prompt: string): { valid: boolean; size: number; warning?: string } {
    return (this.executionService as any).validatePromptSize(prompt);
  }

  // Utility Operations
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize database connections
      await this.dbConnections.initialize();

      this.initialized = true;
      this.logger.debug('🔗 Claude Code integration initialized');
    } catch (error) {
      this.logger.error('❌ Failed to initialize Claude Code integration:', error);
      // Continue in degraded mode
      this.initialized = true;
    }
  }

  async close(): Promise<void> {
    if (!this.initialized) return;

    try {
      await this.sessionManager!.cleanupExpiredSessions();
      await this.dbConnections.close();
      this.initialized = false;
      this.logger.debug('🔗 Claude Code integration closed');
    } catch (error) {
      this.logger.error('Failed to close Claude Code integration:', error);
    }
  }

  // Statistics and Monitoring
  getSessionStats(): any {
    return (this.sessionManager as any).getSessionStats();
  }

  getExecutionStats(): any {
    return (this.executionService as any).getExecutionStats();
  }

  analyzeRequestComplexity(request: string): any {
    return (this.requestProcessor as any).analyzeRequestComplexity(request);
  }

  // Helper Methods
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  // Factory Methods for Testing and Dependency Injection
  static createWithServices(
    executionService: IClaudeExecutionService,
    promptService: IPromptProcessingService,
    analysisService: IProjectAnalysisService,
    sessionManager: ISessionManagementService,
    requestProcessor: IRequestProcessingService,
    contextBuilder: IContextBuilderService,
    responseParser: IResponseParsingService
  ): ClaudeCodeIntegration {
    return new ClaudeCodeIntegration(
      executionService,
      promptService,
      analysisService,
      sessionManager,
      requestProcessor,
      contextBuilder,
      responseParser
    );
  }

  static createDefault(): ClaudeCodeIntegration {
    return new ClaudeCodeIntegration();
  }

  // Backward Compatibility Methods
  async executeCommand(command: string, options?: any): Promise<any> {
    await this.ensureInitialized();
    return (this.executionService as any).executeCommand(command, options);
  }

  validateRequest(request: string): { valid: boolean; error?: string } {
    return this.requestProcessor!.validateRequest(request);
  }

  sanitizeInput(input: string): string {
    return this.requestProcessor!.sanitizeInput(input);
  }
}

// Export the main class and convenience factory
export default ClaudeCodeIntegration;
export { ClaudeCodeIntegration };

// Re-export service classes for advanced usage
export { ClaudeExecutionService } from './services/claude-execution-service';
export { PromptProcessingService } from './services/prompt-processing-service';
export { ProjectAnalysisService } from './services/project-analysis-service';
export { SessionManagementService } from './services/session-management-service';
export { RequestProcessingService } from './services/request-processing-service';
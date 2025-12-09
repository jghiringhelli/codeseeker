/**
 * Claude Code Integration Service (SOLID Refactored)
 * SOLID Principles: Dependency Inversion - Coordinator depends on service abstractions
 * Coordinates all Claude Code integration operations using focused services
 */
import { ClaudeCodeOptions, ClaudeCodeResponse, AnalysisResult, ProjectContext, IClaudeExecutionService, IPromptProcessingService, IProjectAnalysisService, ISessionManagementService, IRequestProcessingService, IContextBuilderService, IResponseParsingService } from './interfaces/index';
export { ClaudeCodeOptions, ClaudeCodeResponse, AnalysisResult, ProjectContext } from './interfaces/index';
declare class ClaudeCodeIntegration {
    private executionService?;
    private promptService?;
    private analysisService?;
    private sessionManager?;
    private requestProcessor?;
    private contextBuilder?;
    private responseParser?;
    private dbConnections;
    private logger;
    private initialized;
    constructor(executionService?: IClaudeExecutionService, promptService?: IPromptProcessingService, analysisService?: IProjectAnalysisService, sessionManager?: ISessionManagementService, requestProcessor?: IRequestProcessingService, contextBuilder?: IContextBuilderService, responseParser?: IResponseParsingService);
    /**
     * Execute Claude Code with a specific prompt and context using centralized command processor
     */
    executeClaudeCode(prompt: string, context: string, options?: ClaudeCodeOptions): Promise<ClaudeCodeResponse>;
    /**
     * Perform comprehensive project analysis using Claude Code
     */
    analyzeProject(projectPath: string, resumeToken?: string): Promise<AnalysisResult>;
    /**
     * Process user request with enhanced context and prompt optimization
     */
    processRequest(userRequest: string, projectPath: string, options?: ClaudeCodeOptions): Promise<ClaudeCodeResponse>;
    /**
     * Build comprehensive project context for Claude Code
     */
    buildProjectContext(projectPath: string): Promise<ProjectContext>;
    getSessionForProject(projectPath: string): Promise<string>;
    startNewSession(projectPath: string): Promise<string>;
    endSession(sessionId: string): Promise<void>;
    processBatchRequests(requests: Array<{
        request: string;
        projectPath: string;
        options?: ClaudeCodeOptions;
    }>, maxConcurrent?: number): Promise<ClaudeCodeResponse[]>;
    testConnection(): Promise<{
        connected: boolean;
        version?: string;
        error?: string;
    }>;
    extractUseCases(projectPath: string, context: string): Promise<AnalysisResult['useCases']>;
    assessCodeQuality(projectPath: string, context: string): Promise<AnalysisResult['codeQuality']>;
    detectUserIntentSimple(query: string): Promise<{
        category: string;
        confidence: number;
        requiresModifications: boolean;
        reasoning: string;
    }>;
    processLargePrompt(prompt: string, projectPath: string, originalRequest: string): Promise<any>;
    validatePromptSize(prompt: string): {
        valid: boolean;
        size: number;
        warning?: string;
    };
    initialize(): Promise<void>;
    close(): Promise<void>;
    getSessionStats(): any;
    getExecutionStats(): any;
    analyzeRequestComplexity(request: string): any;
    private ensureInitialized;
    static createWithServices(executionService: IClaudeExecutionService, promptService: IPromptProcessingService, analysisService: IProjectAnalysisService, sessionManager: ISessionManagementService, requestProcessor: IRequestProcessingService, contextBuilder: IContextBuilderService, responseParser: IResponseParsingService): ClaudeCodeIntegration;
    static createDefault(): ClaudeCodeIntegration;
    executeCommand(command: string, options?: any): Promise<any>;
    validateRequest(request: string): {
        valid: boolean;
        error?: string;
    };
    sanitizeInput(input: string): string;
}
export default ClaudeCodeIntegration;
export { ClaudeCodeIntegration };
export { ClaudeExecutionService } from './services/claude-execution-service';
export { PromptProcessingService } from './services/prompt-processing-service';
export { ProjectAnalysisService } from './services/project-analysis-service';
export { SessionManagementService } from './services/session-management-service';
export { RequestProcessingService } from './services/request-processing-service';
//# sourceMappingURL=claude-cli-integration.d.ts.map
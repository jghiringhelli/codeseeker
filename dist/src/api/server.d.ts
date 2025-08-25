/**
 * REST API Server for Claude Code Integration
 * Token-efficient endpoints for the Intelligent Code Auxiliary System
 */
declare class APIServer {
    private app;
    private dbManager;
    private fsHelper;
    private cache;
    private logger;
    private port;
    private isDev;
    constructor();
    private initializeServices;
    private setupMiddleware;
    private setupRoutes;
    private setupErrorHandling;
    private handleHealth;
    private handleStats;
    private handleAnalyze;
    private handleInit;
    private handleGetPatterns;
    private handleQuestionnaire;
    private handleSuggestions;
    private handleClearCache;
    private handleDBStats;
    private handleClaudeContext;
    private handleClaudeValidate;
    private handleClaudeGuidance;
    private categorizeProjectSize;
    private detectLanguages;
    private inferProjectType;
    private calculateETA;
    private generateRecommendations;
    private generateContextualSuggestions;
    private getNextSteps;
    private generateClaudeRecommendations;
    private getClaudeNextActions;
    private validateCodeAgainstPatterns;
    private formatPatternsForClaude;
    private extractConventions;
    private getTaskSpecificGuidance;
    private getClaudeWarnings;
    private handleListProjects;
    private handleGetProject;
    private handleUpdateProject;
    private handleDeleteProject;
    private handleAddProjectPath;
    private handleUpdateProjectPath;
    private handleGetProjectPaths;
    private handleDeactivateProjectPath;
    private sendSuccess;
    private sendError;
    start(): Promise<void>;
    stop(): Promise<void>;
}
export { APIServer };
//# sourceMappingURL=server.d.ts.map
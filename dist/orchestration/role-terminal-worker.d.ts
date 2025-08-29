/**
 * Role Terminal Worker - Blocking queue-based role processing
 *
 * Each role terminal waits on Redis queues for work, processes with specialized
 * tools and context, then passes enriched results to the next role in the workflow.
 * This creates a sequential pipeline of expert analysis.
 */
export interface RoleDefinition {
    id: string;
    name: string;
    expertise: string[];
    tools: string[];
    contextFocus: string[];
    promptTemplate: string;
}
export interface RoleContext {
    originalQuery: string;
    projectPath: string;
    roleSpecificFocus: string[];
    previousAnalyses: any[];
    toolResults: any[];
}
export declare class RoleTerminalWorker {
    private redis;
    private toolSelector;
    private db;
    private logger;
    private isRunning;
    private currentProcess?;
    private roles;
    constructor();
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    /**
     * Start processing work for multiple roles
     */
    startProcessing(roles?: string[]): Promise<void>;
    /**
     * Process work for a specific role (blocking loop)
     */
    private processRole;
    /**
     * Process a workflow message for a role
     */
    private processMessage;
    /**
     * Build role-specific context from message and previous analyses
     */
    private buildRoleContext;
    /**
     * Execute role-specific analysis using CodeMind CLI
     */
    private executeRoleAnalysis;
    /**
     * Create specialized prompt for role
     */
    private createRolePrompt;
    /**
     * Create temporary prompt file for CodeMind CLI
     */
    private createTempPromptFile;
    /**
     * Execute CodeMind CLI with role-specific parameters
     */
    private executeCodeMindCLI;
    /**
     * Determine next role based on current role and workflow progress
     */
    private determineNextRole;
    /**
     * Pass enriched results to next role
     */
    private passToNextRole;
    /**
     * Send final workflow completion
     */
    private sendFinalCompletion;
    /**
     * Record processing metrics for monitoring
     */
    private recordProcessingMetrics;
    private sleep;
}
export default RoleTerminalWorker;
//# sourceMappingURL=role-terminal-worker.d.ts.map
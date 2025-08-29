import { ChildProcess } from 'child_process';
/**
 * ⚠️ DEPRECATED: Legacy Terminal Orchestrator - Coordinates multiple Claude Code terminals
 *
 * This is the legacy parallel terminal orchestration system.
 * New implementations should use sequential-workflow-orchestrator.ts and role-terminal-worker.ts instead.
 * This file is maintained for backwards compatibility and will be removed in a future version.
 *
 * Core Concept (LEGACY):
 * - Separate layer from the user-facing CLI
 * - Orchestrates multiple Claude Code terminals with specialized contexts
 * - Each terminal gets focused analysis results from different tools
 * - Coordinated through the dashboard and API endpoints
 * - Can be run as separate service or integrated into dashboard
 */
interface OrchestrationRequest {
    orchestrationId?: string;
    query: string;
    projectPath: string;
    requestedBy: 'dashboard' | 'cli' | 'api';
    maxTerminals?: number;
    strategy?: 'parallel' | 'sequential' | 'role_based';
    roles?: string[];
    options?: {
        tokenBudget?: number;
        timeoutMs?: number;
        coordination?: boolean;
    };
}
interface TerminalSession {
    terminalId: string;
    role: string;
    process: ChildProcess;
    context: any;
    status: 'initializing' | 'running' | 'completed' | 'failed';
    output: string[];
    startTime: Date;
    endTime?: Date;
    tokensUsed?: number;
}
interface OrchestrationResult {
    orchestrationId: string;
    success: boolean;
    terminals: TerminalSession[];
    coordinatedResult?: string;
    executionTime: number;
    totalTokensUsed: number;
    insights: string[];
}
export declare class TerminalOrchestrator {
    private logger;
    private toolSelector;
    private db;
    private monitor;
    private activeOrchestrations;
    private terminalSessions;
    constructor();
    /**
     * Main orchestration method - coordinates multiple Claude Code terminals
     */
    orchestrate(request: OrchestrationRequest): Promise<OrchestrationResult>;
    /**
     * Plan orchestration strategy based on query complexity and requirements
     */
    private planOrchestration;
    /**
     * Generate specialized contexts for each terminal based on roles
     */
    private generateTerminalContexts;
    /**
     * Spawn coordinated Claude Code terminals with specialized contexts
     */
    private spawnCoordinatedTerminals;
    /**
     * Spawn individual Claude Code terminal with specialized context
     */
    private spawnTerminal;
    /**
     * Coordinate terminal execution and gather results
     */
    private coordinateTerminalExecution;
    /**
     * Synthesize results from all terminals into coordinated final result
     */
    private synthesizeResults;
    private determineTerminalRoles;
    private selectStrategy;
    private requiresCoordination;
    private generateRoleSpecificContext;
    private getFocusAreasForRole;
    private getToolsForRole;
    private getRolePriority;
    private prepareClaudeArgsForRole;
    private createRolePromptFile;
    private waitForTerminals;
    private processTerminalOutput;
    private extractSummary;
    private extractRecommendations;
    private extractKeyFindings;
    private extractTerminalInsights;
    private calculateExecutionMetrics;
    private runSynthesisQuery;
    private createFallbackSynthesis;
    private extractInsights;
    private getAnalysisScopeForRole;
    private getExpectedOutputsForRole;
    private storeOrchestrationResults;
    /**
     * Get status of active orchestration
     */
    getOrchestrationStatus(orchestrationId: string): Promise<any>;
    /**
     * Cancel active orchestration
     */
    cancelOrchestration(orchestrationId: string): Promise<boolean>;
    /**
     * List active orchestrations
     */
    getActiveOrchestrations(): string[];
}
export {};
//# sourceMappingURL=terminal-orchestrator.d.ts.map
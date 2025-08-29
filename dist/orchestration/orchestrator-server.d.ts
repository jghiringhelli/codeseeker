/**
 * Sequential Workflow Orchestrator Server
 *
 * HTTP API server that manages sequential workflow orchestrations.
 * Provides REST endpoints for starting, monitoring, and controlling
 * multi-role analysis workflows with Redis-based message queuing.
 */
export declare class OrchestratorServer {
    private app;
    private orchestrator;
    private redis;
    private db;
    private toolManager;
    private logger;
    private port;
    private server?;
    constructor();
    private setupMiddleware;
    private setupRoutes;
    private setupErrorHandling;
    /**
     * Start workflow orchestration
     */
    private startOrchestration;
    /**
     * Get orchestration status
     */
    private getOrchestrationStatus;
    /**
     * Get detailed orchestration information
     */
    private getOrchestrationDetails;
    /**
     * Stop orchestration
     */
    private stopOrchestration;
    /**
     * Get active orchestrations
     */
    private getActiveOrchestrations;
    /**
     * Get queue status for all roles
     */
    private getQueueStatus;
    /**
     * Get role processing metrics
     */
    private getRoleMetrics;
    /**
     * Get system status
     */
    private getSystemStatus;
    /**
     * Start the orchestrator server
     */
    start(): Promise<void>;
    /**
     * Get tool recommendations for a project
     */
    private getToolRecommendations;
    /**
     * Get available tools
     */
    private getAvailableTools;
    /**
     * Install a tool
     */
    private installTool;
    /**
     * Get tools status for a project
     */
    private getToolsStatus;
    /**
     * Shutdown the orchestrator server
     */
    shutdown(): Promise<void>;
}
export default OrchestratorServer;
//# sourceMappingURL=orchestrator-server.d.ts.map
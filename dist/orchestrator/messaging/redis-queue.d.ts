/**
 * Redis-based message queue system for sequential workflow orchestration
 *
 * Provides reliable message passing between workflow roles with blocking operations
 * and automatic cleanup. Each role has dedicated queues for input and completion.
 */
export interface WorkflowMessage {
    workflowId: string;
    roleId: string;
    previousRole?: string;
    input: {
        originalQuery: string;
        projectPath: string;
        toolResults?: any[];
        contextFromPrevious?: any;
    };
    metadata: {
        step: number;
        totalSteps: number;
        timestamp: number;
        priority: 'high' | 'normal';
        retryCount: number;
        maxRetries: number;
    };
}
export interface WorkflowCompletion {
    workflowId: string;
    roleId: string;
    status: 'complete' | 'error' | 'progress';
    result?: any;
    error?: string;
    timestamp: number;
}
export declare class RedisQueue {
    private redis;
    private subscriber;
    private logger;
    constructor();
    private setupEventHandlers;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    /**
     * Send message to a role's input queue
     */
    sendToRole(roleId: string, message: WorkflowMessage): Promise<void>;
    /**
     * Wait for message from role's input queue (blocking)
     */
    waitForWork(roleId: string, timeoutSeconds?: number): Promise<WorkflowMessage | null>;
    /**
     * Send completion notification
     */
    sendCompletion(completion: WorkflowCompletion): Promise<void>;
    /**
     * Wait for workflow completion (blocking)
     */
    waitForCompletion(workflowId: string, timeoutSeconds?: number): Promise<WorkflowCompletion | null>;
    /**
     * Get queue length for monitoring
     */
    getQueueLength(roleId: string): Promise<number>;
    /**
     * Get all queue lengths for monitoring
     */
    getAllQueueLengths(): Promise<Record<string, number>>;
    /**
     * Handle failed message with retry logic
     */
    handleFailedMessage(message: WorkflowMessage, error: Error): Promise<void>;
    /**
     * Clean up workflow data after completion
     */
    cleanupWorkflow(workflowId: string): Promise<void>;
    /**
     * Set workflow active role for monitoring
     */
    private setWorkflowActiveRole;
    /**
     * Get workflow active role
     */
    getWorkflowActiveRole(workflowId: string): Promise<string | null>;
    private getRoleQueueKey;
    private getWorkflowCompletionKey;
    private getWorkflowActiveRoleKey;
    private getWorkflowStatusKey;
    private getErrorQueueKey;
}
export default RedisQueue;
//# sourceMappingURL=redis-queue.d.ts.map
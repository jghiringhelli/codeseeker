/**
 * Orchestrator Types and Interfaces
 */
export interface WorkflowStep {
    id: string;
    name: string;
    type: 'analysis' | 'validation' | 'execution' | 'reporting';
    dependencies?: string[];
    timeout?: number;
    retryCount?: number;
}
export interface WorkflowDefinition {
    id: string;
    name: string;
    description: string;
    steps: WorkflowStep[];
    qualityGates?: QualityGate[];
    executionTimeoutMs?: number;
}
export interface QualityGate {
    id: string;
    name: string;
    threshold: number;
    metric: string;
    required: boolean;
}
export interface WorkflowExecution {
    id: string;
    workflowId: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    startTime: Date;
    endTime?: Date;
    currentStep?: string;
    results?: any;
    error?: string;
}
export interface ToolIntegration {
    id: string;
    name: string;
    type: 'internal' | 'external' | 'api';
    config: any;
    capabilities: string[];
}
export interface TaskContext {
    projectId: string;
    taskId: string;
    userId?: string;
    metadata?: Record<string, any>;
    priority?: 'low' | 'medium' | 'high' | 'critical';
}
export interface TaskResult {
    success: boolean;
    data?: any;
    error?: string;
    duration?: number;
    metadata?: Record<string, any>;
}
export interface OrchestratorConfig {
    maxConcurrentWorkflows?: number;
    defaultTimeout?: number;
    retryPolicy?: {
        maxRetries: number;
        backoffMs: number;
    };
    enableMetrics?: boolean;
    enableLogging?: boolean;
}
export type WorkflowEventType = 'workflow.started' | 'workflow.completed' | 'workflow.failed' | 'step.started' | 'step.completed' | 'step.failed' | 'quality.gate.passed' | 'quality.gate.failed';
export interface WorkflowEvent {
    type: WorkflowEventType;
    workflowId: string;
    stepId?: string;
    timestamp: Date;
    data?: any;
}
export type RoleType = 'analyzer' | 'validator' | 'executor' | 'reporter' | 'orchestrator';
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'skipped';
export interface WorkflowNode {
    id: string;
    name: string;
    type: string;
    status?: ExecutionStatus;
    dependencies: string[];
    metadata?: any;
}
export interface WorkflowDAG {
    nodes: WorkflowNode[];
    edges: Array<{
        from: string;
        to: string;
    }>;
    metadata?: {
        createdAt: Date;
        updatedAt: Date;
        version: string;
    };
}
//# sourceMappingURL=types.d.ts.map
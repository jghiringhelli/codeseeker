/**
 * Intelligent Task Orchestrator
 * Manages three-phase discovery and splits work into context-window-optimized tasks
 */
export interface TaskOrchestrationRequest {
    userQuery: string;
    userIntent: string;
    projectPath: string;
    projectId: string;
    maxContextTokens?: number;
}
export interface DiscoveredImpact {
    semanticFiles: Array<{
        filePath: string;
        relevanceScore: number;
    }>;
    graphRelationships: Array<{
        filePath: string;
        relationshipType: string;
        impactLevel: 'direct' | 'indirect' | 'cascading';
    }>;
    treeStructure: Array<{
        filePath: string;
        codeElements: Array<{
            type: 'class' | 'function' | 'interface';
            name: string;
        }>;
    }>;
    impactAreas: {
        coreLogic: string[];
        dataLayer: string[];
        apiLayer: string[];
        uiLayer: string[];
        testLayer: string[];
        configLayer: string[];
        deploymentLayer: string[];
        documentationLayer: string[];
    };
}
export interface OrchestrationTask {
    id: string;
    title: string;
    description: string;
    category: 'core-logic' | 'data-layer' | 'api-layer' | 'ui-layer' | 'test-layer' | 'config-layer' | 'deployment-layer' | 'documentation-layer';
    priority: number;
    estimatedTokens: number;
    dependencies: string[];
    targetFiles: Array<{
        filePath: string;
        action: 'create' | 'modify' | 'delete';
        currentContent?: string;
        requiredContext: string[];
    }>;
    toolData: Array<{
        toolName: string;
        relevantData: any;
    }>;
}
export interface TaskOrchestrationResult {
    request: TaskOrchestrationRequest;
    discoveredImpact: DiscoveredImpact;
    orchestratedTasks: OrchestrationTask[];
    executionPlan: {
        totalTasks: number;
        estimatedDuration: string;
        parallelizable: string[][];
        sequential: string[];
    };
}
export declare class IntelligentTaskOrchestrator {
    private fileDiscovery;
    private semanticGraph;
    private treeNavigator;
    private logger;
    private initialized;
    private retryAttempts;
    private retryDelay;
    constructor();
    initialize(): Promise<void>;
    private safeInitialize;
    private timeout;
    private delay;
    /**
     * Safe execution wrapper with fallback and retry logic
     */
    private safeExecute;
    /**
     * Fallback for semantic discovery when service is unavailable
     */
    private getFallbackSemanticDiscovery;
    /**
     * Fallback for graph impact analysis
     */
    private getFallbackGraphImpact;
    /**
     * Fallback for tree structure analysis
     */
    private getFallbackTreeStructure;
    /**
     * Main orchestration flow: Three-phase discovery + task splitting
     */
    orchestrateRequest(request: TaskOrchestrationRequest): Promise<TaskOrchestrationResult>;
    /**
     * Phase 1: Semantic file discovery using vector search
     */
    private performSemanticDiscovery;
    /**
     * Phase 2: Semantic graph impact analysis
     */
    private performGraphImpactAnalysis;
    /**
     * Phase 3: Tree structure analysis
     */
    private performTreeAnalysis;
    /**
     * Categorize files by impact area (core, data, api, ui, test, etc.)
     */
    private categorizeImpactAreas;
    /**
     * Create orchestrated tasks split by context window and dependencies
     */
    private createOrchestrationTasks;
    private mapUserIntentToDiscoveryIntent;
    private findGraphNodesForFile;
    private determineImpactLevel;
    private extractCodeElements;
    private createTask;
    private createExecutionPlan;
    close(): Promise<void>;
}
//# sourceMappingURL=intelligent-task-orchestrator.d.ts.map
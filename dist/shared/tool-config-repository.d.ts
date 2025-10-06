/**
 * Tool Configuration Repository
 * Manages tool configurations using PostgreSQL
 */
export interface ToolConfig {
    id?: string;
    toolName: string;
    projectId: string;
    configuration: any;
    enabled: boolean;
    lastUsed: Date;
    successRate?: number;
    avgExecutionTime?: number;
}
export declare class ToolConfigRepository {
    private logger;
    private dbConnections;
    constructor();
    /**
     * Get tool configuration
     */
    getToolConfig(projectId: string, toolName: string): Promise<ToolConfig | null>;
    /**
     * Save tool configuration
     */
    saveToolConfig(config: ToolConfig): Promise<void>;
    /**
     * Get all tool configurations for a project
     */
    getAllToolConfigs(projectId: string): Promise<ToolConfig[]>;
    /**
     * Get project configurations
     */
    getProjectConfigs(projectId: string): Promise<ToolConfig[]>;
    /**
     * Update tool usage statistics
     */
    updateToolStats(projectId: string, toolName: string, executionTime: number, success: boolean): Promise<void>;
}
export declare const toolConfigRepo: ToolConfigRepository;
//# sourceMappingURL=tool-config-repository.d.ts.map
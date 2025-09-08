/**
 * Tool Configuration Repository
 * Manages flexible tool configurations in MongoDB
 */
export interface ToolConfig {
    projectId: string;
    toolName: string;
    config: any;
    version?: string;
    updatedAt: Date;
    inheritFrom?: string;
    overrides?: any;
}
export declare class ToolConfigRepository {
    private collection?;
    private logger;
    private cache;
    constructor();
    private ensureConnection;
    /**
     * Save or update tool configuration
     */
    saveToolConfig(projectId: string, toolName: string, config: any): Promise<void>;
    /**
     * Get tool configuration with inheritance support
     */
    getToolConfig(projectId: string, toolName: string): Promise<any | null>;
    /**
     * Get configurations by framework
     */
    getConfigsByFramework(framework: string): Promise<ToolConfig[]>;
    /**
     * Get all configurations for a project
     */
    getProjectConfigs(projectId: string): Promise<ToolConfig[]>;
    /**
     * Copy default configurations to a new project
     */
    initializeProjectConfigs(projectId: string): Promise<void>;
    /**
     * Update specific configuration field
     */
    updateConfigField(projectId: string, toolName: string, field: string, value: any): Promise<void>;
    /**
     * Find optimal configuration based on similar projects
     */
    findOptimalConfig(projectContext: any, toolName: string): Promise<any | null>;
    /**
     * Delete tool configuration
     */
    deleteToolConfig(projectId: string, toolName: string): Promise<boolean>;
    /**
     * Clear cache
     */
    clearCache(): void;
    /**
     * Merge two configuration objects
     */
    private mergeConfigs;
    /**
     * Validate configuration against schema
     */
    validateConfig(toolName: string, config: any): Promise<boolean>;
    /**
     * Get configuration history
     */
    getConfigHistory(projectId: string, toolName: string, limit?: number): Promise<ToolConfig[]>;
}
export declare const toolConfigRepo: ToolConfigRepository;
//# sourceMappingURL=tool-config-repository.d.ts.map
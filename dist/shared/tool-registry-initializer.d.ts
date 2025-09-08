/**
 * Tool Registry Initializer - Auto-discovers and registers all internal tools
 * Bridges enhanced tools with the InternalTool interface via adapters
 */
export declare class ToolRegistryInitializer {
    private static logger;
    /**
     * Initialize all available tools and register them
     */
    static initializeAllTools(projectRoot?: string): Promise<void>;
    /**
     * Register a single tool with error handling
     */
    private static registerTool;
    /**
     * Get tool registration status
     */
    static getRegistrationStatus(): {
        totalRegistered: number;
        availableTools: string[];
        toolsByCategory: Record<string, string[]>;
    };
    /**
     * Verify all registered tools are healthy
     */
    static verifyAllTools(projectId: string): Promise<{
        healthy: string[];
        unhealthy: string[];
        details: Record<string, any>;
    }>;
}
//# sourceMappingURL=tool-registry-initializer.d.ts.map
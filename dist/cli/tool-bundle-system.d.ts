/**
 * Tool Bundle System for CodeMind CLI
 * Defines sets of tools for common scenarios to improve tool selection
 */
export interface ToolBundle {
    id: string;
    name: string;
    description: string;
    category: 'analysis' | 'quality' | 'architecture' | 'performance' | 'security' | 'development';
    tools: string[];
    parameters?: Record<string, any>;
    confidence: number;
    useCases: string[];
    priority: number;
}
export interface BundleExecutionResult {
    bundleId: string;
    success: boolean;
    results: Record<string, any>;
    tokensUsed: number;
    executionTime: number;
    errors?: string[];
}
export interface BundleSelectionContext {
    userQuery: string;
    projectType?: string;
    intent?: string;
    codebaseSize?: 'small' | 'medium' | 'large';
    previousBundles?: string[];
}
export declare class ToolBundleSystem {
    private logger;
    private bundles;
    private bundleUsageStats;
    constructor();
    /**
     * Initialize default tool bundles for common scenarios
     */
    private initializeDefaultBundles;
    /**
     * Load custom bundles from configuration files
     */
    private loadCustomBundles;
    /**
     * Select appropriate tool bundles based on context
     */
    selectBundles(context: BundleSelectionContext): ToolBundle[];
    /**
     * Get category-specific keywords for matching
     */
    private getCategoryKeywords;
    /**
     * Execute a tool bundle (placeholder - actual execution handled by CLI)
     */
    executeBundle(bundleId: string, projectPath: string): Promise<BundleExecutionResult>;
    /**
     * Create a custom tool bundle
     */
    createBundle(bundle: Omit<ToolBundle, 'id'>): string;
    /**
     * Get all available bundles
     */
    getBundles(): ToolBundle[];
    /**
     * Get bundle by ID
     */
    getBundle(id: string): ToolBundle | undefined;
    /**
     * Update bundle success rate based on execution results
     */
    updateBundleStats(bundleId: string, success: boolean): void;
    /**
     * Get bundle usage statistics
     */
    getBundleStats(): Record<string, {
        uses: number;
        successRate: number;
    }>;
    /**
     * Generate a unique bundle ID from name
     */
    private generateBundleId;
    /**
     * Export bundle configuration for persistence
     */
    exportBundles(): ToolBundle[];
    /**
     * Save custom bundles to configuration file
     */
    saveCustomBundles(): void;
}
export default ToolBundleSystem;
//# sourceMappingURL=tool-bundle-system.d.ts.map
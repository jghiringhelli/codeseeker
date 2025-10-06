/**
 * Tool Management API Endpoints
 * Provides REST API for managing tools and bundles in the dashboard
 */
import express from 'express';
export declare class ToolManagementAPI {
    private router;
    private logger;
    private toolSelector;
    private autodiscoveryService;
    constructor();
    private setupRoutes;
    /**
     * Get list of all tools with their metadata and status
     */
    private getToolsList;
    /**
     * Get detailed information about a specific tool
     */
    private getToolDetails;
    /**
     * Update tool configuration (description, trust level, etc.)
     */
    private updateTool;
    /**
     * Get all tool bundles
     */
    private getBundles;
    /**
     * Update bundle configuration
     */
    private updateBundle;
    /**
     * Get tool usage analytics
     */
    private getToolAnalytics;
    /**
     * Test tool selection with a sample query
     */
    private testQuerySelection;
    /**
     * Test a specific tool
     */
    private testTool;
    private getDetailedCapabilities;
    private inferToolUseCases;
    private getCompatibleBundles;
    private checkBundleToolAvailability;
    private estimateBundleEffectiveness;
    private getBundleRecentActivations;
    private validateBundleData;
    private generateMockAnalytics;
    getRouter(): express.Router;
}
//# sourceMappingURL=tool-management-api.d.ts.map
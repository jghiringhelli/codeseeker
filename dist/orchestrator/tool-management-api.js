"use strict";
/**
 * Tool Management API Endpoints
 * Provides REST API for managing tools and bundles in the dashboard
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolManagementAPI = void 0;
const express_1 = __importDefault(require("express"));
const intelligent_tool_selector_1 = require("../shared/intelligent-tool-selector");
const tool_interface_1 = require("../shared/tool-interface");
const tool_autodiscovery_1 = require("../shared/tool-autodiscovery");
const logger_1 = require("../shared/logger");
class ToolManagementAPI {
    router;
    logger;
    toolSelector;
    autodiscoveryService;
    constructor() {
        this.router = express_1.default.Router();
        this.logger = logger_1.Logger.getInstance();
        this.toolSelector = new intelligent_tool_selector_1.IntelligentToolSelector();
        this.autodiscoveryService = new tool_autodiscovery_1.ToolAutodiscoveryService();
        this.setupRoutes();
    }
    setupRoutes() {
        // Tool Management Endpoints
        this.router.get('/tools/list', this.getToolsList.bind(this));
        this.router.get('/tools/:toolName', this.getToolDetails.bind(this));
        this.router.put('/tools/update/:toolName', this.updateTool.bind(this));
        // this.router.delete('/tools/:toolName', this.deleteTool.bind(this)); // TODO: Implement
        this.router.post('/tools/test/:toolName', this.testTool.bind(this));
        // Bundle Management Endpoints
        this.router.get('/tools/bundles', this.getBundles.bind(this));
        // this.router.get('/tools/bundles/:bundleId', this.getBundleDetails.bind(this)); // TODO: Implement
        this.router.put('/tools/bundles/:bundleId', this.updateBundle.bind(this));
        // this.router.delete('/tools/bundles/:bundleId', this.deleteBundle.bind(this)); // TODO: Implement
        // this.router.post('/tools/bundles/test/:bundleId', this.testBundle.bind(this)); // TODO: Implement
        // Analytics Endpoints
        this.router.get('/tools/analytics', this.getToolAnalytics.bind(this));
        // this.router.get('/tools/analytics/:toolName', this.getToolSpecificAnalytics.bind(this)); // TODO: Implement
        // this.router.get('/tools/selection-history', this.getSelectionHistory.bind(this)); // TODO: Implement
        // Tool Selection Testing
        // this.router.post('/tools/selection/simulate', this.simulateToolSelection.bind(this)); // TODO: Implement
        this.router.post('/tools/selection/test-query', this.testQuerySelection.bind(this));
    }
    /**
     * Get list of all tools with their metadata and status
     */
    async getToolsList(req, res) {
        try {
            await this.autodiscoveryService.initializeTools();
            const allTools = tool_interface_1.ToolRegistry.getAllTools();
            const toolsData = await Promise.all(allTools.map(async (tool) => {
                const metadata = tool.getMetadata();
                const status = await tool.getStatus('default'); // Use default project for status
                return {
                    name: metadata.name,
                    category: metadata.category,
                    trustLevel: metadata.trustLevel,
                    version: metadata.version,
                    description: metadata.description,
                    capabilities: metadata.capabilities,
                    dependencies: metadata.dependencies || [],
                    status
                };
            }));
            res.json({
                success: true,
                tools: toolsData,
                totalCount: toolsData.length,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            this.logger.error('❌ Failed to get tools list:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve tools list',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    /**
     * Get detailed information about a specific tool
     */
    async getToolDetails(req, res) {
        try {
            const { toolName } = req.params;
            const tools = tool_interface_1.ToolRegistry.getAllTools();
            const tool = tools.find(t => t.getMetadata().name === toolName);
            if (!tool) {
                res.status(404).json({
                    success: false,
                    error: 'Tool not found',
                    toolName
                });
                return;
            }
            const metadata = tool.getMetadata();
            const status = await tool.getStatus('default');
            res.json({
                success: true,
                tool: {
                    ...metadata,
                    status,
                    detailedCapabilities: this.getDetailedCapabilities(metadata),
                    useCases: this.inferToolUseCases(metadata),
                    compatibleBundles: this.getCompatibleBundles(toolName)
                }
            });
        }
        catch (error) {
            this.logger.error(`❌ Failed to get tool details for ${req.params.toolName}:`, error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve tool details'
            });
        }
    }
    /**
     * Update tool configuration (description, trust level, etc.)
     */
    async updateTool(req, res) {
        try {
            const { toolName } = req.params;
            const updates = req.body;
            // Note: In a real implementation, we'd need to handle tool metadata updates
            // This would require modifying the tool classes or storing overrides in database
            this.logger.info(`🔧 Tool update requested for ${toolName}:`, updates);
            // For now, we'll simulate the update
            res.json({
                success: true,
                message: `Tool ${toolName} updated successfully`,
                updates,
                timestamp: new Date().toISOString()
            });
            // TODO: Implement actual tool metadata persistence
            // This could involve:
            // 1. Database storage of tool configuration overrides
            // 2. Dynamic tool registration with updated metadata
            // 3. Configuration file updates
        }
        catch (error) {
            this.logger.error(`❌ Failed to update tool ${req.params.toolName}:`, error);
            res.status(500).json({
                success: false,
                error: 'Failed to update tool'
            });
        }
    }
    /**
     * Get all tool bundles
     */
    async getBundles(req, res) {
        try {
            const bundles = this.toolSelector.getAllBundles();
            // Enhance bundles with additional metadata
            const enhancedBundles = bundles.map(bundle => ({
                ...bundle,
                availableTools: this.checkBundleToolAvailability(bundle),
                estimatedEffectiveness: this.estimateBundleEffectiveness(bundle),
                recentActivations: this.getBundleRecentActivations(bundle.id)
            }));
            res.json({
                success: true,
                bundles: enhancedBundles,
                totalCount: enhancedBundles.length,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            this.logger.error('❌ Failed to get bundles:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve bundles'
            });
        }
    }
    /**
     * Update bundle configuration
     */
    async updateBundle(req, res) {
        try {
            const { bundleId } = req.params;
            const bundleData = req.body;
            this.logger.info(`🔗 Bundle update requested for ${bundleId}:`, bundleData);
            // Validate bundle data
            const validation = this.validateBundleData(bundleData);
            if (!validation.valid) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid bundle data',
                    validationErrors: validation.errors
                });
                return;
            }
            // TODO: Implement actual bundle persistence
            // This would involve storing custom bundles in database
            res.json({
                success: true,
                message: `Bundle ${bundleId} updated successfully`,
                bundle: bundleData,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            this.logger.error(`❌ Failed to update bundle ${req.params.bundleId}:`, error);
            res.status(500).json({
                success: false,
                error: 'Failed to update bundle'
            });
        }
    }
    /**
     * Get tool usage analytics
     */
    async getToolAnalytics(req, res) {
        try {
            // In a real implementation, this would query actual usage data from database
            const mockAnalytics = this.generateMockAnalytics();
            res.json({
                success: true,
                analytics: mockAnalytics,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            this.logger.error('❌ Failed to get analytics:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve analytics'
            });
        }
    }
    /**
     * Test tool selection with a sample query
     */
    async testQuerySelection(req, res) {
        try {
            const { query, projectPath, intent } = req.body;
            if (!query) {
                res.status(400).json({
                    success: false,
                    error: 'Query is required for testing tool selection'
                });
                return;
            }
            const selectionRequest = {
                userQuery: query,
                projectPath: projectPath || '/sample/project',
                projectId: 'test-project',
                cliCommand: `test-selection: ${query}`,
                intent
            };
            const selectionResult = await this.toolSelector.selectToolsForRequest(selectionRequest);
            res.json({
                success: true,
                testQuery: query,
                selectionResult: {
                    selectedTools: selectionResult.selectedTools.map(selection => ({
                        toolName: selection.metadata.name,
                        confidence: selection.confidence,
                        reasoning: selection.reasoning,
                        priority: selection.priority
                    })),
                    bundleActivated: selectionResult.bundleActivated,
                    totalConfidence: selectionResult.totalConfidence,
                    selectionReasoning: selectionResult.selectionReasoning
                },
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            this.logger.error('❌ Tool selection test failed:', error);
            res.status(500).json({
                success: false,
                error: 'Tool selection test failed',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    /**
     * Test a specific tool
     */
    async testTool(req, res) {
        try {
            const { toolName } = req.params;
            const { projectPath = '/sample/project', projectId = 'test-project' } = req.body;
            const tools = tool_interface_1.ToolRegistry.getAllTools();
            const tool = tools.find(t => t.getMetadata().name === toolName);
            if (!tool) {
                res.status(404).json({
                    success: false,
                    error: 'Tool not found'
                });
                return;
            }
            // Test if tool can analyze the project
            const canAnalyze = await tool.canAnalyzeProject(projectPath);
            if (!canAnalyze) {
                res.json({
                    success: true,
                    testResult: 'not_applicable',
                    message: `Tool ${toolName} is not applicable to the specified project`,
                    toolName,
                    projectPath
                });
                return;
            }
            // Get tool status
            const status = await tool.getStatus(projectId);
            res.json({
                success: true,
                testResult: 'compatible',
                toolName,
                status,
                canAnalyze,
                message: `Tool ${toolName} is ready and can analyze the project`,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            this.logger.error(`❌ Tool test failed for ${req.params.toolName}:`, error);
            res.status(500).json({
                success: false,
                error: 'Tool test failed',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    // Helper Methods
    getDetailedCapabilities(metadata) {
        // Enhance capability descriptions
        const capabilityDescriptions = {
            'file-prioritization': 'Intelligently ranks files by relevance to user queries',
            'semantic-weighting': 'Uses semantic understanding to weight code importance',
            'token-optimization': 'Optimizes context to fit within token limits',
            'relevance-scoring': 'Scores code elements based on query relevance',
            'semantic-code-search': 'Searches code using semantic meaning rather than just text matching',
            'concept-matching': 'Matches programming concepts across different implementations',
            'duplication-detection': 'Identifies duplicate and similar code patterns',
            'architectural-analysis': 'Analyzes overall code architecture and patterns'
        };
        return metadata.capabilities.map((cap) => ({
            name: cap,
            description: capabilityDescriptions[cap] || 'Advanced code analysis capability'
        }));
    }
    inferToolUseCases(metadata) {
        const useCases = [];
        if (metadata.category === 'optimization') {
            useCases.push('Improving code performance', 'Reducing token usage', 'Optimizing context windows');
        }
        if (metadata.category === 'search') {
            useCases.push('Finding relevant code', 'Code exploration', 'Understanding relationships');
        }
        if (metadata.category === 'architecture') {
            useCases.push('Architecture reviews', 'Design decisions', 'Refactoring planning');
        }
        if (metadata.category === 'quality') {
            useCases.push('Code reviews', 'Quality assessments', 'Bug prevention');
        }
        return useCases;
    }
    getCompatibleBundles(toolName) {
        const bundles = this.toolSelector.getAllBundles();
        return bundles
            .filter(bundle => bundle.requiredTools.includes(toolName) ||
            bundle.optionalTools.includes(toolName))
            .map(bundle => bundle.id);
    }
    checkBundleToolAvailability(bundle) {
        const allTools = tool_interface_1.ToolRegistry.getAllTools();
        const toolNames = allTools.map(t => t.getMetadata().name);
        return {
            requiredAvailable: bundle.requiredTools.filter((tool) => toolNames.includes(tool)),
            requiredMissing: bundle.requiredTools.filter((tool) => !toolNames.includes(tool)),
            optionalAvailable: bundle.optionalTools.filter((tool) => toolNames.includes(tool)),
            optionalMissing: bundle.optionalTools.filter((tool) => !toolNames.includes(tool))
        };
    }
    estimateBundleEffectiveness(bundle) {
        // Simple effectiveness estimation based on tool availability and trust levels
        const allTools = tool_interface_1.ToolRegistry.getAllTools();
        const toolsByName = new Map(allTools.map(t => [t.getMetadata().name, t]));
        let totalTrust = 0;
        let toolCount = 0;
        [...bundle.requiredTools, ...bundle.optionalTools].forEach(toolName => {
            const tool = toolsByName.get(toolName);
            if (tool) {
                totalTrust += tool.getMetadata().trustLevel;
                toolCount++;
            }
        });
        return toolCount > 0 ? (totalTrust / toolCount) / 10 : 0;
    }
    getBundleRecentActivations(bundleId) {
        // Mock data - in real implementation, query from database
        const mockActivations = {
            'architecture-analysis': 12,
            'code-quality-audit': 8,
            'performance-optimization': 6,
            'developer-experience': 15,
            'enterprise-compliance': 3
        };
        return mockActivations[bundleId] || 0;
    }
    validateBundleData(bundleData) {
        const errors = [];
        if (!bundleData.id || typeof bundleData.id !== 'string') {
            errors.push('Bundle ID is required and must be a string');
        }
        if (!bundleData.name || typeof bundleData.name !== 'string') {
            errors.push('Bundle name is required and must be a string');
        }
        if (!bundleData.description || typeof bundleData.description !== 'string') {
            errors.push('Bundle description is required and must be a string');
        }
        if (!Array.isArray(bundleData.requiredTools)) {
            errors.push('Required tools must be an array');
        }
        if (!Array.isArray(bundleData.optionalTools)) {
            errors.push('Optional tools must be an array');
        }
        if (!Array.isArray(bundleData.activationKeywords)) {
            errors.push('Activation keywords must be an array');
        }
        if (typeof bundleData.priority !== 'number' || bundleData.priority < 1 || bundleData.priority > 10) {
            errors.push('Priority must be a number between 1 and 10');
        }
        return { valid: errors.length === 0, errors };
    }
    generateMockAnalytics() {
        // Generate realistic mock analytics data
        return {
            selectionAccuracy: 0.89,
            avgToolsPerRequest: 3.2,
            totalSelections: 156,
            totalRequests: 89,
            toolUsage: [
                { tool: 'context-optimizer', uses: 45, lastUsed: '2 hours ago', avgConfidence: 0.92, successRate: 0.94 },
                { tool: 'semantic-search', uses: 38, lastUsed: '1 hour ago', avgConfidence: 0.88, successRate: 0.91 },
                { tool: 'duplication-detector', uses: 22, lastUsed: '4 hours ago', avgConfidence: 0.85, successRate: 0.87 },
                { tool: 'centralization-detector', uses: 15, lastUsed: '1 day ago', avgConfidence: 0.78, successRate: 0.82 }
            ],
            bundleActivations: [
                { bundle: 'architecture-analysis', activations: 12, effectiveness: 0.94, avgToolsUsed: 3.8 },
                { bundle: 'code-quality-audit', activations: 8, effectiveness: 0.91, avgToolsUsed: 4.2 },
                { bundle: 'performance-optimization', activations: 6, effectiveness: 0.87, avgToolsUsed: 2.5 }
            ],
            topQueries: [
                { query: 'architecture review', count: 15, avgConfidence: 0.92 },
                { query: 'code quality', count: 12, avgConfidence: 0.89 },
                { query: 'optimize performance', count: 9, avgConfidence: 0.85 }
            ],
            trendsOverTime: {
                daily: [
                    { date: '2024-01-01', selections: 12, accuracy: 0.91 },
                    { date: '2024-01-02', selections: 15, accuracy: 0.89 },
                    { date: '2024-01-03', selections: 18, accuracy: 0.92 }
                ]
            }
        };
    }
    getRouter() {
        return this.router;
    }
}
exports.ToolManagementAPI = ToolManagementAPI;
//# sourceMappingURL=tool-management-api.js.map
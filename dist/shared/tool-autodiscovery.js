"use strict";
/**
 * Tool Autodiscovery Service
 * Automatically discovers, registers, and manages all internal tools
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolAutodiscoveryService = void 0;
const tool_interface_1 = require("./tool-interface");
const logger_1 = require("./logger");
// Import all internal tools for registration
const semantic_graph_tool_1 = require("../features/semantic-graph/semantic-graph-tool");
const semantic_search_tool_1 = require("../features/search/semantic-search-tool");
// Note: Context optimization is the core CLI mechanism, not a separate tool
// TODO: Add remaining tool imports as they are implemented:
// import { CentralizationDetectorTool } from '../features/centralization/centralization-detector-tool';
// import { DuplicationDetectorTool } from '../features/duplication/duplication-detector-tool';
// import { TreeNavigatorTool } from '../features/tree-navigation/tree-navigator-tool';
// import { DocumentationAnalyzerTool } from '../features/documentation/documentation-analyzer-tool';
// import { CompilationVerifierTool } from '../features/compilation/compilation-verifier-tool';
// import { SolidPrinciplesAnalyzerTool } from '../features/solid-principles/solid-principles-analyzer-tool';
// import { UINavigationAnalyzerTool } from '../features/ui-navigation/ui-navigation-analyzer-tool';
// import { UseCasesAnalyzerTool } from '../features/use-cases/use-cases-analyzer-tool';
class ToolAutodiscoveryService {
    logger;
    initialized = false;
    constructor() {
        this.logger = logger_1.Logger.getInstance();
    }
    /**
     * Auto-register all internal tools
     */
    async initializeTools() {
        if (this.initialized)
            return;
        this.logger.info('🔧 Auto-discovering internal tools...');
        try {
            // Register all tools
            const tools = [
                new semantic_graph_tool_1.SemanticGraphTool(), // Core tool - always available
                new semantic_search_tool_1.SemanticSearchTool()
                // Note: Context optimization is built into the CLI itself
                // TODO: Add remaining tool instances as they are implemented:
                // new CentralizationDetectorTool(),
                // new DuplicationDetectorTool(),
                // new TreeNavigatorTool(),
                // new DocumentationAnalyzerTool(),
                // new CompilationVerifierTool(),
                // new SolidPrinciplesAnalyzerTool(),
                // new UINavigationAnalyzerTool(),
                // new UseCasesAnalyzerTool()
            ];
            for (const tool of tools) {
                tool_interface_1.ToolRegistry.registerTool(tool);
                const metadata = tool.getMetadata();
                this.logger.info(`  ✅ Registered: ${metadata.name} (${metadata.category}, trust: ${metadata.trustLevel})`);
            }
            this.initialized = true;
            this.logger.info(`🎉 Autodiscovered ${tools.length} internal tools`);
        }
        catch (error) {
            this.logger.error('❌ Tool autodiscovery failed:', error);
            throw error;
        }
    }
    /**
     * Get all tools metadata for database registration
     */
    getToolsForRegistration() {
        if (!this.initialized) {
            throw new Error('Tools not initialized. Call initializeTools() first.');
        }
        return tool_interface_1.ToolRegistry.getAllTools().map(tool => {
            const metadata = tool.getMetadata();
            return {
                name: metadata.name,
                category: metadata.category,
                trust_level: metadata.trustLevel,
                installation_status: 'installed',
                metadata: JSON.stringify({
                    type: 'internal',
                    version: metadata.version,
                    description: metadata.description,
                    capabilities: metadata.capabilities,
                    dependencies: metadata.dependencies || []
                })
            };
        });
    }
    /**
     * Initialize all tools for a specific project
     * Uses Claude Code to analyze and populate tables
     */
    async initializeProjectForAllTools(projectPath, projectId) {
        if (!this.initialized) {
            await this.initializeTools();
        }
        this.logger.info(`🔧 Initializing all tools for project: ${projectId}`);
        const results = new Map();
        let totalTablesCreated = 0;
        let totalRecordsInserted = 0;
        let allSuccess = true;
        const tools = tool_interface_1.ToolRegistry.getAllTools();
        for (const tool of tools) {
            const metadata = tool.getMetadata();
            try {
                this.logger.info(`  🔄 Initializing ${metadata.name}...`);
                // Check if tool can analyze this project
                const canAnalyze = await tool.canAnalyzeProject(projectPath);
                if (!canAnalyze) {
                    this.logger.info(`  ⏭️  Skipping ${metadata.name} (not applicable to this project)`);
                    continue;
                }
                // Initialize tool for project
                const result = await tool.initializeForProject(projectPath, projectId);
                results.set(metadata.name, result);
                if (result.success) {
                    totalTablesCreated += result.tablesCreated?.length || 0;
                    totalRecordsInserted += result.recordsInserted || 0;
                    this.logger.info(`  ✅ ${metadata.name}: ${result.recordsInserted || 0} records created`);
                }
                else {
                    allSuccess = false;
                    this.logger.error(`  ❌ ${metadata.name}: ${result.error}`);
                }
            }
            catch (error) {
                allSuccess = false;
                const errorResult = {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
                results.set(metadata.name, errorResult);
                this.logger.error(`  💥 ${metadata.name} initialization failed:`, error);
            }
        }
        this.logger.info(`🎯 Project initialization complete: ${results.size} tools processed`);
        this.logger.info(`   Tables created: ${totalTablesCreated}, Records inserted: ${totalRecordsInserted}`);
        return {
            success: allSuccess,
            results,
            totalTablesCreated,
            totalRecordsInserted
        };
    }
    /**
     * Analyze project with all applicable tools
     */
    async analyzeProjectWithAllTools(projectPath, projectId) {
        if (!this.initialized) {
            await this.initializeTools();
        }
        this.logger.info(`🧠 Running full project analysis: ${projectId}`);
        const startTime = Date.now();
        const results = new Map();
        let allSuccess = true;
        const tools = tool_interface_1.ToolRegistry.getAllTools();
        for (const tool of tools) {
            const metadata = tool.getMetadata();
            try {
                // Check if tool can analyze this project
                const canAnalyze = await tool.canAnalyzeProject(projectPath);
                if (!canAnalyze) {
                    continue;
                }
                this.logger.info(`  🔍 Analyzing with ${metadata.name}...`);
                const result = await tool.analyzeProject(projectPath, projectId);
                results.set(metadata.name, result);
                const executionTime = result.metrics?.executionTime || 0;
                this.logger.info(`  ✅ ${metadata.name}: completed in ${executionTime}ms`);
            }
            catch (error) {
                allSuccess = false;
                this.logger.error(`  💥 ${metadata.name} analysis failed:`, error);
            }
        }
        const totalExecutionTime = Date.now() - startTime;
        this.logger.info(`🎯 Full analysis complete in ${totalExecutionTime}ms`);
        return {
            success: allSuccess,
            results,
            totalExecutionTime
        };
    }
    /**
     * Update all tools after CLI command execution
     */
    async updateToolsAfterCliRequest(projectPath, projectId, cliCommand, cliResult) {
        if (!this.initialized) {
            await this.initializeTools();
        }
        this.logger.info(`🔄 Updating tools after CLI request: ${cliCommand}`);
        const results = new Map();
        let allSuccess = true;
        const tools = tool_interface_1.ToolRegistry.getAllTools();
        for (const tool of tools) {
            const metadata = tool.getMetadata();
            try {
                const result = await tool.updateAfterCliRequest(projectPath, projectId, cliCommand, cliResult);
                results.set(metadata.name, result);
                if (result.success && (result.recordsModified || 0) > 0) {
                    this.logger.info(`  ✅ ${metadata.name}: updated ${result.recordsModified} records`);
                }
            }
            catch (error) {
                allSuccess = false;
                this.logger.error(`  💥 ${metadata.name} update failed:`, error);
            }
        }
        return { success: allSuccess, results };
    }
    /**
     * Get status of all tools for a project
     */
    async getToolsStatus(projectId) {
        if (!this.initialized) {
            await this.initializeTools();
        }
        const tools = tool_interface_1.ToolRegistry.getAllTools();
        const statuses = [];
        for (const tool of tools) {
            const metadata = tool.getMetadata();
            try {
                const status = await tool.getStatus(projectId);
                statuses.push({
                    name: metadata.name,
                    category: metadata.category,
                    status
                });
            }
            catch (error) {
                statuses.push({
                    name: metadata.name,
                    category: metadata.category,
                    status: { initialized: false, health: 'error', error: error instanceof Error ? error.message : 'Unknown error' }
                });
            }
        }
        return statuses;
    }
}
exports.ToolAutodiscoveryService = ToolAutodiscoveryService;
//# sourceMappingURL=tool-autodiscovery.js.map
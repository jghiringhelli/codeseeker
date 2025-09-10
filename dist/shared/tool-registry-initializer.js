"use strict";
/**
 * Tool Registry Initializer - Auto-discovers and registers all internal tools
 * Bridges enhanced tools with the InternalTool interface via adapters
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolRegistryInitializer = void 0;
const tool_interface_1 = require("./tool-interface");
const tool_adapter_1 = require("./tool-adapter");
const logger_1 = require("../utils/logger");
const path_1 = __importDefault(require("path"));
class ToolRegistryInitializer {
    static logger = new logger_1.Logger(logger_1.LogLevel.INFO, 'ToolRegistryInitializer');
    /**
     * Initialize all available tools and register them
     */
    static async initializeAllTools(projectRoot = process.cwd()) {
        this.logger.info('Discovering and registering internal tools...');
        const toolConfigurations = [
            {
                name: 'tree-navigator',
                path: '../features/tree-navigation/navigator',
                className: 'TreeNavigator'
            },
            {
                name: 'compilation-verifier',
                path: '../features/compilation/verifier',
                className: 'CompilationVerifier'
            },
            {
                name: 'solid-analyzer',
                path: '../features/solid-principles/analyzer',
                className: 'SOLIDAnalyzer'
            },
            {
                name: 'centralization-detector',
                path: '../features/centralization/detector',
                className: 'CentralizationDetector'
            },
            {
                name: 'ui-navigator',
                path: '../features/ui-navigation/analyzer',
                className: 'UINavigationAnalyzer'
            },
            {
                name: 'use-case-analyzer',
                path: '../features/use-cases/analyzer',
                className: 'UseCaseAnalyzer'
            },
            {
                name: 'semantic-search',
                path: '../features/search/semantic-search-complete',
                className: 'SemanticSearchTool'
            }
        ];
        let registeredCount = 0;
        for (const config of toolConfigurations) {
            try {
                await this.registerTool(config, projectRoot);
                registeredCount++;
            }
            catch (error) {
                this.logger.warn(`Failed to register tool ${config.name}: ${error}`);
            }
        }
        this.logger.info(`Successfully registered ${registeredCount}/${toolConfigurations.length} tools`);
    }
    /**
     * Register a single tool with error handling
     */
    static async registerTool(config, projectRoot) {
        try {
            // Determine the correct path based on whether we're in dist or src
            const possiblePaths = [
                path_1.default.resolve(__dirname, config.path),
                path_1.default.resolve(projectRoot, 'dist', 'features', config.name.replace('-', '/'), config.className.toLowerCase()),
                path_1.default.resolve(projectRoot, 'src', 'features', config.name.replace('-', '/'), config.className.toLowerCase())
            ];
            let toolModule = null;
            let loadedPath = '';
            // Try each possible path
            for (const tryPath of possiblePaths) {
                try {
                    toolModule = require(tryPath);
                    loadedPath = tryPath;
                    break;
                }
                catch (error) {
                    // Try next path
                    continue;
                }
            }
            if (!toolModule) {
                throw new Error(`Could not load module from any of the attempted paths`);
            }
            // Find the tool class in the module
            const ToolClass = toolModule[config.className] ||
                toolModule.default ||
                Object.values(toolModule).find(exp => typeof exp === 'function' && exp.name === config.className);
            if (!ToolClass || typeof ToolClass !== 'function') {
                throw new Error(`Could not find class ${config.className} in module`);
            }
            // Create instance and adapt to InternalTool interface
            const toolInstance = new ToolClass();
            // Verify it has the required methods for enhanced interface
            if (!toolInstance.getDatabaseToolName || !toolInstance.performAnalysis) {
                throw new Error(`Tool ${config.name} does not implement AnalysisTool interface`);
            }
            const adaptedTool = new tool_adapter_1.ToolAdapter(toolInstance);
            tool_interface_1.ToolRegistry.registerTool(config.name, adaptedTool);
            this.logger.info(`✅ Registered tool: ${config.name} from ${loadedPath}`);
        }
        catch (error) {
            this.logger.error(`❌ Failed to register tool ${config.name}: ${error}`);
            throw error;
        }
    }
    /**
     * Get tool registration status
     */
    static getRegistrationStatus() {
        const allTools = tool_interface_1.ToolRegistry.getAllTools();
        const toolsByCategory = {};
        allTools.forEach(tool => {
            const metadata = tool.getMetadata();
            if (!toolsByCategory[metadata.category]) {
                toolsByCategory[metadata.category] = [];
            }
            toolsByCategory[metadata.category].push(metadata.name);
        });
        return {
            totalRegistered: allTools.length,
            availableTools: allTools.map(tool => tool.getMetadata().name),
            toolsByCategory
        };
    }
    /**
     * Verify all registered tools are healthy
     */
    static async verifyAllTools(projectId) {
        const allTools = tool_interface_1.ToolRegistry.getAllTools();
        const healthy = [];
        const unhealthy = [];
        const details = {};
        for (const tool of allTools) {
            try {
                const status = await tool.getStatus(projectId);
                const toolName = tool.getMetadata().name;
                details[toolName] = status;
                if (status.health === 'healthy') {
                    healthy.push(toolName);
                }
                else {
                    unhealthy.push(toolName);
                }
            }
            catch (error) {
                const toolName = tool.getMetadata().name;
                unhealthy.push(toolName);
                details[toolName] = {
                    health: 'error',
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        }
        return { healthy, unhealthy, details };
    }
}
exports.ToolRegistryInitializer = ToolRegistryInitializer;
//# sourceMappingURL=tool-registry-initializer.js.map
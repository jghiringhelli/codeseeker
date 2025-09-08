"use strict";
/**
 * Tool Adapter - Bridges existing enhanced tools to InternalTool interface
 * Allows initialization script to work with existing tool implementations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolAdapter = void 0;
const tool_interface_1 = require("./tool-interface");
const logger_1 = require("../utils/logger");
class ToolAdapter extends tool_interface_1.InternalTool {
    enhancedTool;
    logger;
    constructor(enhancedTool) {
        super();
        this.enhancedTool = enhancedTool;
        this.logger = new logger_1.Logger(logger_1.LogLevel.INFO, enhancedTool.name);
    }
    getMetadata() {
        return {
            name: this.enhancedTool.name,
            category: this.mapCategory(this.enhancedTool.category),
            trustLevel: 0.8,
            version: this.enhancedTool.version,
            description: this.enhancedTool.description,
            dependencies: this.enhancedTool.dependencies,
            capabilities: Object.keys(this.enhancedTool.capabilities)
        };
    }
    async initializeForProject(projectPath, projectId) {
        try {
            this.logger.info(`Initializing ${this.enhancedTool.name} for project ${projectId}`);
            // Check if tool is applicable
            const applicable = this.enhancedTool.isApplicable ?
                this.enhancedTool.isApplicable(projectPath, { projectId }) : true;
            if (!applicable) {
                return {
                    success: false,
                    error: `Tool ${this.enhancedTool.name} is not applicable to this project`
                };
            }
            // Ensure database tables exist (handled by tool-database-api.ts)
            return {
                success: true,
                tablesCreated: [this.enhancedTool.getDatabaseToolName()],
                recordsInserted: 0
            };
        }
        catch (error) {
            this.logger.error(`Initialization failed: ${error}`);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown initialization error'
            };
        }
    }
    async analyzeProject(projectPath, projectId, parameters) {
        try {
            this.logger.info(`Running analysis with ${this.enhancedTool.name}`);
            const startTime = Date.now();
            const result = await this.enhancedTool.analyze(projectPath, projectId, parameters);
            const executionTime = Date.now() - startTime;
            return {
                toolName: this.enhancedTool.name,
                projectId,
                timestamp: new Date(),
                data: result.data,
                metrics: {
                    executionTime,
                    confidence: 0.8,
                    coverage: Array.isArray(result.data) ? Math.min(result.data.length / 100, 1.0) : 1.0
                },
                recommendations: result.recommendations || [],
                errors: result.error ? [result.error] : []
            };
        }
        catch (error) {
            this.logger.error(`Analysis failed: ${error}`);
            return {
                toolName: this.enhancedTool.name,
                projectId,
                timestamp: new Date(),
                data: null,
                errors: [error instanceof Error ? error.message : 'Unknown analysis error']
            };
        }
    }
    async updateAfterCliRequest(projectPath, projectId, cliCommand, cliResult) {
        try {
            this.logger.info(`Updating ${this.enhancedTool.name} after CLI request`);
            // Check if this tool should respond to the CLI command
            const shouldUpdate = this.shouldUpdateForCommand(cliCommand);
            if (!shouldUpdate) {
                return {
                    success: true,
                    tablesUpdated: [],
                    recordsModified: 0
                };
            }
            // Use enhanced tool's update knowledge method if available
            if (this.enhancedTool.updateKnowledge) {
                await this.enhancedTool.updateKnowledge(projectId, {
                    command: cliCommand,
                    result: cliResult,
                    timestamp: new Date()
                });
            }
            return {
                success: true,
                tablesUpdated: [this.enhancedTool.getDatabaseToolName()],
                recordsModified: 1
            };
        }
        catch (error) {
            this.logger.error(`Update failed: ${error}`);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown update error'
            };
        }
    }
    async canAnalyzeProject(projectPath) {
        try {
            if (this.enhancedTool.isApplicable) {
                return this.enhancedTool.isApplicable(projectPath, {});
            }
            return true;
        }
        catch {
            return false;
        }
    }
    mapCategory(category) {
        const categoryMap = {
            'navigation': 'navigation',
            'architecture': 'architecture',
            'code-quality': 'quality',
            'verification': 'verification',
            'analysis': 'analysis',
            'optimization': 'optimization',
            'search': 'search'
        };
        return categoryMap[category] || 'analysis';
    }
    shouldUpdateForCommand(command) {
        const updateTriggers = [
            'refactor', 'create', 'modify', 'delete', 'move', 'rename',
            'add', 'remove', 'update', 'change', 'fix'
        ];
        return updateTriggers.some(trigger => command.toLowerCase().includes(trigger));
    }
}
exports.ToolAdapter = ToolAdapter;
//# sourceMappingURL=tool-adapter.js.map
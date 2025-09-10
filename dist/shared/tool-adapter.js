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
    async initialize(projectId) {
        try {
            this.logger.info(`Initializing ${this.enhancedTool.name} for project ${projectId}`);
            return {
                success: true,
                metadata: this.getMetadata(),
                tablesCreated: 1
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Initialization failed',
                metadata: this.getMetadata()
            };
        }
    }
    async initializeForProject(projectPath, projectId) {
        return this.initialize(projectId);
    }
    async analyze(projectPath, projectId, parameters) {
        return this.analyzeProject(projectPath, projectId, parameters);
    }
    async analyzeProject(projectPath, projectId, parameters) {
        try {
            this.logger.info(`Running analysis with ${this.enhancedTool.name}`);
            // Use the enhanced tool's analyze method
            const result = await this.enhancedTool.analyze(projectPath, projectId, parameters);
            return {
                success: true,
                toolName: this.enhancedTool.name,
                projectId,
                timestamp: new Date(),
                data: result.data || result.analysis,
                metadata: this.getMetadata(),
                metrics: result.metrics,
                recommendations: this.enhancedTool.getRecommendations ?
                    this.enhancedTool.getRecommendations(result) : []
            };
        }
        catch (error) {
            this.logger.error(`Analysis failed: ${error}`);
            return {
                success: false,
                toolName: this.enhancedTool.name,
                projectId,
                timestamp: new Date(),
                metadata: this.getMetadata(),
                error: error instanceof Error ? error.message : 'Analysis failed'
            };
        }
    }
    async update(projectId, data) {
        try {
            if (this.enhancedTool.updateKnowledge) {
                await this.enhancedTool.updateKnowledge(projectId, data);
            }
        }
        catch (error) {
            this.logger.error(`Update failed: ${error}`);
        }
    }
    async updateAfterCliRequest(projectPath, projectId, cliCommand, cliResult) {
        try {
            await this.update(projectId, { command: cliCommand, result: cliResult });
            return {
                success: true,
                updated: 1,
                changes: [`Updated knowledge for ${this.enhancedTool.name}`]
            };
        }
        catch (error) {
            return {
                success: false,
                updated: false,
                error: error instanceof Error ? error.message : 'Update failed'
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
    async getStatus(projectId) {
        try {
            return {
                initialized: true,
                lastAnalysis: new Date(),
                recordCount: 0,
                health: 'healthy'
            };
        }
        catch (error) {
            return {
                initialized: false,
                health: 'error'
            };
        }
    }
    mapCategory(category) {
        const categoryMap = {
            'code_analysis': 'analysis',
            'documentation': 'documentation',
            'testing': 'quality',
            'optimization': 'optimization',
            'search': 'search'
        };
        return categoryMap[category] || 'other';
    }
}
exports.ToolAdapter = ToolAdapter;
//# sourceMappingURL=tool-adapter.js.map
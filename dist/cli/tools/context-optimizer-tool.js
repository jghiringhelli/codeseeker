"use strict";
/**
 * Context Optimizer Tool Implementation
 * Wraps the ContextOptimizer class to implement InternalTool interface
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextOptimizerTool = void 0;
const tool_interface_1 = require("../../shared/tool-interface");
const logger_1 = require("../../utils/logger");
const context_optimizer_1 = require("../context-optimizer");
class ContextOptimizerTool extends tool_interface_1.InternalTool {
    logger;
    contextOptimizer;
    constructor() {
        super();
        this.logger = logger_1.Logger.getInstance();
        this.contextOptimizer = new context_optimizer_1.ContextOptimizer();
    }
    getMetadata() {
        return {
            name: 'context-optimizer',
            category: 'optimization',
            trustLevel: 9.5,
            version: '2.0.0',
            description: 'Intelligent context optimization for token-efficient Claude Code integration',
            capabilities: [
                'file-prioritization',
                'semantic-weighting',
                'token-optimization',
                'relevance-scoring'
            ],
            dependencies: ['semantic-graph']
        };
    }
    async initialize(projectId) {
        try {
            this.logger.info(`🔧 Context Optimizer: Initializing for project ${projectId}`);
            return {
                success: true,
                metadata: this.getMetadata(),
                tablesCreated: 3
            };
        }
        catch (error) {
            this.logger.error('Context Optimizer initialization failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                metadata: this.getMetadata()
            };
        }
    }
    async initializeForProject(projectPath, projectId) {
        return this.initialize(projectId);
    }
    async analyze(projectPath, projectId, parameters) {
        const startTime = Date.now();
        try {
            this.logger.info(`🧠 Context Optimizer: Analyzing project ${projectPath}`);
            // Use the actual ContextOptimizer for analysis
            const optimization = await this.contextOptimizer.optimizeContext({
                projectPath,
                query: parameters?.query || 'general analysis',
                tokenBudget: parameters?.tokenBudget || 8000,
                strategy: parameters?.strategy || 'smart',
                focusArea: parameters?.focusArea
            });
            const executionTime = Date.now() - startTime;
            return {
                success: true,
                toolName: 'context-optimizer',
                projectId,
                timestamp: new Date(),
                data: {
                    fileCount: optimization.priorityFiles.length,
                    criticalFiles: optimization.priorityFiles
                        .filter(f => f.importance === 'critical')
                        .map(f => ({ path: f.path, relevanceScore: f.score / 100 })),
                    tokenOptimizationOpportunities: [
                        { type: 'smart_selection', savings: Math.max(0, 8000 - optimization.estimatedTokens) }
                    ],
                    recommendedContextWindows: {
                        overview: Math.floor(optimization.estimatedTokens * 0.5),
                        coding: optimization.estimatedTokens,
                        debugging: Math.floor(optimization.estimatedTokens * 0.8)
                    },
                    strategy: optimization.strategy,
                    estimatedTokens: optimization.estimatedTokens
                },
                metadata: this.getMetadata(),
                metrics: {
                    executionTime,
                    confidence: 0.85,
                    coverage: 1.0
                },
                recommendations: [
                    `Use ${optimization.strategy} strategy for optimal token usage`,
                    `Estimated context size: ${optimization.estimatedTokens} tokens`,
                    `Found ${optimization.priorityFiles.length} priority files for context`
                ]
            };
        }
        catch (error) {
            this.logger.error('Context Optimizer analysis failed:', error);
            return {
                success: false,
                toolName: 'context-optimizer',
                projectId,
                timestamp: new Date(),
                metadata: this.getMetadata(),
                error: error instanceof Error ? error.message : 'Analysis failed'
            };
        }
    }
    async analyzeProject(projectPath, projectId, parameters) {
        return this.analyze(projectPath, projectId, parameters);
    }
    async update(projectId, data) {
        try {
            this.logger.info(`🔄 Context Optimizer: Updating knowledge for project ${projectId}`);
            // Clear cache when new data is available
            this.contextOptimizer.clearCache();
        }
        catch (error) {
            this.logger.error('Context Optimizer update failed:', error);
        }
    }
    async updateAfterCliRequest(projectPath, projectId, cliCommand, cliResult) {
        try {
            await this.update(projectId, { command: cliCommand, result: cliResult });
            return {
                success: true,
                updated: 1,
                changes: [`Updated context cache for command: ${cliCommand}`]
            };
        }
        catch (error) {
            this.logger.error('Context Optimizer update failed:', error);
            return {
                success: false,
                updated: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async canAnalyzeProject(projectPath) {
        // Context optimizer can work with any project
        return true;
    }
    async getStatus(projectId) {
        try {
            // In real implementation, query database for status
            return {
                initialized: true,
                lastAnalysis: new Date(),
                recordCount: 0, // Would come from DB query
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
}
exports.ContextOptimizerTool = ContextOptimizerTool;
//# sourceMappingURL=context-optimizer-tool.js.map
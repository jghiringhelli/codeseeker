"use strict";
/**
 * Workflow Orchestration Adapter - SOLID Principles Compliant
 * Bridges the CLI CommandProcessor to the sophisticated CodeMindWorkflowOrchestrator
 * Implements the IRequestProcessor interface following Dependency Inversion Principle
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowOrchestrationAdapter = void 0;
const codemind_workflow_orchestrator_1 = require("../codemind-workflow-orchestrator");
const theme_1 = require("../ui/theme");
const logger_1 = require("../../utils/logger");
class WorkflowOrchestrationAdapter {
    workflowOrchestrator;
    logger = logger_1.Logger.getInstance();
    constructor(projectId, projectPath) {
        this.workflowOrchestrator = new codemind_workflow_orchestrator_1.CodeMindWorkflowOrchestrator(projectId || 'current-project');
    }
    /**
     * Process user request through full CodeMind workflow
     * This is the main method called by CommandProcessor
     */
    async processRequest(query, projectPath) {
        this.logger.info(`🚀 Processing request through full workflow: "${query}"`);
        try {
            // Convert CLI request to workflow request format
            const request = {
                query,
                projectId: this.extractProjectId(projectPath),
                timestamp: Date.now(),
                userId: 'cli-user'
            };
            // Execute the complete workflow
            console.log(theme_1.Theme.colors.info('🔄 Executing complete CodeMind workflow...'));
            console.log(theme_1.Theme.colors.muted('  • Analyzing intent and selecting tools'));
            console.log(theme_1.Theme.colors.muted('  • Gathering semantic context from databases'));
            console.log(theme_1.Theme.colors.muted('  • Splitting into manageable sub-tasks'));
            console.log(theme_1.Theme.colors.muted('  • Processing each task with enhanced context'));
            console.log(theme_1.Theme.colors.muted('  • Running comprehensive quality checks'));
            console.log(theme_1.Theme.colors.muted('  • Updating all databases with changes'));
            const workflowResult = await this.workflowOrchestrator.executeFeatureRequest(request);
            // Convert workflow result back to CLI format
            return this.convertWorkflowResult(workflowResult);
        }
        catch (error) {
            this.logger.error(`❌ Workflow processing failed: ${error.message}`);
            return {
                success: false,
                error: `Workflow execution failed: ${error.message}`
            };
        }
    }
    /**
     * Simplified project analysis for /init command
     */
    async analyzeProject(projectPath, resumeToken) {
        this.logger.info(`🔍 Analyzing project: ${projectPath}`);
        // For now, return basic analysis structure
        // In full implementation, this would use the semantic enhancement engine
        return {
            architecture: {
                type: 'api_service',
                patterns: ['layered-architecture', 'dependency-injection'],
                frameworks: ['typescript', 'nodejs'],
                designPrinciples: ['SOLID', 'DRY', 'KISS']
            },
            dependencies: {
                files: [],
                relationships: []
            },
            useCases: [
                {
                    name: 'Code Analysis',
                    description: 'Analyze project structure and dependencies',
                    actors: ['Developer'],
                    preconditions: ['Project exists'],
                    steps: ['Scan files', 'Extract dependencies', 'Build graph'],
                    postconditions: ['Analysis complete'],
                    businessValue: 'Enable intelligent code assistance'
                }
            ],
            codeQuality: {
                score: 85,
                issues: [],
                recommendations: ['Add more tests', 'Improve documentation']
            },
            resumeToken: resumeToken || 'analysis-complete'
        };
    }
    // Helper methods
    extractProjectId(projectPath) {
        // Extract project identifier from path
        const projectName = projectPath.split(/[/\\]/).pop() || 'unknown-project';
        return projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    }
    convertWorkflowResult(workflowResult) {
        if (workflowResult.success) {
            return {
                success: true,
                data: {
                    summary: workflowResult.summary,
                    filesModified: workflowResult.filesModified,
                    qualityScore: workflowResult.qualityScore,
                    gitBranch: workflowResult.gitBranch,
                    databases: workflowResult.databases,
                    // CLI-friendly display data
                    results: {
                        type: 'workflow_execution',
                        title: 'Feature Implementation Complete',
                        details: [
                            `Quality Score: ${workflowResult.qualityScore}%`,
                            `Files Modified: ${workflowResult.filesModified.length}`,
                            `Git Branch: ${workflowResult.gitBranch}`,
                            `Neo4j Updates: ${workflowResult.databases.neo4j.nodesCreated} nodes, ${workflowResult.databases.neo4j.relationshipsCreated} relationships`,
                            `Redis Updates: ${workflowResult.databases.redis.filesUpdated} files`,
                            `PostgreSQL Updates: ${workflowResult.databases.postgres.recordsUpdated} records`
                        ],
                        success: true
                    }
                }
            };
        }
        else {
            return {
                success: false,
                error: workflowResult.summary,
                data: {
                    qualityScore: workflowResult.qualityScore,
                    summary: workflowResult.summary
                }
            };
        }
    }
}
exports.WorkflowOrchestrationAdapter = WorkflowOrchestrationAdapter;
exports.default = WorkflowOrchestrationAdapter;
//# sourceMappingURL=workflow-orchestration-adapter.js.map
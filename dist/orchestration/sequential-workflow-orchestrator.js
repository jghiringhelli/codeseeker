"use strict";
/**
 * Sequential Workflow Orchestrator - Graph-based role coordination
 *
 * Manages complex analysis workflows by coordinating role-based terminals
 * in sequential order based on dependency graphs. Each role processes
 * and enriches context before passing to the next logical role.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SequentialWorkflowOrchestrator = void 0;
const uuid_1 = require("uuid");
const redis_queue_1 = __importDefault(require("../messaging/redis-queue"));
// Removed IntelligentToolSelector dependency during cleanup
const database_1 = require("../database/database");
const logger_1 = require("../utils/logger");
class SequentialWorkflowOrchestrator {
    redis;
    db;
    logger = logger_1.Logger.getInstance();
    activeOrchestrations = new Map();
    constructor() {
        this.redis = new redis_queue_1.default();
        this.db = new database_1.Database();
    }
    async initialize() {
        await this.redis.connect();
        this.logger.info('🎭 Sequential Workflow Orchestrator initialized');
    }
    async shutdown() {
        await this.redis.disconnect();
        this.logger.info('🎭 Sequential Workflow Orchestrator shutdown');
    }
    /**
     * Start a sequential workflow orchestration
     */
    async orchestrate(request) {
        const orchestrationId = (0, uuid_1.v4)();
        this.logger.info(`🚀 Starting orchestration ${orchestrationId}`, {
            query: request.query,
            projectPath: request.projectPath,
            requestedBy: request.requestedBy
        });
        try {
            // Build workflow graph based on query complexity
            const workflowGraph = await this.buildWorkflowGraph(request);
            // Create orchestration result
            const result = {
                orchestrationId,
                workflowGraph,
                status: 'initiated',
                startTime: Date.now()
            };
            this.activeOrchestrations.set(orchestrationId, result);
            // Store in database
            await this.storeOrchestration(result, request);
            // Start the workflow asynchronously
            this.executeWorkflow(orchestrationId, request, workflowGraph)
                .catch(error => {
                this.logger.error(`❌ Workflow ${orchestrationId} failed:`, error);
                this.handleWorkflowError(orchestrationId, error);
            });
            return result;
        }
        catch (error) {
            this.logger.error(`❌ Failed to start orchestration ${orchestrationId}:`, error);
            throw error;
        }
    }
    /**
     * Execute the sequential workflow
     */
    async executeWorkflow(orchestrationId, request, workflowGraph) {
        const result = this.activeOrchestrations.get(orchestrationId);
        result.status = 'running';
        try {
            // Find starting role (no incoming edges)
            const startingRole = workflowGraph.roles.find(role => !workflowGraph.edges.some(edge => edge.to === role.id));
            if (!startingRole) {
                throw new Error('No starting role found in workflow graph');
            }
            // Send initial message to starting role
            const initialMessage = {
                workflowId: orchestrationId,
                roleId: startingRole.id,
                input: {
                    originalQuery: request.query,
                    projectPath: request.projectPath,
                    toolResults: [],
                    contextFromPrevious: null
                },
                metadata: {
                    step: 1,
                    totalSteps: workflowGraph.roles.length,
                    timestamp: Date.now(),
                    priority: request.options?.priority || 'normal',
                    retryCount: 0,
                    maxRetries: request.options?.maxRetries || 3
                }
            };
            await this.redis.sendToRole(startingRole.id, initialMessage);
            // Monitor workflow completion
            await this.monitorWorkflowCompletion(orchestrationId, request.options?.timeoutMinutes || 30);
        }
        catch (error) {
            await this.handleWorkflowError(orchestrationId, error);
            throw error;
        }
    }
    /**
     * Monitor workflow for completion
     */
    async monitorWorkflowCompletion(orchestrationId, timeoutMinutes) {
        const timeoutMs = timeoutMinutes * 60 * 1000;
        const startTime = Date.now();
        while (Date.now() - startTime < timeoutMs) {
            const completion = await this.redis.waitForCompletion(orchestrationId, 30);
            if (!completion) {
                continue; // Timeout, check again
            }
            this.logger.info(`📋 Workflow ${orchestrationId} completion received`, {
                roleId: completion.roleId,
                status: completion.status
            });
            if (completion.status === 'complete') {
                await this.handleWorkflowComplete(orchestrationId, completion);
                return;
            }
            if (completion.status === 'error') {
                throw new Error(`Role ${completion.roleId} failed: ${completion.error}`);
            }
            // Status is 'progress', continue monitoring
        }
        throw new Error(`Workflow ${orchestrationId} timed out after ${timeoutMinutes} minutes`);
    }
    /**
     * Handle workflow completion
     */
    async handleWorkflowComplete(orchestrationId, completion) {
        const result = this.activeOrchestrations.get(orchestrationId);
        if (!result)
            return;
        result.status = 'completed';
        result.endTime = Date.now();
        result.finalResult = completion.result;
        // Update database
        await this.updateOrchestrationResult(result);
        // Cleanup Redis data
        await this.redis.cleanupWorkflow(orchestrationId);
        this.logger.info(`✅ Workflow ${orchestrationId} completed successfully`, {
            duration: result.endTime - result.startTime,
            finalResult: !!completion.result
        });
    }
    /**
     * Handle workflow error
     */
    async handleWorkflowError(orchestrationId, error) {
        const result = this.activeOrchestrations.get(orchestrationId);
        if (!result)
            return;
        result.status = 'failed';
        result.endTime = Date.now();
        result.error = error.message;
        // Update database
        await this.updateOrchestrationResult(result);
        // Cleanup Redis data
        await this.redis.cleanupWorkflow(orchestrationId);
        this.logger.error(`❌ Workflow ${orchestrationId} failed`, {
            durationMs: result.endTime - result.startTime,
            errorMessage: error.message
        });
    }
    /**
     * Build workflow graph based on query analysis
     */
    async buildWorkflowGraph(request) {
        // Analyze complexity and determine roles needed (simplified after cleanup)
        const complexity = await this.analyzeQueryComplexity(request.query);
        const workflowGraph = {
            id: (0, uuid_1.v4)(),
            name: this.generateWorkflowName(complexity),
            description: `Sequential analysis workflow for: ${request.query}`,
            roles: [],
            edges: [],
            estimatedDuration: 0,
            estimatedTokens: 0
        };
        // Build roles based on complexity analysis
        if (complexity.domains.includes('architecture') || complexity.scope !== 'narrow') {
            workflowGraph.roles.push(this.createArchitectRole());
        }
        if (complexity.domains.includes('security') || complexity.keywords > 2) {
            workflowGraph.roles.push(this.createSecurityRole());
        }
        if (complexity.domains.includes('quality') || complexity.scope !== 'narrow') {
            workflowGraph.roles.push(this.createQualityRole());
        }
        if (complexity.domains.includes('performance')) {
            workflowGraph.roles.push(this.createPerformanceRole());
        }
        // Always add coordinator if multiple roles
        if (workflowGraph.roles.length > 1) {
            workflowGraph.roles.push(this.createCoordinatorRole());
        }
        else if (workflowGraph.roles.length === 0) {
            // Fallback: at least architect for any complex query
            workflowGraph.roles.push(this.createArchitectRole());
        }
        // Build edges (sequential flow)
        workflowGraph.edges = this.buildSequentialEdges(workflowGraph.roles);
        // Calculate estimates
        workflowGraph.estimatedDuration = this.estimateWorkflowDuration(workflowGraph);
        workflowGraph.estimatedTokens = this.estimateWorkflowTokens(workflowGraph);
        return workflowGraph;
    }
    /**
     * Analyze query complexity (simplified version of tool selector logic)
     */
    async analyzeQueryComplexity(query) {
        const queryLower = query.toLowerCase();
        const keywords = this.countComplexityKeywords(queryLower);
        const scope = this.assessQueryScope(queryLower);
        const domains = this.identifyDomains(queryLower);
        return {
            keywords,
            scope,
            domains,
            complexityScore: keywords * 0.1 + domains.length * 0.2 + (scope === 'comprehensive' ? 0.5 : 0.3)
        };
    }
    countComplexityKeywords(query) {
        const complexKeywords = [
            'comprehensive', 'complete', 'full', 'entire', 'all',
            'architecture', 'design', 'structure', 'system',
            'refactor', 'improve', 'optimize', 'enhance',
            'production', 'deployment', 'release', 'go-live',
            'security', 'performance', 'scalability', 'maintenance'
        ];
        return complexKeywords.filter(keyword => query.includes(keyword)).length;
    }
    assessQueryScope(query) {
        if (query.includes('comprehensive') || query.includes('complete') || query.includes('full')) {
            return 'comprehensive';
        }
        if (query.includes('project') || query.includes('system') || query.includes('entire')) {
            return 'broad';
        }
        if (query.includes('file') || query.includes('function') || query.includes('specific')) {
            return 'narrow';
        }
        return 'medium';
    }
    identifyDomains(query) {
        const domains = [];
        if (query.match(/architecture|design|structure|pattern/))
            domains.push('architecture');
        if (query.match(/bug|error|issue|problem|fix/))
            domains.push('debugging');
        if (query.match(/refactor|improve|cleanup|organize/))
            domains.push('refactoring');
        if (query.match(/test|quality|review|assess/))
            domains.push('quality');
        if (query.match(/security|vulnerability|secure/))
            domains.push('security');
        if (query.match(/performance|speed|optimize|slow/))
            domains.push('performance');
        if (query.match(/document|docs|api|spec/))
            domains.push('documentation');
        return domains;
    }
    /**
     * Create role definitions
     */
    createArchitectRole() {
        return {
            id: 'architect',
            name: 'System Architect',
            description: 'Analyzes system architecture, dependencies, and design patterns',
            expertise: ['system-design', 'dependencies', 'architecture-patterns', 'scalability'],
            tools: ['tree-navigator', 'knowledge-graph', 'context-optimizer'],
            contextRequirements: ['project-structure', 'dependencies', 'configuration'],
            outputFormat: 'architectural-analysis'
        };
    }
    createSecurityRole() {
        return {
            id: 'security',
            name: 'Security Specialist',
            description: 'Reviews security vulnerabilities, compliance, and best practices',
            expertise: ['security-analysis', 'vulnerability-assessment', 'compliance', 'threat-modeling'],
            tools: ['issues-detector', 'centralization-detector', 'context-optimizer'],
            contextRequirements: ['risk-areas', 'exposed-endpoints', 'configuration'],
            outputFormat: 'security-analysis'
        };
    }
    createQualityRole() {
        return {
            id: 'quality',
            name: 'Quality Engineer',
            description: 'Assesses code quality, testing coverage, and maintainability',
            expertise: ['code-quality', 'testing', 'maintainability', 'technical-debt'],
            tools: ['issues-detector', 'duplication-detector', 'context-optimizer'],
            contextRequirements: ['code-patterns', 'test-coverage', 'complexity-metrics'],
            outputFormat: 'quality-analysis'
        };
    }
    createPerformanceRole() {
        return {
            id: 'performance',
            name: 'Performance Engineer',
            description: 'Identifies performance bottlenecks and optimization opportunities',
            expertise: ['performance-analysis', 'optimization', 'scalability', 'resource-usage'],
            tools: ['issues-detector', 'tree-navigator', 'context-optimizer'],
            contextRequirements: ['performance-metrics', 'resource-usage', 'bottlenecks'],
            outputFormat: 'performance-analysis'
        };
    }
    createCoordinatorRole() {
        return {
            id: 'coordinator',
            name: 'Analysis Coordinator',
            description: 'Synthesizes insights from all specialists into final recommendations',
            expertise: ['synthesis', 'prioritization', 'recommendations', 'action-planning'],
            tools: ['context-optimizer', 'knowledge-graph'],
            contextRequirements: ['all-analyses', 'priorities', 'constraints'],
            outputFormat: 'coordinated-recommendations'
        };
    }
    /**
     * Build sequential edges between roles
     */
    buildSequentialEdges(roles) {
        const edges = [];
        for (let i = 0; i < roles.length - 1; i++) {
            const fromRole = roles[i];
            const toRole = roles[i + 1];
            edges.push({
                from: fromRole.id,
                to: toRole.id,
                contextMapping: {
                    pass: ['originalQuery', 'projectPath', 'toolResults'],
                    transform: [`${fromRole.id}Analysis`],
                    focus: toRole.contextRequirements
                }
            });
        }
        return edges;
    }
    /**
     * Get orchestration status
     */
    async getOrchestrationStatus(orchestrationId) {
        return this.activeOrchestrations.get(orchestrationId) || null;
    }
    /**
     * Get all active orchestrations
     */
    async getActiveOrchestrations() {
        return Array.from(this.activeOrchestrations.values());
    }
    /**
     * Stop an orchestration
     */
    async stopOrchestration(orchestrationId) {
        const result = this.activeOrchestrations.get(orchestrationId);
        if (!result) {
            throw new Error(`Orchestration ${orchestrationId} not found`);
        }
        result.status = 'failed';
        result.endTime = Date.now();
        result.error = 'Stopped by user';
        await this.redis.cleanupWorkflow(orchestrationId);
        this.activeOrchestrations.delete(orchestrationId);
        return {
            terminatedRoles: result.workflowGraph.roles.map(r => r.id)
        };
    }
    // Helper methods
    generateWorkflowName(complexity) {
        if (complexity.scope === 'comprehensive')
            return 'Comprehensive Analysis Workflow';
        if (complexity.domains.length > 2)
            return 'Multi-Domain Analysis Workflow';
        return 'Focused Analysis Workflow';
    }
    estimateWorkflowDuration(graph) {
        return graph.roles.length * 120000; // 2 minutes per role
    }
    estimateWorkflowTokens(graph) {
        return graph.roles.length * 4000; // 4000 tokens per role
    }
    async storeOrchestration(result, request) {
        // Store orchestration in database for persistence and monitoring
        this.logger.info(`💾 Storing orchestration ${result.orchestrationId}`);
    }
    async updateOrchestrationResult(result) {
        // Update orchestration result in database
        this.logger.info(`📊 Updating orchestration ${result.orchestrationId} status: ${result.status}`);
    }
}
exports.SequentialWorkflowOrchestrator = SequentialWorkflowOrchestrator;
exports.default = SequentialWorkflowOrchestrator;
//# sourceMappingURL=sequential-workflow-orchestrator.js.map
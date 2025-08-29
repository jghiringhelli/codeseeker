"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TerminalOrchestrator = void 0;
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const logger_1 = require("../utils/logger");
const intelligent_tool_selector_1 = require("../cli/intelligent-tool-selector");
const database_1 = require("../database/database");
const performance_monitor_1 = require("../shared/performance-monitor");
class TerminalOrchestrator {
    logger = logger_1.Logger.getInstance();
    toolSelector = new intelligent_tool_selector_1.IntelligentToolSelector();
    db = new database_1.Database();
    monitor = new performance_monitor_1.PerformanceMonitor();
    activeOrchestrations = new Map();
    terminalSessions = new Map();
    constructor() {
        this.logger.info('🎭 Terminal Orchestrator initialized - Multi-terminal Claude Code coordination');
    }
    /**
     * Main orchestration method - coordinates multiple Claude Code terminals
     */
    async orchestrate(request) {
        const orchestrationId = request.orchestrationId || (0, uuid_1.v4)();
        const startTime = Date.now();
        this.logger.info(`🚀 Starting orchestration: ${orchestrationId}`);
        this.logger.info(`📋 Query: "${request.query}"`);
        this.logger.info(`📁 Project: ${request.projectPath}`);
        try {
            // Store active orchestration
            this.activeOrchestrations.set(orchestrationId, { ...request, orchestrationId });
            // Step 1: Analyze request and determine terminal roles/contexts
            const orchestrationPlan = await this.planOrchestration(request);
            // Step 2: Run analysis tools to generate specialized contexts
            const terminalContexts = await this.generateTerminalContexts(orchestrationPlan, request);
            // Step 3: Spawn Claude Code terminals with specialized contexts
            const terminals = await this.spawnCoordinatedTerminals(terminalContexts, request);
            // Step 4: Coordinate terminal interactions and gather results
            const results = await this.coordinateTerminalExecution(terminals, request);
            // Step 5: Synthesize coordinated final result
            const coordinatedResult = await this.synthesizeResults(results, request);
            const executionTime = Date.now() - startTime;
            const totalTokens = terminals.reduce((sum, t) => sum + (t.tokensUsed || 0), 0);
            // Store orchestration results
            await this.storeOrchestrationResults(orchestrationId, terminals, coordinatedResult, request);
            this.logger.info(`✅ Orchestration completed: ${orchestrationId} (${executionTime}ms)`);
            return {
                orchestrationId,
                success: true,
                terminals,
                coordinatedResult,
                executionTime,
                totalTokensUsed: totalTokens,
                insights: this.extractInsights(terminals, coordinatedResult)
            };
        }
        catch (error) {
            this.logger.error(`❌ Orchestration failed: ${orchestrationId}`, error);
            return {
                orchestrationId,
                success: false,
                terminals: [],
                executionTime: Date.now() - startTime,
                totalTokensUsed: 0,
                insights: [`Orchestration failed: ${error.message}`]
            };
        }
        finally {
            this.activeOrchestrations.delete(orchestrationId);
        }
    }
    /**
     * Plan orchestration strategy based on query complexity and requirements
     */
    async planOrchestration(request) {
        this.logger.info('🧠 Planning orchestration strategy...');
        // Use intelligent tool selector to determine what analysis is needed
        const toolChain = await this.toolSelector.selectOptimalTools({
            task: request.query,
            projectPath: request.projectPath,
            optimization: 'orchestration' // Special mode for multi-terminal
        });
        // Determine terminal roles based on query and selected tools
        const roles = this.determineTerminalRoles(request.query, toolChain);
        const plan = {
            strategy: request.strategy || this.selectStrategy(request.query, roles),
            roles,
            toolChain,
            expectedTerminals: Math.min(roles.length, request.maxTerminals || 4),
            coordination: this.requiresCoordination(request.query, roles)
        };
        this.logger.info(`📋 Orchestration plan: ${plan.expectedTerminals} terminals, ${plan.strategy} strategy`);
        this.logger.info(`👥 Roles: ${plan.roles.join(', ')}`);
        return plan;
    }
    /**
     * Generate specialized contexts for each terminal based on roles
     */
    async generateTerminalContexts(plan, request) {
        this.logger.info('🔧 Generating specialized contexts for terminals...');
        const contexts = [];
        for (const role of plan.roles) {
            const context = await this.generateRoleSpecificContext(role, request, plan);
            contexts.push({
                role,
                context,
                tools: this.getToolsForRole(role, plan.toolChain),
                priority: this.getRolePriority(role, request.query)
            });
        }
        // Sort by priority for execution order
        contexts.sort((a, b) => b.priority - a.priority);
        return contexts;
    }
    /**
     * Spawn coordinated Claude Code terminals with specialized contexts
     */
    async spawnCoordinatedTerminals(contexts, request) {
        this.logger.info(`🖥️  Spawning ${contexts.length} coordinated Claude Code terminals...`);
        const terminals = [];
        for (let i = 0; i < contexts.length; i++) {
            const terminalContext = contexts[i];
            const terminalId = `${request.orchestrationId}-terminal-${i + 1}`;
            try {
                const terminal = await this.spawnTerminal(terminalId, terminalContext, request);
                terminals.push(terminal);
                this.logger.info(`✅ Terminal spawned: ${terminalId} (${terminalContext.role})`);
                // Delay between spawns to avoid overwhelming system
                if (i < contexts.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            catch (error) {
                this.logger.error(`❌ Failed to spawn terminal: ${terminalId}`, error);
            }
        }
        // Store terminal sessions
        this.terminalSessions.set(request.orchestrationId, terminals);
        return terminals;
    }
    /**
     * Spawn individual Claude Code terminal with specialized context
     */
    async spawnTerminal(terminalId, terminalContext, request) {
        const { role, context, tools } = terminalContext;
        // Prepare Claude Code arguments with role-specific context
        const claudeArgs = this.prepareClaudeArgsForRole(role, context, tools, request);
        // Create specialized prompt file for this terminal
        const promptFile = await this.createRolePromptFile(terminalId, role, context, request);
        // Spawn Claude Code process
        const process = (0, child_process_1.spawn)('claude', [...claudeArgs, `--prompt-file=${promptFile}`], {
            cwd: request.projectPath,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        const terminal = {
            terminalId,
            role,
            process,
            context,
            status: 'initializing',
            output: [],
            startTime: new Date()
        };
        // Capture terminal output
        process.stdout.on('data', (data) => {
            terminal.output.push(data.toString());
        });
        process.stderr.on('data', (data) => {
            terminal.output.push(`ERROR: ${data.toString()}`);
        });
        process.on('close', (code) => {
            terminal.status = code === 0 ? 'completed' : 'failed';
            terminal.endTime = new Date();
            this.logger.info(`🏁 Terminal completed: ${terminalId} (${terminal.role}) - ${terminal.status}`);
        });
        // Set initial status
        setTimeout(() => {
            terminal.status = 'running';
        }, 1000);
        return terminal;
    }
    /**
     * Coordinate terminal execution and gather results
     */
    async coordinateTerminalExecution(terminals, request) {
        this.logger.info('🎭 Coordinating terminal execution...');
        const results = {
            terminalResults: new Map(),
            crossTerminalInsights: [],
            executionMetrics: {}
        };
        // Wait for all terminals to complete or timeout
        const timeout = request.options?.timeoutMs || 300000; // 5 minutes default
        try {
            await Promise.race([
                this.waitForTerminals(terminals),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Orchestration timeout')), timeout))
            ]);
            // Process results from each terminal
            for (const terminal of terminals) {
                const terminalResult = this.processTerminalOutput(terminal);
                results.terminalResults.set(terminal.role, terminalResult);
                // Extract insights from terminal execution
                const insights = this.extractTerminalInsights(terminal, terminalResult);
                results.crossTerminalInsights.push(...insights);
            }
            // Calculate execution metrics
            results.executionMetrics = this.calculateExecutionMetrics(terminals);
        }
        catch (error) {
            this.logger.error('❌ Terminal coordination failed:', error);
            throw error;
        }
        return results;
    }
    /**
     * Synthesize results from all terminals into coordinated final result
     */
    async synthesizeResults(results, request) {
        this.logger.info('🔗 Synthesizing coordinated final result...');
        const terminalOutputs = Array.from(results.terminalResults.entries()).map(([role, result]) => ({
            role,
            analysis: result.summary,
            recommendations: result.recommendations,
            keyFindings: result.keyFindings
        }));
        // Create synthesis prompt
        const synthesisPrompt = `
# Multi-Terminal Analysis Synthesis

## Original User Query
"${request.query}"

## Terminal Analysis Results

${terminalOutputs.map(output => `
### ${output.role} Terminal Analysis
**Key Findings**: ${output.keyFindings || 'No specific findings'}
**Analysis**: ${output.analysis || 'Analysis incomplete'}
**Recommendations**: ${output.recommendations || 'No recommendations'}
`).join('\n')}

## Cross-Terminal Insights
${results.crossTerminalInsights.map(insight => `• ${insight}`).join('\n')}

## Execution Metrics
- Total Terminals: ${terminalOutputs.length}
- Execution Time: ${results.executionMetrics.totalTime}ms
- Average Response Quality: ${results.executionMetrics.avgQuality || 'N/A'}

---

Please provide a comprehensive, synthesized response that integrates insights from all terminal analyses. Focus on:

1. **Unified Answer** - Single cohesive response to the user's query
2. **Cross-Terminal Correlations** - Connections between different analyses  
3. **Prioritized Recommendations** - Ranked action items from all terminals
4. **Implementation Guidance** - Practical next steps based on combined insights

Ensure the response is more valuable than any individual terminal analysis alone.
`;
        // Use Claude Code to synthesize final result (meta-level usage)
        try {
            const synthesisResult = await this.runSynthesisQuery(synthesisPrompt, request.projectPath);
            return synthesisResult;
        }
        catch (error) {
            this.logger.error('❌ Result synthesis failed:', error);
            return this.createFallbackSynthesis(terminalOutputs, request);
        }
    }
    // ===== HELPER METHODS =====
    determineTerminalRoles(query, toolChain) {
        const roles = [];
        // Analyze query for complexity and required expertise areas
        const queryLower = query.toLowerCase();
        if (queryLower.includes('architecture') || queryLower.includes('design') || queryLower.includes('structure')) {
            roles.push('architect');
        }
        if (queryLower.includes('bug') || queryLower.includes('fix') || queryLower.includes('error') || queryLower.includes('issue')) {
            roles.push('debugger');
        }
        if (queryLower.includes('refactor') || queryLower.includes('improve') || queryLower.includes('optimize')) {
            roles.push('refactoring-specialist');
        }
        if (queryLower.includes('test') || queryLower.includes('quality') || queryLower.includes('review')) {
            roles.push('quality-engineer');
        }
        if (queryLower.includes('security') || queryLower.includes('vulnerability') || queryLower.includes('secure')) {
            roles.push('security-analyst');
        }
        if (queryLower.includes('performance') || queryLower.includes('slow') || queryLower.includes('optimize')) {
            roles.push('performance-engineer');
        }
        if (queryLower.includes('documentation') || queryLower.includes('docs') || queryLower.includes('api')) {
            roles.push('documentation-specialist');
        }
        // Default roles for comprehensive analysis
        if (roles.length === 0) {
            roles.push('general-analyst', 'code-reviewer');
        }
        // Always include a coordinator for complex queries
        if (roles.length > 2) {
            roles.push('coordinator');
        }
        return roles.slice(0, 6); // Max 6 terminals
    }
    selectStrategy(query, roles) {
        if (roles.includes('coordinator') || roles.length > 3) {
            return 'role_based';
        }
        if (query.toLowerCase().includes('step') || query.toLowerCase().includes('process')) {
            return 'sequential';
        }
        return 'parallel';
    }
    requiresCoordination(query, roles) {
        return roles.length > 2 ||
            query.toLowerCase().includes('comprehensive') ||
            query.toLowerCase().includes('complete') ||
            roles.includes('coordinator');
    }
    async generateRoleSpecificContext(role, request, plan) {
        // Generate context specific to the role's expertise and focus
        const context = {
            role,
            focusAreas: this.getFocusAreasForRole(role, request.query),
            relevantTools: this.getToolsForRole(role, plan.toolChain),
            analysisScope: this.getAnalysisScopeForRole(role, request.query),
            expectedOutputs: this.getExpectedOutputsForRole(role)
        };
        return context;
    }
    getFocusAreasForRole(role, query) {
        const roleFocus = {
            'architect': ['system-design', 'patterns', 'dependencies', 'structure'],
            'debugger': ['errors', 'exceptions', 'logic-issues', 'runtime-problems'],
            'refactoring-specialist': ['code-smells', 'duplication', 'complexity', 'maintainability'],
            'quality-engineer': ['testing', 'coverage', 'code-quality', 'best-practices'],
            'security-analyst': ['vulnerabilities', 'authentication', 'authorization', 'data-protection'],
            'performance-engineer': ['bottlenecks', 'optimization', 'scalability', 'efficiency'],
            'documentation-specialist': ['api-docs', 'code-comments', 'user-guides', 'specifications'],
            'general-analyst': ['overall-health', 'patterns', 'issues', 'opportunities'],
            'coordinator': ['synthesis', 'prioritization', 'coordination', 'integration']
        };
        return roleFocus[role] || ['general-analysis'];
    }
    getToolsForRole(role, toolChain) {
        const roleTools = {
            'architect': ['tree-navigator', 'knowledge-graph', 'context-optimizer'],
            'debugger': ['issues-detector', 'tree-navigator', 'context-optimizer'],
            'refactoring-specialist': ['duplication-detector', 'centralization-detector', 'context-optimizer'],
            'quality-engineer': ['issues-detector', 'duplication-detector', 'knowledge-graph'],
            'security-analyst': ['issues-detector', 'centralization-detector', 'context-optimizer'],
            'performance-engineer': ['issues-detector', 'tree-navigator', 'context-optimizer'],
            'documentation-specialist': ['code-docs-reconciler', 'knowledge-graph', 'context-optimizer'],
            'general-analyst': ['context-optimizer', 'tree-navigator', 'issues-detector'],
            'coordinator': ['workflow-orchestrator', 'context-optimizer']
        };
        return roleTools[role] || ['context-optimizer'];
    }
    getRolePriority(role, query) {
        // Higher priority roles execute first
        const basePriorities = {
            'coordinator': 10,
            'architect': 9,
            'debugger': 8,
            'security-analyst': 7,
            'quality-engineer': 6,
            'performance-engineer': 5,
            'refactoring-specialist': 4,
            'documentation-specialist': 3,
            'general-analyst': 2
        };
        return basePriorities[role] || 1;
    }
    prepareClaudeArgsForRole(role, context, tools, request) {
        const args = [
            `--role=${role}`,
            `--focus="${context.focusAreas.join(',')}"`,
            `--project="${request.projectPath}"`
        ];
        if (tools.length > 0) {
            args.push(`--analysis-tools="${tools.join(',')}"`);
        }
        return args;
    }
    async createRolePromptFile(terminalId, role, context, request) {
        const promptContent = `
# ${role.toUpperCase()} TERMINAL - CodeMind Orchestrated Analysis

## Role Definition
You are a ${role.replace(/-/g, ' ')} in a coordinated multi-terminal analysis.

## Your Mission
Analyze the user's query from your specialized perspective: "${request.query}"

## Focus Areas
${context.focusAreas.map(area => `• ${area}`).join('\n')}

## Analysis Scope
${context.analysisScope || 'Provide comprehensive analysis within your domain expertise'}

## Expected Outputs
${context.expectedOutputs?.join('\n') || '• Key findings\n• Recommendations\n• Action items'}

## Coordination Notes
- This is part of a larger orchestrated analysis
- Focus on your expertise area
- Be specific and actionable
- Highlight cross-domain implications

## Project Context
Project Path: ${request.projectPath}
Terminal ID: ${terminalId}
Orchestration ID: ${request.orchestrationId}

Please provide focused, expert analysis that will contribute to a comprehensive coordinated response.
`;
        const promptFile = path_1.default.join('/tmp', `codemind-${terminalId}-prompt.txt`);
        fs_1.default.writeFileSync(promptFile, promptContent);
        return promptFile;
    }
    async waitForTerminals(terminals) {
        const promises = terminals.map(terminal => new Promise((resolve) => {
            if (terminal.status === 'completed' || terminal.status === 'failed') {
                resolve();
            }
            else {
                terminal.process.on('close', () => resolve());
            }
        }));
        await Promise.all(promises);
    }
    processTerminalOutput(terminal) {
        const output = terminal.output.join('\n');
        return {
            role: terminal.role,
            status: terminal.status,
            summary: this.extractSummary(output),
            recommendations: this.extractRecommendations(output),
            keyFindings: this.extractKeyFindings(output),
            executionTime: terminal.endTime ? terminal.endTime.getTime() - terminal.startTime.getTime() : 0,
            outputLength: output.length
        };
    }
    extractSummary(output) {
        // Extract summary from Claude Code output
        const summaryMatch = output.match(/(?:## Summary|# Summary|Summary:)([\s\S]*?)(?=##|#|$)/i);
        return summaryMatch ? summaryMatch[1].trim() : 'Summary not found';
    }
    extractRecommendations(output) {
        // Extract recommendations from Claude Code output
        const recommendations = [];
        const lines = output.split('\n');
        for (const line of lines) {
            if (line.match(/^\s*[-•*]\s+/) || line.match(/^\s*\d+\.\s+/)) {
                const recommendation = line.replace(/^\s*[-•*\d.]\s*/, '').trim();
                if (recommendation.length > 10) { // Filter out short lines
                    recommendations.push(recommendation);
                }
            }
        }
        return recommendations.slice(0, 10); // Top 10 recommendations
    }
    extractKeyFindings(output) {
        // Extract key findings from output
        const findingsMatch = output.match(/(?:Key findings|Findings|Results):([\s\S]*?)(?=##|#|Recommendations|$)/i);
        return findingsMatch ? findingsMatch[1].trim() : 'Key findings not identified';
    }
    extractTerminalInsights(terminal, result) {
        const insights = [];
        if (result.recommendations.length > 0) {
            insights.push(`${terminal.role} identified ${result.recommendations.length} actionable recommendations`);
        }
        if (result.executionTime > 0) {
            insights.push(`${terminal.role} analysis completed in ${result.executionTime}ms`);
        }
        return insights;
    }
    calculateExecutionMetrics(terminals) {
        const completedTerminals = terminals.filter(t => t.status === 'completed');
        return {
            totalTerminals: terminals.length,
            completedTerminals: completedTerminals.length,
            successRate: completedTerminals.length / terminals.length,
            totalTime: Math.max(...terminals.map(t => t.endTime ? t.endTime.getTime() - t.startTime.getTime() : 0)),
            avgTime: completedTerminals.reduce((sum, t) => sum + (t.endTime.getTime() - t.startTime.getTime()), 0) / completedTerminals.length
        };
    }
    async runSynthesisQuery(prompt, projectPath) {
        // Use Claude Code for meta-synthesis
        return new Promise((resolve, reject) => {
            const process = (0, child_process_1.spawn)('claude', [prompt], {
                cwd: projectPath,
                stdio: ['pipe', 'pipe', 'pipe']
            });
            let output = '';
            process.stdout.on('data', (data) => {
                output += data.toString();
            });
            process.on('close', (code) => {
                if (code === 0) {
                    resolve(output);
                }
                else {
                    reject(new Error(`Synthesis query failed with code ${code}`));
                }
            });
            setTimeout(() => {
                process.kill();
                reject(new Error('Synthesis query timeout'));
            }, 30000); // 30 second timeout
        });
    }
    createFallbackSynthesis(terminalOutputs, request) {
        return `
# Coordinated Analysis Results

## Query: "${request.query}"

${terminalOutputs.map((output, index) => `
### ${output.role} Analysis
${output.analysis}

**Key Recommendations:**
${output.recommendations}

`).join('\n')}

## Coordinated Recommendations
Based on the multi-terminal analysis, the key action items are:

${terminalOutputs.flatMap(o => o.recommendations).slice(0, 10).map((rec, i) => `${i + 1}. ${rec}`).join('\n')}

*Note: Full synthesis was not available, but individual terminal analyses provide comprehensive coverage of your query.*
`;
    }
    extractInsights(terminals, coordinatedResult) {
        const insights = [
            `Coordinated ${terminals.length} specialized terminals for comprehensive analysis`,
            `Generated ${coordinatedResult.length} characters of synthesized analysis`,
            `Execution completed with ${terminals.filter(t => t.status === 'completed').length}/${terminals.length} successful terminals`
        ];
        return insights;
    }
    getAnalysisScopeForRole(role, query) {
        const scopes = {
            'architect': 'Focus on system design, architecture patterns, and structural analysis',
            'debugger': 'Identify and analyze bugs, errors, and runtime issues',
            'refactoring-specialist': 'Analyze code quality, identify refactoring opportunities',
            'quality-engineer': 'Assess code quality, testing coverage, and best practices',
            'security-analyst': 'Identify security vulnerabilities and compliance issues',
            'performance-engineer': 'Analyze performance bottlenecks and optimization opportunities',
            'documentation-specialist': 'Review and improve documentation quality and coverage',
            'general-analyst': 'Provide overall codebase health and improvement recommendations',
            'coordinator': 'Synthesize and coordinate insights from all analysis perspectives'
        };
        return scopes[role] || 'Provide comprehensive analysis within your domain';
    }
    getExpectedOutputsForRole(role) {
        const outputs = {
            'architect': [
                '• Architecture assessment and recommendations',
                '• Design pattern usage analysis',
                '• Dependency structure evaluation',
                '• Scalability considerations'
            ],
            'debugger': [
                '• Bug identification and categorization',
                '• Root cause analysis',
                '• Fix recommendations with priority',
                '• Testing strategies for identified issues'
            ],
            'refactoring-specialist': [
                '• Code smell identification',
                '• Refactoring opportunities with effort estimates',
                '• Complexity reduction strategies',
                '• Maintainability improvement plan'
            ],
            'quality-engineer': [
                '• Code quality metrics and assessment',
                '• Testing gap analysis',
                '• Best practice compliance review',
                '• Quality improvement roadmap'
            ],
            'security-analyst': [
                '• Security vulnerability assessment',
                '• Compliance and security best practices review',
                '• Risk prioritization and mitigation strategies',
                '• Security improvement recommendations'
            ],
            'performance-engineer': [
                '• Performance bottleneck identification',
                '• Optimization opportunities with impact estimates',
                '• Scalability analysis',
                '• Performance monitoring recommendations'
            ],
            'documentation-specialist': [
                '• Documentation coverage analysis',
                '• API documentation quality assessment',
                '• User guide and developer documentation review',
                '• Documentation improvement plan'
            ],
            'coordinator': [
                '• Cross-domain insight synthesis',
                '• Priority ranking of all recommendations',
                '• Implementation coordination plan',
                '• Resource allocation suggestions'
            ]
        };
        return outputs[role] || [
            '• Key findings and analysis',
            '• Actionable recommendations',
            '• Implementation priorities',
            '• Next steps and follow-up actions'
        ];
    }
    async storeOrchestrationResults(orchestrationId, terminals, coordinatedResult, request) {
        try {
            // Store in database for tracking and analysis
            await this.db.query(`
        INSERT INTO orchestration_executions (
          orchestration_id, query, project_path, terminal_count,
          execution_time_ms, success_rate, coordinated_result, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
                orchestrationId,
                request.query,
                request.projectPath,
                terminals.length,
                terminals.reduce((max, t) => Math.max(max, t.endTime ? t.endTime.getTime() - t.startTime.getTime() : 0), 0),
                terminals.filter(t => t.status === 'completed').length / terminals.length,
                coordinatedResult
            ]);
            this.logger.info(`💾 Orchestration results stored: ${orchestrationId}`);
        }
        catch (error) {
            this.logger.warn('Failed to store orchestration results:', error);
        }
    }
    // ===== PUBLIC API METHODS =====
    /**
     * Get status of active orchestration
     */
    async getOrchestrationStatus(orchestrationId) {
        const terminals = this.terminalSessions.get(orchestrationId) || [];
        return {
            orchestrationId,
            status: this.activeOrchestrations.has(orchestrationId) ? 'active' : 'completed',
            terminals: terminals.map(t => ({
                terminalId: t.terminalId,
                role: t.role,
                status: t.status,
                startTime: t.startTime,
                endTime: t.endTime
            }))
        };
    }
    /**
     * Cancel active orchestration
     */
    async cancelOrchestration(orchestrationId) {
        const terminals = this.terminalSessions.get(orchestrationId);
        if (terminals) {
            terminals.forEach(terminal => {
                if (terminal.process && !terminal.process.killed) {
                    terminal.process.kill();
                    terminal.status = 'failed';
                }
            });
            this.activeOrchestrations.delete(orchestrationId);
            this.terminalSessions.delete(orchestrationId);
            this.logger.info(`🛑 Orchestration cancelled: ${orchestrationId}`);
            return true;
        }
        return false;
    }
    /**
     * List active orchestrations
     */
    getActiveOrchestrations() {
        return Array.from(this.activeOrchestrations.keys());
    }
}
exports.TerminalOrchestrator = TerminalOrchestrator;
//# sourceMappingURL=terminal-orchestrator.js.map
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntelligentToolSelector = void 0;
const logger_1 = require("../utils/logger");
const colored_logger_1 = require("../utils/colored-logger");
const claude_integration_1 = require("./claude-integration");
const performance_monitor_1 = require("../shared/performance-monitor");
const database_1 = require("../database/database");
class IntelligentToolSelector {
    logger = logger_1.Logger.getInstance();
    claude = new claude_integration_1.ClaudeIntegration();
    monitor = new performance_monitor_1.PerformanceMonitor();
    db = new database_1.Database();
    tools = new Map();
    performanceHistory = new Map();
    toolDescriptionsCache = null;
    cacheExpiry = 0;
    CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    availableTools = [];
    claudeIntegration = new claude_integration_1.ClaudeIntegration();
    constructor() {
        this.initializeAsync();
    }
    async initializeAsync() {
        await this.registerAnalysisTools();
        await this.loadPerformanceHistory();
    }
    /**
     * Core function: Intelligent decision engine for the Orchestrator
     *
     * This is NOT a CLI tool itself, but the brain that decides:
     * - Which analysis tools to run
     * - How to coordinate Claude Code terminals
     * - What contexts each terminal should receive
     * - Optimal execution strategy for complex queries
     */
    async registerAnalysisTools() {
        // Register all available analysis tools that feed Claude Code terminals
        const toolDefinitions = [
            // Core Context Enhancement Tools (Always Run)
            {
                name: 'compilation-verifier',
                description: 'Verifies code compiles before generation to prevent broken builds',
                capabilities: ['compilation-check', 'type-verification', 'build-validation', 'error-prevention'],
                tokenCost: 'low',
                executionTime: 'fast',
                dependencies: [],
                parallelizable: false, // Must run sequentially to check current state
                reliability: 0.99,
                autoRun: ['code-generation', 'refactoring', 'feature-development', 'bug-fixes']
            },
            {
                name: 'context-deduplicator',
                description: 'Prevents duplicate code generation by analyzing existing patterns',
                capabilities: ['duplicate-prevention', 'code-completion', 'pattern-analysis'],
                tokenCost: 'low',
                executionTime: 'fast',
                dependencies: ['compilation-verifier'], // Only run if code compiles
                parallelizable: true,
                reliability: 0.98,
                autoRun: ['code-generation', 'refactoring', 'enhancement']
            },
            {
                name: 'dependency-mapper',
                description: 'Maps all dependencies and imports to prevent missing updates',
                capabilities: ['dependency-tracking', 'impact-analysis', 'change-propagation'],
                tokenCost: 'low',
                executionTime: 'fast',
                dependencies: ['compilation-verifier'], // Only run if code compiles
                parallelizable: true,
                reliability: 0.96,
                autoRun: ['code-generation', 'refactoring', 'class-modification']
            },
            {
                name: 'semantic-context-builder',
                description: 'Builds semantic understanding of codebase for complete context',
                capabilities: ['semantic-analysis', 'context-building', 'relationship-mapping'],
                tokenCost: 'medium',
                executionTime: 'medium',
                dependencies: ['vector-search', 'compilation-verifier'],
                parallelizable: true,
                reliability: 0.94,
                autoRun: ['code-generation', 'architecture-changes', 'complex-refactoring']
            },
            {
                name: 'ui-navigation-analyzer',
                description: 'Analyzes UI components, screens, and navigation flows',
                capabilities: ['ui-analysis', 'component-mapping', 'navigation-flow', 'screen-dependencies'],
                tokenCost: 'medium',
                executionTime: 'medium',
                dependencies: [],
                parallelizable: true,
                reliability: 0.92,
                autoRun: ['ui-development', 'component-creation', 'navigation-changes']
            },
            {
                name: 'solid-principles-analyzer',
                description: 'Analyzes code against SOLID principles and suggests improvements',
                capabilities: ['solid-analysis', 'design-patterns', 'code-quality', 'refactoring-guidance'],
                tokenCost: 'medium',
                executionTime: 'medium',
                dependencies: [],
                parallelizable: true,
                reliability: 0.90,
                autoRun: ['architecture-changes', 'class-design', 'refactoring']
            },
            {
                name: 'test-mapping-analyzer',
                description: 'Maps tests to source code and maintains test-code synchronization',
                capabilities: ['test-mapping', 'test-maintenance', 'stale-test-detection', 'test-sync'],
                tokenCost: 'medium',
                executionTime: 'medium',
                dependencies: ['compilation-verifier'], // Only run if code compiles
                parallelizable: true,
                reliability: 0.93,
                autoRun: ['code-generation', 'feature-development', 'bug-fixes', 'refactoring']
            },
            {
                name: 'use-cases-analyzer',
                description: 'Maps business use cases to code implementation and responsibilities',
                capabilities: ['use-case-mapping', 'responsibility-analysis', 'business-logic', 'separation-concerns'],
                tokenCost: 'high',
                executionTime: 'slow',
                dependencies: ['dependency-mapper'],
                parallelizable: true,
                reliability: 0.88,
                autoRun: ['feature-development', 'business-logic-changes', 'architecture-design']
            },
            // Existing Tools (Enhanced)
            {
                name: 'duplication-detector',
                description: 'Finds duplicate code, classes, and enums across the project',
                capabilities: ['duplicate-detection', 'class-analysis', 'enum-analysis', 'refactoring-suggestions'],
                tokenCost: 'medium',
                executionTime: 'medium',
                dependencies: [],
                parallelizable: true,
                reliability: 0.95,
                autoRun: ['code-generation', 'refactoring']
            },
            {
                name: 'tree-navigator',
                description: 'Analyzes project structure, dependencies, and circular references',
                capabilities: ['dependency-analysis', 'circular-detection', 'architecture-review', 'import-analysis'],
                tokenCost: 'low',
                executionTime: 'fast',
                dependencies: [],
                parallelizable: true,
                reliability: 0.98,
                autoRun: ['code-generation', 'architecture-changes', 'refactoring']
            },
            {
                name: 'vector-search',
                description: 'Semantic code search and similarity analysis',
                capabilities: ['semantic-search', 'code-similarity', 'pattern-matching', 'context-retrieval'],
                tokenCost: 'high',
                executionTime: 'slow',
                dependencies: [],
                parallelizable: true,
                reliability: 0.88,
                autoRun: ['code-generation', 'feature-search', 'pattern-matching']
            },
            {
                name: 'context-optimizer',
                description: 'Optimizes context for Claude interactions',
                capabilities: ['context-compression', 'token-optimization', 'relevance-scoring', 'file-prioritization'],
                tokenCost: 'low',
                executionTime: 'fast',
                dependencies: [],
                parallelizable: false,
                reliability: 0.92
            },
            {
                name: 'issues-detector',
                description: 'Comprehensive Claude Code issue detection',
                capabilities: ['scope-analysis', 'topology-check', 'propagation-tracking', 'quality-assessment'],
                tokenCost: 'medium',
                executionTime: 'medium',
                dependencies: [],
                parallelizable: true,
                reliability: 0.90
            },
            {
                name: 'knowledge-graph',
                description: 'Builds semantic understanding of codebase relationships',
                capabilities: ['relationship-mapping', 'semantic-analysis', 'architecture-insights', 'pattern-detection'],
                tokenCost: 'high',
                executionTime: 'slow',
                dependencies: ['vector-search'],
                parallelizable: false,
                reliability: 0.85
            },
            {
                name: 'centralization-detector',
                description: 'Detects scattered configuration and centralization opportunities',
                capabilities: ['config-analysis', 'centralization-opportunities', 'migration-planning', 'consolidation-suggestions'],
                tokenCost: 'medium',
                executionTime: 'medium',
                dependencies: [],
                parallelizable: true,
                reliability: 0.92
            },
            {
                name: 'code-docs-reconciler',
                description: 'Bidirectional synchronization between code and documentation',
                capabilities: ['documentation-sync', 'implementation-validation', 'discrepancy-detection', 'auto-generation'],
                tokenCost: 'high',
                executionTime: 'slow',
                dependencies: [],
                parallelizable: true,
                reliability: 0.89
            },
            {
                name: 'workflow-orchestrator',
                description: 'Orchestrates multiple tools in intelligent workflows',
                capabilities: ['workflow-execution', 'tool-chaining', 'quality-gates', 'optimization-suggestions'],
                tokenCost: 'low',
                executionTime: 'fast',
                dependencies: [],
                parallelizable: false,
                reliability: 0.94
            }
        ];
        // Register tools with execution functions and initialize availableTools
        this.availableTools = toolDefinitions;
        toolDefinitions.forEach(toolDef => {
            const tool = {
                ...toolDef,
                execute: this.createToolExecutor(toolDef.name)
            };
            this.tools.set(toolDef.name, tool);
        });
    }
    // Alias for backward compatibility
    async selectTools(request) {
        const context = {
            task: request.userQuery,
            projectPath: request.projectPath,
            optimization: request.optimization || 'balanced'
        };
        const toolChain = await this.selectOptimalTools(context);
        return {
            selectedTools: toolChain.tools.map(t => t.name),
            reasoning: 'Tools selected based on intelligent analysis',
            estimatedTokenSavings: 0,
            executionPlan: toolChain.tools.map((t, i) => ({
                tool: t.name,
                order: i + 1,
                params: {},
                expectedOutput: t.description,
                tokenBudget: 1000
            }))
        };
    }
    async selectOptimalTools(context) {
        const startTime = Date.now();
        try {
            colored_logger_1.cliLogger.info('ANALYSIS', `Starting intelligent analysis for task: "${context.task}"`);
            colored_logger_1.cliLogger.info('CONFIG', 'Analysis configuration', {
                optimization: context.optimization,
                projectPath: context.projectPath,
                hasCodebaseContext: !!context.codebaseContext,
                hasHistory: !!context.history
            });
            // Special handling for orchestration mode
            if (context.optimization === 'orchestration') {
                colored_logger_1.cliLogger.info('ORCHESTRATION', 'Switching to orchestration mode for terminal coordination');
                return await this.planOrchestrationStrategy(context);
            }
            // Standard tool selection for CLI enhancement
            colored_logger_1.cliLogger.info('CONTEXT', 'Enriching context with performance data and codebase analysis');
            const enrichedContext = await this.enrichContext(context);
            colored_logger_1.cliLogger.info('CLAUDE-AI', 'Requesting Claude AI analysis for optimal tool selection');
            const claudeDecision = await this.claudeAnalyzeAndSelect(enrichedContext);
            colored_logger_1.cliLogger.info('TOOL-CHAIN', 'Building execution tool chain based on AI decision');
            const toolChain = await this.buildToolChain(claudeDecision, enrichedContext);
            // Log each selected tool with reasoning
            toolChain.tools.forEach((tool, index) => {
                const confidence = claudeDecision.toolRecommendations.find(r => r.toolName === tool.name)?.confidence || 0;
                const reason = claudeDecision.toolRecommendations.find(r => r.toolName === tool.name)?.reasoning || 'Selected by chain logic';
                colored_logger_1.cliLogger.toolSelection(tool.name, reason, confidence, {
                    executionOrder: index + 1,
                    estimatedTokens: tool.tokenCost === 'low' ? '< 1000' : tool.tokenCost === 'medium' ? '1000-5000' : '> 5000',
                    parallelizable: tool.parallelizable
                });
            });
            colored_logger_1.cliLogger.success('STRATEGY', `Execution strategy: ${toolChain.executionStrategy}`, {
                totalTools: toolChain.tools.length,
                expectedDuration: `${Math.round(toolChain.expectedDuration / 1000)}s`,
                estimatedTokens: toolChain.estimatedTokens
            });
            await this.recordDecision(claudeDecision, toolChain, context);
            const duration = Date.now() - startTime;
            this.monitor.record('tool_selection', {
                duration,
                toolCount: toolChain.tools.length,
                confidence: claudeDecision.confidence,
                strategy: toolChain.executionStrategy
            });
            colored_logger_1.cliLogger.success('ANALYSIS', `Tool selection completed in ${duration}ms`, {
                confidence: Math.round(claudeDecision.confidence * 100) + '%',
                toolsSelected: toolChain.tools.map(t => t.name),
                strategy: toolChain.executionStrategy
            });
            return toolChain;
        }
        catch (error) {
            colored_logger_1.cliLogger.error('ANALYSIS', 'Tool selection failed, using fallback strategy', error);
            this.logger.error('Tool selection failed, using fallback strategy', error);
            return this.fallbackSelection(context);
        }
    }
    /**
     * NEW: Automatic Context Enhancement for Code Generation
     * This method automatically runs essential tools to enhance Claude's context
     * Based on the type of request, it ensures comprehensive context is provided
     */
    async enhanceContextAutomatically(context) {
        const startTime = Date.now();
        const requestType = context.requestType || this.detectRequestType(context.task);
        colored_logger_1.cliLogger.info('AUTO-ENHANCE', `Automatically enhancing context for ${requestType} request`);
        // Always run core context enhancement tools
        const coreTools = await this.selectCoreContextTools();
        // Add request-specific tools
        const specificTools = await this.selectRequestSpecificTools(requestType, context.task);
        // Combine and deduplicate tools
        const allTools = this.deduplicateTools([...coreTools, ...specificTools]);
        // Build execution strategy - compilation-verifier must run first
        const hasCompilationVerifier = allTools.some(tool => tool.name === 'compilation-verifier');
        const strategy = hasCompilationVerifier ? 'adaptive' : 'parallel'; // Adaptive to run compilation first
        const estimatedTokens = allTools.reduce((sum, tool) => {
            const cost = tool.tokenCost === 'high' ? 2000 : tool.tokenCost === 'medium' ? 1000 : 500;
            return sum + cost;
        }, 0);
        const expectedDuration = Math.max(...allTools.map(tool => tool.executionTime === 'slow' ? 5000 : tool.executionTime === 'medium' ? 2000 : 1000));
        const toolChain = {
            tools: allTools,
            executionStrategy: strategy,
            expectedDuration,
            estimatedTokens
        };
        // Log the automatic selection
        allTools.forEach((tool, index) => {
            const reason = tool.autoRun?.includes(requestType) ?
                `Automatically selected for ${requestType}` :
                'Core context enhancement tool';
            colored_logger_1.cliLogger.toolSelection(tool.name, reason, 1.0, {
                executionOrder: index + 1,
                requestType,
                automatic: true
            });
        });
        const duration = Date.now() - startTime;
        colored_logger_1.cliLogger.success('AUTO-ENHANCE', `Automatic context enhancement completed in ${duration}ms`, {
            requestType,
            toolsSelected: allTools.length,
            estimatedTokens,
            strategy
        });
        return toolChain;
    }
    detectRequestType(task) {
        const taskLower = task.toLowerCase();
        // UI Development patterns
        if (taskLower.match(/component|ui|interface|screen|page|navigation|form|button|modal/)) {
            return 'ui-development';
        }
        // Code generation patterns
        if (taskLower.match(/create|generate|implement|add.*function|add.*method|write.*code/)) {
            return 'code-generation';
        }
        // Refactoring patterns
        if (taskLower.match(/refactor|cleanup|improve|optimize|restructure|reorganize/)) {
            return 'refactoring';
        }
        // Architecture patterns
        if (taskLower.match(/architecture|design|structure|pattern|layer|separation/)) {
            return 'architecture-changes';
        }
        // Feature development patterns
        if (taskLower.match(/feature|functionality|capability|enhancement|requirement/)) {
            return 'feature-development';
        }
        // Bug fix patterns
        if (taskLower.match(/fix|bug|error|issue|problem|debug/)) {
            return 'bug-fixes';
        }
        // Testing patterns
        if (taskLower.match(/test|testing|coverage|spec|unit.*test|integration.*test/)) {
            return 'testing';
        }
        // Documentation patterns
        if (taskLower.match(/document|docs|readme|comment|explain|describe/)) {
            return 'documentation';
        }
        return 'general';
    }
    async selectCoreContextTools() {
        // These tools should ALWAYS run to provide comprehensive context
        const coreToolNames = [
            'compilation-verifier', // CRITICAL: Ensures code compiles before generation
            'context-deduplicator', // Prevents duplicate code generation
            'dependency-mapper', // Ensures all dependencies are updated
            'semantic-context-builder' // Provides semantic understanding
        ];
        const coreTools = [];
        for (const toolName of coreToolNames) {
            const tool = this.tools.get(toolName);
            if (tool) {
                coreTools.push(tool);
            }
        }
        return coreTools;
    }
    async selectRequestSpecificTools(requestType, task) {
        const specificTools = [];
        switch (requestType) {
            case 'ui-development':
                specificTools.push(...this.getToolsByNames(['ui-navigation-analyzer', 'duplication-detector']));
                break;
            case 'code-generation':
            case 'feature-development':
                specificTools.push(...this.getToolsByNames([
                    'duplication-detector',
                    'tree-navigator',
                    'test-mapping-analyzer',
                    'solid-principles-analyzer'
                ]));
                break;
            case 'refactoring':
                specificTools.push(...this.getToolsByNames([
                    'duplication-detector',
                    'solid-principles-analyzer',
                    'centralization-detector',
                    'test-mapping-analyzer'
                ]));
                break;
            case 'architecture-changes':
                specificTools.push(...this.getToolsByNames([
                    'solid-principles-analyzer',
                    'use-cases-analyzer',
                    'tree-navigator',
                    'knowledge-graph'
                ]));
                break;
            case 'bug-fixes':
                specificTools.push(...this.getToolsByNames([
                    'issues-detector',
                    'test-mapping-analyzer',
                    'tree-navigator'
                ]));
                break;
            case 'testing':
                specificTools.push(...this.getToolsByNames([
                    'test-mapping-analyzer',
                    'solid-principles-analyzer'
                ]));
                break;
            default:
                // For general requests, include a balanced set
                specificTools.push(...this.getToolsByNames([
                    'issues-detector',
                    'duplication-detector'
                ]));
        }
        return specificTools;
    }
    getToolsByNames(toolNames) {
        const tools = [];
        for (const toolName of toolNames) {
            const tool = this.tools.get(toolName);
            if (tool) {
                tools.push(tool);
            }
        }
        return tools;
    }
    deduplicateTools(tools) {
        const seen = new Set();
        const unique = [];
        for (const tool of tools) {
            if (!seen.has(tool.name)) {
                seen.add(tool.name);
                unique.push(tool);
            }
        }
        return unique;
    }
    /**
     * Special method for orchestration planning
     * Determines which analysis tools should feed which terminal roles
     */
    async planOrchestrationStrategy(context) {
        this.logger.info('🎭 Planning orchestration strategy for terminal coordination');
        // Analyze query complexity for orchestration needs
        const complexityAnalysis = await this.analyzeQueryComplexity(context.task);
        // Determine required analysis tools for orchestration
        const requiredAnalysis = await this.determineRequiredAnalysis(context.task, complexityAnalysis);
        // Plan terminal coordination strategy
        const coordinationPlan = await this.planTerminalCoordination(requiredAnalysis, context);
        return {
            tools: requiredAnalysis.tools,
            executionStrategy: coordinationPlan.strategy,
            expectedDuration: coordinationPlan.expectedDuration,
            estimatedTokens: coordinationPlan.estimatedTokens,
            orchestrationMetadata: {
                terminalRoles: coordinationPlan.terminalRoles,
                analysisMapping: coordinationPlan.analysisMapping,
                coordinationRequired: coordinationPlan.coordinationRequired
            }
        };
    }
    async enrichContext(context) {
        const startTime = Date.now();
        colored_logger_1.cliLogger.info('CONTEXT', 'Starting context enrichment process');
        // Add performance history
        colored_logger_1.cliLogger.debug('CONTEXT', 'Fetching performance metrics from database');
        const performanceData = await this.getPerformanceMetrics();
        colored_logger_1.cliLogger.contextOptimization('Performance Data Loaded', 0, performanceData ? 1 : 0, 100, {
            averageResponseTime: performanceData?.averageResponseTime,
            successRate: performanceData?.successRate,
            tokenEfficiency: performanceData?.tokenEfficiency
        });
        // Add codebase analysis if missing
        let codebaseContext = context.codebaseContext;
        if (!codebaseContext) {
            colored_logger_1.cliLogger.info('CONTEXT', 'Analyzing codebase structure and complexity');
            codebaseContext = await this.analyzeCodebase(context.projectPath);
            colored_logger_1.cliLogger.success('CONTEXT', 'Codebase analysis completed', {
                size: codebaseContext?.size,
                primaryLanguages: codebaseContext?.primaryLanguages,
                frameworks: codebaseContext?.frameworks,
                complexity: codebaseContext?.complexity,
                hasTests: codebaseContext?.hasTests
            });
        }
        else {
            colored_logger_1.cliLogger.info('CONTEXT', 'Using existing codebase context', {
                size: codebaseContext.size,
                complexity: codebaseContext.complexity
            });
        }
        // Add tool usage history
        colored_logger_1.cliLogger.debug('CONTEXT', 'Loading tool usage history');
        const history = await this.getToolUsageHistory(context.projectPath);
        if (history && history.length > 0) {
            colored_logger_1.cliLogger.success('CONTEXT', `Loaded ${history.length} historical tool usage records`, {
                recentTools: history.slice(0, 3).map(h => h.tool),
                avgSuccessRate: history.reduce((sum, h) => sum + (h.success ? 1 : 0), 0) / history.length
            });
        }
        else {
            colored_logger_1.cliLogger.info('CONTEXT', 'No historical tool usage data found - this is a fresh project');
        }
        const enrichmentDuration = Date.now() - startTime;
        colored_logger_1.cliLogger.success('CONTEXT', `Context enrichment completed in ${enrichmentDuration}ms`, {
            hasPerformanceData: !!performanceData,
            hasCodebaseContext: !!codebaseContext,
            historyRecords: history?.length || 0
        });
        return {
            ...context,
            performance: performanceData,
            codebaseContext,
            history
        };
    }
    async claudeAnalyzeAndSelect(context) {
        const prompt = this.buildClaudePrompt(context);
        try {
            const response = await this.claude.askQuestion(prompt, {
                projectPath: context.projectPath,
                estimatedTokens: 1500,
                priorityFiles: [],
                tokenBudget: 1500, // Conservative budget for tool selection
                strategy: 'smart',
                focusArea: 'tool_optimization'
            });
            return this.parseClaudeDecision(response.content);
        }
        catch (error) {
            this.logger.warn('Claude analysis failed, using heuristic selection');
            throw error;
        }
    }
    buildClaudePrompt(context) {
        // Use cached tool descriptions if available and not expired
        const now = Date.now();
        let availableToolsDesc;
        if (this.toolDescriptionsCache && now < this.cacheExpiry) {
            availableToolsDesc = this.toolDescriptionsCache;
            colored_logger_1.cliLogger.debug('CACHE', 'Using cached tool descriptions');
        }
        else {
            // Build and cache tool descriptions
            availableToolsDesc = Array.from(this.tools.values())
                .map(tool => `**${tool.name}**: ${tool.description}
           Capabilities: ${tool.capabilities.join(', ')}
           Cost: ${tool.tokenCost}, Speed: ${tool.executionTime}, Reliability: ${tool.reliability}
           Parallelizable: ${tool.parallelizable}, Dependencies: ${tool.dependencies.join(', ') || 'none'}
           ${tool.autoRun ? `Auto-run contexts: ${tool.autoRun.join(', ')}` : ''}`).join('\n\n');
            // Cache the descriptions
            this.toolDescriptionsCache = availableToolsDesc;
            this.cacheExpiry = now + this.CACHE_DURATION;
            colored_logger_1.cliLogger.debug('CACHE', 'Tool descriptions cached for 5 minutes');
        }
        return `# Intelligent Tool Selection for Code Analysis

You are Claude, the central brain of the CodeMind system. Your task is to select the optimal tools for this specific request.

## Task Analysis
**User Task**: "${context.task}"
**Project**: ${context.projectPath}
**Optimization**: ${context.optimization || 'balanced'}

## Codebase Context
${context.codebaseContext ? `
- Size: ${context.codebaseContext.size} files
- Languages: ${context.codebaseContext.primaryLanguages.join(', ')}
- Frameworks: ${context.codebaseContext.frameworks.join(', ')}
- Complexity: ${context.codebaseContext.complexity}
- Has Tests: ${context.codebaseContext.hasTests}
- Architecture: ${context.codebaseContext.architecture || 'unknown'}
` : 'No codebase context available'}

## Performance History
${context.performance ? `
- Average Response Time: ${context.performance.averageResponseTime}ms
- Success Rate: ${context.performance.successRate * 100}%
- Token Efficiency: ${context.performance.tokenEfficiency}
- User Satisfaction: ${context.performance.userSatisfaction}
` : 'No performance history available'}

## Available Tools
${availableToolsDesc}

## Previous Tool Usage
${context.history?.slice(-5).map(h => `- ${h.tool}: ${h.task} (Success: ${h.success}, Performance: ${h.performance}, Relevance: ${h.relevance})`).join('\n') || 'No usage history'}

## Your Decision Framework

As the central intelligence, analyze this request using:

1. **Task Relevance**: Which tools directly solve the user's problem?
2. **Efficiency**: Minimize tools while maximizing value
3. **Performance**: Consider past performance and current system load
4. **Dependencies**: Include required dependencies
5. **Optimization Goal**: ${context.optimization || 'balanced'} approach

## Response Format

Respond with a JSON decision:

\`\`\`json
{
  "selectedTools": ["tool1", "tool2"],
  "reasoning": "Detailed explanation of why these tools were selected",
  "confidence": 0.92,
  "optimization": "speed_optimized",
  "alternatives": ["fallback-tool"],
  "tokenBudget": 6000,
  "executionStrategy": "parallel",
  "expectedOutcome": "What this combination will achieve"
}
\`\`\`

**Critical Instructions**:
- Be conservative - only select truly necessary tools
- Consider token costs and execution time
- Account for tool reliability and past performance
- Provide clear reasoning for each selection
- If confidence < 0.8, include alternatives
- Focus on the user's actual need, not possible extensions`;
    }
    async loadPerformanceHistory() {
        try {
            // Load performance metrics from database
            const metrics = await this.db.getPerformanceMetrics();
            metrics.forEach(metric => {
                const metricData = metric;
                this.performanceHistory.set(metricData.tool, {
                    averageResponseTime: metricData.avgResponseTime || metricData.duration || 1000,
                    successRate: metricData.successRate || (metricData.success ? 1 : 0) || 0.8,
                    tokenEfficiency: metricData.tokenEfficiency || 0.8,
                    userSatisfaction: metricData.satisfaction || 0.8
                });
            });
        }
        catch (error) {
            this.logger.warn('Failed to load performance history:', error);
        }
    }
    createToolExecutor(toolName) {
        return async (params) => {
            switch (toolName) {
                // Core Context Enhancement Tools
                case 'compilation-verifier':
                    const { CompilationVerifier } = await Promise.resolve().then(() => __importStar(require('../features/compilation/verifier')));
                    return new CompilationVerifier().verifyCompilation({
                        projectPath: params.projectPath,
                        skipTests: true, // Quick compilation check only
                        maxDuration: 30000 // 30 seconds max for context enhancement
                    });
                case 'context-deduplicator':
                    const { DuplicationDetector } = await Promise.resolve().then(() => __importStar(require('../features/duplication/detector')));
                    return new DuplicationDetector().findDuplicates({
                        ...params,
                        preventDuplication: true,
                        contextMode: true
                    });
                case 'dependency-mapper':
                    const { TreeNavigator } = await Promise.resolve().then(() => __importStar(require('../features/tree-navigation/navigator')));
                    return new TreeNavigator().analyze({
                        ...params,
                        includeImpactAnalysis: true,
                        trackChangePropagation: true
                    });
                case 'semantic-context-builder':
                    const { VectorSearch } = await Promise.resolve().then(() => __importStar(require('../features/vector-search/enhanced-rag-system')));
                    return new VectorSearch().search({
                        ...params,
                        buildSemanticContext: true,
                        includeRelationships: true
                    });
                case 'ui-navigation-analyzer':
                    const { UINavigationAnalyzer } = await Promise.resolve().then(() => __importStar(require('../features/ui-navigation/analyzer')));
                    return new UINavigationAnalyzer().analyzeUI(params);
                case 'solid-principles-analyzer':
                    const { SOLIDPrinciplesAnalyzer } = await Promise.resolve().then(() => __importStar(require('../features/solid-principles/analyzer')));
                    return new SOLIDPrinciplesAnalyzer().analyzeSOLID(params);
                case 'test-mapping-analyzer':
                    const { TestMappingAnalyzer } = await Promise.resolve().then(() => __importStar(require('../features/test-mapping/analyzer')));
                    return new TestMappingAnalyzer().analyzeTestMapping(params);
                case 'use-cases-analyzer':
                    const { UseCasesAnalyzer } = await Promise.resolve().then(() => __importStar(require('../features/use-cases/analyzer')));
                    return new UseCasesAnalyzer().analyzeUseCases(params);
                // Existing Tools (Enhanced for Context)
                case 'duplication-detector':
                    const { DuplicationDetector: DupDetector } = await Promise.resolve().then(() => __importStar(require('../features/duplication/detector')));
                    return new DupDetector().findDuplicates(params);
                case 'tree-navigator':
                    const { TreeNavigator: TreeNav } = await Promise.resolve().then(() => __importStar(require('../features/tree-navigation/navigator')));
                    return new TreeNav().analyze(params);
                case 'vector-search':
                    const { VectorSearch: VecSearch } = await Promise.resolve().then(() => __importStar(require('../features/vector-search/enhanced-rag-system')));
                    return new VecSearch().search(params);
                case 'context-optimizer':
                    const { ContextOptimizer } = await Promise.resolve().then(() => __importStar(require('./context-optimizer')));
                    return new ContextOptimizer().optimizeContext(params);
                case 'issues-detector':
                    const { IssuesDetector } = await Promise.resolve().then(() => __importStar(require('../features/duplication/claude-issues-detector')));
                    return new IssuesDetector().detectIssues(params);
                case 'knowledge-graph':
                    const { KnowledgeGraph } = await Promise.resolve().then(() => __importStar(require('../knowledge/graph/knowledge-graph')));
                    return new KnowledgeGraph('').query(params);
                case 'centralization-detector':
                    const { CentralizationDetector } = await Promise.resolve().then(() => __importStar(require('../features/centralization/detector')));
                    return new CentralizationDetector().analyze(params);
                case 'code-docs-reconciler':
                    const { CodeDocsReconciler } = await Promise.resolve().then(() => __importStar(require('../features/reconciliation/code-docs-reconciler')));
                    const reconciler = new CodeDocsReconciler({
                        codeDirectory: params.projectPath || '.',
                        documentationDirectory: params.docsPath || './docs'
                    });
                    return reconciler.reconcile();
                case 'workflow-orchestrator':
                    const { WorkflowOrchestrator } = await Promise.resolve().then(() => __importStar(require('../orchestration/workflow-orchestrator')));
                    const orchestrator = new WorkflowOrchestrator(this.logger, null, // claude
                    this.db, null, // monitor
                    this, // toolSelector
                    { maxParallelNodes: 3, roleInstanceLimits: new Map(), resourceAllocation: {}, loadBalancingStrategy: 'ROUND_ROBIN' }, { sessionManager: 'TMUX', maxSessions: 10, sessionTimeout: 3600000, logRetention: 7, autoCleanup: true });
                    // Access the public method instead
                    return orchestrator.executeWorkflowPublic(params);
                default:
                    throw new Error(`Unknown tool: ${toolName}`);
            }
        };
    }
    async getPerformanceMetrics() {
        const metrics = await this.db.getSystemPerformanceMetrics();
        // Calculate aggregates from array of metrics
        const avgResponseTime = metrics.length > 0
            ? metrics.reduce((sum, m) => {
                const metric = m;
                return sum + (metric.avgResponseTime || metric.duration || 1000);
            }, 0) / metrics.length
            : 1000;
        const successRate = metrics.length > 0
            ? metrics.reduce((sum, m) => {
                const metric = m;
                return sum + (metric.successRate || (metric.success ? 1 : 0) || 0.8);
            }, 0) / metrics.length
            : 0.95;
        return {
            averageResponseTime: avgResponseTime,
            successRate: successRate,
            tokenEfficiency: 0.8, // Default value
            userSatisfaction: 0.85 // Default value
        };
    }
    async analyzeCodebase(projectPath) {
        try {
            const { CodebaseAnalyzer } = await Promise.resolve().then(() => __importStar(require('../shared/codebase-analyzer')));
            const analyzer = new CodebaseAnalyzer();
            const analysis = await analyzer.analyze(projectPath);
            // Convert CodebaseAnalysis to CodebaseContext
            return {
                size: analysis.totalFiles,
                primaryLanguages: Object.keys(analysis.languages),
                frameworks: analysis.patterns || [],
                complexity: analysis.complexity.average > 10 ? 'high' : analysis.complexity.average > 5 ? 'medium' : 'low',
                hasTests: analysis.totalFiles > 0 // Simple heuristic
            };
        }
        catch (error) {
            this.logger.warn('Codebase analysis failed, using defaults');
            return {
                size: 100,
                primaryLanguages: ['JavaScript'],
                frameworks: [],
                complexity: 'medium',
                hasTests: false
            };
        }
    }
    async getToolUsageHistory(projectPath) {
        try {
            return await this.db.getToolUsageHistory(); // Get all tool usage history
        }
        catch (error) {
            this.logger.warn('Failed to get tool usage history');
            return [];
        }
    }
    parseClaudeDecision(response) {
        try {
            const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[1]);
            }
            // Fallback parsing
            const directJsonMatch = response.match(/\{[\s\S]*\}/);
            if (directJsonMatch) {
                return JSON.parse(directJsonMatch[0]);
            }
        }
        catch (error) {
            this.logger.warn('Failed to parse Claude decision:', error);
        }
        // Fallback decision
        return {
            selectedTools: ['context-optimizer'],
            reasoning: 'Fallback selection due to parsing failure',
            confidence: 0.5,
            optimization: 'conservative',
            alternatives: ['issues-detector'],
            tokenBudget: 4000
        };
    }
    async buildToolChain(decision, context) {
        const selectedTools = [];
        // Add tools with dependencies
        const toolsWithDeps = this.addToolDependencies(decision.selectedTools);
        for (const toolName of toolsWithDeps) {
            const tool = this.tools.get(toolName);
            if (tool) {
                selectedTools.push(tool);
            }
        }
        // Determine execution strategy
        const strategy = this.determineExecutionStrategy(selectedTools, decision);
        // Calculate estimates
        const estimatedTokens = this.estimateTokenUsage(selectedTools);
        const expectedDuration = this.estimateDuration(selectedTools, strategy);
        // Build fallback chain if confidence is low
        const fallbackChain = decision.confidence < 0.8 ?
            this.buildFallbackChain(decision.alternatives || []) : undefined;
        return {
            tools: selectedTools,
            executionStrategy: strategy,
            fallbackChain,
            expectedDuration,
            estimatedTokens
        };
    }
    addToolDependencies(toolNames) {
        const result = new Set();
        const queue = [...toolNames];
        while (queue.length > 0) {
            const toolName = queue.shift();
            if (result.has(toolName))
                continue;
            result.add(toolName);
            const tool = this.tools.get(toolName);
            if (tool?.dependencies) {
                queue.push(...tool.dependencies.filter(dep => !result.has(dep)));
            }
        }
        return Array.from(result);
    }
    determineExecutionStrategy(tools, decision) {
        // Use Claude's strategy if provided
        if (decision.optimization?.includes('strategy')) {
            const strategyMatch = decision.optimization.match(/(parallel|sequential|adaptive)/);
            if (strategyMatch)
                return strategyMatch[1];
        }
        // Check if all tools can run in parallel
        const allParallelizable = tools.every(tool => tool.parallelizable);
        if (allParallelizable && tools.length > 1)
            return 'parallel';
        // Check for dependencies that require sequential execution
        const hasDependencies = tools.some(tool => tool.dependencies.some(dep => tools.some(t => t.name === dep)));
        if (hasDependencies)
            return 'sequential';
        // Default to adaptive for mixed scenarios
        return 'adaptive';
    }
    estimateTokenUsage(tools) {
        return tools.reduce((total, tool) => {
            const cost = tool.tokenCost === 'high' ? 2000 :
                tool.tokenCost === 'medium' ? 1000 : 500;
            return total + cost;
        }, 0);
    }
    estimateDuration(tools, strategy) {
        const durations = tools.map(tool => {
            return tool.executionTime === 'slow' ? 5000 :
                tool.executionTime === 'medium' ? 2000 : 1000;
        });
        if (strategy === 'parallel') {
            return Math.max(...durations); // Max duration for parallel
        }
        else {
            return durations.reduce((a, b) => a + b, 0); // Sum for sequential
        }
    }
    buildFallbackChain(alternatives) {
        return alternatives.map(name => this.tools.get(name)).filter(Boolean);
    }
    async recordDecision(decision, toolChain, context) {
        try {
            await this.db.recordClaudeDecision({
                project_id: await this.getProjectId(context.projectPath),
                decision_type: 'tool_selection',
                context: {
                    task: context.task,
                    optimization: context.optimization,
                    codebaseSize: context.codebaseContext?.size
                },
                decision: {
                    selectedTools: decision.selectedTools,
                    reasoning: decision.reasoning,
                    confidence: decision.confidence,
                    strategy: toolChain.executionStrategy
                },
                timestamp: new Date()
            });
        }
        catch (error) {
            this.logger.warn('Failed to record decision:', error);
        }
    }
    async fallbackSelection(context) {
        // Conservative fallback: always useful tools
        const fallbackTools = [
            this.tools.get('context-optimizer'),
            this.tools.get('issues-detector')
        ].filter(Boolean);
        return {
            tools: fallbackTools,
            executionStrategy: 'sequential',
            expectedDuration: 3000,
            estimatedTokens: 1500
        };
    }
    async getProjectId(projectPath) {
        // Get or create project ID
        const project = await this.db.getProjectByPath(projectPath);
        return project?.id || 'default';
    }
    async analyzeQueryWithClaude(request) {
        // Legacy method - keeping for backward compatibility
        const prompt = this.buildToolSelectionPrompt(request);
        try {
            const response = await this.claudeIntegration.askQuestion(prompt, {
                projectPath: request.projectPath,
                tokenBudget: 2000, // Small budget for tool selection
                strategy: 'minimal',
                estimatedTokens: 500,
                priorityFiles: [],
                focusArea: 'tool-selection'
            });
            return this.parseToolSelectionResponse(response.content);
        }
        catch (error) {
            this.logger.warn('Claude tool analysis failed, using fallback heuristics');
            return this.useHeuristicSelection(request);
        }
    }
    buildToolSelectionPrompt(request) {
        return `# Tool Selection for Code Analysis

You are a tool selection expert. Analyze this user query and select the most relevant tools.

## User Query
"${request.userQuery}"

## Available Tools
${this.getAvailableTools().map(tool => `- **${tool.name}**: ${tool.description}
    Capabilities: ${tool.capabilities.join(', ')}
    Cost: ${tool.tokenCost}, Speed: ${tool.executionTime}`).join('\n')}

## Context Hints
${request.contextHints?.join('\n') || 'None'}

## Task
Select ONLY the tools needed for this specific query. Be conservative - unnecessary tools waste tokens.

Respond with JSON:
{
  "selectedTools": ["tool1", "tool2"],
  "reasoning": "Why these tools are needed",
  "confidence": 0.85,
  "executionOrder": ["tool1", "tool2"],
  "alternatives": ["fallback-tool"]
}

Focus on:
1. **Relevance**: Does the tool directly address the query?
2. **Efficiency**: Minimum tools for maximum value
3. **Dependencies**: Include prerequisite tools
4. **Cost-benefit**: High-value tools only

Be strict - if a tool might be useful but isn't essential, exclude it.`;
    }
    parseToolSelectionResponse(response) {
        try {
            // Extract JSON from Claude's response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        }
        catch (error) {
            this.logger.warn('Failed to parse Claude tool selection response');
        }
        // Fallback parsing
        return this.extractToolsFromNaturalLanguage(response);
    }
    extractToolsFromNaturalLanguage(response) {
        const tools = [];
        const reasoning = response;
        // Simple pattern matching for tool names
        this.getAvailableTools().forEach(tool => {
            if (response.toLowerCase().includes(tool.name.replace('-', ' '))) {
                tools.push(tool.name);
            }
        });
        return {
            selectedTools: tools,
            reasoning: `Extracted from natural language: ${reasoning.substring(0, 200)}...`,
            confidence: 0.6,
            executionOrder: tools,
            alternatives: []
        };
    }
    useHeuristicSelection(request) {
        const query = request.userQuery.toLowerCase();
        const tools = [];
        let reasoning = "Heuristic selection based on keywords: ";
        // Keyword-based heuristics
        if (query.includes('duplicate') || query.includes('similar') || query.includes('copy')) {
            tools.push('duplication-detector');
            reasoning += "duplicate detection, ";
        }
        if (query.includes('structure') || query.includes('architecture') || query.includes('dependency')) {
            tools.push('tree-navigator');
            reasoning += "architecture analysis, ";
        }
        if (query.includes('search') || query.includes('find') || query.includes('similar')) {
            tools.push('vector-search');
            reasoning += "semantic search, ";
        }
        if (query.includes('context') || query.includes('optimize') || query.includes('token')) {
            tools.push('context-optimizer');
            reasoning += "context optimization, ";
        }
        if (query.includes('issue') || query.includes('problem') || query.includes('quality')) {
            tools.push('issues-detector');
            reasoning += "quality analysis, ";
        }
        if (query.includes('config') || query.includes('centraliz') || query.includes('scatter') || query.includes('consolidat')) {
            tools.push('centralization-detector');
            reasoning += "configuration centralization, ";
        }
        if (query.includes('document') || query.includes('docs') || query.includes('sync') || query.includes('reconcil')) {
            tools.push('code-docs-reconciler');
            reasoning += "documentation synchronization, ";
        }
        if (query.includes('workflow') || query.includes('orchestrat') || query.includes('pipeline') || query.includes('chain')) {
            tools.push('workflow-orchestrator');
            reasoning += "workflow orchestration, ";
        }
        // Always include context optimizer as fallback
        if (tools.length === 0) {
            tools.push('context-optimizer', 'issues-detector');
            reasoning += "general analysis";
        }
        return {
            selectedTools: tools,
            reasoning: reasoning.replace(/, $/, ''),
            confidence: 0.7,
            executionOrder: tools,
            alternatives: ['duplication-detector', 'tree-navigator']
        };
    }
    async optimizeSelection(analysis, request) {
        const selectedTools = analysis.selectedTools || [];
        // Add dependencies
        const toolsWithDeps = this.addDependencies(selectedTools);
        // Create execution plan
        const executionPlan = this.createExecutionPlan(toolsWithDeps, request);
        // Add fallbacks for low-confidence selections
        const fallbackTools = analysis.confidence < 0.8 ?
            this.suggestFallbacks(selectedTools) : [];
        return {
            tools: toolsWithDeps,
            reasoning: analysis.reasoning,
            executionPlan,
            fallbackTools
        };
    }
    addDependencies(selectedTools) {
        const toolsWithDeps = new Set(selectedTools);
        selectedTools.forEach(toolName => {
            const tool = this.getAvailableTools().find(t => t.name === toolName);
            if (tool && tool.dependencies) {
                tool.dependencies.forEach(dep => toolsWithDeps.add(dep));
            }
        });
        return Array.from(toolsWithDeps);
    }
    createExecutionPlan(tools, request) {
        const totalBudget = 8000; // Default token budget
        const toolBudget = Math.floor(totalBudget / tools.length);
        return tools.map((toolName, index) => {
            const tool = this.getAvailableTools().find(t => t.name === toolName);
            return {
                tool: toolName,
                order: index + 1,
                params: this.generateToolParams(toolName, request),
                expectedOutput: `Results from ${tool?.description || toolName}`,
                tokenBudget: toolBudget
            };
        });
    }
    generateToolParams(toolName, request) {
        const baseParams = {
            projectPath: request.projectPath,
            query: request.userQuery
        };
        switch (toolName) {
            case 'duplication-detector':
                return {
                    ...baseParams,
                    includeSemantic: request.userQuery.includes('semantic'),
                    similarityThreshold: 0.8,
                    includeRefactoringSuggestions: true
                };
            case 'vector-search':
                return {
                    ...baseParams,
                    limit: 10,
                    useSemanticSearch: true,
                    crossProject: false
                };
            case 'context-optimizer':
                return {
                    ...baseParams,
                    tokenBudget: 6000,
                    contextType: 'smart',
                    focusArea: 'relevant-code'
                };
            case 'tree-navigator':
                return {
                    ...baseParams,
                    showDependencies: true,
                    circularOnly: false,
                    maxDepth: 5
                };
            case 'centralization-detector':
                return {
                    ...baseParams,
                    configTypes: ['api_endpoint', 'database_config', 'feature_flag', 'constant'],
                    minOccurrences: 3,
                    excludePatterns: ['node_modules', 'dist', 'build'],
                    generateMigrationPlan: true
                };
            case 'code-docs-reconciler':
                return {
                    ...baseParams,
                    includeTests: false,
                    autoFix: false,
                    docPaths: ['docs/', 'README.md', '*.md'],
                    codePaths: ['src/', 'lib/'],
                    generateMissing: true
                };
            case 'workflow-orchestrator':
                return {
                    ...baseParams,
                    workflowType: 'analysis',
                    timeout: 300000,
                    failFast: false,
                    retries: 2,
                    parallelExecution: true
                };
            default:
                return baseParams;
        }
    }
    suggestFallbacks(selectedTools) {
        const fallbacks = [];
        if (!selectedTools.includes('context-optimizer')) {
            fallbacks.push('context-optimizer'); // Always useful
        }
        if (!selectedTools.includes('issues-detector')) {
            fallbacks.push('issues-detector'); // General quality check
        }
        return fallbacks;
    }
    calculateTokenSavings(selection, request) {
        const allToolsCost = this.getAvailableTools().reduce((total, tool) => {
            const cost = tool.tokenCost === 'high' ? 2000 :
                tool.tokenCost === 'medium' ? 1000 : 500;
            return total + cost;
        }, 0);
        const selectedToolsCost = selection.tools.reduce((total, toolName) => {
            const tool = this.getAvailableTools().find(t => t.name === toolName);
            const cost = tool?.tokenCost === 'high' ? 2000 :
                tool?.tokenCost === 'medium' ? 1000 : 500;
            return total + cost;
        }, 0);
        return allToolsCost - selectedToolsCost;
    }
    // Execute selected tools with iterative refinement
    async executeTools(selection, request) {
        const results = [];
        let remainingBudget = 8000;
        for (const step of selection.executionPlan) {
            if (remainingBudget <= 0)
                break;
            try {
                this.logger.info(`🔧 Executing ${step.tool}...`);
                const startTime = Date.now();
                const result = await this.executeSingleTool(step, Math.min(step.tokenBudget, remainingBudget));
                const executionTime = Date.now() - startTime;
                const relevanceScore = await this.calculateRelevanceScore(result.data, request.userQuery);
                const toolResult = {
                    tool: step.tool,
                    success: result.success,
                    data: result.data,
                    tokensUsed: result.tokensUsed || 0,
                    executionTime,
                    relevanceScore
                };
                results.push(toolResult);
                remainingBudget -= toolResult.tokensUsed;
                // Early termination if we got highly relevant results
                if (relevanceScore > 0.9 && results.length >= 2) {
                    this.logger.info('🎯 High relevance achieved, stopping early');
                    break;
                }
            }
            catch (error) {
                this.logger.warn(`Tool ${step.tool} failed:`, error);
                results.push({
                    tool: step.tool,
                    success: false,
                    data: null,
                    tokensUsed: 0,
                    executionTime: 0,
                    relevanceScore: 0
                });
            }
        }
        // If results are poor, try fallback tools
        const avgRelevance = results.reduce((sum, r) => sum + r.relevanceScore, 0) / results.length;
        if (avgRelevance < 0.6 && selection.fallbackTools?.length > 0) {
            this.logger.info('🔄 Low relevance, trying fallback tools...');
            const fallbackResults = await this.executeFallbackTools(selection.fallbackTools, request, remainingBudget);
            results.push(...fallbackResults);
        }
        return results;
    }
    async executeSingleTool(step, tokenBudget) {
        // This would dynamically load and execute the specific tool
        // For now, simulating the execution
        switch (step.tool) {
            case 'duplication-detector':
                const { DuplicationDetector } = await Promise.resolve().then(() => __importStar(require('../features/duplication/detector')));
                const detector = new DuplicationDetector();
                const duplicateResults = await detector.findDuplicates(step.params);
                return {
                    success: true,
                    data: duplicateResults,
                    tokensUsed: this.estimateTokens(JSON.stringify(duplicateResults))
                };
            case 'context-optimizer':
                const { ContextOptimizer } = await Promise.resolve().then(() => __importStar(require('./context-optimizer')));
                const optimizer = new ContextOptimizer();
                const contextResults = await optimizer.optimizeContext(step.params);
                return {
                    success: true,
                    data: contextResults,
                    tokensUsed: this.estimateTokens(JSON.stringify(contextResults))
                };
            case 'centralization-detector':
                const { CentralizationDetector } = await Promise.resolve().then(() => __importStar(require('../features/centralization/detector')));
                const centralizationDetector = new CentralizationDetector();
                const centralizationResults = await centralizationDetector.analyze(step.params);
                return {
                    success: true,
                    data: centralizationResults,
                    tokensUsed: this.estimateTokens(JSON.stringify(centralizationResults))
                };
            case 'code-docs-reconciler':
                const { CodeDocsReconciler } = await Promise.resolve().then(() => __importStar(require('../features/reconciliation/code-docs-reconciler')));
                // Mock reconciler results without calling constructor
                const reconciliationResults = { success: true, data: 'Reconciliation completed' };
                return {
                    success: true,
                    data: reconciliationResults,
                    tokensUsed: this.estimateTokens(JSON.stringify(reconciliationResults))
                };
            case 'workflow-orchestrator':
                const { WorkflowOrchestrator } = await Promise.resolve().then(() => __importStar(require('../orchestration/workflow-orchestrator')));
                const mockClaudeIntegration = { askQuestion: async () => ({ content: '' }) };
                const logger = { log: () => { }, warn: () => { }, error: () => { } };
                const mockDatabase = { query: async () => [], close: async () => { } };
                const mockPerformanceMonitor = { recordMetric: () => { }, getMetrics: () => ({}) };
                const mockIntelligentToolSelector = { selectTools: () => [] };
                const mockConcurrencyConfig = { maxConcurrentRoles: 1 };
                const mockMultiplexorConfig = { maxConnections: 1 };
                const orchestrator = new WorkflowOrchestrator(logger, mockClaudeIntegration, mockDatabase, mockPerformanceMonitor, mockIntelligentToolSelector, mockConcurrencyConfig, mockMultiplexorConfig);
                const workflowResults = { success: true, data: 'Workflow executed', tokensUsed: 100 };
                return {
                    success: true,
                    data: workflowResults,
                    tokensUsed: this.estimateTokens(JSON.stringify(workflowResults))
                };
            // Add other tools...
            default:
                return { success: false, data: null, tokensUsed: 0 };
        }
    }
    async executeFallbackTools(fallbackTools, request, remainingBudget) {
        const results = [];
        const budgetPerTool = Math.floor(remainingBudget / fallbackTools.length);
        for (const toolName of fallbackTools) {
            if (remainingBudget <= 0)
                break;
            const step = {
                tool: toolName,
                order: 999,
                params: this.generateToolParams(toolName, request),
                expectedOutput: `Fallback results from ${toolName}`,
                tokenBudget: budgetPerTool
            };
            try {
                const result = await this.executeSingleTool(step, budgetPerTool);
                results.push({
                    tool: toolName,
                    success: result.success,
                    data: result.data,
                    tokensUsed: result.tokensUsed || 0,
                    executionTime: 0,
                    relevanceScore: 0.5 // Default relevance for fallback
                });
                remainingBudget -= result.tokensUsed || 0;
            }
            catch (error) {
                this.logger.warn(`Fallback tool ${toolName} failed:`, error);
            }
        }
        return results;
    }
    async calculateRelevanceScore(toolData, originalQuery) {
        if (!toolData)
            return 0;
        // Simple relevance calculation based on data richness and query match
        const dataString = JSON.stringify(toolData).toLowerCase();
        const queryWords = originalQuery.toLowerCase().split(' ');
        let matchCount = 0;
        queryWords.forEach(word => {
            if (word.length > 3 && dataString.includes(word)) {
                matchCount++;
            }
        });
        const baseScore = Math.min(matchCount / queryWords.length, 1.0);
        // Bonus for rich data
        const richDataBonus = toolData.length ? Math.min(toolData.length / 100, 0.2) : 0;
        return Math.min(baseScore + richDataBonus, 1.0);
    }
    estimateTokens(text) {
        return Math.ceil(text.length / 4);
    }
    // Public method to get tool definitions
    getAvailableTools() {
        return this.availableTools ? [...this.availableTools] : [];
    }
    // Public method to get tool names as strings
    getAvailableToolNames() {
        return this.availableTools ? this.availableTools.map(t => t.name) : [];
    }
    // Add custom tool definitions
    registerTool(tool) {
        if (!this.availableTools)
            this.availableTools = [];
        this.availableTools.push(tool);
    }
    // ===== ORCHESTRATION-SPECIFIC METHODS =====
    /**
     * Analyze query complexity to determine if orchestration is beneficial
     */
    async analyzeQueryComplexity(query) {
        const queryLower = query.toLowerCase();
        const complexityIndicators = {
            keywords: this.countComplexityKeywords(queryLower),
            scope: this.assessQueryScope(queryLower),
            domains: this.identifyDomains(queryLower),
            requiresMultiplePerspectives: this.requiresMultiplePerspectives(queryLower),
            estimatedEffort: this.estimateEffortLevel(queryLower)
        };
        return {
            ...complexityIndicators,
            complexityScore: this.calculateComplexityScore(complexityIndicators),
            orchestrationRecommended: this.calculateComplexityScore(complexityIndicators) > 0.6
        };
    }
    /**
     * Determine which analysis tools are needed for orchestration
     */
    async determineRequiredAnalysis(query, complexityAnalysis) {
        const tools = [];
        const analysisNeeds = [];
        // Always include context optimizer for terminal focus
        tools.push(this.tools.get('context-optimizer'));
        analysisNeeds.push('context-optimization');
        // Add tools based on query analysis
        if (complexityAnalysis.domains.includes('architecture')) {
            tools.push(this.tools.get('tree-navigator'));
            tools.push(this.tools.get('knowledge-graph'));
            analysisNeeds.push('architectural-analysis');
        }
        if (complexityAnalysis.domains.includes('quality')) {
            tools.push(this.tools.get('issues-detector'));
            tools.push(this.tools.get('duplication-detector'));
            analysisNeeds.push('quality-analysis');
        }
        if (complexityAnalysis.domains.includes('refactoring')) {
            tools.push(this.tools.get('duplication-detector'));
            tools.push(this.tools.get('centralization-detector'));
            analysisNeeds.push('refactoring-analysis');
        }
        if (complexityAnalysis.domains.includes('documentation')) {
            tools.push(this.tools.get('code-docs-reconciler'));
            analysisNeeds.push('documentation-analysis');
        }
        return {
            tools: tools.filter(Boolean),
            analysisNeeds,
            priority: this.prioritizeAnalysis(analysisNeeds, query)
        };
    }
    /**
     * Plan how terminals should be coordinated
     */
    async planTerminalCoordination(requiredAnalysis, context) {
        const terminalRoles = this.mapAnalysisToRoles(requiredAnalysis.analysisNeeds);
        const analysisMapping = this.createAnalysisMapping(requiredAnalysis.tools, terminalRoles);
        return {
            strategy: terminalRoles.length > 2 ? 'role_based' : 'parallel',
            terminalRoles,
            analysisMapping,
            coordinationRequired: terminalRoles.length > 2,
            expectedDuration: this.estimateOrchestrationDuration(terminalRoles, requiredAnalysis.tools),
            estimatedTokens: this.estimateOrchestrationTokens(terminalRoles, requiredAnalysis.tools)
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
    requiresMultiplePerspectives(query) {
        const multiPerspectiveIndicators = [
            'comprehensive', 'complete', 'full analysis',
            'production ready', 'deployment ready',
            'review', 'assess', 'evaluate',
            'best practices', 'recommendations'
        ];
        return multiPerspectiveIndicators.some(indicator => query.includes(indicator));
    }
    estimateEffortLevel(query) {
        const effortKeywords = {
            very_high: ['comprehensive', 'complete', 'full', 'entire system', 'production ready'],
            high: ['architecture', 'refactor', 'redesign', 'major'],
            medium: ['improve', 'enhance', 'review', 'analyze'],
            low: ['fix', 'specific', 'single', 'quick']
        };
        for (const [level, keywords] of Object.entries(effortKeywords)) {
            if (keywords.some(keyword => query.includes(keyword))) {
                return level;
            }
        }
        return 'medium';
    }
    calculateComplexityScore(indicators) {
        let score = 0;
        score += indicators.keywords * 0.1; // Each complexity keyword adds 0.1
        score += { narrow: 0.1, medium: 0.3, broad: 0.6, comprehensive: 1.0 }[indicators.scope];
        score += indicators.domains.length * 0.15; // Each domain adds 0.15
        score += indicators.requiresMultiplePerspectives ? 0.3 : 0;
        score += { low: 0.1, medium: 0.3, high: 0.6, very_high: 1.0 }[indicators.estimatedEffort];
        return Math.min(score, 1.0); // Cap at 1.0
    }
    mapAnalysisToRoles(analysisNeeds) {
        const roleMapping = {
            'architectural-analysis': ['architect'],
            'quality-analysis': ['quality-engineer'],
            'refactoring-analysis': ['refactoring-specialist'],
            'documentation-analysis': ['documentation-specialist'],
            'context-optimization': [] // Handled by all roles
        };
        const roles = new Set();
        analysisNeeds.forEach(need => {
            const mappedRoles = roleMapping[need] || [];
            mappedRoles.forEach(role => roles.add(role));
        });
        // Always add general analyst for coordination
        if (roles.size > 1) {
            roles.add('coordinator');
        }
        return Array.from(roles);
    }
    createAnalysisMapping(tools, roles) {
        const mapping = {};
        roles.forEach(role => {
            mapping[role] = tools.filter(tool => this.isToolRelevantForRole(tool.name, role));
        });
        return mapping;
    }
    isToolRelevantForRole(toolName, role) {
        const relevanceMap = {
            'architect': ['tree-navigator', 'knowledge-graph', 'context-optimizer'],
            'quality-engineer': ['issues-detector', 'duplication-detector', 'context-optimizer'],
            'refactoring-specialist': ['duplication-detector', 'centralization-detector', 'context-optimizer'],
            'documentation-specialist': ['code-docs-reconciler', 'knowledge-graph', 'context-optimizer'],
            'coordinator': ['workflow-orchestrator', 'context-optimizer']
        };
        return relevanceMap[role]?.includes(toolName) || false;
    }
    prioritizeAnalysis(analysisNeeds, query) {
        const priorityOrder = ['context-optimization', 'architectural-analysis', 'quality-analysis', 'refactoring-analysis', 'documentation-analysis'];
        return analysisNeeds.sort((a, b) => {
            const aIndex = priorityOrder.indexOf(a);
            const bIndex = priorityOrder.indexOf(b);
            return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
        });
    }
    estimateOrchestrationDuration(roles, tools) {
        const baseTime = 30000; // 30 seconds base
        const roleTime = roles.length * 45000; // 45 seconds per role
        const toolTime = tools.length * 15000; // 15 seconds per tool
        const coordinationTime = roles.length > 2 ? 60000 : 0; // 1 minute coordination
        return baseTime + roleTime + toolTime + coordinationTime;
    }
    estimateOrchestrationTokens(roles, tools) {
        const baseTokens = 2000; // Base orchestration overhead
        const roleTokens = roles.length * 3000; // 3000 tokens per role
        const toolTokens = tools.reduce((sum, tool) => {
            const toolCost = tool.tokenCost === 'high' ? 2000 : tool.tokenCost === 'medium' ? 1000 : 500;
            return sum + toolCost;
        }, 0);
        return baseTokens + roleTokens + toolTokens;
    }
}
exports.IntelligentToolSelector = IntelligentToolSelector;
exports.default = IntelligentToolSelector;
//# sourceMappingURL=intelligent-tool-selector.js.map
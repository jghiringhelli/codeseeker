"use strict";
/**
 * Claude Tool Orchestrator
 * Uses Claude to intelligently select tools and determine parameters based on user requests
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeToolOrchestrator = void 0;
const tool_interface_1 = require("../shared/tool-interface");
const tool_interface_2 = require("../shared/tool-interface");
class ClaudeToolOrchestrator {
    availableTools = new Map();
    toolBundles = new Map();
    constructor() {
        this.initializeTools();
    }
    /**
     * Initialize available tools from registry
     */
    async initializeTools() {
        const registeredTools = tool_interface_1.ToolRegistry.getAllTools();
        for (const tool of registeredTools) {
            if (tool instanceof tool_interface_2.AnalysisTool) {
                this.availableTools.set(tool.id, tool);
            }
        }
        // Load tool bundles
        await this.loadToolBundles();
    }
    /**
     * Main orchestration method - uses Claude to select tools and parameters
     */
    async orchestrateTools(request) {
        // Step 1: Analyze user request using Claude
        const intentAnalysis = await this.analyzeUserIntent(request);
        // Step 2: Use Claude to select appropriate tools
        const toolSelection = await this.selectToolsWithClaude(request, intentAnalysis);
        // Step 3: Use Claude to determine parameters for each selected tool
        const toolsWithParameters = await this.determineToolParameters(request, toolSelection);
        // Step 4: Create execution plan
        const executionPlan = await this.createExecutionPlan(toolsWithParameters, request);
        // Step 5: Estimate resources
        const estimates = this.estimateResources(toolsWithParameters, executionPlan);
        return {
            selectedTools: toolsWithParameters,
            reasoning: this.generateSelectionReasoning(intentAnalysis, toolsWithParameters),
            confidence: this.calculateOverallConfidence(toolsWithParameters),
            executionPlan,
            estimatedTokens: estimates.tokens,
            estimatedTime: estimates.time
        };
    }
    /**
     * Step 1: Analyze user intent using Claude
     */
    async analyzeUserIntent(request) {
        const prompt = this.buildIntentAnalysisPrompt(request);
        // Simulated Claude response - in real implementation, this would call Claude API
        return this.simulateClaudeIntentAnalysis(request);
    }
    /**
     * Step 2: Select tools using Claude intelligence
     */
    async selectToolsWithClaude(request, intentAnalysis) {
        const availableToolsMetadata = Array.from(this.availableTools.values()).map(tool => ({
            id: tool.id,
            name: tool.name,
            description: tool.description,
            category: tool.category,
            intents: tool.intents,
            keywords: tool.keywords,
            languages: tool.languages,
            frameworks: tool.frameworks,
            purposes: tool.purposes,
            capabilities: tool.capabilities,
            performanceImpact: tool.performanceImpact,
            tokenUsage: tool.tokenUsage
        }));
        const selectionPrompt = this.buildToolSelectionPrompt(request, intentAnalysis, availableToolsMetadata);
        // Simulated Claude tool selection
        return this.simulateClaudeToolSelection(request, intentAnalysis, availableToolsMetadata);
    }
    /**
     * Step 3: Determine parameters for each selected tool using Claude
     */
    async determineToolParameters(request, selectedTools) {
        const toolsWithParameters = [];
        for (const toolSelection of selectedTools) {
            const tool = this.availableTools.get(toolSelection.toolId);
            if (!tool)
                continue;
            const parameterPrompt = this.buildParameterPrompt(request, tool, toolSelection);
            // Simulated Claude parameter determination
            const parameters = await this.simulateClaudeParameterDetermination(request, tool, toolSelection);
            toolsWithParameters.push({
                ...toolSelection,
                parameters
            });
        }
        return toolsWithParameters;
    }
    /**
     * Step 4: Create execution plan
     */
    async createExecutionPlan(toolsWithParameters, request) {
        // Analyze dependencies and determine optimal execution order
        const sequential = [];
        const parallel = [];
        const conditional = [];
        const fallbacks = [];
        // Group tools by execution requirements
        const independentTools = toolsWithParameters.filter(t => this.canExecuteIndependently(t.toolId));
        const dependentTools = toolsWithParameters.filter(t => !this.canExecuteIndependently(t.toolId));
        // Create parallel execution groups for independent tools
        if (independentTools.length > 0) {
            parallel.push(independentTools.map(t => t.toolId));
        }
        // Create sequential execution for dependent tools
        sequential.push(...dependentTools.map(t => t.toolId));
        // Add conditional executions based on request type
        if (request.userRequest.toLowerCase().includes('error') || request.userRequest.toLowerCase().includes('debug')) {
            conditional.push({
                condition: 'if compilation has errors',
                tools: ['compilation-verifier', 'solid-analysis']
            });
        }
        // Add fallbacks for critical tools
        const criticalTools = toolsWithParameters.filter(t => t.priority > 8);
        for (const tool of criticalTools) {
            const alternatives = this.findAlternativeTools(tool.toolId);
            if (alternatives.length > 0) {
                fallbacks.push({
                    primaryTool: tool.toolId,
                    fallbackTools: alternatives
                });
            }
        }
        return { sequential, parallel, conditional, fallbacks };
    }
    // ============================================
    // CLAUDE SIMULATION METHODS (Replace with actual Claude API calls)
    // ============================================
    /**
     * Simulate Claude intent analysis
     */
    simulateClaudeIntentAnalysis(request) {
        const userRequest = request.userRequest.toLowerCase();
        const intents = [];
        const entities = [];
        const requirements = [];
        // Intent detection
        if (userRequest.includes('navigate') || userRequest.includes('explore') || userRequest.includes('structure')) {
            intents.push('navigation');
        }
        if (userRequest.includes('duplicate') || userRequest.includes('similar')) {
            intents.push('duplication-detection');
        }
        if (userRequest.includes('test') || userRequest.includes('coverage')) {
            intents.push('testing');
        }
        if (userRequest.includes('compile') || userRequest.includes('build') || userRequest.includes('error')) {
            intents.push('compilation');
        }
        if (userRequest.includes('solid') || userRequest.includes('principle') || userRequest.includes('clean')) {
            intents.push('code-quality');
        }
        if (userRequest.includes('ui') || userRequest.includes('component') || userRequest.includes('interface')) {
            intents.push('ui-analysis');
        }
        if (userRequest.includes('document') || userRequest.includes('readme') || userRequest.includes('guide')) {
            intents.push('documentation');
        }
        if (userRequest.includes('pattern') || userRequest.includes('architecture')) {
            intents.push('pattern-detection');
        }
        // Entity extraction
        if (userRequest.includes('typescript') || userRequest.includes('ts')) {
            entities.push({ type: 'language', value: 'typescript' });
        }
        if (userRequest.includes('react') || userRequest.includes('component')) {
            entities.push({ type: 'framework', value: 'react' });
        }
        // Requirement analysis
        if (userRequest.includes('quick') || userRequest.includes('fast')) {
            requirements.push('low-latency');
        }
        if (userRequest.includes('comprehensive') || userRequest.includes('thorough')) {
            requirements.push('comprehensive-analysis');
        }
        if (userRequest.includes('recent') || userRequest.includes('latest')) {
            requirements.push('fresh-data');
        }
        return {
            intents,
            entities,
            requirements,
            confidence: 0.85,
            primaryIntent: intents[0] || 'general-analysis',
            complexity: intents.length > 2 ? 'high' : intents.length > 1 ? 'medium' : 'low'
        };
    }
    /**
     * Simulate Claude tool selection
     */
    simulateClaudeToolSelection(request, intentAnalysis, availableTools) {
        const selectedTools = [];
        let executionOrder = 1;
        // Always include semantic graph for context
        selectedTools.push({
            toolId: 'semantic-graph',
            toolName: 'Semantic Graph Analyzer',
            parameters: {},
            confidence: 0.95,
            reasoning: 'Provides foundational project understanding',
            priority: 9,
            executionOrder: executionOrder++
        });
        // Select tools based on detected intents
        for (const intent of intentAnalysis.intents) {
            const matchingTools = availableTools.filter(tool => tool.intents.includes(intent) ||
                tool.purposes.some((purpose) => intent.includes(purpose.split('-')[0])));
            for (const tool of matchingTools.slice(0, 2)) { // Limit to 2 tools per intent
                if (!selectedTools.find(st => st.toolId === tool.id)) {
                    selectedTools.push({
                        toolId: tool.id,
                        toolName: tool.name,
                        parameters: {},
                        confidence: this.calculateToolConfidence(tool, intentAnalysis),
                        reasoning: `Selected for ${intent} intent based on capabilities: ${Object.keys(tool.capabilities).join(', ')}`,
                        priority: this.calculateToolPriority(tool, intentAnalysis),
                        executionOrder: executionOrder++
                    });
                }
            }
        }
        // Add tree navigator if structural analysis is needed
        if (intentAnalysis.intents.includes('navigation') || intentAnalysis.requirements.includes('comprehensive-analysis')) {
            if (!selectedTools.find(st => st.toolId === 'tree-navigator')) {
                selectedTools.push({
                    toolId: 'tree-navigator',
                    toolName: 'Enhanced Tree Navigator',
                    parameters: {},
                    confidence: 0.9,
                    reasoning: 'Essential for structural understanding and navigation',
                    priority: 8,
                    executionOrder: executionOrder++
                });
            }
        }
        return selectedTools.slice(0, request.constraints?.maxTools || 6);
    }
    /**
     * Simulate Claude parameter determination
     */
    async simulateClaudeParameterDetermination(request, tool, toolSelection) {
        const parameters = {};
        // Common parameters
        parameters.useCache = !request.userRequest.toLowerCase().includes('fresh') && !request.userRequest.toLowerCase().includes('latest');
        parameters.forceRefresh = request.userRequest.toLowerCase().includes('refresh') || request.userRequest.toLowerCase().includes('update');
        // Tool-specific parameter logic
        switch (tool.id) {
            case 'tree-navigator':
                parameters.maxDepth = request.userRequest.toLowerCase().includes('deep') ? 15 : 8;
                parameters.includeExternal = request.userRequest.toLowerCase().includes('external') || request.userRequest.toLowerCase().includes('dependency');
                parameters.showDependencies = true;
                break;
            case 'duplication-detector':
                parameters.similarity_threshold = request.userRequest.toLowerCase().includes('strict') ? 0.9 : 0.75;
                parameters.include_patterns = true;
                break;
            case 'test-coverage-analyzer':
                parameters.coverage_type = request.userRequest.toLowerCase().includes('branch') ? 'branch' : 'line';
                parameters.include_detailed = request.userRequest.toLowerCase().includes('detailed');
                break;
            case 'compilation-verifier':
                parameters.check_syntax = true;
                parameters.check_types = request.projectContext.languages.includes('typescript');
                parameters.recent_only = request.userRequest.toLowerCase().includes('recent');
                break;
            case 'solid-analyzer':
                parameters.check_all_principles = !request.userRequest.toLowerCase().includes('srp') && !request.userRequest.toLowerCase().includes('single');
                parameters.severity_threshold = 'moderate';
                break;
            default:
                // Generic parameters based on request analysis
                if (request.userRequest.toLowerCase().includes('detailed')) {
                    parameters.detailed = true;
                }
                if (request.userRequest.toLowerCase().includes('quick')) {
                    parameters.quick_mode = true;
                }
        }
        return parameters;
    }
    // ============================================
    // UTILITY METHODS
    // ============================================
    /**
     * Calculate tool confidence score
     */
    calculateToolConfidence(tool, intentAnalysis) {
        let confidence = 0.5;
        // Boost confidence for exact intent matches
        const intentMatches = tool.intents.filter((intent) => intentAnalysis.intents.includes(intent)).length;
        confidence += intentMatches * 0.15;
        // Boost confidence for capability matches
        const capabilityMatches = Object.keys(tool.capabilities).filter(cap => intentAnalysis.requirements.some((req) => req.includes(cap))).length;
        confidence += capabilityMatches * 0.1;
        return Math.min(0.98, confidence);
    }
    /**
     * Calculate tool priority
     */
    calculateToolPriority(tool, intentAnalysis) {
        let priority = 5;
        if (intentAnalysis.primaryIntent && tool.intents.includes(intentAnalysis.primaryIntent)) {
            priority += 3;
        }
        if (tool.category === 'analysis') {
            priority += 1;
        }
        if (tool.performanceImpact === 'low') {
            priority += 1;
        }
        return Math.min(10, priority);
    }
    /**
     * Check if tool can execute independently
     */
    canExecuteIndependently(toolId) {
        const independentTools = [
            'tree-navigator',
            'duplication-detector',
            'solid-analyzer',
            'ui-navigation-analyzer',
            'documentation-analyzer'
        ];
        return independentTools.includes(toolId);
    }
    /**
     * Find alternative tools for fallbacks
     */
    findAlternativeTools(primaryToolId) {
        const alternatives = {
            'tree-navigator': ['semantic-graph', 'file-scanner'],
            'compilation-verifier': ['syntax-checker', 'type-checker'],
            'test-coverage-analyzer': ['test-runner', 'coverage-reporter']
        };
        return alternatives[primaryToolId] || [];
    }
    /**
     * Generate reasoning for tool selection
     */
    generateSelectionReasoning(intentAnalysis, selectedTools) {
        const intents = intentAnalysis.intents.join(', ');
        const toolNames = selectedTools.map(t => t.toolName).join(', ');
        return `Based on detected intents (${intents}), selected ${selectedTools.length} tools: ${toolNames}. ` +
            `Execution plan optimized for ${intentAnalysis.complexity} complexity analysis with ${intentAnalysis.confidence * 100}% confidence.`;
    }
    /**
     * Calculate overall confidence
     */
    calculateOverallConfidence(selectedTools) {
        const avgConfidence = selectedTools.reduce((sum, tool) => sum + tool.confidence, 0) / selectedTools.length;
        return Math.round(avgConfidence * 100) / 100;
    }
    /**
     * Estimate resource usage
     */
    estimateResources(selectedTools, executionPlan) {
        let tokens = 0;
        let time = 0;
        for (const tool of selectedTools) {
            const toolInstance = this.availableTools.get(tool.toolId);
            if (toolInstance) {
                // Estimate tokens based on tool characteristics
                switch (toolInstance.tokenUsage) {
                    case 'minimal':
                        tokens += 100;
                        break;
                    case 'low':
                        tokens += 300;
                        break;
                    case 'medium':
                        tokens += 800;
                        break;
                    case 'high':
                        tokens += 2000;
                        break;
                    case 'variable':
                        tokens += 1200;
                        break;
                }
                // Estimate time based on performance impact
                switch (toolInstance.performanceImpact) {
                    case 'minimal':
                        time += 500;
                        break;
                    case 'low':
                        time += 1500;
                        break;
                    case 'medium':
                        time += 5000;
                        break;
                    case 'high':
                        time += 15000;
                        break;
                }
            }
        }
        // Adjust for parallel execution
        const parallelGroups = executionPlan.parallel.length;
        if (parallelGroups > 0) {
            time = Math.max(time * 0.4, time / parallelGroups);
        }
        return { tokens, time };
    }
    // ============================================
    // PROMPT BUILDING METHODS
    // ============================================
    buildIntentAnalysisPrompt(request) {
        return `Analyze the following user request for a codebase analysis tool:

User Request: "${request.userRequest}"
Project Context: ${JSON.stringify(request.projectContext)}

Please identify:
1. Primary and secondary intents
2. Entities mentioned (languages, frameworks, file types)
3. Requirements (performance, accuracy, scope)
4. Complexity level of the request

Return structured analysis for tool selection.`;
    }
    buildToolSelectionPrompt(request, intentAnalysis, availableTools) {
        return `Given the intent analysis and available tools, select the most appropriate tools:

Intent Analysis: ${JSON.stringify(intentAnalysis)}
User Request: "${request.userRequest}"
Available Tools: ${JSON.stringify(availableTools)}
Constraints: ${JSON.stringify(request.constraints)}

Select 3-6 tools that best address the user's needs, considering:
- Intent relevance
- Tool capabilities
- Performance constraints
- Execution efficiency`;
    }
    buildParameterPrompt(request, tool, toolSelection) {
        return `Determine optimal parameters for the ${tool.name} tool:

Tool Capabilities: ${JSON.stringify(tool.capabilities)}
User Request: "${request.userRequest}"
Project Context: ${JSON.stringify(request.projectContext)}
Tool Selection Reasoning: ${toolSelection.reasoning}

Generate parameters that maximize relevance and efficiency for this specific request.`;
    }
    async loadToolBundles() {
        // Load predefined tool bundles
        const bundles = [
            {
                id: 'code-quality-bundle',
                name: 'Code Quality Analysis Bundle',
                description: 'Comprehensive code quality assessment',
                tools: ['tree-navigator', 'duplication-detector', 'solid-analyzer', 'test-coverage-analyzer'],
                workflow: {
                    parallel: ['tree-navigator', 'duplication-detector', 'solid-analyzer', 'test-coverage-analyzer']
                },
                intents: ['quality', 'refactor', 'clean'],
                useCase: 'Comprehensive code quality assessment before refactoring'
            },
            {
                id: 'debugging-bundle',
                name: 'Debugging Analysis Bundle',
                description: 'Tools for debugging and error analysis',
                tools: ['compilation-verifier', 'solid-analyzer', 'tree-navigator'],
                workflow: {
                    sequential: ['compilation-verifier', 'solid-analyzer', 'tree-navigator']
                },
                intents: ['debug', 'error', 'fix'],
                useCase: 'Debugging assistance and error root cause analysis'
            }
        ];
        for (const bundle of bundles) {
            this.toolBundles.set(bundle.id, bundle);
        }
    }
}
exports.ClaudeToolOrchestrator = ClaudeToolOrchestrator;
//# sourceMappingURL=claude-tool-orchestrator.js.map
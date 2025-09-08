"use strict";
/**
 * Intelligent Tool Selection System
 * Uses Claude Code to assess which tools should be used for each request
 * Similar to MCP client tool selection mechanism
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntelligentToolSelector = void 0;
const tool_interface_1 = require("./tool-interface");
const logger_1 = require("./logger");
class IntelligentToolSelector {
    logger;
    claudeCodeApiUrl;
    constructor() {
        this.logger = logger_1.Logger.getInstance();
        this.claudeCodeApiUrl = process.env.CLAUDE_CODE_API_URL || 'http://localhost:3007';
    }
    /**
     * Main tool selection method - uses Claude Code to intelligently select tools
     */
    async selectToolsForRequest(request) {
        this.logger.info(`🤖 Selecting tools for: "${request.userQuery}"`);
        try {
            // Get all available tools
            const allTools = tool_interface_1.ToolRegistry.getAllTools();
            const toolDescriptions = await this.generateToolDescriptions(allTools);
            // Check for bundle activation first
            const activatedBundle = await this.checkBundleActivation(request, toolDescriptions);
            // Use Claude Code to analyze and select tools
            const selectionPrompt = this.buildSelectionPrompt(request, toolDescriptions, activatedBundle);
            const claudeResponse = await this.callClaudeCodeAnalysis(selectionPrompt);
            // Parse Claude's response and build selection result
            const selectionResult = await this.parseToolSelectionResponse(claudeResponse, allTools, activatedBundle);
            this.logger.info(`✅ Selected ${selectionResult.selectedTools.length} tools with ${selectionResult.totalConfidence.toFixed(2)} confidence`);
            return selectionResult;
        }
        catch (error) {
            this.logger.error('❌ Tool selection failed:', error);
            // Fallback: select default tools
            const allTools = tool_interface_1.ToolRegistry.getAllTools();
            return this.getFallbackToolSelection(allTools);
        }
    }
    /**
     * Generate enriched descriptions for all tools
     */
    async generateToolDescriptions(tools) {
        return tools.map(tool => {
            const metadata = tool.getMetadata();
            // Create enriched description with capabilities and use cases
            const enrichedDescription = [
                `${metadata.name}: ${metadata.description}`,
                `Category: ${metadata.category}`,
                `Trust Level: ${metadata.trustLevel}/10`,
                `Capabilities: ${metadata.capabilities.join(', ')}`,
                `Best for: ${this.inferUseCases(metadata)}`,
                `Dependencies: ${metadata.dependencies?.join(', ') || 'none'}`
            ].join(' | ');
            return {
                tool,
                metadata,
                enrichedDescription
            };
        });
    }
    /**
     * Infer use cases based on tool metadata
     */
    inferUseCases(metadata) {
        const useCases = [];
        if (metadata.category === 'optimization') {
            useCases.push('performance improvements', 'code efficiency');
        }
        if (metadata.category === 'search') {
            useCases.push('code discovery', 'finding related components');
        }
        if (metadata.category === 'architecture') {
            useCases.push('design decisions', 'structural analysis');
        }
        if (metadata.category === 'quality') {
            useCases.push('code review', 'bug detection');
        }
        if (metadata.capabilities.includes('semantic-analysis')) {
            useCases.push('understanding code meaning', 'relationship mapping');
        }
        if (metadata.capabilities.includes('duplication-detection')) {
            useCases.push('refactoring opportunities', 'code consolidation');
        }
        return useCases.join(', ') || 'general code analysis';
    }
    /**
     * Check if any tool bundles should be activated
     */
    async checkBundleActivation(request, toolDescriptions) {
        const bundles = this.getToolBundles();
        for (const bundle of bundles) {
            const hasKeyword = bundle.activationKeywords.some(keyword => request.userQuery.toLowerCase().includes(keyword.toLowerCase()) ||
                request.cliCommand.toLowerCase().includes(keyword.toLowerCase()));
            if (hasKeyword) {
                this.logger.info(`🔗 Activated tool bundle: ${bundle.name}`);
                return bundle;
            }
        }
        return null;
    }
    /**
     * Build prompt for Claude Code tool selection
     */
    buildSelectionPrompt(request, toolDescriptions, activatedBundle) {
        return `
TASK: Intelligent Tool Selection for CodeMind CLI Request

USER REQUEST: "${request.userQuery}"
CLI COMMAND: ${request.cliCommand}
PROJECT PATH: ${request.projectPath}
INTENT: ${request.intent || 'general'}

AVAILABLE TOOLS:
${toolDescriptions.map((desc, i) => `${i + 1}. ${desc.enrichedDescription}`).join('\n')}

${activatedBundle ? `
ACTIVATED BUNDLE: ${activatedBundle.name}
- Description: ${activatedBundle.description}
- Required Tools: ${activatedBundle.requiredTools.join(', ')}
- Optional Tools: ${activatedBundle.optionalTools.join(', ')}
- Use Case: ${activatedBundle.useCase}
` : ''}

INSTRUCTIONS:
1. Analyze the user request and determine which tools would be most helpful
2. Consider the command context, intent, and any activated bundles
3. Select 2-5 tools that would provide the most value
4. Prioritize tools that complement each other
5. Ensure bundle requirements are met if a bundle is activated

RESPONSE FORMAT (JSON):
{
  "selectedTools": [
    {
      "toolName": "tool-name",
      "confidence": 0.95,
      "reasoning": "Why this tool is valuable for this request",
      "priority": 1
    }
  ],
  "totalConfidence": 0.87,
  "selectionReasoning": "Overall rationale for tool selection"
}

Focus on tools that will provide the most context and insights for the user's specific request.
`;
    }
    /**
     * Call Claude Code API for tool selection analysis
     */
    async callClaudeCodeAnalysis(prompt) {
        try {
            const response = await fetch(`${this.claudeCodeApiUrl}/api/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    maxTokens: 1500,
                    temperature: 0.3 // Lower temperature for more consistent selections
                })
            });
            if (!response.ok) {
                throw new Error(`Claude Code API error: ${response.status}`);
            }
            const result = await response.json();
            // Try to parse as JSON, fallback to text analysis
            try {
                return JSON.parse(result.analysis || result.response);
            }
            catch {
                return this.parseTextResponse(result.analysis || result.response);
            }
        }
        catch (error) {
            this.logger.warn('Claude Code API unavailable, using fallback selection');
            throw error;
        }
    }
    /**
     * Parse text response if JSON parsing fails
     */
    parseTextResponse(text) {
        // Simple fallback parsing for non-JSON responses
        const tools = [];
        const lines = text.split('\n');
        for (const line of lines) {
            if (line.includes('tool') && (line.includes('recommend') || line.includes('select'))) {
                // Extract tool names mentioned in the response
                const toolMatches = line.match(/(\w+[-]\w+)/g);
                if (toolMatches) {
                    toolMatches.forEach(toolName => {
                        tools.push({
                            toolName,
                            confidence: 0.7,
                            reasoning: 'Extracted from text analysis',
                            priority: tools.length + 1
                        });
                    });
                }
            }
        }
        return {
            selectedTools: tools,
            totalConfidence: 0.7,
            selectionReasoning: 'Parsed from text analysis due to API formatting'
        };
    }
    /**
     * Parse Claude's response into selection result
     */
    async parseToolSelectionResponse(claudeResponse, allTools, activatedBundle) {
        const selectedTools = [];
        for (const selection of claudeResponse.selectedTools || []) {
            const tool = allTools.find(t => t.getMetadata().name === selection.toolName);
            if (tool) {
                selectedTools.push({
                    tool,
                    metadata: tool.getMetadata(),
                    confidence: selection.confidence || 0.7,
                    reasoning: selection.reasoning || 'Selected by Claude Code analysis',
                    priority: selection.priority || 1
                });
            }
        }
        // Ensure bundle requirements are met
        if (activatedBundle) {
            for (const requiredToolName of activatedBundle.requiredTools) {
                const alreadySelected = selectedTools.some(s => s.metadata.name === requiredToolName);
                if (!alreadySelected) {
                    const tool = allTools.find(t => t.getMetadata().name === requiredToolName);
                    if (tool) {
                        selectedTools.push({
                            tool,
                            metadata: tool.getMetadata(),
                            confidence: 0.9,
                            reasoning: `Required by bundle: ${activatedBundle.name}`,
                            priority: 0 // High priority
                        });
                    }
                }
            }
        }
        // Sort by priority and confidence
        selectedTools.sort((a, b) => {
            if (a.priority !== b.priority)
                return a.priority - b.priority;
            return b.confidence - a.confidence;
        });
        return {
            selectedTools,
            bundleActivated: activatedBundle?.id,
            totalConfidence: claudeResponse.totalConfidence || 0.75,
            selectionReasoning: claudeResponse.selectionReasoning || 'Tools selected based on request analysis'
        };
    }
    /**
     * Fallback selection when Claude Code is unavailable
     */
    getFallbackToolSelection(allTools) {
        // Select most trusted, general-purpose tools
        const fallbackTools = allTools
            .filter(tool => {
            const metadata = tool.getMetadata();
            return metadata.trustLevel >= 8.0 &&
                ['optimization', 'search', 'architecture'].includes(metadata.category);
        })
            .slice(0, 3)
            .map(tool => ({
            tool,
            metadata: tool.getMetadata(),
            confidence: 0.6,
            reasoning: 'Fallback selection - high-trust general tools',
            priority: 1
        }));
        return {
            selectedTools: fallbackTools,
            totalConfidence: 0.6,
            selectionReasoning: 'Fallback selection due to Claude Code unavailability'
        };
    }
    /**
     * Get predefined tool bundles
     */
    getToolBundles() {
        return [
            {
                id: 'architecture-analysis',
                name: 'Architecture Analysis Bundle',
                description: 'Comprehensive architectural assessment and design guidance',
                requiredTools: ['context-optimizer', 'centralization-detector', 'semantic-search'],
                optionalTools: ['tree-navigator', 'solid-principles-analyzer'],
                activationKeywords: ['architecture', 'design', 'structure', 'refactor', 'organize'],
                priority: 9,
                useCase: 'When users need deep architectural insights and design recommendations'
            },
            {
                id: 'code-quality-audit',
                name: 'Code Quality Audit Bundle',
                description: 'Complete code quality assessment with improvement suggestions',
                requiredTools: ['duplication-detector', 'solid-principles-analyzer', 'compilation-verifier'],
                optionalTools: ['test-coverage-analyzer', 'documentation-analyzer'],
                activationKeywords: ['quality', 'audit', 'review', 'clean', 'improve', 'best practices'],
                priority: 8,
                useCase: 'For comprehensive code quality reviews and improvement guidance'
            },
            {
                id: 'performance-optimization',
                name: 'Performance Optimization Bundle',
                description: 'Tools focused on identifying and resolving performance issues',
                requiredTools: ['context-optimizer', 'duplication-detector'],
                optionalTools: ['centralization-detector', 'compilation-verifier'],
                activationKeywords: ['performance', 'optimize', 'slow', 'efficiency', 'speed'],
                priority: 8,
                useCase: 'When performance improvements are the primary concern'
            },
            {
                id: 'developer-experience',
                name: 'Developer Experience Bundle',
                description: 'Enhance developer productivity and code navigation',
                requiredTools: ['semantic-search', 'tree-navigator', 'documentation-analyzer'],
                optionalTools: ['ui-navigation-analyzer', 'test-mapping-analyzer'],
                activationKeywords: ['navigation', 'documentation', 'explore', 'understand', 'learn'],
                priority: 7,
                useCase: 'For improving developer onboarding and code comprehension'
            },
            {
                id: 'enterprise-compliance',
                name: 'Enterprise Compliance Bundle',
                description: 'Ensure code meets enterprise standards and compliance requirements',
                requiredTools: ['solid-principles-analyzer', 'compilation-verifier', 'test-coverage-analyzer'],
                optionalTools: ['documentation-analyzer', 'use-cases-analyzer'],
                activationKeywords: ['compliance', 'standards', 'enterprise', 'regulation', 'policy'],
                priority: 6,
                useCase: 'For enterprise environments requiring strict compliance and standards'
            }
        ];
    }
    /**
     * Get bundle by ID
     */
    getBundle(bundleId) {
        return this.getToolBundles().find(bundle => bundle.id === bundleId) || null;
    }
    /**
     * Get all available bundles
     */
    getAllBundles() {
        return this.getToolBundles();
    }
}
exports.IntelligentToolSelector = IntelligentToolSelector;
//# sourceMappingURL=intelligent-tool-selector.js.map
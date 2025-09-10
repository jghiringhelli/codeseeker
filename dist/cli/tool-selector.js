"use strict";
/**
 * Enhanced Tool Selector for CodeMind CLI
 * Integrates with Tool Bundle System for intelligent tool selection
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolSelector = void 0;
const logger_1 = require("../utils/logger");
const tool_bundle_system_1 = require("./tool-bundle-system");
class ToolSelector {
    logger = logger_1.Logger.getInstance();
    bundleSystem;
    availableTools = new Map();
    constructor() {
        this.bundleSystem = new tool_bundle_system_1.ToolBundleSystem();
        this.initializeAvailableTools();
    }
    /**
     * Initialize available tools registry
     */
    initializeAvailableTools() {
        const tools = [
            {
                id: 'semantic-graph',
                name: 'Semantic Graph Analyzer',
                description: 'Builds knowledge graph of code relationships and dependencies',
                category: 'analysis',
                parameters: { depth: 2, includeTypes: true },
                confidence: 0.95,
                estimatedTokens: 800
            },
            {
                id: 'centralization-detector',
                name: 'Centralization Detector',
                description: 'Identifies architectural patterns and centralization opportunities',
                category: 'architecture',
                parameters: { analysisDepth: 3 },
                confidence: 0.90,
                estimatedTokens: 600
            },
            {
                id: 'duplication-detector',
                name: 'Code Duplication Detector',
                description: 'Finds duplicate code blocks and suggests refactoring',
                category: 'quality',
                parameters: { minSimilarity: 0.8 },
                confidence: 0.88,
                estimatedTokens: 500
            },
            {
                id: 'tree-navigator',
                name: 'Tree Navigator',
                description: 'Provides intelligent code navigation and exploration paths',
                category: 'navigation',
                parameters: { maxDepth: 4 },
                confidence: 0.85,
                estimatedTokens: 400
            },
            {
                id: 'semantic-search',
                name: 'Semantic Search',
                description: 'Find similar code patterns using AI-powered semantic search',
                category: 'search',
                parameters: { threshold: 0.7, limit: 10 },
                confidence: 0.95,
                estimatedTokens: 600
            },
            {
                id: 'security-analyzer',
                name: 'Security Analyzer',
                description: 'Scans for security vulnerabilities and best practices',
                category: 'security',
                parameters: { includeRecommendations: true },
                confidence: 0.92,
                estimatedTokens: 700
            },
            {
                id: 'performance-analyzer',
                name: 'Performance Analyzer',
                description: 'Identifies performance bottlenecks and optimization opportunities',
                category: 'performance',
                parameters: { includeMetrics: true },
                confidence: 0.87,
                estimatedTokens: 650
            },
            {
                id: 'test-coverage-analyzer',
                name: 'Test Coverage Analyzer',
                description: 'Analyzes test coverage and suggests testing improvements',
                category: 'testing',
                parameters: { includeRecommendations: true },
                confidence: 0.90,
                estimatedTokens: 550
            },
            {
                id: 'documentation-analyzer',
                name: 'Documentation Analyzer',
                description: 'Evaluates documentation quality and suggests improvements',
                category: 'documentation',
                parameters: { includeGaps: true },
                confidence: 0.83,
                estimatedTokens: 450
            },
            {
                id: 'dependency-analyzer',
                name: 'Dependency Analyzer',
                description: 'Analyzes project dependencies and identifies issues',
                category: 'dependencies',
                parameters: { checkVersions: true },
                confidence: 0.89,
                estimatedTokens: 500
            },
            {
                id: 'solid-principles-analyzer',
                name: 'SOLID Principles Analyzer',
                description: 'Evaluates code against SOLID design principles',
                category: 'architecture',
                parameters: { detailedAnalysis: true },
                confidence: 0.86,
                estimatedTokens: 600
            },
            {
                id: 'code-complexity-analyzer',
                name: 'Code Complexity Analyzer',
                description: 'Measures code complexity and suggests simplifications',
                category: 'quality',
                parameters: { includeMetrics: true },
                confidence: 0.84,
                estimatedTokens: 450
            },
            {
                id: 'use-case-analyzer',
                name: 'Use Case Analyzer',
                description: 'Identifies and documents use cases and user flows',
                category: 'analysis',
                parameters: { includeFlows: true },
                confidence: 0.80,
                estimatedTokens: 500
            },
            {
                id: 'test-mapping-analyzer',
                name: 'Test Mapping Analyzer',
                description: 'Maps tests to code and identifies testing gaps',
                category: 'testing',
                parameters: { includeGaps: true },
                confidence: 0.85,
                estimatedTokens: 500
            },
            {
                id: 'code-pattern-analyzer',
                name: 'Code Pattern Analyzer',
                description: 'Identifies and analyzes code patterns and anti-patterns',
                category: 'architecture',
                parameters: { includeAntiPatterns: true },
                confidence: 0.87,
                estimatedTokens: 550
            }
        ];
        tools.forEach(tool => {
            this.availableTools.set(tool.id, tool);
        });
        this.logger.info(`Initialized ${tools.length} available tools`);
    }
    /**
     * Select tools based on context, with bundle system integration
     */
    selectTools(context) {
        const { userQuery, preferBundles = true, maxTokens = 2000 } = context;
        this.logger.info(`Selecting tools for query: "${userQuery}"`);
        let selectedTools = [];
        let selectedBundles = [];
        let reasoning = '';
        let executionStrategy = 'sequential';
        // First, try bundle-based selection if preferred
        if (preferBundles) {
            const bundleContext = {
                userQuery: context.userQuery,
                projectType: context.projectType,
                intent: context.intent,
                codebaseSize: context.codebaseSize,
                previousBundles: [] // Could track this in the future
            };
            selectedBundles = this.bundleSystem.selectBundles(bundleContext);
            if (selectedBundles.length > 0) {
                // Use the best bundle's tools
                const bestBundle = selectedBundles[0];
                selectedTools = bestBundle.tools
                    .map(toolId => this.availableTools.get(toolId))
                    .filter((tool) => tool !== undefined);
                reasoning = `Selected bundle "${bestBundle.name}" with ${selectedTools.length} tools: ${selectedTools.map(t => t.name).join(', ')}`;
                executionStrategy = selectedTools.length > 3 ? 'hybrid' : 'sequential';
            }
        }
        // If no bundles selected or bundle selection disabled, use individual tool selection
        if (selectedTools.length === 0) {
            selectedTools = this.selectIndividualTools(context);
            reasoning = `Individual tool selection: ${selectedTools.map(t => t.name).join(', ')}`;
            executionStrategy = 'sequential';
        }
        // Apply token budget constraints
        const totalTokens = selectedTools.reduce((sum, tool) => sum + tool.estimatedTokens, 0);
        if (totalTokens > maxTokens) {
            selectedTools = this.optimizeForTokenBudget(selectedTools, maxTokens);
            reasoning += ` (optimized for ${maxTokens} token budget)`;
        }
        // Calculate overall confidence
        const avgConfidence = selectedTools.length > 0
            ? selectedTools.reduce((sum, tool) => sum + tool.confidence, 0) / selectedTools.length
            : 0;
        const result = {
            selectedTools,
            selectedBundles,
            confidence: avgConfidence,
            reasoning,
            estimatedTokens: selectedTools.reduce((sum, tool) => sum + tool.estimatedTokens, 0),
            executionStrategy
        };
        this.logger.info(`Selected ${selectedTools.length} tools (${result.estimatedTokens} estimated tokens)`);
        return result;
    }
    /**
     * Select individual tools based on context
     */
    selectIndividualTools(context) {
        const { userQuery, intent, codebaseSize } = context;
        const queryLower = userQuery.toLowerCase();
        const candidates = [];
        for (const tool of this.availableTools.values()) {
            let score = 0;
            // Keyword matching in query
            const nameWords = tool.name.toLowerCase().split(' ');
            const descWords = tool.description.toLowerCase().split(' ');
            nameWords.forEach(word => {
                if (queryLower.includes(word) && word.length > 3) {
                    score += 3;
                }
            });
            descWords.forEach(word => {
                if (queryLower.includes(word) && word.length > 4) {
                    score += 1;
                }
            });
            // Intent-based scoring
            if (intent) {
                const intentToolMapping = {
                    'overview': ['semantic-graph', 'tree-navigator', 'centralization-detector'],
                    'refactor': ['duplication-detector', 'solid-principles-analyzer', 'centralization-detector'],
                    'debug': ['semantic-graph', 'dependency-analyzer', 'test-coverage-analyzer'],
                    'optimize': ['performance-analyzer', 'code-complexity-analyzer', 'dependency-analyzer'],
                    'analyze': ['semantic-graph', 'centralization-detector', 'use-case-analyzer'],
                    'quality': ['duplication-detector', 'test-coverage-analyzer', 'code-complexity-analyzer'],
                    'security': ['security-analyzer', 'dependency-analyzer', 'code-pattern-analyzer']
                };
                if (intentToolMapping[intent]?.includes(tool.id)) {
                    score += 5;
                }
            }
            // Category-based scoring
            const categoryKeywords = {
                'analysis': ['analyze', 'analysis', 'understand', 'overview'],
                'quality': ['quality', 'clean', 'improve', 'fix', 'refactor'],
                'architecture': ['architecture', 'design', 'structure', 'patterns'],
                'performance': ['performance', 'optimize', 'speed', 'bottleneck'],
                'security': ['security', 'vulnerability', 'secure', 'audit'],
                'testing': ['test', 'testing', 'coverage', 'unit test'],
                'documentation': ['document', 'docs', 'comment', 'readme']
            };
            const categoryWords = categoryKeywords[tool.category] || [];
            categoryWords.forEach(keyword => {
                if (queryLower.includes(keyword)) {
                    score += 2;
                }
            });
            // Base confidence boost
            score += tool.confidence * 2;
            // Codebase size consideration
            if (codebaseSize === 'large' && ['semantic-graph', 'centralization-detector', 'dependency-analyzer'].includes(tool.id)) {
                score += 1;
            }
            else if (codebaseSize === 'small' && ['tree-navigator', 'use-case-analyzer'].includes(tool.id)) {
                score += 1;
            }
            // Avoid recently used tools (slight penalty)
            if (context.previousTools?.includes(tool.id)) {
                score -= 0.5;
            }
            if (score > 0) {
                candidates.push({ tool, score });
            }
        }
        // Sort by score and return top tools
        candidates.sort((a, b) => b.score - a.score);
        // Return top 2-4 tools based on complexity
        const maxTools = codebaseSize === 'large' ? 4 : 3;
        return candidates.slice(0, maxTools).map(c => c.tool);
    }
    /**
     * Optimize tool selection for token budget
     */
    optimizeForTokenBudget(tools, maxTokens) {
        // Sort by efficiency (confidence per token)
        const sorted = tools
            .map(tool => ({
            tool,
            efficiency: tool.confidence / tool.estimatedTokens
        }))
            .sort((a, b) => b.efficiency - a.efficiency);
        const optimized = [];
        let totalTokens = 0;
        for (const { tool } of sorted) {
            if (totalTokens + tool.estimatedTokens <= maxTokens) {
                optimized.push(tool);
                totalTokens += tool.estimatedTokens;
            }
        }
        return optimized;
    }
    /**
     * Get all available tools
     */
    getAvailableTools() {
        return Array.from(this.availableTools.values());
    }
    /**
     * Get tool by ID
     */
    getTool(id) {
        return this.availableTools.get(id);
    }
    /**
     * Get available bundles
     */
    getAvailableBundles() {
        return this.bundleSystem.getBundles();
    }
    /**
     * Create a custom tool bundle
     */
    createToolBundle(bundle) {
        return this.bundleSystem.createBundle(bundle);
    }
    /**
     * Update bundle statistics after execution
     */
    updateBundleStats(bundleId, success) {
        this.bundleSystem.updateBundleStats(bundleId, success);
    }
    /**
     * Get bundle usage statistics
     */
    getBundleStats() {
        return this.bundleSystem.getBundleStats();
    }
}
exports.ToolSelector = ToolSelector;
exports.default = ToolSelector;
//# sourceMappingURL=tool-selector.js.map
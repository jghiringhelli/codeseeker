"use strict";
/**
 * Tool Bundle System for CodeMind CLI
 * Defines sets of tools for common scenarios to improve tool selection
 */
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
exports.ToolBundleSystem = void 0;
const logger_1 = require("../utils/logger");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class ToolBundleSystem {
    logger = logger_1.Logger.getInstance();
    bundles = new Map();
    bundleUsageStats = new Map();
    constructor() {
        this.initializeDefaultBundles();
        this.loadCustomBundles();
    }
    /**
     * Initialize default tool bundles for common scenarios
     */
    initializeDefaultBundles() {
        const defaultBundles = [
            {
                id: 'architecture-analysis',
                name: 'Architecture Analysis',
                description: 'Comprehensive architectural understanding and design pattern analysis',
                category: 'architecture',
                tools: ['semantic-graph', 'centralization-detector', 'solid-principles-analyzer', 'dependency-analyzer'],
                parameters: { depth: 3, includePatterns: true },
                confidence: 0.95,
                useCases: ['refactor', 'architecture review', 'design patterns', 'system understanding'],
                priority: 9
            },
            {
                id: 'code-quality-audit',
                name: 'Code Quality Audit',
                description: 'Complete code quality assessment including duplication and test coverage',
                category: 'quality',
                tools: ['duplication-detector', 'test-coverage-analyzer', 'code-complexity-analyzer', 'documentation-analyzer'],
                parameters: { includeTests: true, detailedReport: true },
                confidence: 0.92,
                useCases: ['code review', 'quality improvement', 'technical debt', 'cleanup'],
                priority: 8
            },
            {
                id: 'performance-optimization',
                name: 'Performance Optimization',
                description: 'Performance bottleneck identification and optimization suggestions',
                category: 'performance',
                tools: ['performance-analyzer', 'semantic-graph', 'dependency-analyzer'],
                parameters: { includeMetrics: true, benchmarking: true },
                confidence: 0.88,
                useCases: ['optimization', 'performance issues', 'slow code', 'bottlenecks'],
                priority: 7
            },
            {
                id: 'security-assessment',
                name: 'Security Assessment',
                description: 'Security vulnerability detection and best practices validation',
                category: 'security',
                tools: ['security-analyzer', 'dependency-analyzer', 'code-pattern-analyzer'],
                parameters: { includeVulnerabilities: true, checkDependencies: true },
                confidence: 0.90,
                useCases: ['security audit', 'vulnerability scan', 'security review', 'compliance'],
                priority: 8
            },
            {
                id: 'developer-experience',
                name: 'Developer Experience',
                description: 'Code navigation, understanding, and development workflow improvement',
                category: 'development',
                tools: ['tree-navigator', 'semantic-graph', 'documentation-analyzer', 'use-case-analyzer'],
                parameters: { includeNavigation: true, generateDocs: true },
                confidence: 0.85,
                useCases: ['onboarding', 'code navigation', 'understanding', 'documentation'],
                priority: 6
            },
            {
                id: 'testing-strategy',
                name: 'Testing Strategy',
                description: 'Test coverage analysis and testing improvement recommendations',
                category: 'quality',
                tools: ['test-coverage-analyzer', 'test-mapping-analyzer', 'semantic-graph'],
                parameters: { includeUncovered: true, suggestTests: true },
                confidence: 0.87,
                useCases: ['testing', 'test coverage', 'test improvement', 'quality assurance'],
                priority: 7
            },
            {
                id: 'quick-overview',
                name: 'Quick Overview',
                description: 'Fast project overview for initial understanding',
                category: 'analysis',
                tools: ['semantic-graph', 'centralization-detector'],
                parameters: { depth: 1, quickScan: true },
                confidence: 0.80,
                useCases: ['overview', 'quick scan', 'initial understanding', 'summary'],
                priority: 5
            },
            {
                id: 'deep-analysis',
                name: 'Deep Analysis',
                description: 'Comprehensive multi-tool analysis for complex projects',
                category: 'analysis',
                tools: ['semantic-graph', 'centralization-detector', 'duplication-detector', 'dependency-analyzer', 'solid-principles-analyzer'],
                parameters: { depth: 4, comprehensive: true },
                confidence: 0.93,
                useCases: ['complex analysis', 'comprehensive review', 'full audit', 'detailed understanding'],
                priority: 9
            }
        ];
        defaultBundles.forEach(bundle => {
            this.bundles.set(bundle.id, bundle);
            this.bundleUsageStats.set(bundle.id, { uses: 0, successRate: 0.0 });
        });
        this.logger.info(`Initialized ${defaultBundles.length} default tool bundles`);
    }
    /**
     * Load custom bundles from configuration files
     */
    loadCustomBundles() {
        const customBundlesPath = path.join(process.cwd(), 'config', 'tool-bundles.json');
        try {
            if (fs.existsSync(customBundlesPath)) {
                const customBundles = JSON.parse(fs.readFileSync(customBundlesPath, 'utf-8'));
                customBundles.forEach((bundle) => {
                    this.bundles.set(bundle.id, bundle);
                    this.bundleUsageStats.set(bundle.id, { uses: 0, successRate: 0.0 });
                });
                this.logger.info(`Loaded ${customBundles.length} custom tool bundles`);
            }
        }
        catch (error) {
            this.logger.warn('Failed to load custom tool bundles:', error);
        }
    }
    /**
     * Select appropriate tool bundles based on context
     */
    selectBundles(context) {
        const { userQuery, projectType, intent, codebaseSize } = context;
        const queryLower = userQuery.toLowerCase();
        const candidates = [];
        for (const bundle of this.bundles.values()) {
            let score = 0;
            // Use case matching
            const matchingUseCases = bundle.useCases.filter(useCase => queryLower.includes(useCase.toLowerCase()));
            score += matchingUseCases.length * 2;
            // Intent matching
            if (intent) {
                const intentMatch = bundle.useCases.some(useCase => useCase.toLowerCase().includes(intent.toLowerCase()) ||
                    intent.toLowerCase().includes(useCase.toLowerCase()));
                if (intentMatch)
                    score += 3;
            }
            // Category matching based on keywords
            const categoryKeywords = this.getCategoryKeywords(bundle.category);
            const keywordMatches = categoryKeywords.filter(keyword => queryLower.includes(keyword)).length;
            score += keywordMatches * 1.5;
            // Project size consideration
            if (codebaseSize === 'large' && bundle.tools.length > 3) {
                score += 1; // Prefer comprehensive bundles for large projects
            }
            else if (codebaseSize === 'small' && bundle.tools.length <= 2) {
                score += 1; // Prefer lightweight bundles for small projects
            }
            // Base confidence and priority
            score += bundle.confidence * 2;
            score += bundle.priority * 0.5;
            // Usage success rate bonus
            const stats = this.bundleUsageStats.get(bundle.id);
            if (stats && stats.uses > 0) {
                score += stats.successRate * 1.5;
            }
            // Avoid recently used bundles (slight penalty)
            if (context.previousBundles?.includes(bundle.id)) {
                score -= 0.5;
            }
            if (score > 0) {
                candidates.push({ bundle, score });
            }
        }
        // Sort by score and return top bundles
        candidates.sort((a, b) => b.score - a.score);
        // Return top 3 bundles, but ensure at least one if any candidates exist
        const maxBundles = Math.min(3, candidates.length);
        const selectedBundles = candidates.slice(0, maxBundles).map(c => c.bundle);
        this.logger.info(`Selected ${selectedBundles.length} bundles for query: "${userQuery}"`);
        selectedBundles.forEach(bundle => {
            this.logger.debug(`- ${bundle.name} (${bundle.tools.join(', ')})`);
        });
        return selectedBundles;
    }
    /**
     * Get category-specific keywords for matching
     */
    getCategoryKeywords(category) {
        const keywords = {
            'analysis': ['analyze', 'analysis', 'understand', 'overview', 'examine'],
            'quality': ['quality', 'clean', 'improve', 'fix', 'refactor', 'review'],
            'architecture': ['architecture', 'design', 'structure', 'patterns', 'organize'],
            'performance': ['performance', 'optimize', 'slow', 'speed', 'bottleneck', 'efficiency'],
            'security': ['security', 'vulnerability', 'secure', 'audit', 'compliance', 'risk'],
            'development': ['develop', 'coding', 'workflow', 'experience', 'navigation', 'docs']
        };
        return keywords[category] || [];
    }
    /**
     * Execute a tool bundle (placeholder - actual execution handled by CLI)
     */
    async executeBundle(bundleId, projectPath) {
        const bundle = this.bundles.get(bundleId);
        if (!bundle) {
            throw new Error(`Bundle not found: ${bundleId}`);
        }
        const startTime = Date.now();
        // This is a placeholder - actual tool execution would be handled by the CLI
        // The bundle system just defines which tools to run and their parameters
        const result = {
            bundleId,
            success: false,
            results: {},
            tokensUsed: 0,
            executionTime: Date.now() - startTime,
            errors: ['Bundle execution should be handled by CLI tool selector']
        };
        // Update usage stats
        const stats = this.bundleUsageStats.get(bundleId);
        stats.uses++;
        this.logger.info(`Bundle execution placeholder for: ${bundle.name}`);
        return result;
    }
    /**
     * Create a custom tool bundle
     */
    createBundle(bundle) {
        const id = this.generateBundleId(bundle.name);
        const fullBundle = { ...bundle, id };
        this.bundles.set(id, fullBundle);
        this.bundleUsageStats.set(id, { uses: 0, successRate: 0.0 });
        this.logger.info(`Created custom bundle: ${fullBundle.name} (${id})`);
        return id;
    }
    /**
     * Get all available bundles
     */
    getBundles() {
        return Array.from(this.bundles.values());
    }
    /**
     * Get bundle by ID
     */
    getBundle(id) {
        return this.bundles.get(id);
    }
    /**
     * Update bundle success rate based on execution results
     */
    updateBundleStats(bundleId, success) {
        const stats = this.bundleUsageStats.get(bundleId);
        if (stats) {
            const totalExecutions = stats.uses;
            const currentSuccesses = stats.successRate * stats.uses;
            const newSuccesses = success ? currentSuccesses + 1 : currentSuccesses;
            stats.successRate = totalExecutions > 0 ? newSuccesses / totalExecutions : 0;
        }
    }
    /**
     * Get bundle usage statistics
     */
    getBundleStats() {
        return Object.fromEntries(this.bundleUsageStats.entries());
    }
    /**
     * Generate a unique bundle ID from name
     */
    generateBundleId(name) {
        const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const timestamp = Date.now().toString(36);
        return `${base}-${timestamp}`;
    }
    /**
     * Export bundle configuration for persistence
     */
    exportBundles() {
        return this.getBundles();
    }
    /**
     * Save custom bundles to configuration file
     */
    saveCustomBundles() {
        const configDir = path.join(process.cwd(), 'config');
        const configPath = path.join(configDir, 'tool-bundles.json');
        try {
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }
            const customBundles = this.getBundles().filter(bundle => !bundle.id.startsWith('architecture-') &&
                !bundle.id.startsWith('code-quality-') &&
                !bundle.id.startsWith('performance-') &&
                !bundle.id.startsWith('security-') &&
                !bundle.id.startsWith('developer-') &&
                !bundle.id.startsWith('testing-') &&
                !bundle.id.startsWith('quick-') &&
                !bundle.id.startsWith('deep-'));
            fs.writeFileSync(configPath, JSON.stringify(customBundles, null, 2));
            this.logger.info(`Saved ${customBundles.length} custom bundles to ${configPath}`);
        }
        catch (error) {
            this.logger.error('Failed to save custom bundles:', error);
        }
    }
}
exports.ToolBundleSystem = ToolBundleSystem;
exports.default = ToolBundleSystem;
//# sourceMappingURL=tool-bundle-system.js.map
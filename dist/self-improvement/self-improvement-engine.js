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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelfImprovementEngine = void 0;
const path = __importStar(require("path"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const detector_1 = require("../features/duplication/detector");
const navigator_1 = require("../features/tree-navigation/navigator");
const search_engine_1 = require("../features/vector-search/search-engine");
const detector_2 = require("../features/centralization/detector");
const context_optimizer_1 = require("../cli/context-optimizer");
const logger_1 = require("../utils/logger");
const events_1 = require("events");
/**
 * Self-Improvement Engine
 *
 * Uses CodeMind's own features to improve its codebase systematically.
 * Implements the "dogfooding strategy" from Phase 2 requirements.
 */
class SelfImprovementEngine extends events_1.EventEmitter {
    logger = logger_1.Logger.getInstance();
    db;
    projectPath;
    // Our own tools
    duplicationDetector;
    treeNavigator;
    vectorSearch;
    centralizationDetector;
    contextOptimizer;
    constructor(projectPath, dbPath) {
        super();
        this.projectPath = projectPath || path.join(__dirname, '..', '..');
        const databasePath = dbPath || path.join(this.projectPath, 'codemind.db');
        this.db = new better_sqlite3_1.default(databasePath);
        this.db.pragma('journal_mode = WAL');
        // Initialize our own tools
        this.duplicationDetector = new detector_1.DuplicationDetector();
        this.treeNavigator = new navigator_1.TreeNavigator();
        this.vectorSearch = new search_engine_1.VectorSearch();
        this.centralizationDetector = new detector_2.CentralizationDetector();
        this.contextOptimizer = new context_optimizer_1.ContextOptimizer();
    }
    /**
     * Run complete self-improvement cycle
     */
    async runSelfImprovement() {
        this.logger.info('Starting self-improvement cycle on CodeMind codebase...');
        const report = {
            timestamp: new Date(),
            improvements: [],
            metrics: {
                before: {},
                after: {}
            },
            recommendations: []
        };
        try {
            // Step 1: Analyze our own code for duplications
            const duplications = await this.findAndFixDuplications();
            report.improvements.push(...duplications);
            // Step 2: Optimize our dependency tree
            const dependencies = await this.optimizeDependencies();
            report.improvements.push(...dependencies);
            // Step 3: Find similar implementations using vector search
            const similarities = await this.consolidateSimilarCode();
            report.improvements.push(...similarities);
            // Step 4: Centralize scattered configurations
            const centralizations = await this.centralizeConfigurations();
            report.improvements.push(...centralizations);
            // Step 5: Optimize our own context windows
            const contextOptimizations = await this.optimizeOwnContext();
            report.improvements.push(...contextOptimizations);
            // Calculate metrics
            report.metrics = await this.calculateMetrics(report.improvements);
            // Generate recommendations
            report.recommendations = await this.generateRecommendations(report);
            // Save to database
            await this.saveImprovements(report);
            this.emit('self-improvement:completed', report);
        }
        catch (error) {
            this.logger.error('Self-improvement cycle failed', error);
            this.emit('self-improvement:failed', error);
            throw error;
        }
        return report;
    }
    /**
     * Find and suggest fixes for code duplications in our codebase
     */
    async findAndFixDuplications() {
        this.logger.info('Analyzing CodeMind for code duplications...');
        const improvements = [];
        const results = await this.duplicationDetector.findDuplicates({
            projectPath: this.projectPath,
            includeSemantic: true,
            similarityThreshold: 0.8,
            includeRefactoringSuggestions: true,
            filePatterns: ['src/**/*.ts', 'src/**/*.js'],
            excludePatterns: ['**/node_modules/**', '**/dist/**', '**/*.test.ts']
        });
        for (const group of results.duplicates) {
            if (group.refactoring) {
                const improvement = {
                    type: 'duplication_removed',
                    feature: 'duplication_detection',
                    target: group.locations[0].file,
                    description: `Found ${group.locations.length} duplicates with ${group.similarity}% similarity`,
                    suggestion: group.refactoring.description,
                    estimatedEffort: group.refactoring.estimatedEffort.level,
                    benefit: this.calculateDuplicationBenefit(group),
                    status: 'identified',
                    metadata: {
                        duplicateCount: group.locations.length,
                        linesAffected: group.metadata.linesOfCode,
                        similarityScore: group.similarity,
                        refactoringApproach: group.refactoring.approach
                    }
                };
                improvements.push(improvement);
            }
        }
        this.logger.info(`Found ${improvements.length} duplication improvements`);
        return improvements;
    }
    /**
     * Optimize dependency tree and find circular dependencies
     */
    async optimizeDependencies() {
        this.logger.info('Analyzing CodeMind dependency tree...');
        const improvements = [];
        const tree = await this.treeNavigator.buildDependencyTree({
            projectPath: this.projectPath,
            filePattern: 'src/**/*.ts',
            showDependencies: true,
            circularOnly: false,
            maxDepth: 10
        });
        // Check for circular dependencies
        for (const circular of tree.circularDependencies) {
            const improvement = {
                type: 'dependency_optimized',
                feature: 'tree_navigation',
                target: circular.path[0],
                description: `Circular dependency: ${circular.path.join(' → ')}`,
                suggestion: `Break circular dependency by introducing an interface or moving shared code to a separate module`,
                estimatedEffort: 'medium',
                benefit: 8, // Circular dependencies are high priority
                status: 'identified',
                metadata: {
                    dependencyPath: circular.path,
                    severity: circular.severity
                }
            };
            improvements.push(improvement);
        }
        // Check for overly complex modules (too many dependencies)
        const complexityThreshold = 15;
        for (const [nodeId, node] of tree.nodes) {
            if (node.children.length > complexityThreshold) {
                const improvement = {
                    type: 'dependency_optimized',
                    feature: 'tree_navigation',
                    target: node.path,
                    description: `High complexity: ${node.children.length} dependencies`,
                    suggestion: `Consider splitting this module to reduce coupling`,
                    estimatedEffort: 'high',
                    benefit: 6,
                    status: 'identified',
                    metadata: {
                        dependencyCount: node.children.length,
                        complexity: node.complexity
                    }
                };
                improvements.push(improvement);
            }
        }
        this.logger.info(`Found ${improvements.length} dependency improvements`);
        return improvements;
    }
    /**
     * Find and consolidate similar code using vector search
     */
    async consolidateSimilarCode() {
        this.logger.info('Finding similar code patterns in CodeMind...');
        const improvements = [];
        // Search for common patterns we might want to consolidate
        const patterns = [
            'error handling',
            'logging setup',
            'database connection',
            'file reading',
            'AST parsing',
            'configuration loading'
        ];
        for (const pattern of patterns) {
            const results = await this.vectorSearch.search({
                query: pattern,
                projectPath: this.projectPath,
                limit: 10,
                crossProject: false,
                useSemanticSearch: true,
                similarityThreshold: 0.7
            });
            // Group similar matches
            const similarGroups = this.groupSimilarMatches(results.matches);
            for (const group of similarGroups) {
                if (group.length > 2) { // Only suggest if 3+ similar implementations
                    const improvement = {
                        type: 'pattern_applied',
                        feature: 'vector_search',
                        target: group[0].file,
                        description: `Found ${group.length} similar implementations of "${pattern}"`,
                        suggestion: `Extract common ${pattern} logic to a shared utility`,
                        estimatedEffort: 'medium',
                        benefit: group.length * 2, // More duplicates = higher benefit
                        status: 'identified',
                        metadata: {
                            pattern,
                            similarFiles: group.map(m => m.file),
                            averageSimilarity: group.reduce((sum, m) => sum + m.similarity, 0) / group.length
                        }
                    };
                    improvements.push(improvement);
                }
            }
        }
        this.logger.info(`Found ${improvements.length} similarity improvements`);
        return improvements;
    }
    /**
     * Centralize scattered configurations
     */
    async centralizeConfigurations() {
        this.logger.info('Finding scattered configurations in CodeMind...');
        const improvements = [];
        const results = await this.centralizationDetector.scanProject({
            projectPath: this.projectPath,
            includeMigrationPlan: true,
            includeRiskAssessment: true,
            minOccurrences: 2
        });
        for (const opportunity of results.opportunities) {
            if (opportunity.benefitScore > 5) { // Only high-benefit centralizations
                const improvement = {
                    type: 'config_centralized',
                    feature: 'centralization_detection',
                    target: opportunity.scatteredLocations[0].file,
                    description: `${opportunity.configType} scattered across ${opportunity.scatteredLocations.length} files`,
                    suggestion: opportunity.migrationPlan?.description || 'Centralize configuration',
                    estimatedEffort: this.mapComplexityToEffort(opportunity.complexityScore),
                    benefit: opportunity.benefitScore,
                    status: 'identified',
                    metadata: {
                        configType: opportunity.configType,
                        locations: opportunity.scatteredLocations.map(l => l.file),
                        consolidationTarget: opportunity.consolidationTarget
                    }
                };
                improvements.push(improvement);
            }
        }
        this.logger.info(`Found ${improvements.length} centralization improvements`);
        return improvements;
    }
    /**
     * Optimize our own context windows for better Claude interactions
     */
    async optimizeOwnContext() {
        this.logger.info('Optimizing CodeMind context windows...');
        const improvements = [];
        // Analyze our own codebase for context optimization
        const analysis = await this.contextOptimizer.analyzeProject({
            projectPath: this.projectPath,
            tokenBudget: 8000
        });
        // Check if our files are too large for optimal context
        const largeFiles = analysis.files?.filter((f) => f.tokenCount > 2000) || [];
        for (const file of largeFiles) {
            const improvement = {
                type: 'context_optimized',
                feature: 'context_optimization',
                target: file.path,
                description: `File too large for optimal context (${file.tokenCount} tokens)`,
                suggestion: `Split into smaller modules or extract interfaces`,
                estimatedEffort: 'medium',
                benefit: 5,
                status: 'identified',
                metadata: {
                    currentTokens: file.tokenCount,
                    targetTokens: 1500,
                    reduction: file.tokenCount - 1500
                }
            };
            improvements.push(improvement);
        }
        this.logger.info(`Found ${improvements.length} context improvements`);
        return improvements;
    }
    /**
     * Group similar search matches
     */
    groupSimilarMatches(matches) {
        const groups = [];
        const used = new Set();
        for (let i = 0; i < matches.length; i++) {
            if (used.has(i))
                continue;
            const group = [matches[i]];
            used.add(i);
            for (let j = i + 1; j < matches.length; j++) {
                if (used.has(j))
                    continue;
                // Simple grouping by file similarity
                if (this.areSimilarFiles(matches[i], matches[j])) {
                    group.push(matches[j]);
                    used.add(j);
                }
            }
            groups.push(group);
        }
        return groups;
    }
    areSimilarFiles(match1, match2) {
        // Simple heuristic: similar if in same directory or have similar names
        const dir1 = path.dirname(match1.file);
        const dir2 = path.dirname(match2.file);
        return dir1 === dir2 || match1.similarity > 0.8;
    }
    calculateDuplicationBenefit(group) {
        // Higher benefit for more duplicates and larger code blocks
        const duplicateScore = Math.min(group.locations.length * 2, 10);
        const sizeScore = Math.min(group.metadata.linesOfCode / 10, 5);
        return Math.round(duplicateScore + sizeScore);
    }
    mapComplexityToEffort(complexity) {
        if (complexity < 3)
            return 'low';
        if (complexity < 7)
            return 'medium';
        return 'high';
    }
    /**
     * Calculate before/after metrics
     */
    async calculateMetrics(improvements) {
        const metrics = {
            before: {
                totalDuplications: 0,
                circularDependencies: 0,
                scatteredConfigs: 0,
                averageFileSize: 0,
                totalComplexity: 0
            },
            after: {
                totalDuplications: 0,
                circularDependencies: 0,
                scatteredConfigs: 0,
                averageFileSize: 0,
                totalComplexity: 0
            }
        };
        // Calculate current metrics
        for (const improvement of improvements) {
            if (improvement.type === 'duplication_removed') {
                metrics.before.totalDuplications += improvement.metadata?.duplicateCount || 0;
            }
            else if (improvement.type === 'dependency_optimized' && improvement.metadata?.dependencyPath) {
                metrics.before.circularDependencies++;
            }
            else if (improvement.type === 'config_centralized') {
                metrics.before.scatteredConfigs += improvement.metadata?.locations?.length || 0;
            }
        }
        // Estimate after metrics (if all improvements applied)
        metrics.after = {
            totalDuplications: Math.max(0, metrics.before.totalDuplications - improvements.filter(i => i.type === 'duplication_removed').length),
            circularDependencies: 0, // All would be fixed
            scatteredConfigs: 0, // All would be centralized
            averageFileSize: metrics.before.averageFileSize * 0.8, // Estimate 20% reduction
            totalComplexity: metrics.before.totalComplexity * 0.7 // Estimate 30% reduction
        };
        return metrics;
    }
    /**
     * Generate recommendations based on analysis
     */
    async generateRecommendations(report) {
        const recommendations = [];
        // Count improvements by type
        const byType = report.improvements.reduce((acc, imp) => {
            acc[imp.type] = (acc[imp.type] || 0) + 1;
            return acc;
        }, {});
        // Generate recommendations based on findings
        if (byType.duplication_removed > 5) {
            recommendations.push('Consider creating a shared utilities module to reduce duplication');
        }
        if (byType.dependency_optimized > 0) {
            recommendations.push('Review module boundaries and consider dependency injection');
        }
        if (byType.config_centralized > 3) {
            recommendations.push('Implement a centralized configuration management system');
        }
        if (byType.context_optimized > 0) {
            recommendations.push('Split large files into smaller, focused modules');
        }
        // Priority recommendation
        const highPriority = report.improvements.filter(i => i.benefit > 7);
        if (highPriority.length > 0) {
            recommendations.push(`Focus on ${highPriority.length} high-priority improvements first`);
        }
        return recommendations;
    }
    /**
     * Save improvements to database
     */
    async saveImprovements(report) {
        const stmt = this.db.prepare(`
      INSERT INTO self_improvement (
        feature_used, target_file, improvement_type,
        before_state, after_state, metrics_before, metrics_after,
        improvement_score, applied_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const transaction = this.db.transaction((improvements) => {
            for (const improvement of improvements) {
                stmt.run(improvement.feature, improvement.target, improvement.type, JSON.stringify(improvement.metadata), null, // after_state - will be updated when applied
                JSON.stringify(report.metrics.before), JSON.stringify(report.metrics.after), improvement.benefit, 'self-improvement-engine');
            }
        });
        transaction(report.improvements);
        this.logger.info(`Saved ${report.improvements.length} improvements to database`);
    }
    /**
     * Apply a specific improvement (with user confirmation)
     */
    async applyImprovement(improvement) {
        this.logger.info(`Applying improvement: ${improvement.description}`);
        // This would integrate with actual refactoring tools
        // For now, we just mark it as applied in the database
        const stmt = this.db.prepare(`
      UPDATE self_improvement 
      SET after_state = ?, applied_by = 'self-improvement-engine'
      WHERE target_file = ? AND improvement_type = ? AND after_state IS NULL
    `);
        const result = stmt.run(JSON.stringify({ applied: true, timestamp: new Date() }), improvement.target, improvement.type);
        return result.changes > 0;
    }
    close() {
        this.db.close();
    }
}
exports.SelfImprovementEngine = SelfImprovementEngine;
exports.default = SelfImprovementEngine;
//# sourceMappingURL=self-improvement-engine.js.map
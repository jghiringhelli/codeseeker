import { EventEmitter } from 'events';
/**
 * Self-Improvement Engine
 *
 * Uses CodeMind's own features to improve its codebase systematically.
 * Implements the "dogfooding strategy" from Phase 2 requirements.
 */
export declare class SelfImprovementEngine extends EventEmitter {
    private logger;
    private db;
    private projectPath;
    private duplicationDetector;
    private treeNavigator;
    private vectorSearch;
    private centralizationDetector;
    private contextOptimizer;
    constructor(projectPath?: string, dbPath?: string);
    /**
     * Run complete self-improvement cycle
     */
    runSelfImprovement(): Promise<SelfImprovementReport>;
    /**
     * Find and suggest fixes for code duplications in our codebase
     */
    private findAndFixDuplications;
    /**
     * Optimize dependency tree and find circular dependencies
     */
    private optimizeDependencies;
    /**
     * Find and consolidate similar code using vector search
     */
    private consolidateSimilarCode;
    /**
     * Centralize scattered configurations
     */
    private centralizeConfigurations;
    /**
     * Optimize our own context windows for better Claude interactions
     */
    private optimizeOwnContext;
    /**
     * Group similar search matches
     */
    private groupSimilarMatches;
    private areSimilarFiles;
    private calculateDuplicationBenefit;
    private mapComplexityToEffort;
    /**
     * Calculate before/after metrics
     */
    private calculateMetrics;
    /**
     * Generate recommendations based on analysis
     */
    private generateRecommendations;
    /**
     * Save improvements to database
     */
    private saveImprovements;
    /**
     * Apply a specific improvement (with user confirmation)
     */
    applyImprovement(improvement: Improvement): Promise<boolean>;
    close(): void;
}
export interface SelfImprovementReport {
    timestamp: Date;
    improvements: Improvement[];
    metrics: {
        before: Record<string, number>;
        after: Record<string, number>;
    };
    recommendations: string[];
}
export interface Improvement {
    type: ImprovementType;
    feature: string;
    target: string;
    description: string;
    suggestion: string;
    estimatedEffort: EffortLevel;
    benefit: number;
    status: 'identified' | 'in_progress' | 'applied' | 'rejected';
    metadata?: Record<string, any>;
}
export type ImprovementType = 'duplication_removed' | 'dependency_optimized' | 'config_centralized' | 'context_optimized' | 'pattern_applied' | 'refactoring_applied';
export type EffortLevel = 'low' | 'medium' | 'high';
export default SelfImprovementEngine;
//# sourceMappingURL=self-improvement-engine.d.ts.map
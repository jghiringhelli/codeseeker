import { ToolSelectionContext } from './intelligent-tool-selector';
import { ToolBundleSystem, BundleSelectionResult } from './tool-bundle-system';
import { Database } from '../database/database';
import { PerformanceMonitor } from '../shared/performance-monitor';
export interface EnhancedSelectionResult extends BundleSelectionResult {
    fallbackToIndividual: boolean;
    selectionStrategy: 'bundle-first' | 'tool-first' | 'hybrid' | 'claude-direct';
    confidence: number;
    recommendations: string[];
}
export interface SelectionMetrics {
    selectionTime: number;
    totalTools: number;
    totalBundles: number;
    averageToolRelevance: number;
    executionComplexity: number;
    expectedTokenSavings: number;
}
export declare class EnhancedToolSelector {
    private logger;
    private bundleSystem;
    private db;
    private performanceMonitor;
    private selectionCache;
    private cacheTTL;
    constructor(database: Database, performanceMonitor: PerformanceMonitor);
    initialize(): Promise<void>;
    /**
     * Main selection method that intelligently chooses between bundles, tools, or Claude direct
     */
    selectOptimalApproach(context: ToolSelectionContext): Promise<EnhancedSelectionResult>;
    private determineSelectionStrategy;
    private isExternalQuery;
    private isComplexTask;
    private isSpecificTask;
    private bundleFirstSelection;
    private toolFirstSelection;
    private hybridSelection;
    private claudeDirectSelection;
    private selectIndividualTools;
    private isToolRelevant;
    private findComplementaryBundles;
    private calculateToolOverlap;
    private optimizeHybridSelection;
    private calculateConfidence;
    private generateRecommendations;
    private getFallbackSelection;
    private generateCacheKey;
    private getFromCache;
    private cacheResult;
    private recordSelectionMetrics;
    private calculateExpectedTokenSavings;
    getBundleSystem(): Promise<ToolBundleSystem>;
    getSelectionStats(): Promise<any>;
    clearCache(): void;
}
//# sourceMappingURL=enhanced-tool-selector.d.ts.map
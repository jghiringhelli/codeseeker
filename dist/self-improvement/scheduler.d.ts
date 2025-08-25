import { SelfImprovementReport } from './self-improvement-engine';
import { EventEmitter } from 'events';
/**
 * Self-Improvement Scheduler
 *
 * Runs self-improvement analysis on a schedule as per Phase 2 requirements:
 * "As we build Phase 2, we'll use our own features to improve the system"
 */
export declare class SelfImprovementScheduler extends EventEmitter {
    private logger;
    private engine;
    private scheduledTasks;
    constructor(projectPath?: string);
    /**
     * Set up Phase 2 dogfooding schedule as specified in the requirements
     */
    setupPhase2Schedule(): void;
    /**
     * Schedule daily self-improvement
     */
    scheduleDaily(cronPattern: string, analysisType: string): void;
    /**
     * Schedule specific Phase 2 dogfooding days
     */
    private scheduleSpecificDays;
    /**
     * Run analysis focused on a specific feature
     */
    private runFeatureSpecificAnalysis;
    /**
     * Analyze our duplication detection code for duplications
     */
    private analyzeOurDuplicationDetection;
    /**
     * Apply refactoring suggestions to our own code
     */
    private applyOurRefactoringSuggestions;
    /**
     * Optimize our own dependency tree
     */
    private optimizeOurDependencyTree;
    /**
     * Find similar implementations in our code
     */
    private findOurSimilarImplementations;
    /**
     * Centralize our scattered configurations
     */
    private centralizeOurConfigurations;
    /**
     * Optimize our context windows
     */
    private optimizeOurContextWindows;
    /**
     * Get our own tools (helper method)
     */
    private getOurOwnTools;
    /**
     * Start all scheduled tasks
     */
    start(): void;
    /**
     * Stop all scheduled tasks
     */
    stop(): void;
    /**
     * Get status of all scheduled tasks
     */
    getStatus(): Array<{
        name: string;
        running: boolean;
        nextRun?: Date;
    }>;
    /**
     * Run immediate self-improvement (manual trigger)
     */
    runNow(): Promise<SelfImprovementReport>;
    /**
     * Log improvement report
     */
    private logReport;
    close(): void;
}
export default SelfImprovementScheduler;
//# sourceMappingURL=scheduler.d.ts.map
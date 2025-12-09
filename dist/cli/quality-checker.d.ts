/**
 * Quality Checker - Comprehensive quality validation for code changes
 * SOLID Principles: Dependency Inversion - Coordinator depends on abstractions
 * Runs compilation, tests, coverage, security, and architecture checks
 */
import { DatabaseConnections } from '../config/database-config';
import { SubTaskResult, QualityCheckResult, QualityThresholds, ICompilationService, ITestingService, ISecurityService, IArchitectureService, IQualityScoreCalculator } from './quality/interfaces/index';
export { SubTaskResult, QualityCheckResult, QualityThresholds } from './quality/interfaces/index';
export declare class QualityChecker {
    private compilationService?;
    private testingService?;
    private securityService?;
    private architectureService?;
    private scoreCalculator?;
    private logger;
    private projectRoot;
    private db;
    private qualityThresholds;
    constructor(projectRoot?: string, db?: DatabaseConnections, compilationService?: ICompilationService, testingService?: ITestingService, securityService?: ISecurityService, architectureService?: IArchitectureService, scoreCalculator?: IQualityScoreCalculator);
    /**
     * Main entry point for quality checking
     */
    check(result: any): Promise<any>;
    /**
     * Run comprehensive quality checks across all dimensions
     */
    runAllChecks(subTaskResults: SubTaskResult[]): Promise<QualityCheckResult>;
    /**
     * Update quality thresholds
     */
    setThresholds(thresholds: Partial<QualityThresholds>): void;
    /**
     * Get current quality thresholds
     */
    getThresholds(): QualityThresholds;
    private normalizeInput;
    private logQualitySummary;
    private generateFailedResult;
}
export default QualityChecker;
//# sourceMappingURL=quality-checker.d.ts.map
/**
 * Quality Checker - Real implementation for comprehensive code quality checks
 * Runs compilation, tests, coverage, SOLID principles, and duplication detection
 */
export interface QualityCheckResult {
    compilation: {
        success: boolean;
        errors: string[];
        warnings: string[];
        timeMs: number;
    };
    tests: {
        passed: number;
        failed: number;
        coverage: number;
        failedTests: string[];
        timeMs: number;
    };
    codeQuality: {
        solidPrinciples: boolean;
        security: boolean;
        architecture: boolean;
        duplicates: {
            count: number;
            files: string[];
        };
        complexity: {
            average: number;
            max: number;
            violations: string[];
        };
    };
    overallScore: number;
    summary: string;
    recommendations: string[];
}
export interface ProjectStructure {
    hasPackageJson: boolean;
    hasTsConfig: boolean;
    hasTests: boolean;
    testFramework: string | null;
    buildCommand: string | null;
    testCommand: string | null;
}
export declare class QualityChecker {
    private logger;
    private projectPath;
    constructor(projectPath?: string);
    /**
     * Run all quality checks and return comprehensive results
     */
    runAllChecks(subTaskResults: any[]): Promise<QualityCheckResult>;
    /**
     * Run compilation/build check
     */
    private runCompilationCheck;
    /**
     * Run tests and coverage check
     */
    private runTestsCheck;
    /**
     * Run code quality checks (SOLID, duplicates, complexity)
     */
    private runCodeQualityCheck;
    private detectProjectStructure;
    private fileExists;
    private findTestFiles;
    private parseCompilerOutput;
    private parseTestOutput;
    private extractFailedTestNames;
    private checkSOLIDPrinciples;
    private checkForDuplicates;
    private areFilesSimilar;
    private checkComplexity;
    private checkSecurity;
    private calculateOverallScore;
    private generateSummaryAndRecommendations;
    private getFailedQualityResult;
}
export default QualityChecker;
//# sourceMappingURL=QualityChecker.d.ts.map
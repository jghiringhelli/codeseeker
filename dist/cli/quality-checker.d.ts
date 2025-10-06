/**
 * Quality Checker - Comprehensive quality validation for code changes
 * Runs compilation, tests, coverage, security, and architecture checks
 */
import { DatabaseConnections } from '../config/database-config';
export interface SubTaskResult {
    success: boolean;
    filesModified: string[];
    summary: string;
    changes: {
        linesAdded: number;
        linesRemoved: number;
        linesModified: number;
    };
}
export interface CompilationResult {
    success: boolean;
    errors: string[];
    warnings: string[];
    duration: number;
}
export interface TestResult {
    passed: number;
    failed: number;
    coverage: number;
    duration: number;
    failedTests: string[];
    coverageFiles: {
        file: string;
        coverage: number;
    }[];
}
export interface SecurityResult {
    vulnerabilities: {
        severity: 'low' | 'medium' | 'high' | 'critical';
        type: string;
        file: string;
        line?: number;
        description: string;
    }[];
    overallScore: number;
}
export interface ArchitectureResult {
    solidPrinciples: {
        singleResponsibility: boolean;
        openClosed: boolean;
        liskovSubstitution: boolean;
        interfaceSegregation: boolean;
        dependencyInversion: boolean;
        score: number;
    };
    codeQuality: {
        maintainability: number;
        readability: number;
        complexity: number;
        duplication: number;
    };
    patterns: {
        detectedPatterns: string[];
        antiPatterns: string[];
        recommendations: string[];
    };
}
export interface QualityCheckResult {
    compilation: CompilationResult;
    tests: TestResult;
    security: SecurityResult;
    architecture: ArchitectureResult;
    overallScore: number;
    passed: boolean;
    recommendations: string[];
    blockers: string[];
}
export declare class QualityChecker {
    private logger;
    private projectRoot;
    private db;
    private qualityThresholds;
    constructor(projectRoot?: string, db?: DatabaseConnections);
    /**
     * Simple check method for integration compatibility
     */
    check(result: any): Promise<any>;
    runAllChecks(subTaskResults: SubTaskResult[]): Promise<QualityCheckResult>;
    private runCompilationChecks;
    private runTypeScriptCompilation;
    private runJavaScriptSyntaxCheck;
    private runTestChecks;
    private runJestTests;
    private runMochaTests;
    private runSecurityChecks;
    private scanFileForSecurityIssues;
    private runArchitectureChecks;
    private checkSOLIDPrinciples;
    private analyzeCodeQuality;
    private detectCodeDuplication;
    private extractFunctions;
    private detectFunctionDuplication;
    private detectBlockDuplication;
    private detectPatternDuplication;
    private normalizeFunctionBody;
    private normalizeCodeBlock;
    private calculateStringSimilarity;
    private detectEmbeddingBasedDuplication;
    private extractCodeElements;
    private extractMethodsFromClass;
    private findMatchingBrace;
    private generateCodeEmbedding;
    private prepareCodeForEmbedding;
    private generateMockCodeEmbedding;
    private simpleHash;
    private findSimilarEmbeddings;
    private getMockSimilarEmbeddings;
    private generateConsolidationSuggestion;
    private detectArchitecturalPatterns;
    private parseTypeScriptErrors;
    private parseTypeScriptWarnings;
    private parseJestResults;
    private parseJestResultsFromText;
    private calculateCoverageFromJest;
    private generateNoTestFrameworkResult;
    private calculateOverallScore;
    private determineQualityPassed;
    private generateRecommendations;
    private generateFailedResult;
}
export default QualityChecker;
//# sourceMappingURL=quality-checker.d.ts.map
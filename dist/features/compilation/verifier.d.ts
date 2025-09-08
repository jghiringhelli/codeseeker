/**
 * Compilation Verifier - Simplified Build Safety Verification
 * Ensures that code changes don't break compilation before Claude Code suggests them
 */
export interface CompilationVerificationConfig {
    projectPath: string;
    buildCommand?: string;
    typeCheckCommand?: string;
    lintCommand?: string;
    testCommand?: string;
    skipLinting?: boolean;
    skipTests?: boolean;
    maxDuration?: number;
}
export interface CompilationResult {
    success: boolean;
    framework: string;
    buildCommand: string;
    duration: number;
    stages: {
        typeCheck: StageResult;
        compilation: StageResult;
        linting?: StageResult;
        testing?: StageResult;
    };
    errors: CompilationError[];
    warnings: CompilationWarning[];
    recommendations: string[];
}
export interface StageResult {
    name: string;
    success: boolean;
    duration: number;
    output: string;
    errorCount: number;
    warningCount: number;
}
export interface CompilationError {
    stage: string;
    file?: string;
    line?: number;
    column?: number;
    message: string;
    severity: 'error' | 'warning';
    code?: string;
}
export interface CompilationWarning {
    stage: string;
    message: string;
    suggestion?: string;
}
export declare class CompilationVerifier {
    private logger;
    verifyCompilation(config: CompilationVerificationConfig): Promise<CompilationResult>;
    private detectBuildFramework;
    private determineBuildCommand;
    private runTypeCheck;
    private runCompilation;
    private runLinting;
    private runQuickTests;
    private combineResults;
    private extractIssues;
    private generateRecommendations;
    private countErrors;
    private countWarnings;
    private countTestFailures;
}
export default CompilationVerifier;
//# sourceMappingURL=verifier.d.ts.map
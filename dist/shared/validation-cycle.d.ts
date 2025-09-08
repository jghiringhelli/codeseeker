/**
 * CodeMind Validation Cycle System
 *
 * Implements automatic quality and safety validation that runs before every Claude Code response.
 * Replaces database-heavy tools with fast, stateless validation for immediate feedback.
 */
export interface ProjectContext {
    projectPath: string;
    changedFiles?: string[];
    requestType: 'code_modification' | 'analysis' | 'general';
    language?: string;
    framework?: string;
    userIntent?: string;
}
export interface CycleResult {
    success: boolean;
    duration: number;
    warnings: ValidationWarning[];
    errors: ValidationError[];
    recommendations: string[];
}
export interface ValidationWarning {
    type: string;
    message: string;
    file?: string;
    line?: number;
    severity: 'info' | 'warning' | 'error';
}
export interface ValidationError {
    type: string;
    message: string;
    file?: string;
    line?: number;
    blocking: boolean;
}
export interface CycleConfig {
    enableCoreCycle: boolean;
    enableQualityCycle: boolean;
    maxDuration: number;
    skipOnPatterns?: string[];
    qualityThresholds: {
        solidMinScore: number;
        maxDuplicationLines: number;
        maxComplexityPerFunction: number;
    };
}
export declare class CodeMindValidationCycle {
    private logger;
    private compilationVerifier;
    private solidAnalyzer;
    private intelligentFeatures;
    private config;
    constructor(config?: Partial<CycleConfig>);
    /**
     * Core Safety Cycle - Always runs before every response
     * Critical validations that prevent breaking changes
     */
    runCoreCycle(context: ProjectContext): Promise<CycleResult>;
    /**
     * Quality Cycle - Runs for code modifications
     * Provides quality feedback and architectural guidance
     */
    runQualityCycle(context: ProjectContext): Promise<CycleResult>;
    /**
     * Validate compilation status
     */
    private validateCompilation;
    /**
     * Validate tests (non-blocking)
     */
    private validateTests;
    /**
     * Validate safety constraints (prevent destructive operations)
     */
    private validateSafetyConstraints;
    /**
     * SOLID Principles validation (lightweight, context-aware)
     */
    private validateSOLIDPrinciples;
    /**
     * Linting validation
     */
    private validateLinting;
    /**
     * Check for dependency cycles
     */
    private validateDependencyCycles;
    /**
     * Semantic Deduplication Check (intelligent, semantic-search powered)
     */
    private validateSemanticDuplication;
    /**
     * Smart Security Analysis (context-aware, enhanced)
     */
    private validateSmartSecurity;
    /**
     * Extract imports from file content
     */
    private extractImports;
    /**
     * Find circular dependencies using DFS
     */
    private findCircularDependencies;
    /**
     * Format cycle results for CLI output
     */
    formatCycleResults(coreResult: CycleResult, qualityResult?: CycleResult): string;
}
export default CodeMindValidationCycle;
//# sourceMappingURL=validation-cycle.d.ts.map
/**
 * Shared types for CodeMind orchestration system
 */
export interface ProjectContext {
    projectPath: string;
    projectId: string;
    projectName?: string;
    gitBranch?: string;
    dependencies?: string[];
    architecture?: string;
    testingFramework?: string;
    requestType: 'analysis' | 'code_modification' | 'general';
    changedFiles?: string[];
    language?: string;
    framework?: string;
    userIntent?: string;
}
export interface TaskResult {
    success: boolean;
    output?: string;
    error?: string;
    duration?: number;
    metadata?: Record<string, any>;
}
export interface ValidationResult {
    passed: boolean;
    issues: string[];
    warnings: string[];
    suggestions: string[];
}
export interface CompilationResult {
    success: boolean;
    errors: string[];
    warnings: string[];
    output?: string;
}
export interface TestResult {
    passed: boolean;
    totalTests: number;
    passedTests: number;
    failedTests: number;
    testResults: Array<{
        testName: string;
        passed: boolean;
        error?: string;
    }>;
}
//# sourceMappingURL=types.d.ts.map
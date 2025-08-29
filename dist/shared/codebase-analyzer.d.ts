/**
 * Codebase Analyzer - Analyzes and provides insights about the codebase
 */
export interface CodebaseAnalysis {
    totalFiles: number;
    totalLines: number;
    languages: Record<string, number>;
    complexity: {
        average: number;
        high: string[];
        low: string[];
    };
    dependencies: {
        internal: string[];
        external: string[];
    };
    patterns: string[];
    issues: {
        critical: string[];
        warnings: string[];
        suggestions: string[];
    };
}
export interface FileAnalysis {
    path: string;
    size: number;
    lines: number;
    complexity: number;
    dependencies: string[];
    exports: string[];
    imports: string[];
}
export declare class CodebaseAnalyzer {
    private analysisCache;
    analyze(projectPath: string): Promise<CodebaseAnalysis>;
    analyzeCodebase(projectPath: string): Promise<CodebaseAnalysis>;
    analyzeFile(filePath: string): Promise<FileAnalysis>;
    clearCache(): void;
}
export default CodebaseAnalyzer;
//# sourceMappingURL=codebase-analyzer.d.ts.map
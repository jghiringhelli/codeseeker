/**
 * Minimal AST Analyzer - MVP Implementation
 * Provides basic AST analysis functionality for features that depend on it
 */
export interface Symbol {
    name: string;
    type: string;
    location: {
        file: string;
        line: number;
        endLine: number;
        column: number;
        endColumn: number;
    };
}
export interface Dependency {
    from: string;
    to: string;
    target?: string;
    type: 'import' | 'call' | 'extends' | 'implements';
    location?: {
        line: number;
        column: number;
    };
}
export interface ASTAnalysisResult {
    symbols: Symbol[];
    dependencies: Dependency[];
    exports: Symbol[];
    imports: Symbol[];
    complexity: number;
}
export declare class ASTAnalyzer {
    /**
     * Basic file analysis using regex patterns instead of full AST parsing
     */
    analyzeFile(filePath: string): Promise<ASTAnalysisResult>;
    /**
     * Extract symbols (functions, classes, variables) using regex
     */
    private extractSymbols;
    /**
     * Extract dependencies using regex
     */
    private extractDependencies;
    /**
     * Extract exports using regex
     */
    private extractExports;
    /**
     * Extract imports using regex
     */
    private extractImports;
    /**
     * Calculate basic complexity based on control flow keywords
     */
    private calculateComplexity;
}
//# sourceMappingURL=analyzer.d.ts.map
export interface CompilationError {
    file: string;
    line: number;
    column: number;
    severity: 'error' | 'warning' | 'info';
    code: string;
    message: string;
    suggestion?: string;
    relatedFiles?: string[];
}
export interface CompilationResult {
    success: boolean;
    errors: CompilationError[];
    warnings: CompilationError[];
    duration: number;
    command: string;
    framework: 'typescript' | 'javascript' | 'babel' | 'webpack' | 'vite' | 'unknown';
    outputSize?: number;
    sourceMapGenerated: boolean;
    affectedFiles: string[];
    recommendations: string[];
}
export interface BuildConfiguration {
    projectPath: string;
    buildCommand?: string;
    typeCheckCommand?: string;
    lintCommand?: string;
    testCommand?: string;
    framework?: string;
    skipTests?: boolean;
    skipLinting?: boolean;
    maxDuration?: number;
}
export declare class CompilationVerifier {
    private logger;
    verifyCompilation(config: BuildConfiguration): Promise<CompilationResult>;
    private detectBuildFramework;
    private determineBuildCommand;
    private runTypeCheck;
    private runCompilation;
    private runLinting;
    private runQuickTests;
    private parseTypeScriptErrors;
    private parseBuildErrors;
    private parseLintErrors;
    private parseTestErrors;
    private getTypeScriptSuggestion;
    private getBuildErrorSuggestion;
    private getLintSuggestion;
    private analyzeBuildOutput;
    private getDirectorySize;
    private combineResults;
    private generateCompilationRecommendations;
}
export default CompilationVerifier;
//# sourceMappingURL=verifier.d.ts.map
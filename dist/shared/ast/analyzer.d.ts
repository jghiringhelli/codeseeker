export interface ASTNode {
    type: string;
    name?: string;
    kind?: string;
    start?: number;
    end?: number;
    line?: number;
    column?: number;
    children?: ASTNode[];
    metadata?: Record<string, any>;
}
export interface ASTAnalysisResult {
    language: string;
    symbols: Symbol[];
    dependencies: Dependency[];
    complexity: ComplexityMetrics;
    patterns: Pattern[];
    errors: AnalysisError[];
}
export interface Symbol {
    name: string;
    type: 'function' | 'class' | 'interface' | 'variable' | 'type' | 'enum' | 'method' | 'property';
    location: SourceLocation;
    signature?: string;
    visibility?: 'public' | 'private' | 'protected';
    isExported?: boolean;
    isAsync?: boolean;
    parameters?: Parameter[];
    returnType?: string;
}
export interface Dependency {
    type: 'import' | 'export' | 'call' | 'inheritance' | 'composition';
    source: string;
    target: string;
    line: number;
    isExternal?: boolean;
}
export interface ComplexityMetrics {
    cyclomaticComplexity: number;
    cognitiveComplexity: number;
    linesOfCode: number;
    maintainabilityIndex: number;
    nestingDepth: number;
}
export interface Pattern {
    name: string;
    type: 'architectural' | 'design' | 'anti-pattern';
    confidence: number;
    description: string;
    locations: SourceLocation[];
}
export interface AnalysisError {
    message: string;
    line?: number;
    column?: number;
    severity: 'error' | 'warning' | 'info';
}
export interface SourceLocation {
    file: string;
    line: number;
    column: number;
    endLine?: number;
    endColumn?: number;
}
export interface Parameter {
    name: string;
    type?: string;
    optional?: boolean;
    defaultValue?: string;
}
export declare class ASTAnalyzer {
    private logger;
    analyzeFile(filePath: string): Promise<ASTAnalysisResult>;
    private detectLanguage;
    private analyzeTypeScript;
    private analyzePython;
    private extractTypeScriptSymbols;
    private extractBabelSymbols;
    private extractTypeScriptDependencies;
    private extractBabelDependencies;
    private calculateTypeScriptComplexity;
    private calculateBabelComplexity;
    private detectTypeScriptPatterns;
    private detectSingletonPattern;
    private detectFactoryPattern;
    private initializeComplexityMetrics;
    private getSourceLocation;
    private getBabelLocation;
    private getFunctionSignature;
    private hasExportModifier;
    private hasAsyncModifier;
    private getFunctionParameters;
    private getVisibility;
}
export default ASTAnalyzer;
//# sourceMappingURL=analyzer.d.ts.map
/**
 * SOLID Principles Analyzer Service
 * Analyzes code files for SOLID principles violations and provides refactoring suggestions
 */
export interface SOLIDViolation {
    principle: 'SRP' | 'OCP' | 'LSP' | 'ISP' | 'DIP';
    severity: 'critical' | 'major' | 'minor';
    description: string;
    location: {
        file: string;
        startLine: number;
        endLine: number;
        element: string;
    };
    suggestion: string;
    refactoring?: {
        type: string;
        effort: 'low' | 'medium' | 'high';
        automatable: boolean;
        steps: string[];
    };
}
export interface SOLIDFileResult {
    file: string;
    violations: SOLIDViolation[];
    score: number;
    refactoringSuggestions: string[];
}
export interface SOLIDProjectReport {
    projectId: string;
    totalFiles: number;
    analyzedFiles: number;
    overallScore: number;
    fileResults: SOLIDFileResult[];
    summary: {
        criticalViolations: number;
        majorViolations: number;
        minorViolations: number;
        topViolations: SOLIDViolation[];
    };
}
export declare class SOLIDAnalyzerService {
    private logger;
    private codeParser;
    constructor();
    /**
     * Analyze project file by file for SOLID principles
     */
    analyzeProject(projectPath: string, progressCallback?: (progress: number, current: string) => void, recursive?: boolean): Promise<SOLIDProjectReport>;
    /**
     * Analyze single file for SOLID violations
     */
    analyzeFile(filePath: string): Promise<SOLIDFileResult>;
    /**
     * Single Responsibility Principle Analysis
     */
    private analyzeSRP;
    /**
     * Open/Closed Principle Analysis
     */
    private analyzeOCP;
    /**
     * Liskov Substitution Principle Analysis
     */
    private analyzeLSP;
    /**
     * Interface Segregation Principle Analysis
     */
    private analyzeISP;
    /**
     * Dependency Inversion Principle Analysis
     */
    private analyzeDIP;
    /**
     * Print SOLID analysis report
     */
    printSOLIDReport(report: SOLIDProjectReport): void;
    /**
     * Interactive refactoring for SOLID violations
     */
    interactiveRefactor(report: SOLIDProjectReport, workflowOrchestrator: any): Promise<void>;
    private getCodeFiles;
    private generateRefactoringSuggestions;
    private colorizeScore;
}
export default SOLIDAnalyzerService;
//# sourceMappingURL=solid-analyzer-service.d.ts.map
/**
 * Claude Code Outcome Analyzer
 * Analyzes the outcome of Claude Code execution to determine intelligent database updates
 */
export interface ClaudeCodeOutcome {
    filesModified: string[];
    classesChanged: string[];
    newClasses: string[];
    functionsChanged: string[];
    newFunctions: string[];
    importsModified: string[];
    success: boolean;
    errorMessages?: string[];
    warnings?: string[];
}
export interface FileAnalysis {
    path: string;
    wasModified: boolean;
    classChanges: {
        added: string[];
        modified: string[];
        removed: string[];
    };
    functionChanges: {
        added: string[];
        modified: string[];
        removed: string[];
    };
    importChanges: {
        added: string[];
        removed: string[];
    };
    needsRehashing: boolean;
}
export declare class ClaudeCodeOutcomeAnalyzer {
    private static instance;
    private beforeSnapshot;
    private afterSnapshot;
    static getInstance(): ClaudeCodeOutcomeAnalyzer;
    /**
     * Take a snapshot before Claude Code execution
     */
    takeBeforeSnapshot(projectPath: string): Promise<void>;
    /**
     * Take a snapshot after Claude Code execution and analyze differences
     */
    takeAfterSnapshotAndAnalyze(projectPath: string): Promise<ClaudeCodeOutcome>;
    /**
     * Analyze changes in a specific file
     */
    private analyzeFileChanges;
    /**
     * Extract class names from code content
     */
    private extractClasses;
    /**
     * Extract function names from code content
     */
    private extractFunctions;
    /**
     * Extract import statements from code content
     */
    private extractImports;
    /**
     * Get class content for comparison
     */
    private getClassContent;
    /**
     * Get function content for comparison
     */
    private getFunctionContent;
    /**
     * Get all relevant files for tracking
     */
    private getAllRelevantFiles;
    /**
     * Recursively get files with specific extensions
     */
    private getFilesRecursively;
    /**
     * Check compilation status after changes
     */
    private checkCompilationStatus;
    /**
     * Clear snapshots to free memory
     */
    clearSnapshots(): void;
}
export default ClaudeCodeOutcomeAnalyzer;
//# sourceMappingURL=claude-code-outcome-analyzer.d.ts.map
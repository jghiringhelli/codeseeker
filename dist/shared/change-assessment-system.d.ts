/**
 * Comprehensive Change Assessment System
 * Analyzes codebase changes after CLI requests and updates all tool databases
 */
import { ToolUpdateResult } from './tool-interface';
export interface ChangeAnalysisRequest {
    projectPath: string;
    projectId: string;
    cliCommand: string;
    userQuery: string;
    beforeState?: ProjectState;
    afterState?: ProjectState;
    claudeCodeResult?: any;
}
export interface ProjectState {
    fileCount: number;
    totalLines: number;
    languages: string[];
    lastModified: Date;
    gitHash?: string;
    fileHashes: Map<string, string>;
    directoryStructure: any;
}
export interface ChangeAnalysisResult {
    filesChanged: Array<{
        path: string;
        changeType: 'added' | 'modified' | 'deleted' | 'renamed';
        linesAdded: number;
        linesRemoved: number;
        language: string;
    }>;
    structuralChanges: Array<{
        type: 'directory_added' | 'directory_removed' | 'file_moved';
        details: string;
    }>;
    codeMetrics: {
        complexityChange: number;
        duplicatedLinesChange: number;
        testCoverageChange: number;
    };
    toolUpdates: Map<string, ToolUpdateResult>;
    overallImpact: 'low' | 'medium' | 'high';
    assessmentSummary: string;
}
export interface ClaudeCodeAnalysisResult {
    success: boolean;
    changes: any[];
    insights: string[];
    recommendations: string[];
    quality: {
        before: number;
        after: number;
        improvement: number;
    };
    tokensSaved?: number;
    executionTime: number;
}
export declare class ChangeAssessmentSystem {
    private logger;
    private claudeCodeApiUrl;
    constructor();
    /**
     * Main method to assess changes and update all tools
     */
    assessChangesAndUpdateTools(request: ChangeAnalysisRequest): Promise<ChangeAnalysisResult>;
    /**
     * Capture current state of the project
     */
    captureProjectState(projectPath: string): Promise<ProjectState>;
    /**
     * Analyze all files in the project
     */
    private analyzeProjectFiles;
    /**
     * Simple hash function for change detection
     */
    private simpleHash;
    /**
     * Get programming language from file extension
     */
    private getLanguageFromExtension;
    /**
     * Analyze changes using Claude Code
     */
    private analyzeChangesWithClaudeCode;
    /**
     * Build analysis prompt for Claude Code
     */
    private buildChangeAnalysisPrompt;
    /**
     * Detect file and structural changes
     */
    private detectChanges;
    /**
     * Calculate changes in code metrics
     */
    private calculateMetricsChanges;
    /**
     * Update all tools with change information
     */
    private updateAllToolsWithChanges;
    /**
     * Assess overall impact of changes
     */
    private assessOverallImpact;
    /**
     * Generate comprehensive assessment summary
     */
    private generateAssessmentSummary;
}
//# sourceMappingURL=change-assessment-system.d.ts.map
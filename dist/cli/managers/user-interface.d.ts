/**
 * UserInterface - Handles all user interaction, prompts, and display
 * Single Responsibility: User interface and interaction
 */
import { ProjectInitOptions } from './project-manager';
export declare class UserInterface {
    /**
     * Get project initialization options from user
     */
    getProjectInitOptions(): Promise<ProjectInitOptions>;
    /**
     * Display comprehensive help information
     */
    displayHelp(): void;
    /**
     * Display processing results from Claude Code
     */
    displayProcessingResults(data: any): void;
    /**
     * Display search results
     */
    displaySearchResults(results: Array<{
        file: string;
        relevance: number;
        summary: string;
    }>): void;
    /**
     * Display analysis results
     */
    displayAnalysisResults(analysis: any): void;
    /**
     * Display project information
     */
    displayProjectInfo(projectInfo: any): void;
    /**
     * Display a spinner or progress indicator
     */
    showProgress(message: string): void;
    /**
     * Display success message
     */
    showSuccess(message: string): void;
    /**
     * Display error message
     */
    showError(message: string): void;
    /**
     * Display warning message
     */
    showWarning(message: string): void;
    /**
     * Show a confirmation prompt to the user
     */
    confirm(message: string): Promise<boolean>;
    /**
     * Ask user to choose from multiple options when project is already initialized
     */
    getInitializationAction(projectName: string): Promise<'reinitialize' | 'skip' | 'sync' | 'prompt_user'>;
    /**
     * Display deduplication report with detailed findings
     */
    displayDeduplicationReport(report: any): void;
    /**
     * Display consolidation summary after automatic consolidation
     */
    displayConsolidationSummary(summary: any): void;
}
//# sourceMappingURL=user-interface.d.ts.map
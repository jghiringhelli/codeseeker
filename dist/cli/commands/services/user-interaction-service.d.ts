/**
 * User Interaction Service
 * Single Responsibility: Handle user interactions and Claude Code detection
 * Manages user clarification prompts and Claude Code command execution
 */
import * as readline from 'readline';
import { QueryAnalysis } from './natural-language-processor';
export interface UserClarification {
    question: string;
    answer: string;
}
export interface ClaudeResponse {
    response: string;
    filesToModify: string[];
    summary: string;
}
/**
 * Represents a file change proposed by Claude
 */
export interface ProposedChange {
    tool: 'Write' | 'Edit';
    filePath: string;
    content?: string;
    oldString?: string;
    newString?: string;
}
/**
 * User's choice for file changes approval
 */
export type ApprovalChoice = 'yes' | 'yes_always' | 'no_feedback' | 'cancelled';
/**
 * Result of approval prompt
 */
export interface ApprovalResult {
    choice: ApprovalChoice;
    feedback?: string;
}
export declare class UserInteractionService {
    private rl?;
    private skipApproval;
    constructor();
    /**
     * Set skip approval mode (when user selects "Yes, always")
     */
    setSkipApproval(skip: boolean): void;
    /**
     * Set the readline interface (passed from main CLI)
     */
    setReadlineInterface(rl: readline.Interface): void;
    /**
     * Pause readline before inquirer prompts to avoid conflicts
     */
    private pauseReadline;
    /**
     * Resume readline after inquirer prompts
     */
    private resumeReadline;
    /**
     * Prompt user for clarifications based on detected assumptions and ambiguities
     */
    promptForClarifications(queryAnalysis: QueryAnalysis): Promise<string[]>;
    /**
     * Execute Claude Code with enhanced prompt
     * When running inside Claude Code, outputs context transparently for the current Claude instance
     */
    executeClaudeCode(enhancedPrompt: string): Promise<ClaudeResponse>;
    /**
     * Execute Claude Code with two-phase permission handling and feedback loop
     * Phase 1: Run Claude and collect proposed changes (permission denials)
     * Phase 2: If user approves, resume session with permissions to execute changes
     * Feedback Loop: If user provides feedback, retry with modified prompt
     */
    private executeClaudeCodeWithStreaming;
    /**
     * Incorporate user feedback into the prompt for retry
     */
    private incorporateFeedback;
    /**
     * Ask user if they want to continue with more feedback
     */
    private askToContinue;
    /**
     * Show compact context summary - just a single line showing what's being sent
     */
    private showCompactContextSummary;
    /**
     * Show Claude's plan (filtering out permission-related messages)
     */
    private showClaudePlan;
    /**
     * Deduplicate proposed changes (same file path should only appear once)
     */
    private deduplicateChanges;
    /**
     * Show what changes were applied
     */
    private showAppliedChanges;
    /**
     * Phase 1: Execute Claude and collect proposed changes without applying them
     */
    private executeClaudeFirstPhase;
    /**
     * Phase 2: Resume the session with permissions to apply changes
     */
    private executeClaudeSecondPhase;
    /**
     * Show proposed changes to user and ask for confirmation
     * Uses list-style prompt like Claude Code with Yes/Yes always/No/No with feedback options
     */
    private showProposedChangesAndConfirm;
    /**
     * This method is now deprecated - file changes are confirmed before being applied
     * via showProposedChangesAndConfirm. Keeping for backwards compatibility.
     */
    confirmFileModifications(_filesToModify: string[]): Promise<{
        approved: boolean;
        dontAskAgain: boolean;
    }>;
    /**
     * Ask user if they want to run build/tests after changes
     */
    confirmBuildAndTest(): Promise<ApprovalResult>;
    /**
     * Display execution summary
     */
    displayExecutionSummary(summary: string, stats: any): void;
    /**
     * Generate clarification questions based on analysis
     */
    private generateClarificationQuestions;
    /**
     * Parse Claude Code response to extract files and summary
     */
    private parseClaudeResponse;
}
//# sourceMappingURL=user-interaction-service.d.ts.map
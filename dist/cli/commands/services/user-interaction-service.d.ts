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
export type ApprovalChoice = 'yes' | 'yes_always' | 'yes_per_file' | 'no_feedback' | 'cancelled';
/**
 * User's choice for how to continue after interruption
 */
export type ContinuationChoice = 'continue' | 'new_search' | 'cancel';
/**
 * Result of approval prompt
 */
export interface ApprovalResult {
    choice: ApprovalChoice;
    feedback?: string;
}
/**
 * Test type for generation
 */
export type TestType = 'unit' | 'integration' | 'e2e';
/**
 * Options for build/test verification
 */
export interface BuildTestOptions {
    runBuild: boolean;
    runTests: boolean;
    generateTests: boolean;
    testType?: TestType;
    cancelled?: boolean;
}
/**
 * Action to take on build/test failure
 */
export interface FailureAction {
    action: 'fix' | 'continue' | 'show_error' | 'abort';
    errorMessage: string;
}
/**
 * Language-agnostic test result summary
 */
export interface TestResultSummary {
    passed: number;
    failed: number;
    skipped?: number;
    total: number;
    framework?: string;
}
/**
 * Search mode options for the pre-prompt menu
 */
export type SearchMode = 'enabled' | 'disabled';
/**
 * Result of the pre-prompt menu
 */
export interface PrePromptResult {
    searchEnabled: boolean;
    prompt: string;
    cancelled: boolean;
}
export declare class UserInteractionService {
    private rl?;
    private skipApproval;
    private verboseMode;
    private activeChild;
    private isCancelled;
    private searchModeEnabled;
    private isFirstPromptInSession;
    constructor();
    /**
     * Set verbose mode (when user uses -v/--verbose flag)
     */
    setVerboseMode(enabled: boolean): void;
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
     * @param enhancedPrompt The prompt to send to Claude
     * @param options.autoApprove If true, auto-approve all file changes (for automated fix tasks)
     */
    executeClaudeCode(enhancedPrompt: string, options?: {
        autoApprove?: boolean;
    }): Promise<ClaudeResponse>;
    /**
     * Execute a direct Claude command for autonomous fix tasks (build/test fixes)
     * This method bypasses the full workflow orchestrator and executes immediately.
     *
     * In transparent mode: Outputs a plain instruction for Claude to process without
     * triggering the CodeMind workflow (no <codemind-context> tags).
     *
     * In external mode: Runs Claude CLI with auto-approval for immediate execution.
     */
    executeDirectFixCommand(fixPrompt: string, taskType: 'build' | 'test' | 'general'): Promise<{
        success: boolean;
        output: string;
    }>;
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
     * In verbose mode, shows full context details
     */
    private showCompactContextSummary;
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
     * Uses stream-json format to show Claude's thinking in real-time
     */
    private executeClaudeFirstPhase;
    /**
     * Phase 2: Resume the session with permissions to apply changes
     * Uses streaming output to show Claude's reasoning and progress in real-time
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
     * Ask user what verification steps to run after changes
     */
    confirmBuildAndTest(): Promise<BuildTestOptions>;
    /**
     * Ask user how to handle build/test failure
     */
    promptFailureAction(failureType: 'build' | 'test', errorMessage: string): Promise<FailureAction>;
    /**
     * Ask user how to continue after an interruption
     * Used when user provides new input while a Claude session is active
     * @param hasActiveSession Whether there's an active Claude session that can be resumed
     * @returns The user's choice: continue (forward to Claude), new_search (fresh CodeMind search), or cancel
     */
    promptContinuationChoice(hasActiveSession: boolean): Promise<ContinuationChoice>;
    /**
     * Check if cancellation was requested
     */
    wasCancelled(): boolean;
    /**
     * Reset cancellation flag
     */
    resetCancellation(): void;
    /**
     * Get current search mode status
     */
    isSearchEnabled(): boolean;
    /**
     * Set search mode enabled/disabled
     */
    setSearchMode(enabled: boolean): void;
    /**
     * Toggle search mode on/off
     */
    toggleSearchMode(): boolean;
    /**
     * Prepare search mode for a new prompt
     * In REPL mode: First prompt = ON, subsequent prompts = OFF by default
     * In -c mode: Always ON (called with forceOn=true)
     * @param forceOn If true, always enable search (used for -c mode)
     */
    prepareForNewPrompt(forceOn?: boolean): void;
    /**
     * Mark a conversation as complete (for REPL mode)
     * After a conversation, search defaults to OFF for the next prompt
     */
    markConversationComplete(): void;
    /**
     * Reset session state (for new REPL sessions)
     */
    resetSession(): void;
    /**
     * Show a compact pre-prompt menu for search mode toggle
     * Returns the user's choice and their prompt
     * @param hasActiveSession Whether there's an active Claude session (for context)
     */
    promptWithSearchToggle(hasActiveSession?: boolean): Promise<PrePromptResult>;
    /**
     * Show a minimal inline search toggle (single key press style)
     * For quick mode switching without a full menu
     * Format: "[S] Search: ON/OFF | Enter prompt:"
     */
    promptWithInlineToggle(): Promise<PrePromptResult>;
    /**
     * Get the search toggle indicator string for display
     * Returns a radio-button style indicator like "( * ) Search files" or "( ) Search files"
     * @param enabled Optional override for the search state, defaults to current state
     */
    getSearchToggleIndicator(enabled?: boolean): string;
    /**
     * Display the search toggle indicator (for use before prompts)
     * Shows: "( * ) Search files and knowledge graph" or "( ) Search files and knowledge graph"
     * Also shows toggle hint: "[s] to toggle"
     */
    displaySearchToggleIndicator(): void;
    /**
     * Check if input is a search toggle command
     * Returns true if input is 's' or '/s' (toggle search)
     */
    isSearchToggleCommand(input: string): boolean;
    /**
     * Display execution summary
     */
    displayExecutionSummary(summary: string, stats: any): void;
    /**
     * Generate clarification questions based on analysis
     */
    private generateClarificationQuestions;
    /**
     * Parse test results from Claude's output (language-agnostic)
     * Supports: Jest, Mocha, pytest, Go test, Cargo test, PHPUnit, RSpec, JUnit, etc.
     */
    parseTestResults(output: string): TestResultSummary | null;
    /**
     * Display test result summary in a user-friendly format
     */
    displayTestSummary(summary: TestResultSummary): void;
    /**
     * Format tool invocation for display
     * Shows human-readable descriptions like "Reading src/file.ts" or "Editing config.json"
     */
    private formatToolDisplay;
    /**
     * Parse Claude Code response to extract files and summary
     */
    private parseClaudeResponse;
}
//# sourceMappingURL=user-interaction-service.d.ts.map
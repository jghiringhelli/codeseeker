/**
 * User Interaction Service
 * Single Responsibility: Handle user interactions and Claude Code detection
 * Manages user clarification prompts and Claude Code command execution
 */
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
export declare class UserInteractionService {
    private tempDir;
    constructor();
    /**
     * Prompt user for clarifications based on detected assumptions and ambiguities
     */
    promptForClarifications(queryAnalysis: QueryAnalysis): Promise<string[]>;
    /**
     * Execute Claude Code with enhanced prompt
     */
    executeClaudeCode(enhancedPrompt: string): Promise<ClaudeResponse>;
    /**
     * Show file modification confirmation to user
     */
    confirmFileModifications(filesToModify: string[]): Promise<{
        approved: boolean;
        dontAskAgain: boolean;
    }>;
    /**
     * Display execution summary
     */
    displayExecutionSummary(summary: string, stats: any): void;
    /**
     * Generate clarification questions based on analysis
     */
    private generateClarificationQuestions;
    /**
     * Simulate user input for clarification questions
     */
    private getSimulatedUserInput;
    /**
     * Simulate user choice for file modifications
     */
    private getSimulatedUserChoice;
    /**
     * Simulate Claude Code response when running inside Claude Code environment
     */
    private simulateClaudeResponse;
    /**
     * Parse Claude Code response to extract files and summary
     */
    private parseClaudeResponse;
}
//# sourceMappingURL=user-interaction-service.d.ts.map
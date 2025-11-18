/**
 * User Clarification Service
 * Handles user interaction for assumption clarification
 * Integrates with readline interface for real-time feedback
 */
import * as readline from 'readline';
import { AmbiguityAnalysis, DetectedAssumption } from './assumption-detector';
export interface ClarificationResponse {
    originalRequest: string;
    assumptions: DetectedAssumption[];
    userChoices: Map<string, string>;
    clarifiedPrompt: string;
    shouldProceed: boolean;
}
export declare class UserClarificationService {
    private rl;
    constructor(rl: readline.Interface);
    /**
     * Present assumptions to user and collect clarifications (streamlined)
     */
    requestClarification(originalRequest: string, analysis: AmbiguityAnalysis): Promise<ClarificationResponse>;
    /**
     * Simple prompt for user input
     */
    private promptUser;
    /**
     * Confirm if user wants to proceed
     */
    private confirmProceed;
    /**
     * Build simple clarified prompt for Claude Code
     */
    private buildSimpleClarifiedPrompt;
    /**
     * Generate final approach summary based on user choices
     */
    private generateFinalApproach;
    /**
     * Build enhanced prompt with clarifications for Claude Code
     */
    private buildClarifiedPrompt;
    /**
     * Quick yes/no confirmation
     */
    quickConfirm(message: string): Promise<boolean>;
    /**
     * Present simple multiple choice
     */
    multipleChoice(question: string, choices: string[]): Promise<number>;
}
export default UserClarificationService;
//# sourceMappingURL=user-clarification-service.d.ts.map
/**
 * Intention Clarification Service
 * Handles interactive user clarification for ambiguous requests
 * Provides numbered selection interface for intentions and assumptions
 */
import * as readline from 'readline';
import { IntentionAnalysis, UserClarification, ClarifiedIntentionAnalysis, IntentionType } from './llm-intention-detector';
export interface ClarificationSession {
    sessionId: string;
    originalRequest: string;
    analysis: IntentionAnalysis;
    clarifications: UserClarification[];
    isComplete: boolean;
    currentAmbiguityIndex: number;
}
export declare class IntentionClarificationService {
    private llmDetector;
    private activeSessions;
    constructor();
    /**
     * Start a clarification session for ambiguous requests
     */
    startClarificationSession(userRequest: string, analysis: IntentionAnalysis, rl: readline.Interface): Promise<ClarifiedIntentionAnalysis>;
    /**
     * Display a summary of the detected intention
     */
    private displayIntentionSummary;
    /**
     * Process all ambiguities with user interaction
     */
    private processAmbiguities;
    /**
     * Handle a single ambiguity with user selection
     */
    private handleAmbiguity;
    /**
     * Get user selection with validation
     */
    private getUserSelection;
    /**
     * Get custom input from user
     */
    private getCustomInput;
    /**
     * Display final clarified instructions
     */
    displayFinalInstructions(clarifiedAnalysis: ClarifiedIntentionAnalysis): void;
    /**
     * Format intention names for display (convert snake_case to readable format)
     */
    private formatIntentionName;
    /**
     * Generate unique session ID
     */
    private generateSessionId;
    /**
     * Get intention categories for display
     */
    getIntentionCategories(): Record<string, IntentionType[]>;
    /**
     * Check if a session exists
     */
    hasActiveSession(sessionId: string): boolean;
    /**
     * Get session by ID
     */
    getSession(sessionId: string): ClarificationSession | undefined;
    /**
     * Clean up expired sessions
     */
    cleanupExpiredSessions(maxAgeMs?: number): void;
}
//# sourceMappingURL=intention-clarification-service.d.ts.map
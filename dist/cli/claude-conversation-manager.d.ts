/**
 * Claude Code Conversation Manager
 * Manages conversation history and context for local Claude Code CLI interactions
 */
export interface ConversationMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    tokens?: number;
}
export interface ConversationSession {
    sessionId: string;
    projectPath: string;
    messages: ConversationMessage[];
    startTime: number;
    lastActivity: number;
    totalTokens: number;
}
export declare class ClaudeConversationManager {
    private sessions;
    private readonly MAX_HISTORY_LENGTH;
    private readonly COMPRESSION_THRESHOLD;
    /**
     * Start or continue a conversation session
     */
    startSession(projectPath: string): Promise<string>;
    /**
     * Send a message to Claude Code CLI and get response with conversation context
     */
    sendMessage(sessionId: string, userMessage: string, additionalContext?: string): Promise<{
        response: string;
        tokensUsed: number;
    }>;
    /**
     * Build conversation context with history for Claude Code
     */
    private buildConversationContext;
    /**
     * Execute Claude Code CLI with the conversation context
     */
    private executeClaudeCode;
    /**
     * Strategy 1: Execute with completely clean environment (no Claude Code vars)
     */
    private executeWithCleanEnvironment;
    /**
     * Strategy 2: Try using long-lived token authentication
     */
    private executeWithLongLivedToken;
    /**
     * Strategy 3: Try direct authentication with existing credentials
     */
    private executeWithDirectAuth;
    /**
     * Compress conversation history using Claude Code itself
     */
    private compressHistory;
    /**
     * Generate a session ID based on project path
     */
    private generateSessionId;
    /**
     * Get session info
     */
    getSession(sessionId: string): ConversationSession | undefined;
    /**
     * Clean up old sessions
     */
    cleanupOldSessions(maxAgeMs?: number): void;
}
export default ClaudeConversationManager;
//# sourceMappingURL=claude-conversation-manager.d.ts.map
/**
 * Claude Code Output Forwarder
 * Captures and forwards Claude Code output in real-time with distinctive styling
 * Mirrors Claude Code's prompt-level output within CodeMind CLI
 */
import { EventEmitter } from 'events';
import { ChildProcess } from 'child_process';
export interface ClaudeCodeOutputOptions {
    showTimestamps?: boolean;
    prefixLines?: boolean;
    bufferOutput?: boolean;
}
export declare class ClaudeCodeForwarder extends EventEmitter {
    private claudeProcess;
    private outputBuffer;
    private options;
    constructor(options?: ClaudeCodeOutputOptions);
    /**
     * Start forwarding output from a Claude Code process
     */
    startForwarding(process: ChildProcess): void;
    /**
     * Handle Claude Code output and format it with distinctive colors
     */
    private handleClaudeOutput;
    /**
     * Format Claude Code output with distinctive styling
     */
    private formatClaudeOutput;
    /**
     * Handle Claude Code process close
     */
    private handleClaudeClose;
    /**
     * Handle Claude Code process error
     */
    private handleClaudeError;
    /**
     * Send input to Claude Code process
     */
    sendToClaudeCode(input: string): boolean;
    /**
     * Interrupt Claude Code process (send escape/interrupt signal)
     */
    interruptClaudeCode(): void;
    /**
     * Execute a Claude Code command with real-time output forwarding
     */
    executeClaudeCodeCommand(command: string, args?: string[], workingDirectory?: string): Promise<{
        success: boolean;
        output: string[];
        code: number | null;
    }>;
    /**
     * Get buffered output
     */
    getBufferedOutput(): string[];
    /**
     * Clear output buffer
     */
    clearBuffer(): void;
    /**
     * Stop forwarding and cleanup
     */
    stopForwarding(): void;
}
export default ClaudeCodeForwarder;
//# sourceMappingURL=claude-code-forwarder.d.ts.map
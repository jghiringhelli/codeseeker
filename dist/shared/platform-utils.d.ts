/**
 * Cross-platform utilities for CodeMind
 * Handles differences between Windows, macOS, and Linux
 */
export type Platform = 'windows' | 'macos' | 'linux' | 'unknown';
export declare class PlatformUtils {
    private static _platform;
    /**
     * Get the current platform
     */
    static getPlatform(): Platform;
    /**
     * Check if running on Windows
     */
    static isWindows(): boolean;
    /**
     * Check if running on macOS
     */
    static isMacOS(): boolean;
    /**
     * Check if running on Linux
     */
    static isLinux(): boolean;
    /**
     * Check if running on Unix-like system (macOS or Linux)
     */
    static isUnix(): boolean;
    /**
     * Detect if running inside Claude Code's TOOL EXECUTION context
     * This is used to decide whether to output context for the current Claude instance
     * or try to spawn a new Claude CLI process
     *
     * IMPORTANT: We only want to detect when CodeMind is being EXECUTED AS A TOOL by Claude Code,
     * NOT just when Claude Code VSCode extension is installed or running in background.
     *
     * - CLAUDECODE and CLAUDE_CODE_ENTRYPOINT are set when VSCode extension is active
     *   but do NOT indicate we're being run as a tool - ignore these
     * - MCP_TOOL_CALL_ID indicates actual tool execution context
     * - CLAUDE_CLI_SESSION / ANTHROPIC_CLI_SESSION indicate actual CLI session context
     */
    static isRunningInClaudeCode(): boolean;
    /**
     * Force transparent mode for testing or when running inside Claude Code
     * Set CODEMIND_TRANSPARENT_MODE=true to force this behavior
     */
    static setTransparentMode(enabled: boolean): void;
    /**
     * Get the appropriate file reading command for the platform
     */
    static getFileReadCommand(): string;
    /**
     * Get the appropriate shell for exec commands
     */
    static getShell(): string | boolean;
    /**
     * Get platform-specific exec options
     */
    static getExecOptions(baseOptions?: Record<string, unknown>): Record<string, unknown>;
    /**
     * Get the appropriate pipe command for Claude Code execution
     * Note: Environment variables should be set via execOptions.env in Node.js, not via export/set commands
     */
    static getClaudeCodeCommand(inputFile: string): string;
    /**
     * Fallback command when running inside Claude Code (to avoid recursion)
     */
    private static getClaudeCodeFallbackCommand;
    /**
     * Get platform-specific temporary directory
     */
    static getTempDir(): string;
    /**
     * Get platform-specific path separator
     */
    static getPathSeparator(): string;
    /**
     * Get platform-specific environment variable handling
     */
    static getEnvVar(name: string): string | undefined;
    /**
     * Set environment variable with platform-specific handling
     */
    static setEnvVar(name: string, value: string): void;
    /**
     * Get platform-specific line ending
     */
    static getLineEnding(): string;
    /**
     * Get platform information for debugging
     */
    static getPlatformInfo(): {
        platform: Platform;
        arch: string;
        version: string;
        nodeVersion: string;
        isWindows: boolean;
        isUnix: boolean;
        shell: string;
        isGitBash: boolean;
        isWSL: boolean;
        fileCommand: string;
    };
}
export default PlatformUtils;
//# sourceMappingURL=platform-utils.d.ts.map
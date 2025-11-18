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
     * Detect if running inside Claude Code environment
     */
    static isRunningInClaudeCode(): boolean;
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
/**
 * Theme - Single Responsibility Principle
 * Centralized color theme and styling configuration
 */
import chalk from 'chalk';
export interface ThemeColors {
    primary: chalk.Chalk;
    secondary: chalk.Chalk;
    success: chalk.Chalk;
    warning: chalk.Chalk;
    error: chalk.Chalk;
    info: chalk.Chalk;
    muted: chalk.Chalk;
    prompt: chalk.Chalk;
    result: chalk.Chalk;
    border: chalk.Chalk;
    command: chalk.Chalk;
    highlight: chalk.Chalk;
    claudeCode: chalk.Chalk;
    claudeCodeMuted: chalk.Chalk;
    interrupt: chalk.Chalk;
    accent: chalk.Chalk;
}
export declare class Theme {
    static readonly colors: ThemeColors;
    /**
     * Get themed prompt text
     */
    static getPrompt(projectName: string): string;
    /**
     * Create a themed header
     */
    static createHeader(title: string, subtitle?: string): string;
    /**
     * Format error messages consistently
     */
    static formatError(message: string, context?: string): string;
    /**
     * Format success messages consistently
     */
    static formatSuccess(message: string, details?: string): string;
    /**
     * Format info messages consistently
     */
    static formatInfo(message: string, icon?: string): string;
}
/**
 * Spinner - Interactive thinking indicator
 * Shows animated spinner while processing
 */
export declare class Spinner {
    private static readonly frames;
    private intervalId;
    private frameIndex;
    private message;
    private stream;
    constructor(message?: string);
    /**
     * Start the spinner animation
     */
    start(): void;
    /**
     * Update the spinner message
     */
    update(message: string): void;
    /**
     * Stop the spinner and show success
     */
    succeed(message?: string): void;
    /**
     * Stop the spinner and show failure
     */
    fail(message?: string): void;
    /**
     * Stop the spinner without message
     */
    stop(): void;
    /**
     * Static helper to create and start a spinner
     */
    static create(message: string): Spinner;
}
//# sourceMappingURL=theme.d.ts.map
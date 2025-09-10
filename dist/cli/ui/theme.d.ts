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
//# sourceMappingURL=theme.d.ts.map
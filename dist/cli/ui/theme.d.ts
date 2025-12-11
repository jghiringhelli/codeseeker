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
    file: chalk.Chalk;
    relationship: chalk.Chalk;
    question: chalk.Chalk;
    component: chalk.Chalk;
    taskHeader: chalk.Chalk;
    sectionTitle: chalk.Chalk;
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
    /**
     * Create a prominent section box with title
     */
    static createSectionBox(title: string, icon: string, content: string[]): string;
    /**
     * Format a file path with emphasis
     */
    static formatFile(filePath: string, similarity?: number, type?: string): string;
    /**
     * Format a relationship with visual arrow
     */
    static formatRelationship(from: string, to: string, type: string): string;
    /**
     * Format a question prominently for user attention
     */
    static formatQuestion(question: string, index?: number): string;
    /**
     * Format a component/class entry
     */
    static formatComponent(name: string, type: string, location?: string): string;
    /**
     * Create a mini progress bar
     */
    static createProgressBar(current: number, total: number, width?: number): string;
    /**
     * Create a step indicator with status
     */
    static formatStep(stepNumber: number, totalSteps: number, title: string, status: 'pending' | 'active' | 'complete'): string;
    /**
     * Create a horizontal divider
     */
    static divider(char?: string, width?: number): string;
    /**
     * Format a highlighted section title
     */
    static sectionTitle(title: string, icon?: string): string;
    /**
     * Format a task header for sub-tasks
     */
    static formatTaskHeader(taskId: number, taskType: string, description: string): string;
    /**
     * Format a results summary with statistics
     */
    static formatResultsSummary(stats: {
        files: number;
        components: number;
        relationships: number;
    }): string;
    /**
     * Create emphasized output for important information
     */
    static emphasize(text: string): string;
    /**
     * Format a list of items with visual hierarchy
     */
    static formatList(items: string[], icon?: string, indent?: number): string;
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
/**
 * Welcome Display - Single Responsibility Principle
 * Handles all CLI welcome/branding display logic
 */
export declare class WelcomeDisplay {
    private static readonly LOGO;
    /**
     * Display the main welcome screen
     */
    static displayWelcome(): void;
    /**
     * Display startup information
     */
    static displayStartup(projectPath: string, projectName: string): void;
    /**
     * Display shutdown message
     */
    static displayShutdown(): void;
}
//# sourceMappingURL=welcome-display.d.ts.map
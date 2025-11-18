/**
 * Quality Tool Manager
 * Manages language-specific quality tools with validation, installation, and fallback handling
 * Following SOLID principles with extensible tool categories
 */
export interface QualityTool {
    name: string;
    command: string;
    installCommand?: string;
    configFiles?: string[];
    requiredDependencies?: string[];
    description: string;
    category: 'linting' | 'formatting' | 'security' | 'testing' | 'compilation' | 'complexity';
    weight: number;
}
export interface LanguageTools {
    language: string;
    extensions: string[];
    tools: {
        linting: QualityTool[];
        formatting: QualityTool[];
        security: QualityTool[];
        testing: QualityTool[];
        compilation: QualityTool[];
        complexity: QualityTool[];
    };
}
export interface ToolValidationResult {
    isAvailable: boolean;
    isConfigured: boolean;
    missingDependencies: string[];
    missingConfigFiles: string[];
    installationRequired: boolean;
    skipReason?: string;
}
export interface QualityCheckOptions {
    autoInstall?: boolean;
    skipOnFailure?: boolean;
    userPrompts?: boolean;
    enableUserInteraction?: boolean;
    languages: string[];
    categories: string[];
}
export declare class QualityToolManager {
    private logger;
    private languageToolMap;
    private claudeCodeIntegration;
    constructor(claudeCodeIntegration?: any);
    /**
     * Initialize language-specific tool configurations
     */
    private initializeLanguageTools;
    /**
     * Detect project languages based on file extensions
     */
    detectProjectLanguages(projectPath: string): Promise<string[]>;
    /**
     * Validate if a tool is available and properly configured
     */
    validateTool(tool: QualityTool, projectPath: string): Promise<ToolValidationResult>;
    /**
     * Run quality checks for detected languages with resilient error handling
     */
    runQualityChecks(projectPath: string, options?: QualityCheckOptions): Promise<any>;
    /**
     * Run a single quality tool with comprehensive error handling
     */
    private runSingleTool;
    /**
     * Handle missing tool with user interaction
     */
    private handleMissingTool;
    /**
     * Handle missing configuration
     */
    private handleMissingConfig;
    /**
     * Install tool via Claude Code integration
     */
    private installToolViaClaudeCode;
    /**
     * Create configuration via Claude Code
     */
    private createConfigViaClaudeCode;
    /**
     * Skip a tool and record the reason
     */
    private skipTool;
    /**
     * Parse tool output based on tool type and format
     */
    private parseToolOutput;
    /**
     * Calculate penalty based on tool results
     */
    private calculatePenalty;
    /**
     * Extract human-readable issues from tool results
     */
    private extractIssues;
}
export default QualityToolManager;
//# sourceMappingURL=quality-manager.d.ts.map
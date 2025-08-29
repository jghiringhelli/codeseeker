#!/usr/bin/env node
/**
 * CodeMind CLI - User-facing CLI tool for enhanced Claude Code interactions
 *
 * This is the CLI that users interact with directly. It provides enhanced
 * Claude Code capabilities through integration with the CodeMind ecosystem.
 *
 * The Orchestrator (separate layer) can spawn multiple instances of Claude Code
 * terminals with specialized contexts for complex multi-role scenarios.
 */
export declare class CodeMindCLI {
    private logger;
    private contextOptimizer;
    private db;
    constructor();
    /**
     * Main CLI entry point - processes user commands with enhanced context
     */
    run(args: string[]): Promise<void>;
    /**
     * Default behavior: enhance regular Claude Code with intelligent context
     */
    private enhanceClaudeCodeInteraction;
    /**
     * Run analysis tools and provide results
     */
    private runAnalysis;
    /**
     * Request sequential workflow orchestration
     */
    private requestOrchestration;
    /**
     * Initialize CodeMind for a project
     */
    private initializeProject;
    private parseArgs;
    private prepareClaudeCodeArgs;
    private updateUsageDatabase;
    /**
     * Track sequential workflow usage in database
     */
    private trackSequentialWorkflowUsage;
    private showHelp;
}
export default CodeMindCLI;
//# sourceMappingURL=codemind-cli.d.ts.map
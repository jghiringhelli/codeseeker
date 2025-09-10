#!/usr/bin/env node
/**
 * CodeMind Cycle-Enhanced CLI
 *
 * Integrates automatic validation cycles for quality-aware AI assistance.
 * Runs safety and quality checks before every response to prevent issues.
 */
import { Command } from 'commander';
declare const program: Command;
declare class CycleEnhancedCLI {
    private validationCycle;
    private semanticOrchestrator;
    private contextOptimizer;
    private toolSelector;
    private contextProvider;
    constructor();
    /**
     * Main request processing with integrated validation cycles
     */
    processRequest(userRequest: string, projectPath: string, options?: {
        force?: boolean;
        skipCycles?: boolean;
    }): Promise<string>;
    /**
     * Build comprehensive project context
     */
    private buildProjectContext;
    /**
     * Classify the type of user request
     */
    private classifyRequestType;
    /**
     * Find recently modified files
     */
    private findRecentlyModifiedFiles;
    /**
     * Detect project language and framework
     */
    private detectProjectTechnology;
    /**
     * Run validation cycles
     */
    private runValidationCycles;
    /**
     * Execute request using intelligent tool selection
     */
    private executeIntelligentRequest;
    /**
     * Run post-execution validation
     */
    private runPostExecutionValidation;
    /**
     * Format error response for validation failures
     */
    private formatErrorResponse;
    /**
     * Format semantic orchestrator response
     */
    private formatSemanticResponse;
}
export { CycleEnhancedCLI };
export default program;
//# sourceMappingURL=codemind-cycle.d.ts.map
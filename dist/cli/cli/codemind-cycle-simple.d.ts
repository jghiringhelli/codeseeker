#!/usr/bin/env node
/**
 * CodeMind Cycle-Enhanced CLI - Simplified Version
 *
 * Demonstrates the validation cycle system without complex integrations.
 * Focus on showing how validation cycles work before every request.
 */
import { Command } from 'commander';
declare const program: Command;
declare class SimpleCycleEnhancedCLI {
    private validationCycle;
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
     * Detect project language and framework
     */
    private detectProjectTechnology;
    /**
     * Run validation cycles
     */
    private runValidationCycles;
    /**
     * Simulate request execution
     */
    private simulateRequestExecution;
    /**
     * Run post-execution validation
     */
    private runPostExecutionValidation;
    /**
     * Format error response for validation failures
     */
    private formatErrorResponse;
}
export { SimpleCycleEnhancedCLI };
export default program;
//# sourceMappingURL=codemind-cycle-simple.d.ts.map
#!/usr/bin/env node
/**
 * CodeMind Context Enhancer CLI
 * Core mechanism that enriches Claude Code requests with intelligent context
 *
 * FLOW:
 * 1. User makes request
 * 2. Claude analyzes request and selects tools with parameters
 * 3. Selected tools generate context data
 * 4. Enhanced request sent to Claude Code with context
 * 5. Claude Code executes with enriched context
 * 6. Response assessed and ALL tool databases updated
 * 7. Claude provides final summary
 */
import { Command } from 'commander';
export declare class CodeMindContextEnhancer {
    private logger;
    private autodiscovery;
    private claudeApiUrl;
    private projectPath;
    private projectId;
    constructor();
    /**
     * Main flow: Process user request with context enhancement
     */
    processRequest(userQuery: string, options: any): Promise<void>;
    /**
     * Phase 2: Claude selects tools based on user request
     */
    private claudeSelectsTools;
    /**
     * Phase 3: Generate enhanced context from selected tools
     */
    private generateEnhancedContext;
    /**
     * Phase 4: Execute enhanced request with Claude Code
     */
    private executeEnhancedRequest;
    /**
     * Phase 5: Assess changes and update ALL tool databases
     */
    private assessAndUpdateAllTools;
    /**
     * Phase 6: Get final summary from Claude
     */
    private getClaudeFinalSummary;
    private generateProjectId;
    private callClaude;
    private callClaudeCode;
    private getFallbackToolSelection;
    private getToolParameterSchema;
    private estimateTokens;
    private extractRecommendations;
    private updateToolDatabase;
    private getMinimalAssessment;
    private displayToolSelections;
    private displayContextSummary;
    private displayClaudeResponse;
    private displayAssessment;
}
declare const program: Command;
export default program;
//# sourceMappingURL=codemind-context-enhancer.d.ts.map
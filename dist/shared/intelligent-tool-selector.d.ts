/**
 * Intelligent Tool Selection System
 * Uses Claude Code to assess which tools should be used for each request
 * Similar to MCP client tool selection mechanism
 */
import { InternalTool, ToolMetadata } from './tool-interface';
export interface ToolSelectionRequest {
    userQuery: string;
    projectPath: string;
    projectId: string;
    cliCommand: string;
    intent?: string;
    previousContext?: any;
}
export interface ToolSelectionResult {
    selectedTools: Array<{
        tool: InternalTool;
        metadata: ToolMetadata;
        confidence: number;
        reasoning: string;
        priority: number;
    }>;
    bundleActivated?: string;
    totalConfidence: number;
    selectionReasoning: string;
}
export interface ToolBundle {
    id: string;
    name: string;
    description: string;
    requiredTools: string[];
    optionalTools: string[];
    activationKeywords: string[];
    priority: number;
    useCase: string;
}
export declare class IntelligentToolSelector {
    private logger;
    private claudeCodeApiUrl;
    constructor();
    /**
     * Main tool selection method - uses Claude Code to intelligently select tools
     */
    selectToolsForRequest(request: ToolSelectionRequest): Promise<ToolSelectionResult>;
    /**
     * Generate enriched descriptions for all tools
     */
    private generateToolDescriptions;
    /**
     * Infer use cases based on tool metadata
     */
    private inferUseCases;
    /**
     * Check if any tool bundles should be activated
     */
    private checkBundleActivation;
    /**
     * Build prompt for Claude Code tool selection
     */
    private buildSelectionPrompt;
    /**
     * Call Claude Code API for tool selection analysis
     */
    private callClaudeCodeAnalysis;
    /**
     * Parse text response if JSON parsing fails
     */
    private parseTextResponse;
    /**
     * Parse Claude's response into selection result
     */
    private parseToolSelectionResponse;
    /**
     * Fallback selection when Claude Code is unavailable
     */
    private getFallbackToolSelection;
    /**
     * Get predefined tool bundles
     */
    private getToolBundles;
    /**
     * Get bundle by ID
     */
    getBundle(bundleId: string): ToolBundle | null;
    /**
     * Get all available bundles
     */
    getAllBundles(): ToolBundle[];
}
//# sourceMappingURL=intelligent-tool-selector.d.ts.map
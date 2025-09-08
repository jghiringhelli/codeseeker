/**
 * Enhanced Tool Selector for CodeMind CLI
 * Integrates with Tool Bundle System for intelligent tool selection
 */
import { ToolBundle } from './tool-bundle-system';
export interface ToolDefinition {
    id: string;
    name: string;
    description: string;
    category: string;
    parameters: Record<string, any>;
    confidence: number;
    dependencies?: string[];
    estimatedTokens: number;
}
export interface ToolSelectionResult {
    selectedTools: ToolDefinition[];
    selectedBundles: ToolBundle[];
    confidence: number;
    reasoning: string;
    estimatedTokens: number;
    executionStrategy: 'sequential' | 'parallel' | 'hybrid';
}
export interface SelectionContext {
    userQuery: string;
    projectPath: string;
    projectType?: string;
    intent?: 'overview' | 'refactor' | 'debug' | 'optimize' | 'analyze' | 'quality' | 'security';
    codebaseSize?: 'small' | 'medium' | 'large';
    maxTokens?: number;
    preferBundles?: boolean;
    previousTools?: string[];
}
export declare class EnhancedToolSelector {
    private logger;
    private bundleSystem;
    private availableTools;
    constructor();
    /**
     * Initialize available tools registry
     */
    private initializeAvailableTools;
    /**
     * Select tools based on context, with bundle system integration
     */
    selectTools(context: SelectionContext): ToolSelectionResult;
    /**
     * Select individual tools based on context
     */
    private selectIndividualTools;
    /**
     * Optimize tool selection for token budget
     */
    private optimizeForTokenBudget;
    /**
     * Get all available tools
     */
    getAvailableTools(): ToolDefinition[];
    /**
     * Get tool by ID
     */
    getTool(id: string): ToolDefinition | undefined;
    /**
     * Get available bundles
     */
    getAvailableBundles(): ToolBundle[];
    /**
     * Create a custom tool bundle
     */
    createToolBundle(bundle: Omit<ToolBundle, 'id'>): string;
    /**
     * Update bundle statistics after execution
     */
    updateBundleStats(bundleId: string, success: boolean): void;
    /**
     * Get bundle usage statistics
     */
    getBundleStats(): Record<string, {
        uses: number;
        successRate: number;
    }>;
}
export default EnhancedToolSelector;
//# sourceMappingURL=enhanced-tool-selector.d.ts.map
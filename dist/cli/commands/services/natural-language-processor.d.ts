/**
 * Natural Language Processor Service
 * Single Responsibility: Delegate query analysis to Claude-based intent analyzer
 *
 * This service now delegates all intent detection to ClaudeIntentAnalyzer,
 * which uses actual Claude AI to analyze queries instead of hardcoded keywords.
 */
export interface QueryAnalysis {
    assumptions: string[];
    ambiguities: string[];
    intent: string;
    confidence: number;
    reasoning?: string;
    requiresModifications?: boolean;
    suggestedClarifications?: string[];
    targetEntities?: string[];
}
export declare class NaturalLanguageProcessor {
    private claudeAnalyzer;
    private static readonly KNOWN_COMMANDS;
    constructor();
    /**
     * Analyze user query using Claude Code CLI
     * All intent detection is now delegated to ClaudeIntentAnalyzer
     */
    analyzeQueryAsync(query: string, projectContext?: string): Promise<QueryAnalysis>;
    /**
     * Synchronous version for backward compatibility
     * Returns minimal analysis - callers should migrate to analyzeQueryAsync
     */
    analyzeQuery(query: string): QueryAnalysis;
    /**
     * Determine if input is a natural language query vs a command
     */
    isNaturalLanguageQuery(input: string): boolean;
    /**
     * Convert ClaudeIntentAnalyzer result to legacy QueryAnalysis format
     */
    private convertToQueryAnalysis;
}
//# sourceMappingURL=natural-language-processor.d.ts.map
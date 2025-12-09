"use strict";
/**
 * Natural Language Processor Service
 * Single Responsibility: Delegate query analysis to Claude-based intent analyzer
 *
 * This service now delegates all intent detection to ClaudeIntentAnalyzer,
 * which uses actual Claude AI to analyze queries instead of hardcoded keywords.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NaturalLanguageProcessor = void 0;
const claude_intent_analyzer_1 = require("./claude-intent-analyzer");
class NaturalLanguageProcessor {
    claudeAnalyzer;
    // Known commands for quick filtering (not intent detection)
    static KNOWN_COMMANDS = new Set([
        'help', 'exit', 'quit', 'status', 'setup', 'init', 'project', 'sync',
        'search', 'analyze', 'dedup', 'solid', 'docs', 'instructions', 'watch', 'watcher'
    ]);
    constructor() {
        this.claudeAnalyzer = claude_intent_analyzer_1.ClaudeIntentAnalyzer.getInstance();
    }
    /**
     * Analyze user query using Claude Code CLI
     * All intent detection is now delegated to ClaudeIntentAnalyzer
     */
    async analyzeQueryAsync(query, projectContext) {
        const result = await this.claudeAnalyzer.analyzeQuery(query, projectContext);
        if (result.success && result.analysis) {
            return this.convertToQueryAnalysis(result.analysis);
        }
        // Fallback - should rarely happen as ClaudeIntentAnalyzer has its own fallback
        return {
            assumptions: [],
            ambiguities: ['Unable to analyze query intent'],
            intent: 'general',
            confidence: 0.5
        };
    }
    /**
     * Synchronous version for backward compatibility
     * Returns minimal analysis - callers should migrate to analyzeQueryAsync
     */
    analyzeQuery(query) {
        // Return minimal synchronous result
        // The workflow orchestrator should use analyzeQueryAsync for full Claude analysis
        return {
            assumptions: [],
            ambiguities: [],
            intent: 'general',
            confidence: 0.5,
            reasoning: 'Synchronous call - use analyzeQueryAsync for Claude-based analysis'
        };
    }
    /**
     * Determine if input is a natural language query vs a command
     */
    isNaturalLanguageQuery(input) {
        return this.claudeAnalyzer.isNaturalLanguageQuery(input);
    }
    /**
     * Convert ClaudeIntentAnalyzer result to legacy QueryAnalysis format
     */
    convertToQueryAnalysis(analysis) {
        return {
            assumptions: analysis.assumptions,
            ambiguities: analysis.ambiguities,
            intent: analysis.intent,
            confidence: analysis.confidence,
            reasoning: analysis.reasoning,
            requiresModifications: analysis.requiresModifications,
            suggestedClarifications: analysis.suggestedClarifications,
            targetEntities: analysis.targetEntities
        };
    }
}
exports.NaturalLanguageProcessor = NaturalLanguageProcessor;
//# sourceMappingURL=natural-language-processor.js.map
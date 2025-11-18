"use strict";
/**
 * Natural Language Processor Service
 * Single Responsibility: Process and analyze natural language queries
 * Handles assumption detection and ambiguity analysis
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NaturalLanguageProcessor = void 0;
class NaturalLanguageProcessor {
    // Cache expensive pattern compilations and arrays for better performance
    static KNOWN_COMMANDS = new Set([
        'help', 'exit', 'quit', 'status', 'setup', 'init', 'project', 'sync',
        'search', 'analyze', 'dedup', 'solid', 'docs', 'instructions', 'watch', 'watcher'
    ]);
    static NATURAL_LANGUAGE_PATTERNS = [
        /^(can you|could you|please|help me|i want to|i need to|how do i)/i,
        /\b(add|create|make|build|implement|fix|update|change|modify|improve|refactor)\b/i,
        /\b(authentication|database|api|test|component|service|function|class|method)\b/i,
        /\s+(to|for|with|in|on|at|from)\s+/i,
    ];
    static ASSUMPTION_PATTERNS = [
        { pattern: /(authentication|login|auth)/i, message: 'Assuming you have authentication system in place' },
        { pattern: /(database|db)/i, message: 'Assuming database configuration is available' },
        { pattern: /(api|endpoint)/i, message: 'Assuming REST API structure exists' },
        { pattern: /(test|testing)/i, message: 'Assuming testing framework is set up' }
    ];
    static AMBIGUITY_PATTERNS = [
        { pattern: /\b(it|this|that)\b/i, message: 'Pronouns detected - may need specific file/component references' },
        { pattern: /\b(better|improve|optimize)\b/i, message: 'Improvement request - specific criteria may be needed' },
        { pattern: /\b(similar|like)\b/i, message: 'Comparison requested - reference example may be helpful' }
    ];
    /**
     * Analyze user query for assumptions and ambiguities
     */
    analyzeQuery(query) {
        const assumptions = [];
        const ambiguities = [];
        // Use cached patterns for better performance
        for (const { pattern, message } of NaturalLanguageProcessor.ASSUMPTION_PATTERNS) {
            if (pattern.test(query)) {
                assumptions.push(message);
            }
        }
        for (const { pattern, message } of NaturalLanguageProcessor.AMBIGUITY_PATTERNS) {
            if (pattern.test(query)) {
                ambiguities.push(message);
            }
        }
        // Determine intent using optimized intent patterns
        const lowerQuery = query.toLowerCase();
        let intent = 'general';
        if (lowerQuery.includes('create') || lowerQuery.includes('add') || lowerQuery.includes('generate')) {
            intent = 'create';
        }
        else if (lowerQuery.includes('fix') || lowerQuery.includes('debug') || lowerQuery.includes('resolve')) {
            intent = 'fix';
        }
        else if (lowerQuery.includes('refactor') || lowerQuery.includes('improve') || lowerQuery.includes('optimize')) {
            intent = 'improve';
        }
        else if (lowerQuery.includes('test') || lowerQuery.includes('verify')) {
            intent = 'test';
        }
        // Calculate confidence based on clarity of the request
        const confidence = this.calculateConfidence(query, assumptions, ambiguities);
        return { assumptions, ambiguities, intent, confidence };
    }
    /**
     * Determine if input is a natural language query vs a command
     */
    isNaturalLanguageQuery(input) {
        const trimmed = input.trim();
        // Use cached command set for O(1) lookup instead of O(n) array search
        const firstWord = trimmed.split(' ')[0].toLowerCase();
        if (NaturalLanguageProcessor.KNOWN_COMMANDS.has(firstWord)) {
            return false;
        }
        // Must be longer than typical commands and contain natural language patterns
        if (trimmed.length > 10) {
            return NaturalLanguageProcessor.NATURAL_LANGUAGE_PATTERNS.some(pattern => pattern.test(trimmed));
        }
        return false;
    }
    calculateConfidence(query, assumptions, ambiguities) {
        let confidence = 0.8; // Base confidence
        // Reduce confidence for each ambiguity
        confidence -= ambiguities.length * 0.1;
        // Reduce confidence for vague terms
        const vagueTerms = ['it', 'this', 'that', 'better', 'good', 'nice', 'clean'];
        const lowerQuery = query.toLowerCase();
        const vagueCount = vagueTerms.filter(term => lowerQuery.includes(term)).length;
        confidence -= vagueCount * 0.05;
        // Increase confidence for specific technical terms
        const technicalTerms = ['api', 'database', 'authentication', 'middleware', 'component', 'service', 'class', 'function'];
        const technicalCount = technicalTerms.filter(term => lowerQuery.includes(term)).length;
        confidence += technicalCount * 0.05;
        return Math.max(0.1, Math.min(1.0, confidence));
    }
}
exports.NaturalLanguageProcessor = NaturalLanguageProcessor;
//# sourceMappingURL=natural-language-processor.js.map
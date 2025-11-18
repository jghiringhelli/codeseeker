/**
 * Natural Language Processor Service
 * Single Responsibility: Process and analyze natural language queries
 * Handles assumption detection and ambiguity analysis
 */
export interface QueryAnalysis {
    assumptions: string[];
    ambiguities: string[];
    intent: string;
    confidence: number;
}
export declare class NaturalLanguageProcessor {
    private static readonly KNOWN_COMMANDS;
    private static readonly NATURAL_LANGUAGE_PATTERNS;
    private static readonly ASSUMPTION_PATTERNS;
    private static readonly AMBIGUITY_PATTERNS;
    /**
     * Analyze user query for assumptions and ambiguities
     */
    analyzeQuery(query: string): QueryAnalysis;
    /**
     * Determine if input is a natural language query vs a command
     */
    isNaturalLanguageQuery(input: string): boolean;
    private calculateConfidence;
}
//# sourceMappingURL=natural-language-processor.d.ts.map
/**
 * Assumption Detector Service
 * Analyzes user requests to identify potential assumptions and ambiguities
 * Uses LLM-based analysis with keyword-based fallback
 * Provides structured feedback for Claude Code integration
 */
import { IntentionAnalysis } from './llm-intention-detector';
export interface DetectedAssumption {
    category: 'implementation' | 'scope' | 'format' | 'integration' | 'data' | 'behavior' | 'approach' | 'bugfix';
    assumption: string;
    alternatives?: string[];
    confidence: 'high' | 'medium' | 'low';
}
export interface AmbiguityAnalysis {
    hasAmbiguities: boolean;
    assumptions: DetectedAssumption[];
    clarificationNeeded: string[];
    suggestedQuestions: string[];
}
export declare class AssumptionDetector {
    private llmDetector;
    private enableLLM;
    constructor(enableLLM?: boolean);
    /**
     * Get the full LLM intention analysis (new enhanced method)
     */
    analyzeIntentionWithLLM(userInput: string, projectContext?: any): Promise<IntentionAnalysis | null>;
    /**
     * Enable or disable LLM analysis
     */
    setLLMEnabled(enabled: boolean): void;
    /**
     * Check if LLM is enabled and available
     */
    isLLMEnabled(): boolean;
    /**
     * Analyze user input for assumptions and ambiguities using LLM with keyword fallback
     */
    analyzeRequest(userInput: string, projectContext?: any): Promise<AmbiguityAnalysis>;
    /**
     * Convert LLM intention analysis to legacy AmbiguityAnalysis format
     */
    private convertLLMAnalysisToAmbiguityAnalysis;
    /**
     * Map LLM categories to legacy DetectedAssumption categories
     */
    private mapLLMCategoryToLegacy;
    /**
     * Map LLM confidence (0-1) to legacy confidence levels
     */
    private mapLLMConfidenceToLegacy;
    /**
     * Legacy keyword-based analysis (fallback method)
     */
    private analyzeRequestKeywordBased;
    /**
     * Generate structured prompt enhancement for Claude Code
     */
    generatePromptEnhancement(analysis: AmbiguityAnalysis): string;
    /**
     * Detect when user might want research vs immediate implementation
     */
    private hasApproachAmbiguity;
    private hasImplementationAmbiguity;
    private hasScopeAmbiguity;
    private hasDataAmbiguity;
    private hasFormatAmbiguity;
    private hasIntegrationAmbiguity;
    private hasBehaviorAmbiguity;
    /**
     * Detect when user is requesting bug fixes
     */
    private hasBugFixIntent;
}
export default AssumptionDetector;
//# sourceMappingURL=assumption-detector.d.ts.map
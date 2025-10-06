/**
 * Assumption Detector Service
 * Analyzes user requests to identify potential assumptions and ambiguities
 * Provides structured feedback for Claude Code integration
 */
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
    /**
     * Analyze user input for assumptions and ambiguities
     */
    analyzeRequest(userInput: string, projectContext?: any): AmbiguityAnalysis;
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
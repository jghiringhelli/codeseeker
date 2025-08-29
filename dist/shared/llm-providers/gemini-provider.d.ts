import { BaseLLMProvider, AnalysisOptions, LLMResponse, CodeGenerationRequest, CodeGenerationResponse, CodeReviewRequest, CodeReviewResponse, ValidationResult, CommandResult } from './base-provider';
/**
 * Google Gemini CLI Provider
 * Template for integrating with future Gemini CLI tools
 * Designed for when Google releases CLI tools similar to Claude Code
 */
export declare class GeminiProvider extends BaseLLMProvider {
    private geminiCommand;
    private workingDirectory;
    constructor(workingDirectory?: string);
    analyze(prompt: string, options?: AnalysisOptions): Promise<LLMResponse>;
    generateCode(request: CodeGenerationRequest): Promise<CodeGenerationResponse>;
    reviewCode(request: CodeReviewRequest): Promise<CodeReviewResponse>;
    isAvailable(): Promise<boolean>;
    validateConfiguration(): Promise<ValidationResult>;
    executeCommand(command: string, args: string[]): Promise<CommandResult>;
    private extractCode;
    private extractExplanation;
    private extractDependencies;
    private extractTestSuggestions;
    private extractConfidence;
    private parseIssues;
    private parseSuggestions;
    private parseQualityScore;
    private estimateTokens;
}
export default GeminiProvider;
//# sourceMappingURL=gemini-provider.d.ts.map
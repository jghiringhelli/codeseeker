import { BaseLLMProvider, AnalysisOptions, LLMResponse, CodeGenerationRequest, CodeGenerationResponse, CodeReviewRequest, CodeReviewResponse, ValidationResult, CommandResult } from './base-provider';
/**
 * ChatGPT/GPT CLI Provider
 * Template for integrating with ChatGPT CLI tools (when available)
 * Currently supports hypothetical future CLI implementations
 */
export declare class GPTProvider extends BaseLLMProvider {
    private gptCommand;
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
export default GPTProvider;
//# sourceMappingURL=gpt-provider.d.ts.map
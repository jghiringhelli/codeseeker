import { BaseLLMProvider, AnalysisOptions, LLMResponse, CodeGenerationRequest, CodeGenerationResponse, CodeReviewRequest, CodeReviewResponse, ValidationResult, CommandResult } from './base-provider';
/**
 * Claude Code CLI Provider
 * Integrates with the official Claude Code CLI tool from Anthropic
 */
export declare class ClaudeProvider extends BaseLLMProvider {
    private claudeCommand;
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
    private createTempFile;
    private getFileExtension;
    private estimateTokens;
}
export default ClaudeProvider;
//# sourceMappingURL=claude-provider.d.ts.map
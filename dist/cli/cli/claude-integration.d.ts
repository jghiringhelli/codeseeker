import { ContextOptimization } from './context-optimizer';
export interface ClaudeResponse {
    content: string;
    contextUsed?: {
        tokensUsed: number;
        filesIncluded: string[];
        optimizationStrategy: string;
    };
    usage?: {
        inputTokens: number;
        outputTokens: number;
    };
}
export interface ClaudeConfig {
    apiKey?: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
}
export declare class ClaudeIntegration {
    private client;
    private logger;
    private config;
    constructor(config?: ClaudeConfig);
    private initialize;
    askQuestion(question: string, contextOptimization: ContextOptimization): Promise<ClaudeResponse>;
    private buildPrompt;
    private simulateResponse;
    private estimateTokens;
    testConnection(): Promise<boolean>;
}
export default ClaudeIntegration;
//# sourceMappingURL=claude-integration.d.ts.map
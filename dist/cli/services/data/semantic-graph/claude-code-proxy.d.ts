/**
 * Claude Code CLI Proxy - Dependency Inversion Principle
 * Uses Claude Code CLI as external semantic analysis service for unsupported languages
 * or when Tree-sitter parsing fails
 */
import { FileInfo } from '../../monitoring/file-scanning/file-scanner-interfaces';
import { CodeEntity, SemanticRelationship } from './tree-sitter-semantic-builder';
export interface ClaudeAnalysisResult {
    entities: CodeEntity[];
    relationships: SemanticRelationship[];
    summary: string;
    confidence: number;
    processingTime: number;
}
export declare class ClaudeCodeProxy {
    private claudeCommand;
    private maxRetries;
    private readonly timeout;
    private entityIdCounter;
    private relationshipIdCounter;
    constructor(claudeCommand?: string, maxRetries?: number);
    /**
     * Analyze file using Claude Code CLI
     */
    analyzeFile(file: FileInfo): Promise<ClaudeAnalysisResult>;
    /**
     * Batch analyze multiple files using Claude Code
     */
    analyzeFiles(files: FileInfo[]): Promise<Map<string, ClaudeAnalysisResult>>;
    private createAnalysisPrompt;
    private executeClaudeCodeCentralized;
    private parseClaudeResponse;
    private transformEntities;
    private transformRelationships;
    private extractWithRegex;
    private createFallbackAnalysis;
    private validateEntityType;
    private validateRelationshipType;
    private generateEntityId;
    private generateRelationshipId;
    private delay;
}
//# sourceMappingURL=claude-code-proxy.d.ts.map
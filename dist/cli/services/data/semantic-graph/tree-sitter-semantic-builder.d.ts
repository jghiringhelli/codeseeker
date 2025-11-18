/**
 * Tree-sitter Semantic Graph Builder - SOLID Principles
 * Uses Tree-sitter for CPU-optimized AST parsing and semantic relationship extraction
 * Builds Neo4j knowledge graph from discovered code files
 */
import { FileInfo } from '../../monitoring/file-scanning/file-scanner-interfaces';
export interface SemanticRelationship {
    id: string;
    sourceFile: string;
    targetFile?: string;
    sourceEntity: string;
    targetEntity: string;
    relationshipType: 'IMPORTS' | 'EXTENDS' | 'IMPLEMENTS' | 'CALLS' | 'DEFINES' | 'USES' | 'CONTAINS';
    confidence: number;
    lineNumber: number;
    metadata: Record<string, any>;
}
export interface CodeEntity {
    id: string;
    name: string;
    type: 'module' | 'class' | 'function' | 'method' | 'variable' | 'interface' | 'type';
    filePath: string;
    startLine: number;
    endLine: number;
    signature?: string;
    docstring?: string;
    modifiers: string[];
    metadata: Record<string, any>;
}
export interface SemanticGraphData {
    entities: CodeEntity[];
    relationships: SemanticRelationship[];
    fileNodes: Map<string, string>;
    stats: {
        totalFiles: number;
        totalEntities: number;
        totalRelationships: number;
        byLanguage: Record<string, number>;
        processingTime: number;
    };
}
export declare class TreeSitterSemanticBuilder {
    private parsers;
    private entityIdCounter;
    private relationshipIdCounter;
    constructor();
    /**
     * Initialize Tree-sitter parsers for supported languages
     */
    private initializeParsers;
    /**
     * Build semantic graph from discovered files
     */
    buildSemanticGraph(files: FileInfo[]): Promise<SemanticGraphData>;
    private shouldProcessFile;
    private getTreeSitterLanguage;
    /**
     * Process file using Tree-sitter AST parsing
     */
    private processWithTreeSitter;
    /**
     * Extract semantic information from Tree-sitter AST
     */
    private extractFromAST;
    private extractImportRelationship;
    private extractClassEntity;
    private extractFunctionEntity;
    private extractCallRelationship;
    /**
     * Fallback to Claude Code CLI for unsupported languages or failed parsing
     */
    private processWithClaudeProxy;
    private buildCrossFileRelationships;
    private findImportPath;
    private getClassName;
    private getFunctionName;
    private getSuperClass;
    private getCallTarget;
    private extractModifiers;
    private extractFunctionSignature;
    private isKeyword;
    private generateEntityId;
    private generateRelationshipId;
}
//# sourceMappingURL=tree-sitter-semantic-builder.d.ts.map
/**
 * Content Chunker Service - Single Responsibility
 * Handles breaking down files into searchable semantic chunks
 */
import { IContentChunker, SemanticChunk } from '../../../core/interfaces/search-interfaces';
export declare class ContentChunker implements IContentChunker {
    private readonly chunkSize;
    private readonly chunkOverlap;
    createSemanticChunks(filePath: string, content: string, fileHash: string): Promise<SemanticChunk[]>;
    createStructuralChunks(filePath: string, content: string, fileHash: string, lines: string[]): Promise<SemanticChunk[]>;
    private createSingleChunk;
    private createStructuralChunk;
    private getLineNumber;
    private detectLanguage;
    private extractFunctions;
    private extractClasses;
    private extractFunctionNames;
    private extractClassNames;
    private extractImports;
    private extractExports;
    private calculateSignificance;
}
//# sourceMappingURL=content-chunker.d.ts.map
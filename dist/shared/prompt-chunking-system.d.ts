/**
 * Prompt Chunking System for Claude Code Integration
 * Handles 25K prompt limit by intelligently chunking and compressing prompts
 */
export interface ChunkResult {
    success: boolean;
    finalPrompt: string;
    tokensUsed: number;
    chunksProcessed: number;
    error?: string;
}
export declare class PromptChunkingSystem {
    private static readonly CLAUDE_CODE_LIMIT;
    private static readonly CHUNK_SIZE;
    private static readonly COMPRESSION_INSTRUCTION;
    /**
     * Process a large prompt by chunking and compressing if needed
     */
    static processLargePrompt(prompt: string, projectPath: string, originalRequest: string): Promise<ChunkResult>;
    /**
     * Split prompt into chunks that can be processed individually
     */
    private static splitIntoChunks;
    /**
     * Compress a single chunk using Claude Code
     */
    private static compressChunk;
    /**
     * Get compression statistics for debugging
     */
    static getCompressionStats(original: string, compressed: string): {
        originalLength: number;
        compressedLength: number;
        reductionPercent: number;
        underLimit: boolean;
    };
}
export default PromptChunkingSystem;
//# sourceMappingURL=prompt-chunking-system.d.ts.map
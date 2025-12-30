/**
 * Prompt Chunking System for Claude Code Integration
 * Handles 25K prompt limit by intelligently chunking and compressing prompts
 */

import * as path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import { PlatformUtils } from './platform-utils';

export interface ChunkResult {
  success: boolean;
  finalPrompt: string;
  tokensUsed: number;
  chunksProcessed: number;
  error?: string;
}

export class PromptChunkingSystem {
  private static readonly CLAUDE_CODE_LIMIT = 25000; // Claude Code 25K character limit
  private static readonly CHUNK_SIZE = 20000; // Leave buffer for instructions
  private static readonly COMPRESSION_INSTRUCTION = `
COMPRESSION TASK: You are receiving a large prompt that exceeds Claude Code's 25K limit.
Please compress this content while preserving ALL essential information:

1. Maintain all technical details, file paths, and code snippets
2. Preserve the core request and context
3. Keep all important requirements and constraints
4. Compress redundant explanations and verbose descriptions
5. Maintain structured format for easy processing

Return ONLY the compressed version without additional commentary.

CONTENT TO COMPRESS:
`;

  /**
   * Process a large prompt by chunking and compressing if needed
   */
  static async processLargePrompt(
    prompt: string,
    projectPath: string,
    originalRequest: string
  ): Promise<ChunkResult> {
    const promptLength = prompt.length;

    console.log(`📏 Prompt length: ${promptLength} characters`);

    // If under limit, process normally
    if (promptLength <= this.CLAUDE_CODE_LIMIT) {
      console.log(`✅ Prompt under ${this.CLAUDE_CODE_LIMIT} character limit, processing normally`);
      return {
        success: true,
        finalPrompt: prompt,
        tokensUsed: Math.ceil(promptLength / 4),
        chunksProcessed: 0
      };
    }

    console.log(`⚠️ Prompt exceeds ${this.CLAUDE_CODE_LIMIT} character limit, starting compression process...`);
    console.log(`📦 Will split into chunks and compress using Claude Code`);

    try {
      // Split prompt into manageable chunks
      const chunks = this.splitIntoChunks(prompt);
      console.log(`🔄 Created ${chunks.length} chunks for compression`);

      let compressedContent = '';
      let totalTokensUsed = 0;

      // Process each chunk through Claude Code for compression
      for (let i = 0; i < chunks.length; i++) {
        console.log(`🔧 Compressing chunk ${i + 1}/${chunks.length}...`);

        const compressionPrompt = this.COMPRESSION_INSTRUCTION + chunks[i];
        const compressedChunk = await this.compressChunk(compressionPrompt, projectPath);

        if (!compressedChunk.success) {
          console.error(`❌ Failed to compress chunk ${i + 1}: ${compressedChunk.error}`);
          return {
            success: false,
            finalPrompt: '',
            tokensUsed: 0,
            chunksProcessed: i,
            error: `Compression failed at chunk ${i + 1}: ${compressedChunk.error}`
          };
        }

        compressedContent += compressedChunk.content + '\n\n';
        totalTokensUsed += compressedChunk.tokensUsed;
      }

      // Final check - if still too large, do one more compression pass
      if (compressedContent.length > this.CLAUDE_CODE_LIMIT) {
        console.log(`🔄 Compressed content still too large (${compressedContent.length}), doing final compression pass...`);

        const finalCompressionPrompt = `
FINAL COMPRESSION: The content is still too large. Please create an ultra-compressed version that:
1. Focuses ONLY on the core request: "${originalRequest}"
2. Includes only the most essential context and technical details
3. Removes any redundant or secondary information
4. Stays under 20,000 characters

CONTENT TO ULTRA-COMPRESS:
${compressedContent}`;

        const finalCompressed = await this.compressChunk(finalCompressionPrompt, projectPath);
        if (finalCompressed.success) {
          compressedContent = finalCompressed.content;
          totalTokensUsed += finalCompressed.tokensUsed;
        }
      }

      const finalLength = compressedContent.length;
      console.log(`✅ Compression complete: ${promptLength} → ${finalLength} chars (${Math.round((1 - finalLength/promptLength) * 100)}% reduction)`);

      return {
        success: true,
        finalPrompt: compressedContent,
        tokensUsed: totalTokensUsed,
        chunksProcessed: chunks.length
      };

    } catch (error) {
      console.error(`❌ Prompt chunking system error: ${error.message}`);
      return {
        success: false,
        finalPrompt: '',
        tokensUsed: 0,
        chunksProcessed: 0,
        error: error.message
      };
    }
  }

  /**
   * Split prompt into chunks that can be processed individually
   */
  private static splitIntoChunks(prompt: string): string[] {
    const chunks: string[] = [];
    let currentIndex = 0;

    while (currentIndex < prompt.length) {
      let chunkEnd = currentIndex + this.CHUNK_SIZE;

      // Try to break at natural boundaries (newlines, sentences)
      if (chunkEnd < prompt.length) {
        // Look for good break points
        const breakPoints = ['\n\n', '\n', '. ', '} ', '); '];

        for (const breakPoint of breakPoints) {
          const lastBreak = prompt.lastIndexOf(breakPoint, chunkEnd);
          if (lastBreak > currentIndex + this.CHUNK_SIZE * 0.8) {
            chunkEnd = lastBreak + breakPoint.length;
            break;
          }
        }
      }

      chunks.push(prompt.slice(currentIndex, chunkEnd));
      currentIndex = chunkEnd;
    }

    return chunks;
  }

  /**
   * Compress a single chunk using Claude Code
   */
  private static async compressChunk(
    compressionPrompt: string,
    projectPath: string
  ): Promise<{ success: boolean; content: string; tokensUsed: number; error?: string }> {
    try {
      // Create temp file for compression prompt
      const { writeFile, unlink } = await import('fs/promises');
      const { randomBytes } = await import('crypto');
      const tmpDir = PlatformUtils.getTempDir();
      const inputFile = path.join(tmpDir, `compression-input-${randomBytes(8).toString('hex')}.txt`);

      await writeFile(inputFile, compressionPrompt, 'utf8');

      // Execute Claude Code compression
      const execAsync = promisify(exec);
      const command = PlatformUtils.getClaudeCodeCommand(inputFile);
      const execOptions = PlatformUtils.getExecOptions({
        cwd: projectPath,
        timeout: 45000, // Longer timeout for compression
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env, FORCE_COLOR: '0' }
      });

      const { stdout, stderr } = await execAsync(command, execOptions);

      // Clean up temp file
      try {
        await unlink(inputFile);
      } catch {
        // Ignore cleanup errors
      }

      const stdoutStr = String(stdout);
      const stderrStr = String(stderr);

      if (stderrStr && stderrStr.trim()) {
        console.warn(`⚠️ Compression stderr: ${stderrStr.trim()}`);
      }

      const tokensUsed = Math.ceil((compressionPrompt.length + stdoutStr.length) / 4);

      return {
        success: true,
        content: stdoutStr.trim(),
        tokensUsed
      };

    } catch (error) {
      return {
        success: false,
        content: '',
        tokensUsed: 0,
        error: error.message
      };
    }
  }

  /**
   * Get compression statistics for debugging
   */
  static getCompressionStats(original: string, compressed: string): {
    originalLength: number;
    compressedLength: number;
    reductionPercent: number;
    underLimit: boolean;
  } {
    const originalLength = original.length;
    const compressedLength = compressed.length;
    const reductionPercent = Math.round((1 - compressedLength/originalLength) * 100);

    return {
      originalLength,
      compressedLength,
      reductionPercent,
      underLimit: compressedLength <= this.CLAUDE_CODE_LIMIT
    };
  }
}

export default PromptChunkingSystem;
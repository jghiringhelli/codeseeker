/**
 * Prompt Processing Service
 * SOLID Principles: Single Responsibility - Handle prompt processing and chunking only
 */

import { Logger } from '../../../utils/logger';
import { PromptChunkingSystem } from '../../../shared/prompt-chunking-system';
import {
  IPromptProcessingService,
  ProcessingResult
} from '../interfaces/index';

export class PromptProcessingService implements IPromptProcessingService {
  private logger = Logger.getInstance();

  async processLargePrompt(
    prompt: string,
    projectPath: string,
    originalRequest: string
  ): Promise<ProcessingResult> {
    try {
      this.logger.debug(`📏 Processing prompt: ${prompt.length} characters`);

      // Use existing PromptChunkingSystem for consistency
      const chunkResult = await PromptChunkingSystem.processLargePrompt(
        prompt,
        projectPath,
        originalRequest
      );

      if (!chunkResult.success) {
        return {
          success: false,
          finalPrompt: prompt,
          chunksProcessed: 0,
          tokensUsed: 0,
          error: chunkResult.error
        };
      }

      return {
        success: true,
        finalPrompt: chunkResult.finalPrompt,
        chunksProcessed: chunkResult.chunksProcessed,
        tokensUsed: chunkResult.tokensUsed
      };
    } catch (error) {
      this.logger.error('Failed to process large prompt:', error);
      return {
        success: false,
        finalPrompt: prompt,
        chunksProcessed: 0,
        tokensUsed: 0,
        error: error instanceof Error ? error.message : 'Unknown processing error'
      };
    }
  }

  chunkPrompt(prompt: string, maxChunkSize: number = 8000): string[] {
    try {
      const chunks: string[] = [];

      if (prompt.length <= maxChunkSize) {
        return [prompt];
      }

      // Try to split on logical boundaries (paragraphs, sentences)
      const paragraphs = prompt.split(/\n\s*\n/);
      let currentChunk = '';

      for (const paragraph of paragraphs) {
        if ((currentChunk + paragraph).length <= maxChunkSize) {
          currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        } else {
          if (currentChunk) {
            chunks.push(currentChunk);
            currentChunk = paragraph;
          } else {
            // Paragraph is too large, split by sentences
            const sentences = this.splitBySentences(paragraph, maxChunkSize);
            chunks.push(...sentences);
          }
        }
      }

      if (currentChunk) {
        chunks.push(currentChunk);
      }

      this.logger.debug(`📝 Split prompt into ${chunks.length} chunks`);
      return chunks;
    } catch (error) {
      this.logger.error('Failed to chunk prompt:', error);
      return [prompt]; // Return original if chunking fails
    }
  }

  async compressContext(context: string): Promise<string> {
    try {
      if (context.length <= 2000) {
        return context; // No compression needed for small context
      }

      // Simple compression strategies
      let compressed = context;

      // Remove excessive whitespace
      compressed = compressed.replace(/\s+/g, ' ').trim();

      // Remove common boilerplate
      compressed = this.removeBoilerplate(compressed);

      // Summarize if still too large
      if (compressed.length > 5000) {
        compressed = await this.summarizeContent(compressed);
      }

      this.logger.debug(`🗜️ Compressed context: ${context.length} → ${compressed.length} chars`);
      return compressed;
    } catch (error) {
      this.logger.error('Failed to compress context:', error);
      return context; // Return original if compression fails
    }
  }

  // Validation methods
  validatePromptStructure(prompt: string): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check for basic structure
    if (prompt.trim().length === 0) {
      issues.push('Prompt is empty');
    }

    // Check for excessive repetition
    if (this.hasExcessiveRepetition(prompt)) {
      issues.push('Prompt contains excessive repetition');
    }

    // Check for unbalanced brackets/quotes
    if (this.hasUnbalancedDelimiters(prompt)) {
      issues.push('Prompt contains unbalanced delimiters');
    }

    // Check for very long lines
    const lines = prompt.split('\n');
    const longLines = lines.filter(line => line.length > 500);
    if (longLines.length > 0) {
      issues.push(`${longLines.length} lines exceed 500 characters`);
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  optimizePrompt(prompt: string): string {
    try {
      let optimized = prompt;

      // Remove unnecessary whitespace
      optimized = optimized.replace(/\n\s*\n\s*\n/g, '\n\n');
      optimized = optimized.replace(/[ \t]+/g, ' ');

      // Remove repetitive patterns
      optimized = this.removeRepetitivePatterns(optimized);

      // Consolidate similar instructions
      optimized = this.consolidateInstructions(optimized);

      this.logger.debug(`⚡ Optimized prompt: ${prompt.length} → ${optimized.length} chars`);
      return optimized;
    } catch (error) {
      this.logger.error('Failed to optimize prompt:', error);
      return prompt;
    }
  }

  private splitBySentences(text: string, maxChunkSize: number): string[] {
    const sentences = text.split(/(?<=[.!?])\s+/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length <= maxChunkSize) {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = sentence;
        } else {
          // Sentence is too large, force split
          chunks.push(sentence.substring(0, maxChunkSize));
          currentChunk = sentence.substring(maxChunkSize);
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  private removeBoilerplate(text: string): string {
    // Remove common boilerplate patterns
    const boilerplatePatterns = [
      /\/\*\*[\s\S]*?\*\//g, // JSDoc comments
      /\/\/.*$/gm, // Single line comments
      /^\s*import\s+.*$/gm, // Import statements
      /^\s*export\s+.*$/gm, // Export statements
      /console\.(log|debug|info|warn|error)\([^)]*\);?/g // Console logs
    ];

    let cleaned = text;
    for (const pattern of boilerplatePatterns) {
      cleaned = cleaned.replace(pattern, '');
    }

    return cleaned.replace(/\n\s*\n\s*\n/g, '\n\n').trim();
  }

  private async summarizeContent(content: string): Promise<string> {
    // Simple summarization - in production, this could use AI
    const lines = content.split('\n').filter(line => line.trim());

    if (lines.length <= 50) {
      return content;
    }

    // Keep first 20 lines, last 10 lines, and sample from middle
    const summary = [
      ...lines.slice(0, 20),
      '... [content abbreviated] ...',
      ...lines.slice(-10)
    ].join('\n');

    return summary;
  }

  private hasExcessiveRepetition(text: string): boolean {
    // Simple check for repeated phrases
    const words = text.toLowerCase().split(/\s+/);
    const wordCounts = new Map<string, number>();

    for (const word of words) {
      if (word.length > 3) { // Only check meaningful words
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    }

    // Check if any word appears more than 10% of the time
    const maxRepetition = Math.max(...wordCounts.values());
    return maxRepetition > words.length * 0.1;
  }

  private hasUnbalancedDelimiters(text: string): boolean {
    const brackets = { '(': 0, '[': 0, '{': 0, '"': 0, "'": 0 };

    for (const char of text) {
      switch (char) {
        case '(': brackets['(']++; break;
        case ')': brackets['(']--; break;
        case '[': brackets['[']++; break;
        case ']': brackets['[']--; break;
        case '{': brackets['{']++; break;
        case '}': brackets['{']--; break;
        case '"': brackets['"'] = 1 - brackets['"']; break;
        case "'": brackets["'"] = 1 - brackets["'"]; break;
      }
    }

    return Object.values(brackets).some(count => count !== 0);
  }

  private removeRepetitivePatterns(text: string): string {
    // Remove repetitive patterns (simplified)
    return text.replace(/(.{10,}?)\1{3,}/g, '$1');
  }

  private consolidateInstructions(text: string): string {
    // Simple consolidation of similar instructions
    const lines = text.split('\n');
    const consolidated: string[] = [];
    const seen = new Set<string>();

    for (const line of lines) {
      const normalized = line.toLowerCase().replace(/\s+/g, ' ').trim();
      if (normalized && !seen.has(normalized)) {
        consolidated.push(line);
        seen.add(normalized);
      }
    }

    return consolidated.join('\n');
  }
}
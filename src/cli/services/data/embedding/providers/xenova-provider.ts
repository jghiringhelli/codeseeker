/**
 * Xenova Embedding Provider
 * SOLID Principles: Single Responsibility - Handle Xenova transformers only
 */

import { Logger } from '../../../../../utils/logger';
import { IEmbeddingProvider, EmbeddingConfig } from '../interfaces';

// Dynamic import for ES module compatibility
let pipeline: any = null;

export class XenovaEmbeddingProvider implements IEmbeddingProvider {
  private logger = Logger.getInstance();
  private xenovaExtractor?: any;

  constructor(private config: EmbeddingConfig) {}

  canHandle(model: string): boolean {
    return model.startsWith('Xenova/');
  }

  async initialize(): Promise<void> {
    if (!pipeline) {
      try {
        // Use dynamic import with proper module resolution
        const transformersModule = await (eval('import("@xenova/transformers")') as Promise<any>);
        const { pipeline: pipelineFunc } = transformersModule;
        pipeline = await pipelineFunc('feature-extraction', this.config.model);
        this.logger.debug('Xenova transformers initialized');
      } catch (error: any) {
        this.logger.error('Failed to initialize Xenova:', error);

        // If ES Module import fails, provide helpful feedback
        if (error.message?.includes('require() of ES Module')) {
          this.logger.warn('⚠️ Xenova transformers requires ES Module support');
          this.logger.info('💡 Falling back to local embeddings');
          // Don't throw - let it fall back to local embeddings
          return;
        }

        throw new Error(`Failed to initialize Xenova transformers: ${error.message}`);
      }
    }
    this.xenovaExtractor = pipeline;
  }

  async generateEmbedding(text: string, context?: string): Promise<number[]> {
    if (!this.xenovaExtractor) {
      throw new Error('Xenova provider not initialized');
    }

    try {
      // Truncate text to prevent token limit issues
      const truncatedText = this.truncateText(text, this.config.maxTokens);

      // Generate embedding
      const output = await this.xenovaExtractor(truncatedText, {
        pooling: 'mean',
        normalize: true,
      });

      // Convert tensor to array
      let embedding: number[];
      if (output?.data) {
        embedding = Array.from(output.data);
      } else if (Array.isArray(output)) {
        embedding = output;
      } else {
        embedding = Array.from(output);
      }

      this.logger.debug(`Generated Xenova embedding: ${embedding.length} dimensions`);
      return embedding;

    } catch (error) {
      this.logger.error('Failed to generate Xenova embedding:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    // Cleanup resources if needed
    this.xenovaExtractor = null;
    if (pipeline) {
      pipeline = null;
    }
  }

  private truncateText(text: string, maxTokens: number): string {
    // Rough token estimation (1 token ≈ 4 characters for English)
    const maxChars = maxTokens * 4;

    if (text.length <= maxChars) {
      return text;
    }

    // Truncate and ensure we don't break words
    const truncated = text.substring(0, maxChars);
    const lastSpace = truncated.lastIndexOf(' ');

    return lastSpace > maxChars * 0.8 ? truncated.substring(0, lastSpace) : truncated;
  }
}
/**
 * OpenAI Embedding Provider
 * SOLID Principles: Single Responsibility - Handle OpenAI API only
 */

import { Logger } from '../../../../../utils/logger';
import { IEmbeddingProvider, EmbeddingConfig } from '../interfaces';

export class OpenAIEmbeddingProvider implements IEmbeddingProvider {
  private logger = Logger.getInstance();
  private openaiClient?: any;

  constructor(private config: EmbeddingConfig) {}

  canHandle(model: string): boolean {
    return model.includes('text-embedding');
  }

  async initialize(): Promise<void> {
    try {
      if (!this.config.openaiApiKey) {
        throw new Error('OpenAI API key is required for OpenAI embeddings');
      }

      // Dynamic import for OpenAI client - disabled for MVP
      try {
        // TODO: Install openai package for production
        // const { OpenAI } = await import('openai');
        // this.openaiClient = new OpenAI({
        //   apiKey: this.config.openaiApiKey
        // });
        throw new Error('OpenAI provider not available in MVP build');
        this.logger.info('✅ OpenAI client initialized');
      } catch (importError) {
        this.logger.warn('OpenAI package not available, install with: npm install openai');
        throw new Error('OpenAI package not installed');
      }
    } catch (error) {
      this.logger.error('Failed to initialize OpenAI client:', error);
      throw error;
    }
  }

  async generateEmbedding(text: string, context?: string): Promise<number[]> {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not initialized');
    }

    try {
      // Truncate text to prevent token limit issues
      const truncatedText = text.substring(0, this.config.maxTokens);

      const response = await this.openaiClient.embeddings.create({
        model: this.config.model,
        input: truncatedText
      });

      const embedding = response.data[0].embedding;
      this.logger.debug(`Generated OpenAI embedding: ${embedding.length} dimensions`);

      return embedding;
    } catch (error) {
      this.logger.error('Failed to generate OpenAI embedding:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    // Cleanup OpenAI client if needed
    this.openaiClient = null;
  }
}
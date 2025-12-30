/**
 * Local Embedding Provider
 * SOLID Principles: Single Responsibility - Handle local TF-IDF embeddings only
 */

import * as crypto from 'crypto';
import { Logger } from '../../../../../utils/logger';
import { IEmbeddingProvider, EmbeddingConfig } from '../interfaces';

export class LocalEmbeddingProvider implements IEmbeddingProvider {
  private logger = Logger.getInstance();

  constructor(private config: EmbeddingConfig) {}

  canHandle(model: string): boolean {
    return model === 'local';
  }

  async initialize(): Promise<void> {
    // No initialization needed for local embeddings
    this.logger.debug('Local embedding provider initialized');
  }

  async generateEmbedding(text: string, context?: string): Promise<number[]> {
    try {
      // Simple TF-IDF based embedding
      const words = text.toLowerCase().split(/\W+/);
      const wordFreq = new Map<string, number>();

      // Calculate word frequencies
      for (const word of words) {
        if (word.length > 2) {
          wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
        }
      }

      // Create a fixed-size vector (384 dimensions to match small models)
      const vectorSize = 384;
      const embedding = new Array(vectorSize).fill(0);

      // Hash words to positions and set frequencies
      let i = 0;
      for (const [word, freq] of wordFreq.entries()) {
        const hash = crypto.createHash('md5').update(word).digest();
        const position = hash.readUInt32BE(0) % vectorSize;
        embedding[position] += freq / words.length;
        if (++i >= vectorSize / 2) break; // Limit to prevent oversaturation
      }

      // Normalize the vector
      const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      if (magnitude > 0) {
        for (let j = 0; j < embedding.length; j++) {
          embedding[j] /= magnitude;
        }
      }

      this.logger.debug(`Generated local embedding: ${embedding.length} dimensions`);
      return embedding;

    } catch (error) {
      this.logger.error('Failed to generate local embedding:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    // No cleanup needed for local embeddings
  }
}
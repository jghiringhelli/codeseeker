/**
 * Transformers.js Embedding Provider
 * SOLID Principles: Single Responsibility - Handle transformers.js feature extraction only
 *
 * Runs on `@huggingface/transformers`, the maintained successor to `@xenova/transformers`.
 * The old package is frozen at 2.17.2 and will never receive another patch, which left
 * four unfixable advisories in the dependency tree.
 *
 * VECTOR COMPATIBILITY — do not change `EMBEDDING_DTYPE` casually.
 *
 * `@xenova` v2 defaulted to the **quantized (q8)** ONNX weights. `@huggingface` v4
 * defaults to fp32. Same model id, same dimensions, different numbers: measured max
 * component delta 1.03e-2 between them, which is far above noise and would silently
 * degrade ranking against every index built before the change. Pinning q8 reproduces the
 * old vectors to 3.17e-7 — floating-point noise — so existing indexes stay valid and no
 * user has to reindex.
 *
 * Verify with `node scripts/embedding-fingerprint.js --compare reports/embedding/baseline.json`
 * before changing the model, the dtype, or this package.
 */

import { Logger } from '../../../../../utils/logger';
import { IEmbeddingProvider, EmbeddingConfig } from '../interfaces';

/** Quantization of the ONNX weights. Changing this invalidates every existing index. */
const EMBEDDING_DTYPE = 'q8';

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
        // `@huggingface/transformers` ships a CommonJS build, so a plain require works.
        // The previous package was ESM-only and needed an `eval('import(...)')` to get
        // past TypeScript's module transform — that workaround is no longer necessary.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { pipeline: pipelineFunc } = require('@huggingface/transformers');
        pipeline = await pipelineFunc('feature-extraction', this.config.model, {
          dtype: EMBEDDING_DTYPE,
        });
        this.logger.debug(`transformers.js initialized (${this.config.model}, dtype=${EMBEDDING_DTYPE})`);
      } catch (error: any) {
        this.logger.error('Failed to initialize transformers.js:', error);
        throw new Error(`Failed to initialize transformers.js: ${error.message}`);
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
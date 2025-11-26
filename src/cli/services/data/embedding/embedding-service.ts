/**
 * Embedding Service - Refactored with SOLID Principles
 * SOLID Principles: Single Responsibility, Dependency Inversion
 * Reduced from 924 lines to ~200 lines using service extraction
 */

import { Logger } from '../../../../utils/logger';
import { DatabaseConnections } from '../../../../config/database-config';
import {
  EmbeddingConfig,
  FileEmbedding,
  EmbeddingResult,
  IEmbeddingProvider,
  IFileProcessor
} from './interfaces';
import { XenovaEmbeddingProvider } from './providers/xenova-provider';
import { OpenAIEmbeddingProvider } from './providers/openai-provider';
import { LocalEmbeddingProvider } from './providers/local-provider';
import { FileProcessor } from './services/file-processor';

// Re-export interfaces for backward compatibility
export {
  EmbeddingConfig,
  FileEmbedding,
  MethodEmbedding,
  ClassEmbedding,
  EmbeddingResult
} from './interfaces';

/**
 * Main Embedding Service Coordinator
 * Uses dependency injection for all embedding operations
 */
export class EmbeddingService {
  private logger: Logger;
  private embeddingProvider: IEmbeddingProvider;
  private fileProcessor: IFileProcessor;

  constructor(
    private config: EmbeddingConfig,
    embeddingProvider?: IEmbeddingProvider,
    fileProcessor?: IFileProcessor
  ) {
    this.logger = Logger.getInstance();

    // Apply default values for backward compatibility
    this.config = {
      provider: 'local',
      model: 'local',
      chunkSize: 1000,
      maxTokens: 8000,
      batchSize: 10,
      ...config
    };

    // Initialize embedding provider based on config
    this.embeddingProvider = embeddingProvider || this.createEmbeddingProvider();

    // Initialize file processor with dependency injection
    this.fileProcessor = fileProcessor || new FileProcessor(this.config, this.embeddingProvider);
  }

  /**
   * Generate embeddings for a project - main entry point
   */
  async generateProjectEmbeddings(
    projectPath: string,
    files: string[],
    dbConnections?: DatabaseConnections
  ): Promise<EmbeddingResult> {
    const startTime = Date.now();

    try {
      // Initialize the embedding provider
      await this.embeddingProvider.initialize();

      // Check if we're in granular mode
      if (this.config.granularMode) {
        return await this.generateGranularEmbeddings(projectPath, files, dbConnections);
      }

      // Generate file-level embeddings
      return await this.generateFileEmbeddings(projectPath, files, dbConnections);

    } catch (error) {
      this.logger.error('Failed to generate project embeddings:', error as Error);
      throw error;
    } finally {
      // Cleanup resources
      await this.embeddingProvider.cleanup?.();

      const duration = Date.now() - startTime;
      this.logger.info(`⏱️ Embedding generation completed in ${duration}ms`);
    }
  }

  /**
   * Generate embedding for single text
   */
  async generateEmbedding(text: string, context?: string): Promise<number[]> {
    await this.embeddingProvider.initialize();
    return await this.embeddingProvider.generateEmbedding(text, context);
  }

  /**
   * Generate file-level embeddings
   */
  private async generateFileEmbeddings(
    projectPath: string,
    files: string[],
    dbConnections?: DatabaseConnections
  ): Promise<EmbeddingResult> {
    try {
      // Process files and generate embeddings
      const embeddings = await this.fileProcessor.processFiles(projectPath, files);

      // Save to database if provided
      if (dbConnections && embeddings.length > 0) {
        await this.saveFileEmbeddings(embeddings, dbConnections);
      }

      return {
        embeddings: embeddings.length,
        errors: files.length - embeddings.length
      };

    } catch (error) {
      this.logger.error('Failed to generate file embeddings:', error as Error);
      return {
        embeddings: 0,
        errors: files.length
      };
    }
  }

  /**
   * Generate granular embeddings (classes and methods)
   * TODO: Implement when needed - placeholder for now
   */
  private async generateGranularEmbeddings(
    projectPath: string,
    files: string[],
    dbConnections?: DatabaseConnections
  ): Promise<EmbeddingResult> {
    this.logger.info('🔬 Granular embedding mode not fully implemented yet');

    // For now, fall back to file-level embeddings
    return await this.generateFileEmbeddings(projectPath, files, dbConnections);
  }

  /**
   * Save file embeddings to database
   */
  private async saveFileEmbeddings(
    embeddings: FileEmbedding[],
    dbConnections: DatabaseConnections
  ): Promise<void> {
    try {
      this.logger.info(`💾 Saving ${embeddings.length} file embeddings to database`);

      const postgres = await dbConnections.getPostgresConnection();

      for (const embedding of embeddings) {
        try {
          // Convert embedding array to PostgreSQL vector format
          const vectorString = `[${embedding.embedding.join(',')}]`;

          await postgres.query(`
            INSERT INTO file_embeddings (
              file_path, content_hash, embedding, metadata, content_preview, created_at, updated_at
            ) VALUES ($1, $2, $3::vector, $4, $5, NOW(), NOW())
            ON CONFLICT (file_path) DO UPDATE SET
              content_hash = $2, embedding = $3::vector, metadata = $4,
              content_preview = $5, updated_at = NOW()
          `, [
            embedding.filePath,
            embedding.hash,
            vectorString,
            JSON.stringify(embedding.metadata),
            embedding.content.substring(0, 1000) // Preview
          ]);

        } catch (error) {
          this.logger.error(`Failed to save embedding for ${embedding.filePath}:`, error);
        }
      }

      this.logger.info('✅ File embeddings saved to database');

    } catch (error) {
      this.logger.error('Failed to save embeddings to database:', error as Error);
      throw error;
    }
  }

  /**
   * Initialize database tables for embeddings
   */
  async initializeDatabase(dbConnections: DatabaseConnections): Promise<void> {
    try {
      this.logger.info('🔧 Initializing embedding database tables');

      const postgres = await dbConnections.getPostgresConnection();

      // Create file embeddings table
      await postgres.query(`
        CREATE TABLE IF NOT EXISTS file_embeddings (
          id SERIAL PRIMARY KEY,
          file_path TEXT UNIQUE NOT NULL,
          content_hash TEXT NOT NULL,
          embedding vector(384),
          metadata JSONB,
          content_preview TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Create indexes
      await postgres.query(`
        CREATE INDEX IF NOT EXISTS idx_file_embeddings_file_path
        ON file_embeddings(file_path)
      `);

      await postgres.query(`
        CREATE INDEX IF NOT EXISTS idx_file_embeddings_embedding
        ON file_embeddings USING ivfflat (embedding vector_cosine_ops)
      `);

      this.logger.info('✅ Embedding database tables initialized');

    } catch (error) {
      this.logger.error('Failed to initialize embedding database:', error as Error);
      throw error;
    }
  }

  /**
   * Get embedding statistics
   */
  async getEmbeddingStats(dbConnections: DatabaseConnections): Promise<any> {
    try {
      const postgres = await dbConnections.getPostgresConnection();

      const result = await postgres.query(`
        SELECT
          COUNT(*) as total_embeddings,
          COUNT(DISTINCT CASE WHEN metadata->>'language' IS NOT NULL THEN metadata->>'language' END) as languages,
          AVG(octet_length(content_preview)) as avg_content_size,
          MIN(created_at) as first_embedding,
          MAX(updated_at) as last_updated
        FROM file_embeddings
      `);

      return result.rows[0];

    } catch (error) {
      this.logger.error('Failed to get embedding stats:', error as Error);
      return null;
    }
  }

  /**
   * Create appropriate embedding provider based on config
   */
  private createEmbeddingProvider(): IEmbeddingProvider {
    switch (this.config.provider) {
      case 'xenova':
        return new XenovaEmbeddingProvider(this.config);

      case 'openai':
        return new OpenAIEmbeddingProvider(this.config);

      case 'local':
        return new LocalEmbeddingProvider(this.config);

      case 'hybrid':
        // Try Xenova first, fall back to local
        try {
          return new XenovaEmbeddingProvider(this.config);
        } catch (error) {
          this.logger.warn('Xenova not available, falling back to local embeddings');
          return new LocalEmbeddingProvider(this.config);
        }

      default:
        this.logger.warn(`Unknown provider ${this.config.provider}, using local`);
        return new LocalEmbeddingProvider(this.config);
    }
  }

  /**
   * Find similar methods (placeholder for backward compatibility)
   * TODO: Implement proper granular similarity search
   */
  async findSimilarMethods(embedding: number[], threshold: number = 0.8): Promise<any[]> {
    this.logger.warn('findSimilarMethods not yet implemented in refactored service');
    return [];
  }

  /**
   * Find similar classes (placeholder for backward compatibility)
   * TODO: Implement proper granular similarity search
   */
  async findSimilarClasses(embedding: number[], threshold: number = 0.8): Promise<any[]> {
    this.logger.warn('findSimilarClasses not yet implemented in refactored service');
    return [];
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      await this.embeddingProvider.cleanup?.();
      this.logger.info('🧹 Embedding service cleanup completed');
    } catch (error) {
      this.logger.error('Error during embedding service cleanup:', error);
    }
  }
}
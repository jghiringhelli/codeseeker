"use strict";
/**
 * Embedding Service - Refactored with SOLID Principles
 * SOLID Principles: Single Responsibility, Dependency Inversion
 * Reduced from 924 lines to ~200 lines using service extraction
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmbeddingService = void 0;
const logger_1 = require("../../../../utils/logger");
const xenova_provider_1 = require("./providers/xenova-provider");
const openai_provider_1 = require("./providers/openai-provider");
const local_provider_1 = require("./providers/local-provider");
const file_processor_1 = require("./services/file-processor");
/**
 * Main Embedding Service Coordinator
 * Uses dependency injection for all embedding operations
 */
class EmbeddingService {
    config;
    logger;
    embeddingProvider;
    fileProcessor;
    constructor(config, embeddingProvider, fileProcessor) {
        this.config = config;
        this.logger = logger_1.Logger.getInstance();
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
        this.fileProcessor = fileProcessor || new file_processor_1.FileProcessor(this.config, this.embeddingProvider);
    }
    /**
     * Generate embeddings for a project - main entry point
     */
    async generateProjectEmbeddings(projectPath, files, dbConnections) {
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
        }
        catch (error) {
            this.logger.error('Failed to generate project embeddings:', error);
            throw error;
        }
        finally {
            // Cleanup resources
            await this.embeddingProvider.cleanup?.();
            const duration = Date.now() - startTime;
            this.logger.info(`⏱️ Embedding generation completed in ${duration}ms`);
        }
    }
    /**
     * Generate embedding for single text
     */
    async generateEmbedding(text, context) {
        await this.embeddingProvider.initialize();
        return await this.embeddingProvider.generateEmbedding(text, context);
    }
    /**
     * Generate file-level embeddings
     */
    async generateFileEmbeddings(projectPath, files, dbConnections) {
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
        }
        catch (error) {
            this.logger.error('Failed to generate file embeddings:', error);
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
    async generateGranularEmbeddings(projectPath, files, dbConnections) {
        this.logger.info('🔬 Granular embedding mode not fully implemented yet');
        // For now, fall back to file-level embeddings
        return await this.generateFileEmbeddings(projectPath, files, dbConnections);
    }
    /**
     * Save file embeddings to database
     */
    async saveFileEmbeddings(embeddings, dbConnections) {
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
                }
                catch (error) {
                    this.logger.error(`Failed to save embedding for ${embedding.filePath}:`, error);
                }
            }
            this.logger.info('✅ File embeddings saved to database');
        }
        catch (error) {
            this.logger.error('Failed to save embeddings to database:', error);
            throw error;
        }
    }
    /**
     * Initialize database tables for embeddings
     */
    async initializeDatabase(dbConnections) {
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
        }
        catch (error) {
            this.logger.error('Failed to initialize embedding database:', error);
            throw error;
        }
    }
    /**
     * Get embedding statistics
     */
    async getEmbeddingStats(dbConnections) {
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
        }
        catch (error) {
            this.logger.error('Failed to get embedding stats:', error);
            return null;
        }
    }
    /**
     * Create appropriate embedding provider based on config
     */
    createEmbeddingProvider() {
        switch (this.config.provider) {
            case 'xenova':
                return new xenova_provider_1.XenovaEmbeddingProvider(this.config);
            case 'openai':
                return new openai_provider_1.OpenAIEmbeddingProvider(this.config);
            case 'local':
                return new local_provider_1.LocalEmbeddingProvider(this.config);
            case 'hybrid':
                // Try Xenova first, fall back to local
                try {
                    return new xenova_provider_1.XenovaEmbeddingProvider(this.config);
                }
                catch (error) {
                    this.logger.warn('Xenova not available, falling back to local embeddings');
                    return new local_provider_1.LocalEmbeddingProvider(this.config);
                }
            default:
                this.logger.warn(`Unknown provider ${this.config.provider}, using local`);
                return new local_provider_1.LocalEmbeddingProvider(this.config);
        }
    }
    /**
     * Find similar methods (placeholder for backward compatibility)
     * TODO: Implement proper granular similarity search
     */
    async findSimilarMethods(embedding, threshold = 0.8) {
        this.logger.warn('findSimilarMethods not yet implemented in refactored service');
        return [];
    }
    /**
     * Find similar classes (placeholder for backward compatibility)
     * TODO: Implement proper granular similarity search
     */
    async findSimilarClasses(embedding, threshold = 0.8) {
        this.logger.warn('findSimilarClasses not yet implemented in refactored service');
        return [];
    }
    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            await this.embeddingProvider.cleanup?.();
            this.logger.info('🧹 Embedding service cleanup completed');
        }
        catch (error) {
            this.logger.error('Error during embedding service cleanup:', error);
        }
    }
}
exports.EmbeddingService = EmbeddingService;
//# sourceMappingURL=embedding-service.js.map
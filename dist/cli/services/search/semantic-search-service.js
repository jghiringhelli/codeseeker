"use strict";
/**
 * Consolidated Semantic Search Service - SOLID Principles Compliant
 * Single Responsibility: Unified semantic search management with vector similarity, caching, and project indexing
 * Open/Closed: Extensible through strategy injection for different vector stores and embedding models
 * Liskov Substitution: Different stores and generators are interchangeable through common interfaces
 * Interface Segregation: Separate interfaces for different search aspects
 * Dependency Inversion: Depends on abstractions, not concrete implementations
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticSearchService = exports.LocalEmbeddingService = exports.OpenAIEmbeddingService = exports.PostgreSQLVectorStore = exports.InMemoryVectorStore = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const fast_glob_1 = require("fast-glob");
const crypto_1 = __importDefault(require("crypto"));
const fast_cosine_similarity_1 = require("fast-cosine-similarity");
const logger_1 = require("../../../utils/logger");
const tool_interface_1 = require("../../../shared/tool-interface");
// ============================================
// VECTOR STORE IMPLEMENTATIONS
// ============================================
class InMemoryVectorStore {
    vectors = new Map();
    async store(chunkId, vector, chunk) {
        this.vectors.set(chunkId, {
            chunkId,
            vector,
            chunk,
            metadata: {
                indexed: new Date(),
                model: 'unknown',
                dimensions: vector.length
            }
        });
    }
    async search(vector, maxResults, minSimilarity) {
        const results = [];
        for (const [chunkId, index] of this.vectors) {
            const similarity = (0, fast_cosine_similarity_1.cosineSimilarity)(vector, index.vector);
            if (similarity >= minSimilarity) {
                results.push({
                    chunkId,
                    similarity,
                    chunk: index.chunk
                });
            }
        }
        return results
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, maxResults);
    }
    async getStats() {
        const vectors = Array.from(this.vectors.values());
        return {
            totalVectors: vectors.length,
            dimensions: vectors[0]?.metadata.dimensions || 0,
            memoryUsage: vectors.length * (vectors[0]?.vector.length || 0) * 8,
            lastIndexed: vectors.reduce((latest, v) => v.metadata.indexed > latest ? v.metadata.indexed : latest, new Date(0))
        };
    }
    async clear() {
        this.vectors.clear();
    }
}
exports.InMemoryVectorStore = InMemoryVectorStore;
class PostgreSQLVectorStore {
    client;
    constructor(client) {
        this.client = client;
    }
    async store(chunkId, vector, chunk) {
        await this.client.query(`
      INSERT INTO semantic_search_embeddings (id, content, file_path, chunk_type, embedding, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO UPDATE SET
        content = EXCLUDED.content,
        embedding = EXCLUDED.embedding,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    `, [
            chunkId,
            chunk.content,
            chunk.filePath,
            chunk.chunkType,
            JSON.stringify(vector),
            JSON.stringify({
                startLine: chunk.startLine,
                endLine: chunk.endLine,
                language: chunk.language,
                significance: chunk.significance
            })
        ]);
    }
    async search(vector, maxResults, minSimilarity) {
        const result = await this.client.query(`
      SELECT id, content, file_path, chunk_type, embedding, metadata,
             (1 - (embedding::vector <=> $1::vector)) as similarity
      FROM semantic_search_embeddings
      WHERE (1 - (embedding::vector <=> $1::vector)) >= $2
      ORDER BY embedding::vector <=> $1::vector
      LIMIT $3
    `, [JSON.stringify(vector), minSimilarity, maxResults]);
        return result.rows.map((row) => ({
            chunkId: row.id,
            similarity: row.similarity,
            chunk: {
                id: row.id,
                content: row.content,
                filePath: row.file_path,
                chunkType: row.chunk_type,
                startLine: row.metadata.startLine,
                endLine: row.metadata.endLine,
                language: row.metadata.language,
                significance: row.metadata.significance
            }
        }));
    }
    async getStats() {
        const result = await this.client.query(`
      SELECT COUNT(*) as total, MAX(updated_at) as last_indexed
      FROM semantic_search_embeddings
    `);
        return {
            totalVectors: parseInt(result.rows[0].total),
            dimensions: 1536, // OpenAI default
            memoryUsage: 0, // Stored in database
            lastIndexed: result.rows[0].last_indexed || new Date(0)
        };
    }
    async clear() {
        await this.client.query('DELETE FROM semantic_search_embeddings');
    }
}
exports.PostgreSQLVectorStore = PostgreSQLVectorStore;
// ============================================
// EMBEDDING SERVICE IMPLEMENTATIONS
// ============================================
class OpenAIEmbeddingService {
    apiKey;
    model = 'text-embedding-ada-002';
    dimensions = 1536;
    constructor(apiKey) {
        this.apiKey = apiKey || process.env.OPENAI_API_KEY || '';
        if (!this.apiKey) {
            throw new Error('OpenAI API key required for embedding generation');
        }
    }
    async generateEmbedding(text) {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                input: text,
                model: this.model
            })
        });
        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.statusText}`);
        }
        const data = await response.json();
        return data.data[0].embedding;
    }
    async batchGenerateEmbeddings(texts) {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                input: texts,
                model: this.model
            })
        });
        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.statusText}`);
        }
        const data = await response.json();
        return data.data.map((item) => item.embedding);
    }
    getDimensions() {
        return this.dimensions;
    }
    getModel() {
        return this.model;
    }
}
exports.OpenAIEmbeddingService = OpenAIEmbeddingService;
class LocalEmbeddingService {
    dimensions = 384; // Default for sentence-transformers
    model = 'all-MiniLM-L6-v2';
    async generateEmbedding(text) {
        // Placeholder for local embedding generation
        // In production, this would use a local model like sentence-transformers
        const hash = crypto_1.default.createHash('md5').update(text).digest('hex');
        const vector = Array.from({ length: this.dimensions }, (_, i) => Math.sin(parseInt(hash.substr(i % hash.length, 2), 16) / 256 * Math.PI * 2));
        return vector;
    }
    async batchGenerateEmbeddings(texts) {
        return Promise.all(texts.map(text => this.generateEmbedding(text)));
    }
    getDimensions() {
        return this.dimensions;
    }
    getModel() {
        return this.model;
    }
}
exports.LocalEmbeddingService = LocalEmbeddingService;
// ============================================
// CONSOLIDATED SEMANTIC SEARCH SERVICE
// ============================================
class SemanticSearchService extends tool_interface_1.AnalysisTool {
    // Tool metadata (from SemanticSearchTool)
    id = 'semantic-search';
    name = 'Semantic Search';
    description = 'Intelligent semantic search across codebase using vector embeddings';
    version = '2.0.0';
    category = 'search';
    languages = ['any'];
    frameworks = ['any'];
    purposes = ['search', 'discovery', 'comprehension'];
    intents = ['search', 'find', 'locate', 'discover', 'similarity', 'semantic'];
    keywords = ['search', 'semantic', 'find', 'similar', 'vector', 'embedding'];
    logger;
    config;
    // Injected dependencies (SOLID: Dependency Inversion)
    vectorStore;
    embeddingService;
    cache;
    contentChunker;
    queryProcessor;
    constructor(config, vectorStore, embeddingService, cache, contentChunker, queryProcessor, databaseClient) {
        super();
        this.logger = new logger_1.Logger(logger_1.LogLevel.INFO, 'SemanticSearchService');
        // Configuration with defaults
        this.config = {
            vectorStore: databaseClient ? 'postgresql' : 'memory',
            embeddingService: process.env.OPENAI_API_KEY ? 'openai' : 'local',
            caching: true,
            maxResults: 20,
            minSimilarity: 0.7,
            batchSize: 50,
            supportedExtensions: ['.ts', '.js', '.py', '.java', '.go', '.rs', '.cpp', '.c', '.h'],
            excludePatterns: ['node_modules', '.git', 'dist', 'build', 'coverage'],
            ...config
        };
        // Dependency injection with fallbacks (SOLID: Dependency Inversion)
        this.vectorStore = vectorStore || (this.config.vectorStore === 'postgresql' && databaseClient
            ? new PostgreSQLVectorStore(databaseClient)
            : new InMemoryVectorStore());
        this.embeddingService = embeddingService || (this.config.embeddingService === 'openai'
            ? new OpenAIEmbeddingService()
            : new LocalEmbeddingService());
        this.cache = cache;
        this.contentChunker = contentChunker;
        this.queryProcessor = queryProcessor;
        if (!this.embeddingService && this.config.embeddingService === 'openai') {
            this.logger.warn('OpenAI API key not found. Falling back to local embeddings.');
            this.embeddingService = new LocalEmbeddingService();
        }
    }
    // ============================================
    // PROJECT INDEXING (from SemanticSearchManager)
    // ============================================
    /**
     * Initialize project for semantic search
     * SOLID: Single Responsibility - focused on project initialization
     */
    async initializeProject(projectId, projectPath) {
        this.logger.info(`🔍 Initializing semantic search for project: ${projectId}`);
        try {
            // Initialize cache if available
            if (this.cache) {
                await this.cache.initialize();
            }
            // Scan all relevant files in the project
            const filePaths = await this.scanProjectFiles(projectPath);
            this.logger.info(`📂 Found ${filePaths.length} files to process`);
            // Process files in batches to avoid memory issues
            for (let i = 0; i < filePaths.length; i += this.config.batchSize) {
                const batch = filePaths.slice(i, i + this.config.batchSize);
                await this.processBatch(projectId, batch);
                this.logger.info(`📊 Processed batch ${Math.floor(i / this.config.batchSize) + 1}/${Math.ceil(filePaths.length / this.config.batchSize)}`);
            }
            this.logger.info(`✅ Semantic search initialization complete: ${filePaths.length} files processed`);
        }
        catch (error) {
            this.logger.error(`❌ Semantic search initialization failed: ${error.message}`);
            throw error;
        }
    }
    async scanProjectFiles(projectPath) {
        const patterns = this.config.supportedExtensions.map(ext => `**/*${ext}`);
        const ignorePatterns = this.config.excludePatterns.map(pattern => `**/${pattern}/**`);
        return await (0, fast_glob_1.glob)(patterns, {
            cwd: projectPath,
            absolute: true,
            ignore: ignorePatterns
        });
    }
    async processBatch(projectId, filePaths) {
        for (const filePath of filePaths) {
            try {
                const content = await fs.readFile(filePath, 'utf-8');
                await this.indexFile(projectId, filePath, content);
            }
            catch (error) {
                this.logger.warn(`Skipping file ${filePath}: ${error.message}`);
            }
        }
    }
    async indexFile(projectId, filePath, content) {
        // Generate chunks (use injected chunker or basic chunking)
        const chunks = this.contentChunker
            ? await this.contentChunker.chunkContent(content, filePath)
            : this.createBasicChunks(content, filePath);
        // Generate embeddings and store
        for (const chunk of chunks) {
            const chunkId = this.generateChunkId(projectId, chunk);
            // Check cache first
            let embedding;
            if (this.cache) {
                const cached = await this.cache.get(`embedding:${chunkId}`);
                if (cached) {
                    embedding = cached;
                }
                else {
                    embedding = await this.embeddingService.generateEmbedding(chunk.content);
                    await this.cache.set(`embedding:${chunkId}`, embedding, 86400); // 24h TTL
                }
            }
            else {
                embedding = await this.embeddingService.generateEmbedding(chunk.content);
            }
            await this.vectorStore.store(chunkId, embedding, chunk);
        }
    }
    createBasicChunks(content, filePath) {
        const lines = content.split('\n');
        const chunkSize = 100; // lines per chunk
        const chunks = [];
        for (let i = 0; i < lines.length; i += chunkSize) {
            const chunkLines = lines.slice(i, i + chunkSize);
            const chunk = {
                id: `${path.basename(filePath)}-${i}`,
                content: chunkLines.join('\n'),
                filePath,
                startLine: i + 1,
                endLine: Math.min(i + chunkSize, lines.length),
                chunkType: 'code',
                language: this.detectLanguage(filePath),
                significance: 'medium'
            };
            chunks.push(chunk);
        }
        return chunks;
    }
    detectLanguage(filePath) {
        const ext = path.extname(filePath);
        const langMap = {
            '.ts': 'typescript', '.js': 'javascript', '.py': 'python',
            '.java': 'java', '.go': 'go', '.rs': 'rust',
            '.cpp': 'cpp', '.c': 'c', '.h': 'c'
        };
        return langMap[ext] || 'text';
    }
    generateChunkId(projectId, chunk) {
        const content = `${projectId}:${chunk.filePath}:${chunk.startLine}:${chunk.endLine}`;
        return crypto_1.default.createHash('md5').update(content).digest('hex');
    }
    // ============================================
    // VECTOR SEARCH (from VectorSearchEngine)
    // ============================================
    /**
     * Execute semantic search
     * SOLID: Single Responsibility - focused on search execution
     */
    async search(query) {
        const startTime = Date.now();
        this.logger.info(`🔍 Executing semantic search: "${query.text}"`);
        try {
            // Generate query embedding
            const queryEmbedding = await this.embeddingService.generateEmbedding(query.text);
            // Search vector store
            const vectorResults = await this.vectorStore.search(queryEmbedding, query.options?.maxResults || this.config.maxResults, query.options?.minSimilarity || this.config.minSimilarity);
            // Convert to search results with ranking
            const results = vectorResults.map((result, index) => ({
                chunk: result.chunk,
                similarity: result.similarity,
                rank: index + 1,
                highlights: this.generateHighlights(result.chunk.content, query.text)
            }));
            // Apply filters if specified
            const filteredResults = this.applyFilters(results, query.filters);
            const searchTime = Date.now() - startTime;
            const indexStats = await this.vectorStore.getStats();
            this.logger.info(`✅ Search completed in ${searchTime}ms: ${filteredResults.length} results`);
            return {
                query: query.text,
                results: filteredResults,
                totalResults: filteredResults.length,
                searchTime,
                metadata: {
                    embeddingModel: this.embeddingService.getModel(),
                    indexSize: indexStats.totalVectors
                }
            };
        }
        catch (error) {
            this.logger.error(`❌ Search failed: ${error.message}`);
            throw error;
        }
    }
    applyFilters(results, filters) {
        if (!filters)
            return results;
        return results.filter(result => {
            if (filters.language && result.chunk.language !== filters.language)
                return false;
            if (filters.chunkType && result.chunk.chunkType !== filters.chunkType)
                return false;
            if (filters.filePath && !result.chunk.filePath.includes(filters.filePath))
                return false;
            if (filters.significance && result.chunk.significance !== filters.significance)
                return false;
            return true;
        });
    }
    generateHighlights(content, query) {
        const keywords = query.toLowerCase().split(/\s+/);
        const sentences = content.split(/[.!?]+/);
        const highlights = [];
        for (const sentence of sentences) {
            const lowerSentence = sentence.toLowerCase();
            if (keywords.some(keyword => lowerSentence.includes(keyword))) {
                highlights.push(sentence.trim());
                if (highlights.length >= 3)
                    break;
            }
        }
        return highlights;
    }
    // ============================================
    // ANALYSIS TOOL INTERFACE (from SemanticSearchTool)
    // ============================================
    getDatabaseToolName() {
        return 'semantic-search';
    }
    /**
     * Tool execution method
     */
    async execute(context) {
        const { projectPath, query, options = {} } = context;
        // Initialize if not already done
        if (!await this.isIndexed(projectPath)) {
            await this.initializeProject('default', projectPath);
        }
        // Execute search
        const searchQuery = {
            text: query,
            options: {
                maxResults: options.maxResults || this.config.maxResults,
                minSimilarity: options.minSimilarity || this.config.minSimilarity,
                includeContent: options.includeContent !== false
            }
        };
        const searchResponse = await this.search(searchQuery);
        return {
            success: true,
            data: searchResponse,
            metadata: {
                toolId: this.id,
                executionTime: searchResponse.searchTime,
                version: this.version
            }
        };
    }
    async isIndexed(projectPath) {
        try {
            const stats = await this.vectorStore.getStats();
            return stats.totalVectors > 0;
        }
        catch {
            return false;
        }
    }
    // ============================================
    // UTILITY AND MANAGEMENT METHODS
    // ============================================
    /**
     * Get search service statistics
     */
    async getStats() {
        const indexStats = await this.vectorStore.getStats();
        return {
            config: this.config,
            indexStats,
            embeddingModel: this.embeddingService.getModel(),
            embeddingDimensions: this.embeddingService.getDimensions()
        };
    }
    /**
     * Clear all indexed data
     */
    async clearIndex() {
        await this.vectorStore.clear();
        if (this.cache) {
            await this.cache.clear();
        }
        this.logger.info('🗑️ Search index cleared');
    }
    /**
     * Update configuration at runtime (SOLID: Open/Closed)
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
    /**
     * Inject dependencies for testing or extension (SOLID: Dependency Inversion)
     */
    setVectorStore(store) {
        this.vectorStore = store;
    }
    setEmbeddingService(service) {
        this.embeddingService = service;
    }
    setCache(cache) {
        this.cache = cache;
    }
    setContentChunker(chunker) {
        this.contentChunker = chunker;
    }
    setQueryProcessor(processor) {
        this.queryProcessor = processor;
    }
}
exports.SemanticSearchService = SemanticSearchService;
exports.default = SemanticSearchService;
//# sourceMappingURL=semantic-search-service.js.map
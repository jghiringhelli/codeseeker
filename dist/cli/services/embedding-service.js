"use strict";
/**
 * CodeMind Embedding Service
 * Generates vector embeddings for semantic search using multiple strategies
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmbeddingService = void 0;
const logger_1 = require("../../utils/logger");
const fs = __importStar(require("fs/promises"));
const crypto = __importStar(require("crypto"));
const database_config_1 = require("../../config/database-config");
// Dynamic import for ES module compatibility
let pipeline = null;
class EmbeddingService {
    logger;
    config;
    openaiClient;
    xenovaExtractor;
    constructor(config) {
        this.logger = logger_1.Logger.getInstance();
        // Check environment variables for configuration
        const envProvider = process.env.EMBEDDING_PROVIDER;
        const envModel = process.env.EMBEDDING_MODEL;
        const hasApiKey = !!process.env.OPENAI_API_KEY;
        this.config = {
            provider: envProvider || 'xenova', // Default to Xenova transformers (free, local, semantic)
            model: envModel || 'Xenova/all-MiniLM-L6-v2', // Use semantic embeddings by default
            openaiApiKey: process.env.OPENAI_API_KEY,
            chunkSize: 8000, // tokens
            maxTokens: 8191,
            batchSize: 20,
            ...config
        };
        // Log the configuration being used
        this.logger.info(`🧠 Embedding service initialized with provider: ${this.config.provider}, model: ${this.config.model}`);
        if (this.config.provider === 'xenova') {
            this.logger.info('🚀 Using Xenova Transformers - free semantic embeddings with 384 dimensions!');
            this.logger.info('💡 This provides true semantic understanding at zero cost');
        }
        else if (!hasApiKey) {
            this.logger.info('💡 No OpenAI API key found - using local embeddings (no costs!)');
            this.logger.info('💡 To enable premium models, set OPENAI_API_KEY in your .env file');
        }
        this.initializeProviders();
    }
    /**
     * Generate embeddings for all files in a project
     */
    async generateProjectEmbeddings(projectId, files, progressCallback) {
        this.logger.info(`🚀 Generating embeddings for ${files.length} files using ${this.config.provider} strategy`);
        let success = 0;
        let errors = 0;
        let skipped = 0;
        const dbConnections = new database_config_1.DatabaseConnections();
        try {
            // Process files in batches
            for (let i = 0; i < files.length; i += this.config.batchSize) {
                const batch = files.slice(i, i + this.config.batchSize);
                const batchResults = await Promise.allSettled(batch.map(async (filePath, index) => {
                    try {
                        progressCallback?.(Math.round(((i + index) / files.length) * 100), filePath);
                        const result = await this.processFile(projectId, filePath, dbConnections);
                        return result;
                    }
                    catch (error) {
                        this.logger.warn(`Failed to process ${filePath}: ${error.message}`);
                        throw error;
                    }
                }));
                // Count results
                batchResults.forEach(result => {
                    if (result.status === 'fulfilled') {
                        if (result.value === 'success')
                            success++;
                        else if (result.value === 'skipped')
                            skipped++;
                    }
                    else {
                        errors++;
                    }
                });
                // Small delay to avoid overwhelming the API
                if (this.config.provider === 'openai' || this.config.provider === 'hybrid') {
                    await this.delay(100);
                }
            }
            this.logger.info(`✅ Embedding generation complete: ${success} success, ${skipped} skipped, ${errors} errors`);
        }
        finally {
            await dbConnections.closeAll();
        }
        return { success, errors, skipped };
    }
    /**
     * Process a single file for embedding generation
     */
    async processFile(projectId, filePath, dbConnections) {
        try {
            // Read file content
            const content = await fs.readFile(filePath, 'utf-8');
            const hash = crypto.createHash('sha256').update(content).digest('hex');
            // Skip binary or very large files
            if (this.shouldSkipFile(filePath, content)) {
                return 'skipped';
            }
            // Check if already processed with same hash
            const pgClient = await dbConnections.getPostgresConnection();
            const existing = await pgClient.query('SELECT content_hash FROM semantic_search_embeddings WHERE project_id = $1 AND file_path = $2', [projectId, filePath]);
            if (existing.rows.length > 0 && existing.rows[0].content_hash === hash) {
                return 'skipped'; // Already up to date
            }
            // Generate embedding
            const embedding = await this.generateEmbedding(content, filePath);
            // Extract metadata
            const metadata = this.extractFileMetadata(filePath, content);
            // Store in database
            await this.storeEmbedding(projectId, filePath, content, hash, embedding, metadata, pgClient);
            return 'success';
        }
        catch (error) {
            this.logger.error(`Failed to process ${filePath}:`, error);
            return 'error';
        }
    }
    /**
     * Process a single file and store its embedding
     * Public method for incremental sync
     */
    async processSingleFile(projectId, filePath, content) {
        try {
            const crypto = require('crypto');
            const hash = crypto.createHash('sha256').update(content).digest('hex');
            const embedding = await this.generateEmbedding(content, filePath);
            const metadata = this.extractFileMetadata(filePath, content);
            // Get database connection
            const { DatabaseConnections } = await Promise.resolve().then(() => __importStar(require('../../config/database-config')));
            const dbConnections = new DatabaseConnections();
            const pgClient = await dbConnections.getPostgresConnection();
            await this.storeEmbedding(projectId, filePath, content, hash, embedding, metadata, pgClient);
            return true;
        }
        catch (error) {
            this.logger.error(`Failed to process single file ${filePath}:`, error);
            return false;
        }
    }
    /**
     * Generate embedding for content using configured provider
     * Public method for use by semantic search engine
     */
    async generateEmbedding(content, filePath) {
        // Truncate content if too large
        const truncatedContent = this.truncateContent(content);
        try {
            switch (this.config.provider) {
                case 'xenova':
                    return await this.generateXenovaEmbedding(truncatedContent, filePath);
                case 'openai':
                    return await this.generateOpenAIEmbedding(truncatedContent);
                case 'local':
                    return await this.generateLocalEmbedding(truncatedContent, filePath);
                case 'hybrid':
                    // Try Xenova first (best balance), fallback to OpenAI, then local
                    try {
                        return await this.generateXenovaEmbedding(truncatedContent, filePath);
                    }
                    catch (xenovaError) {
                        this.logger.warn(`Xenova failed for ${filePath}, trying OpenAI...`);
                        try {
                            return await this.generateOpenAIEmbedding(truncatedContent);
                        }
                        catch (openaiError) {
                            this.logger.warn(`OpenAI failed for ${filePath}, using local embedding`);
                            return await this.generateLocalEmbedding(truncatedContent, filePath);
                        }
                    }
                default:
                    throw new Error(`Unsupported embedding provider: ${this.config.provider}`);
            }
        }
        catch (error) {
            this.logger.error(`Embedding generation failed for ${filePath}:`, error);
            throw error;
        }
    }
    /**
     * Generate Xenova Transformers embedding (semantic, free, local)
     */
    async generateXenovaEmbedding(content, filePath) {
        try {
            // Initialize extractor if not already done
            if (!this.xenovaExtractor) {
                this.logger.debug(`🔄 Initializing Xenova extractor: ${this.config.model}`);
                // Dynamic import for ES module compatibility
                if (!pipeline) {
                    // Use Function constructor to prevent TypeScript from transpiling the import
                    const dynamicImport = new Function('specifier', 'return import(specifier)');
                    const { pipeline: importedPipeline } = await dynamicImport('@xenova/transformers');
                    pipeline = importedPipeline;
                }
                this.xenovaExtractor = await pipeline('feature-extraction', this.config.model, // Default: 'Xenova/all-MiniLM-L6-v2'
                {
                    // Configure for CPU optimization
                    quantized: true, // Use quantized model for faster CPU performance
                    progress_callback: (progress) => {
                        if (progress.status === 'downloading') {
                            this.logger.debug(`📥 Downloading model: ${Math.round(progress.progress || 0)}%`);
                        }
                    }
                });
                this.logger.info(`✅ Xenova extractor initialized: ${this.config.model}`);
            }
            // Generate embedding with proper configuration
            const result = await this.xenovaExtractor([content], {
                pooling: 'mean', // Mean pooling for sentence-level embeddings
                normalize: true // Normalize vectors for cosine similarity
            });
            // Extract the embedding array (result is typically tensor-like)
            const embedding = Array.from(result.data);
            // Validate dimensions (should be 384 for all-MiniLM-L6-v2)
            if (embedding.length !== 384) {
                this.logger.warn(`⚠️ Unexpected embedding dimensions: ${embedding.length} (expected 384)`);
            }
            return embedding;
        }
        catch (error) {
            this.logger.error(`❌ Xenova embedding failed for ${filePath}:`, error);
            throw error;
        }
    }
    /**
     * Generate OpenAI embedding
     */
    async generateOpenAIEmbedding(content) {
        if (!this.openaiClient) {
            throw new Error('OpenAI client not initialized');
        }
        try {
            const response = await this.openaiClient.embeddings.create({
                model: this.config.model,
                input: content,
            });
            return response.data[0].embedding;
        }
        catch (error) {
            this.logger.error('OpenAI embedding API error:', error);
            throw error;
        }
    }
    /**
     * Generate local embedding using simple but effective algorithm
     */
    async generateLocalEmbedding(content, filePath) {
        // Create a 384-dimensional embedding to match database schema (OpenAI text-embedding-3-small)
        const embedding = new Array(384).fill(0);
        // Extract meaningful features
        const features = this.extractContentFeatures(content, filePath);
        // Map features to embedding dimensions
        this.mapFeaturesToEmbedding(features, embedding);
        // Normalize the embedding vector
        const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        if (magnitude > 0) {
            for (let i = 0; i < embedding.length; i++) {
                embedding[i] /= magnitude;
            }
        }
        return embedding;
    }
    /**
     * Extract content features for local embedding
     */
    extractContentFeatures(content, filePath) {
        const features = {
            // File type features
            language: this.detectLanguage(filePath),
            extension: filePath.split('.').pop()?.toLowerCase() || '',
            // Content features
            length: content.length,
            lines: content.split('\n').length,
            // Code structure features
            functions: this.extractFunctions(content),
            classes: this.extractClasses(content),
            imports: this.extractImports(content),
            exports: this.extractExports(content),
            // Semantic features
            keywords: this.extractKeywords(content),
            comments: this.extractComments(content),
            // Complexity features
            cyclomaticComplexity: this.estimateComplexity(content),
            nestingDepth: this.estimateNestingDepth(content),
            // Hash-based features for similarity
            contentHash: crypto.createHash('md5').update(content).digest('hex'),
            structureHash: this.generateStructureHash(content)
        };
        return features;
    }
    /**
     * Map extracted features to embedding dimensions
     */
    mapFeaturesToEmbedding(features, embedding) {
        let index = 0;
        // Language encoding (dimensions 0-255)
        const languageEncoding = this.encodeLanguage(features.language);
        for (let i = 0; i < 256 && index < embedding.length; i++, index++) {
            embedding[index] = languageEncoding[i] || 0;
        }
        // Keywords encoding (dimensions 256-767)
        const keywordEncoding = this.encodeKeywords(features.keywords);
        for (let i = 0; i < 512 && index < embedding.length; i++, index++) {
            embedding[index] = keywordEncoding[i] || 0;
        }
        // Structure encoding (dimensions 768-1279)
        const structureEncoding = this.encodeStructure(features);
        for (let i = 0; i < 512 && index < embedding.length; i++, index++) {
            embedding[index] = structureEncoding[i] || 0;
        }
        // Hash-based similarity features (dimensions 1280-1535)
        const hashEncoding = this.encodeHashes(features.contentHash, features.structureHash);
        for (let i = 0; i < 256 && index < embedding.length; i++, index++) {
            embedding[index] = hashEncoding[i] || 0;
        }
    }
    /**
     * Store embedding in database
     */
    async storeEmbedding(projectId, filePath, content, hash, embedding, metadata, pgClient) {
        const truncatedContent = content.length > 50000
            ? content.substring(0, 50000) + '...[truncated]'
            : content;
        const query = `
      INSERT INTO semantic_search_embeddings (
        project_id,
        file_path,
        content_text,
        content_hash,
        embedding,
        metadata,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      ON CONFLICT (project_id, file_path)
      DO UPDATE SET
        content_text = EXCLUDED.content_text,
        content_hash = EXCLUDED.content_hash,
        embedding = EXCLUDED.embedding,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    `;
        await pgClient.query(query, [
            projectId,
            filePath,
            truncatedContent,
            hash,
            `[${embedding.join(',')}]`, // PostgreSQL vector format
            JSON.stringify(metadata)
        ]);
    }
    // Helper methods
    shouldSkipFile(filePath, content) {
        const skipExtensions = ['.png', '.jpg', '.gif', '.pdf', '.zip', '.exe'];
        const ext = filePath.split('.').pop()?.toLowerCase();
        return skipExtensions.includes(`.${ext}`) ||
            content.length > 100000 || // Skip very large files
            content.length === 0; // Skip empty files
    }
    truncateContent(content) {
        // Estimate tokens (rough approximation: 1 token ≈ 4 characters)
        const estimatedTokens = content.length / 4;
        if (estimatedTokens > this.config.maxTokens) {
            const maxChars = this.config.maxTokens * 4;
            return content.substring(0, maxChars);
        }
        return content;
    }
    extractFileMetadata(filePath, content) {
        return {
            language: this.detectLanguage(filePath),
            size: content.length,
            lines: content.split('\n').length,
            functions: this.extractFunctions(content),
            classes: this.extractClasses(content),
            imports: this.extractImports(content),
            exports: this.extractExports(content),
        };
    }
    // Feature extraction methods (simplified versions)
    detectLanguage(filePath) {
        const ext = filePath.split('.').pop()?.toLowerCase();
        const langMap = {
            'ts': 'TypeScript', 'js': 'JavaScript', 'py': 'Python',
            'java': 'Java', 'cpp': 'C++', 'cs': 'C#', 'go': 'Go'
        };
        return langMap[ext || ''] || 'Unknown';
    }
    extractFunctions(content) {
        const functions = [];
        const patterns = [
            /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
            /const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>/g
        ];
        patterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                functions.push(match[1]);
            }
        });
        return [...new Set(functions)];
    }
    extractClasses(content) {
        const classes = [];
        const pattern = /class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
        let match;
        while ((match = pattern.exec(content)) !== null) {
            classes.push(match[1]);
        }
        return classes;
    }
    extractImports(content) {
        const imports = [];
        const patterns = [
            /import\s+.*?from\s+['"']([^'"]+)['"]/g,
            /require\s*\(\s*['"']([^'"]+)['"]\s*\)/g
        ];
        patterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                imports.push(match[1]);
            }
        });
        return [...new Set(imports)];
    }
    extractExports(content) {
        const exports = [];
        const patterns = [
            /export\s+(?:const|let|var|function|class)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
            /export\s+\{\s*([^}]+)\s*\}/g
        ];
        patterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                if (match[1]) {
                    exports.push(match[1].trim());
                }
            }
        });
        return [...new Set(exports)];
    }
    extractKeywords(content) {
        const codeKeywords = [
            'async', 'await', 'promise', 'callback', 'function', 'class', 'interface',
            'type', 'enum', 'export', 'import', 'const', 'let', 'var',
            'if', 'else', 'for', 'while', 'switch', 'try', 'catch', 'finally'
        ];
        const found = [];
        const words = content.toLowerCase().match(/\b\w+\b/g) || [];
        codeKeywords.forEach(keyword => {
            if (words.includes(keyword)) {
                found.push(keyword);
            }
        });
        return found;
    }
    extractComments(content) {
        const commentPatterns = [
            /\/\/.*$/gm,
            /\/\*[\s\S]*?\*\//g,
            /#.*$/gm
        ];
        let comments = '';
        commentPatterns.forEach(pattern => {
            const matches = content.match(pattern);
            if (matches) {
                comments += matches.join(' ');
            }
        });
        return comments;
    }
    estimateComplexity(content) {
        const complexityKeywords = ['if', 'else', 'for', 'while', 'switch', 'catch'];
        let complexity = 1; // Base complexity
        complexityKeywords.forEach(keyword => {
            const regex = new RegExp(`\\b${keyword}\\b`, 'g');
            const matches = content.match(regex);
            complexity += matches ? matches.length : 0;
        });
        return Math.min(complexity, 50); // Cap at 50
    }
    estimateNestingDepth(content) {
        let maxDepth = 0;
        let currentDepth = 0;
        for (const char of content) {
            if (char === '{' || char === '(') {
                currentDepth++;
                maxDepth = Math.max(maxDepth, currentDepth);
            }
            else if (char === '}' || char === ')') {
                currentDepth = Math.max(0, currentDepth - 1);
            }
        }
        return Math.min(maxDepth, 20); // Cap at 20
    }
    generateStructureHash(content) {
        // Remove whitespace and comments, then hash the structure
        const structure = content
            .replace(/\/\/.*$/gm, '') // Remove line comments
            .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
        return crypto.createHash('md5').update(structure).digest('hex');
    }
    // Encoding methods for local embeddings
    encodeLanguage(language) {
        const encoding = new Array(256).fill(0);
        const languages = ['TypeScript', 'JavaScript', 'Python', 'Java', 'C++', 'C#', 'Go'];
        const index = languages.indexOf(language);
        if (index >= 0) {
            encoding[index] = 1.0;
            // Add some noise for uniqueness
            for (let i = 10; i < 256; i++) {
                encoding[i] = Math.sin(index * i) * 0.1;
            }
        }
        return encoding;
    }
    encodeKeywords(keywords) {
        const encoding = new Array(512).fill(0);
        keywords.forEach((keyword, i) => {
            const hash = this.simpleHash(keyword);
            const startIndex = Math.abs(hash) % 504;
            for (let j = 0; j < 8; j++) {
                const index = (startIndex + j) % 512;
                encoding[index] += 0.1;
            }
        });
        return encoding;
    }
    encodeStructure(features) {
        const encoding = new Array(512).fill(0);
        // Encode numeric features
        encoding[0] = Math.min(features.length / 10000, 1); // File size
        encoding[1] = Math.min(features.lines / 1000, 1); // Line count
        encoding[2] = Math.min(features.functions.length / 50, 1); // Function count
        encoding[3] = Math.min(features.classes.length / 20, 1); // Class count
        encoding[4] = Math.min(features.cyclomaticComplexity / 50, 1); // Complexity
        encoding[5] = Math.min(features.nestingDepth / 20, 1); // Nesting
        // Fill remaining with derived features
        for (let i = 6; i < 512; i++) {
            encoding[i] = Math.sin(features.length * i) * 0.01;
        }
        return encoding;
    }
    encodeHashes(contentHash, structureHash) {
        const encoding = new Array(256).fill(0);
        // Convert hex hashes to numeric features (128 dimensions each)
        for (let i = 0; i < 64 && i < contentHash.length; i += 2) {
            const hexPair = contentHash.substr(i, 2);
            const value = parseInt(hexPair, 16) / 255; // Normalize to 0-1
            encoding[Math.floor(i / 2)] = value;
        }
        for (let i = 0; i < 64 && i < structureHash.length; i += 2) {
            const hexPair = structureHash.substr(i, 2);
            const value = parseInt(hexPair, 16) / 255;
            encoding[128 + Math.floor(i / 2)] = value;
        }
        // Fill remaining dimensions with hash-derived features
        for (let i = 64; i < 256; i++) {
            const hashValue = (contentHash.charCodeAt(i % contentHash.length) +
                structureHash.charCodeAt(i % structureHash.length)) / 510;
            encoding[i] = hashValue;
        }
        return encoding;
    }
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash;
    }
    async initializeProviders() {
        // Initialize Xenova extractor if using xenova provider
        if (this.config.provider === 'xenova') {
            try {
                this.logger.info(`🚀 Preparing Xenova Transformers: ${this.config.model}`);
                // Extractor will be lazily initialized on first use to avoid startup delay
            }
            catch (error) {
                this.logger.warn('Xenova initialization setup failed, falling back to local embeddings');
                this.config.provider = 'local';
            }
        }
        // Initialize OpenAI client if available
        if (this.config.openaiApiKey || process.env.OPENAI_API_KEY) {
            try {
                // Would require: npm install openai
                // this.openaiClient = new OpenAI({
                //   apiKey: this.config.openaiApiKey || process.env.OPENAI_API_KEY
                // });
                this.logger.info('OpenAI client would be initialized here');
            }
            catch (error) {
                this.logger.warn('OpenAI client initialization failed, using local embeddings only');
                if (this.config.provider === 'openai') {
                    this.config.provider = 'xenova'; // Fall back to Xenova instead of local
                }
            }
        }
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.EmbeddingService = EmbeddingService;
exports.default = EmbeddingService;
//# sourceMappingURL=embedding-service.js.map
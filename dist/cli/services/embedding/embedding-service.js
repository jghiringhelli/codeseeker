"use strict";
/**
 * CodeMind Unified Embedding Service
 * Generates vector embeddings for semantic search at file, class, and method levels
 * Combines functionality from both embedding-service and granular-embedding-service
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
const logger_1 = require("../../../utils/logger");
const fs = __importStar(require("fs/promises"));
const crypto = __importStar(require("crypto"));
const database_config_1 = require("../../../config/database-config");
const code_relationship_parser_1 = require("../code-relationship-parser");
// Dynamic import for ES module compatibility
let pipeline = null;
class EmbeddingService {
    logger;
    config;
    openaiClient;
    xenovaExtractor;
    codeParser;
    constructor(config) {
        this.logger = logger_1.Logger.getInstance();
        // Check environment variables for configuration
        const envProvider = process.env.EMBEDDING_PROVIDER;
        const envModel = process.env.EMBEDDING_MODEL;
        const hasApiKey = !!process.env.OPENAI_API_KEY;
        this.config = {
            provider: config?.provider || envProvider || 'xenova',
            openaiApiKey: config?.openaiApiKey || process.env.OPENAI_API_KEY,
            model: config?.model || envModel || 'Xenova/all-MiniLM-L6-v2',
            chunkSize: config?.chunkSize || 512,
            maxTokens: config?.maxTokens || 2048,
            batchSize: config?.batchSize || 10,
            granularMode: config?.granularMode || false
        };
        // Initialize code parser for granular mode
        if (this.config.granularMode) {
            this.codeParser = new code_relationship_parser_1.CodeRelationshipParser();
        }
        // Log configuration only in debug mode to reduce verbosity during init
        if (process.env.DEBUG_EMBEDDING === 'true') {
            this.logger.info('Embedding Service Initialized:', {
                provider: this.config.provider,
                model: this.config.model,
                hasOpenAIKey: !!this.config.openaiApiKey,
                granularMode: this.config.granularMode
            });
        }
        // Initialize provider client
        if (this.config.provider === 'openai' && this.config.openaiApiKey) {
            this.initializeOpenAI();
        }
    }
    /**
     * Initialize Xenova transformers pipeline
     */
    async initializeXenova() {
        if (!pipeline) {
            try {
                // Use dynamic import with proper module resolution
                const transformersModule = await eval('import("@xenova/transformers")');
                const { pipeline: pipelineFunc } = transformersModule;
                pipeline = await pipelineFunc('feature-extraction', this.config.model);
                this.logger.info('✅ Xenova transformers initialized');
            }
            catch (error) {
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
    /**
     * Initialize OpenAI client
     */
    initializeOpenAI() {
        try {
            const OpenAI = require('openai');
            this.openaiClient = new OpenAI({
                apiKey: this.config.openaiApiKey
            });
            this.logger.info('✅ OpenAI client initialized');
        }
        catch (error) {
            this.logger.error('Failed to initialize OpenAI:', error);
        }
    }
    /**
     * Generate embeddings for a project - supports both file-level and granular modes
     */
    async generateProjectEmbeddings(projectPath, files, dbConnections) {
        if (this.config.granularMode && this.codeParser) {
            return this.generateGranularEmbeddings(projectPath, files, dbConnections);
        }
        return this.generateFileEmbeddings(projectPath, files, dbConnections);
    }
    /**
     * Generate file-level embeddings (original functionality)
     */
    async generateFileEmbeddings(projectPath, files, dbConnections) {
        const startTime = Date.now();
        this.logger.info(`🔮 Generating embeddings for ${files.length} files`);
        // Initialize provider
        if (this.config.provider === 'xenova' && !this.xenovaExtractor) {
            await this.initializeXenova();
        }
        let successCount = 0;
        let errorCount = 0;
        const shouldCloseConnections = !dbConnections;
        try {
            dbConnections = dbConnections || new database_config_1.DatabaseConnections();
            // Process in batches
            const batchSize = this.config.batchSize;
            for (let i = 0; i < files.length; i += batchSize) {
                const batch = files.slice(i, i + batchSize);
                const batchResults = await Promise.all(batch.map(async (filePath) => {
                    try {
                        const embedding = await this.generateFileEmbedding(filePath, projectPath);
                        if (dbConnections) {
                            const pgClient = await dbConnections.getPostgresConnection();
                            await this.storeEmbedding(embedding, pgClient);
                        }
                        return { success: true };
                    }
                    catch (error) {
                        this.logger.error(`Failed to embed ${filePath}:`, error);
                        return { success: false };
                    }
                }));
                successCount += batchResults.filter(r => r.success).length;
                errorCount += batchResults.filter(r => !r.success).length;
                // Progress update
                const progress = Math.round((i + batch.length) / files.length * 100);
                this.logger.info(`Progress: ${progress}% (${i + batch.length}/${files.length})`);
            }
        }
        finally {
            if (shouldCloseConnections && dbConnections) {
                await dbConnections.closeAll();
            }
        }
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        this.logger.info(`✅ Embedding generation complete in ${duration}s`);
        this.logger.info(`Success: ${successCount}, Errors: ${errorCount}`);
        return { embeddings: successCount, errors: errorCount };
    }
    /**
     * Generate granular embeddings at method and class levels
     */
    async generateGranularEmbeddings(projectPath, files, dbConnections) {
        const startTime = Date.now();
        this.logger.info(`🔮 Generating granular embeddings for ${files.length} files`);
        // Initialize provider
        if (this.config.provider === 'xenova' && !this.xenovaExtractor) {
            await this.initializeXenova();
        }
        let methodCount = 0;
        let classCount = 0;
        let errors = 0;
        const shouldCloseConnections = !dbConnections;
        try {
            dbConnections = dbConnections || new database_config_1.DatabaseConnections();
            for (let i = 0; i < files.length; i++) {
                const filePath = files[i];
                this.logger.info(`Progress: ${Math.round((i / files.length) * 100)}% - Processing ${filePath}`);
                try {
                    // Parse the file to extract methods and classes
                    const parsedFile = await this.codeParser.parseFile(filePath);
                    // Generate class-level embeddings
                    for (const classInfo of parsedFile.classes) {
                        const classEmbedding = await this.generateClassEmbedding(parsedFile, classInfo);
                        if (dbConnections) {
                            await this.storeClassEmbedding(projectPath, classEmbedding, dbConnections);
                        }
                        classCount++;
                        // Generate method-level embeddings for each method in the class
                        for (const method of classInfo.methods) {
                            const methodEmbedding = await this.generateMethodEmbedding(parsedFile, classInfo, method);
                            if (dbConnections) {
                                await this.storeMethodEmbedding(projectPath, methodEmbedding, dbConnections);
                            }
                            methodCount++;
                        }
                    }
                    // Generate method-level embeddings for standalone functions
                    for (const functionInfo of parsedFile.functions) {
                        const methodEmbedding = await this.generateMethodEmbedding(parsedFile, null, functionInfo);
                        if (dbConnections) {
                            await this.storeMethodEmbedding(projectPath, methodEmbedding, dbConnections);
                        }
                        methodCount++;
                    }
                }
                catch (error) {
                    this.logger.error(`Failed to process ${filePath}:`, error);
                    errors++;
                }
            }
        }
        finally {
            if (shouldCloseConnections && dbConnections) {
                await dbConnections.closeAll();
            }
        }
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        this.logger.info(`✅ Granular embedding generation complete in ${duration}s`);
        this.logger.info(`Methods: ${methodCount}, Classes: ${classCount}, Errors: ${errors}`);
        return {
            embeddings: methodCount + classCount,
            errors,
            methodEmbeddings: methodCount,
            classEmbeddings: classCount
        };
    }
    /**
     * Generate embedding for a single file
     */
    async generateFileEmbedding(filePath, projectPath) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const hash = crypto.createHash('md5').update(content).digest('hex');
            // Extract metadata
            const metadata = this.extractFileMetadata(content, filePath);
            // Generate embedding based on provider
            const embedding = await this.generateEmbedding(content, filePath);
            return {
                filePath: filePath.replace(projectPath, '').replace(/\\/g, '/'),
                content: content.substring(0, this.config.maxTokens),
                hash,
                embedding,
                metadata
            };
        }
        catch (error) {
            throw new Error(`Failed to generate embedding for ${filePath}: ${error}`);
        }
    }
    /**
     * Generate embedding for a class
     */
    async generateClassEmbedding(parsedFile, classInfo) {
        const content = await this.extractClassContent(parsedFile.filePath, classInfo);
        const classContext = this.buildClassContext(classInfo, content);
        const embedding = await this.generateEmbedding(classContext, parsedFile.filePath);
        return {
            classId: `${parsedFile.filePath}:class:${classInfo.name}`,
            className: classInfo.name,
            filePath: parsedFile.filePath,
            content,
            embedding,
            metadata: {
                extends: classInfo.extends,
                implements: classInfo.implements || [],
                methodCount: classInfo.methods?.length || 0,
                propertyCount: classInfo.properties?.length || 0,
                startLine: classInfo.startLine,
                endLine: classInfo.endLine,
                language: parsedFile.language,
                methods: classInfo.methods?.map((m) => m.name) || [],
                properties: classInfo.properties?.map((p) => p.name) || []
            }
        };
    }
    /**
     * Generate embedding for a method
     */
    async generateMethodEmbedding(parsedFile, classInfo, methodInfo) {
        const content = await this.extractMethodContent(parsedFile.filePath, methodInfo);
        const methodContext = this.buildMethodContext(methodInfo, content, classInfo);
        const embedding = await this.generateEmbedding(methodContext, parsedFile.filePath);
        const methodId = classInfo
            ? `${parsedFile.filePath}:class:${classInfo.name}:method:${methodInfo.name}`
            : `${parsedFile.filePath}:function:${methodInfo.name}`;
        return {
            methodId,
            className: classInfo?.name,
            methodName: methodInfo.name,
            filePath: parsedFile.filePath,
            content,
            signature: methodInfo.signature || '',
            parameters: methodInfo.parameters || [],
            returnType: methodInfo.returnType,
            complexity: methodInfo.complexity || 0,
            embedding,
            metadata: {
                isAsync: methodInfo.isAsync || false,
                visibility: methodInfo.visibility || 'public',
                isStatic: methodInfo.isStatic || false,
                startLine: methodInfo.startLine,
                endLine: methodInfo.endLine,
                language: parsedFile.language,
                callsTo: methodInfo.calls || []
            }
        };
    }
    /**
     * Generate embedding vector using configured provider
     */
    async generateEmbedding(text, context) {
        try {
            switch (this.config.provider) {
                case 'xenova':
                    return await this.generateXenovaEmbedding(text);
                case 'openai':
                    return await this.generateOpenAIEmbedding(text);
                case 'local':
                    return await this.generateLocalEmbedding(text);
                case 'hybrid':
                    return await this.generateHybridEmbedding(text);
                default:
                    throw new Error(`Unsupported provider: ${this.config.provider}`);
            }
        }
        catch (error) {
            this.logger.error('Embedding generation failed:', error);
            // Fallback to local embedding
            return this.generateLocalEmbedding(text);
        }
    }
    /**
     * Generate embedding using Xenova transformers
     */
    async generateXenovaEmbedding(text) {
        if (!this.xenovaExtractor) {
            await this.initializeXenova();
            // If still no extractor after initialization, fall back to local
            if (!this.xenovaExtractor) {
                this.logger.warn('Xenova not available, using local embeddings');
                return this.generateLocalEmbedding(text);
            }
        }
        // Truncate text to max tokens
        const truncatedText = text.substring(0, this.config.maxTokens);
        const output = await this.xenovaExtractor(truncatedText, {
            pooling: 'mean',
            normalize: true
        });
        return Array.from(output.data);
    }
    /**
     * Generate embedding using OpenAI
     */
    async generateOpenAIEmbedding(text) {
        if (!this.openaiClient) {
            throw new Error('OpenAI client not initialized');
        }
        const response = await this.openaiClient.embeddings.create({
            model: this.config.model,
            input: text.substring(0, this.config.maxTokens)
        });
        return response.data[0].embedding;
    }
    /**
     * Generate local embedding using basic techniques
     */
    async generateLocalEmbedding(text) {
        // Simple TF-IDF based embedding
        const words = text.toLowerCase().split(/\W+/);
        const wordFreq = new Map();
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
            if (++i >= vectorSize / 2)
                break; // Limit to prevent oversaturation
        }
        // Normalize the vector
        const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        if (magnitude > 0) {
            for (let i = 0; i < embedding.length; i++) {
                embedding[i] /= magnitude;
            }
        }
        return embedding;
    }
    /**
     * Generate hybrid embedding combining multiple approaches
     */
    async generateHybridEmbedding(text) {
        const embeddings = [];
        // Try Xenova
        try {
            embeddings.push(await this.generateXenovaEmbedding(text));
        }
        catch (error) {
            this.logger.warn('Xenova embedding failed, skipping');
        }
        // Try OpenAI if available
        if (this.openaiClient) {
            try {
                embeddings.push(await this.generateOpenAIEmbedding(text));
            }
            catch (error) {
                this.logger.warn('OpenAI embedding failed, skipping');
            }
        }
        // Always include local embedding as fallback
        embeddings.push(await this.generateLocalEmbedding(text));
        // Average all embeddings
        if (embeddings.length === 0) {
            throw new Error('All embedding methods failed');
        }
        // Ensure all embeddings have the same length
        const maxLength = Math.max(...embeddings.map(e => e.length));
        const averaged = new Array(maxLength).fill(0);
        for (const embedding of embeddings) {
            for (let i = 0; i < embedding.length; i++) {
                averaged[i] += embedding[i] / embeddings.length;
            }
        }
        return averaged;
    }
    /**
     * Extract metadata from file content
     */
    extractFileMetadata(content, filePath) {
        const lines = content.split('\n');
        const language = this.detectLanguage(filePath);
        // Extract functions and classes based on language
        const functions = [];
        const classes = [];
        const imports = [];
        const exports = [];
        for (const line of lines) {
            // Functions
            if (line.match(/(?:function|const|let|var)\s+(\w+)\s*(?:=|\()/)) {
                const match = line.match(/(?:function|const|let|var)\s+(\w+)/);
                if (match)
                    functions.push(match[1]);
            }
            // Classes
            if (line.match(/class\s+(\w+)/)) {
                const match = line.match(/class\s+(\w+)/);
                if (match)
                    classes.push(match[1]);
            }
            // Imports
            if (line.match(/import\s+.+from/)) {
                imports.push(line.trim());
            }
            // Exports
            if (line.match(/export\s+/)) {
                exports.push(line.trim());
            }
        }
        return {
            language,
            size: content.length,
            lines: lines.length,
            functions: [...new Set(functions)],
            classes: [...new Set(classes)],
            imports: imports.slice(0, 10), // Limit to first 10
            exports: exports.slice(0, 10)
        };
    }
    /**
     * Detect programming language from file extension
     */
    detectLanguage(filePath) {
        const ext = filePath.split('.').pop()?.toLowerCase();
        const languageMap = {
            'ts': 'typescript',
            'tsx': 'typescript',
            'js': 'javascript',
            'jsx': 'javascript',
            'py': 'python',
            'java': 'java',
            'cs': 'csharp',
            'cpp': 'cpp',
            'c': 'c',
            'go': 'go',
            'rs': 'rust',
            'php': 'php',
            'rb': 'ruby',
            'swift': 'swift',
            'kt': 'kotlin'
        };
        return languageMap[ext || ''] || 'unknown';
    }
    /**
     * Extract class content from file
     */
    async extractClassContent(filePath, classInfo) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const lines = content.split('\n');
            return lines.slice(classInfo.startLine - 1, classInfo.endLine).join('\n');
        }
        catch (error) {
            this.logger.error(`Failed to extract class content from ${filePath}:`, error);
            return '';
        }
    }
    /**
     * Extract method content from file
     */
    async extractMethodContent(filePath, methodInfo) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const lines = content.split('\n');
            return lines.slice(methodInfo.startLine - 1, methodInfo.endLine).join('\n');
        }
        catch (error) {
            this.logger.error(`Failed to extract method content from ${filePath}:`, error);
            return '';
        }
    }
    /**
     * Build context string for class embedding
     */
    buildClassContext(classInfo, content) {
        const parts = [
            `Class: ${classInfo.name}`,
            classInfo.extends ? `Extends: ${classInfo.extends}` : '',
            classInfo.implements?.length ? `Implements: ${classInfo.implements.join(', ')}` : '',
            `Methods: ${classInfo.methods?.map((m) => m.name).join(', ') || 'none'}`,
            `Properties: ${classInfo.properties?.map((p) => p.name).join(', ') || 'none'}`,
            '',
            'Content:',
            content
        ];
        return parts.filter(p => p).join('\n');
    }
    /**
     * Build context string for method embedding
     */
    buildMethodContext(methodInfo, content, classInfo) {
        const parts = [
            classInfo ? `Class: ${classInfo.name}` : '',
            `Method: ${methodInfo.name}`,
            methodInfo.signature ? `Signature: ${methodInfo.signature}` : '',
            methodInfo.returnType ? `Returns: ${methodInfo.returnType}` : '',
            methodInfo.parameters?.length ? `Parameters: ${methodInfo.parameters.map((p) => p.name).join(', ')}` : '',
            '',
            'Implementation:',
            content
        ];
        return parts.filter(p => p).join('\n');
    }
    /**
     * Store file embedding in database
     */
    async storeEmbedding(embedding, postgres) {
        try {
            await postgres.query(`
        INSERT INTO embeddings (file_path, content, hash, embedding, metadata)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (file_path) DO UPDATE SET
          content = $2,
          hash = $3,
          embedding = $4,
          metadata = $5,
          updated_at = NOW()
      `, [
                embedding.filePath,
                embedding.content,
                embedding.hash,
                JSON.stringify(embedding.embedding),
                JSON.stringify(embedding.metadata)
            ]);
        }
        catch (error) {
            this.logger.error('Failed to store embedding:', error);
            throw error;
        }
    }
    /**
     * Store class embedding in database
     */
    async storeClassEmbedding(projectId, embedding, dbConnections) {
        try {
            const pgClient = await dbConnections.getPostgresConnection();
            await pgClient.query(`
        INSERT INTO class_embeddings (
          project_id, class_id, class_name, file_path,
          content, embedding, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (class_id) DO UPDATE SET
          content = $5,
          embedding = $6,
          metadata = $7,
          updated_at = NOW()
      `, [
                projectId,
                embedding.classId,
                embedding.className,
                embedding.filePath,
                embedding.content,
                JSON.stringify(embedding.embedding),
                JSON.stringify(embedding.metadata)
            ]);
        }
        catch (error) {
            this.logger.error('Failed to store class embedding:', error);
            throw error;
        }
    }
    /**
     * Store method embedding in database
     */
    async storeMethodEmbedding(projectId, embedding, dbConnections) {
        try {
            const pgClient = await dbConnections.getPostgresConnection();
            await pgClient.query(`
        INSERT INTO method_embeddings (
          project_id, method_id, class_name, method_name,
          file_path, content, signature, embedding, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (method_id) DO UPDATE SET
          content = $6,
          signature = $7,
          embedding = $8,
          metadata = $9,
          updated_at = NOW()
      `, [
                projectId,
                embedding.methodId,
                embedding.className,
                embedding.methodName,
                embedding.filePath,
                embedding.content,
                embedding.signature,
                JSON.stringify(embedding.embedding),
                JSON.stringify(embedding.metadata)
            ]);
        }
        catch (error) {
            this.logger.error('Failed to store method embedding:', error);
            throw error;
        }
    }
    /**
     * Search for similar content using embeddings
     */
    async searchSimilar(query, limit = 10, threshold = 0.7) {
        const queryEmbedding = await this.generateEmbedding(query);
        // This would typically query the database for similar embeddings
        // using cosine similarity or other vector similarity metrics
        this.logger.info(`Searching for content similar to: "${query.substring(0, 50)}..."`);
        // Placeholder for actual implementation
        return [];
    }
    /**
     * Calculate cosine similarity between two vectors
     */
    cosineSimilarity(vec1, vec2) {
        if (vec1.length !== vec2.length) {
            throw new Error('Vectors must have the same length');
        }
        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;
        for (let i = 0; i < vec1.length; i++) {
            dotProduct += vec1[i] * vec2[i];
            norm1 += vec1[i] * vec1[i];
            norm2 += vec2[i] * vec2[i];
        }
        const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
        return denominator === 0 ? 0 : dotProduct / denominator;
    }
    /**
     * Find similar methods using embeddings
     */
    async findSimilarMethods(methodEmbedding, threshold = 0.8) {
        // This would query the database for similar method embeddings
        this.logger.info(`Finding methods similar to: ${methodEmbedding.methodName}`);
        return [];
    }
    /**
     * Find similar classes using embeddings
     */
    async findSimilarClasses(classEmbedding, threshold = 0.8) {
        // This would query the database for similar class embeddings
        this.logger.info(`Finding classes similar to: ${classEmbedding.className}`);
        return [];
    }
    /**
     * Initialize database tables for embeddings
     */
    async initializeDatabase(dbConnections) {
        const pgClient = await dbConnections.getPostgresConnection();
        // Create tables if they don't exist
        await pgClient.query(`
      CREATE TABLE IF NOT EXISTS embeddings (
        file_path TEXT PRIMARY KEY,
        content TEXT,
        hash TEXT,
        embedding JSONB,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
        await pgClient.query(`
      CREATE TABLE IF NOT EXISTS method_embeddings (
        method_id TEXT PRIMARY KEY,
        project_id TEXT,
        class_name TEXT,
        method_name TEXT,
        file_path TEXT,
        content TEXT,
        signature TEXT,
        embedding JSONB,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
        await pgClient.query(`
      CREATE TABLE IF NOT EXISTS class_embeddings (
        class_id TEXT PRIMARY KEY,
        project_id TEXT,
        class_name TEXT,
        file_path TEXT,
        content TEXT,
        embedding JSONB,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
        this.logger.info('✅ Embedding database tables initialized');
    }
}
exports.EmbeddingService = EmbeddingService;
//# sourceMappingURL=embedding-service.js.map
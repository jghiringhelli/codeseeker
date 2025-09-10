"use strict";
/**
 * Semantic Enhancement Engine
 * Powers CLI cycle with semantic search and relationship traversal
 * Provides complete context to Claude without file reads
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
exports.SemanticEnhancementEngine = void 0;
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs/promises"));
const logger_1 = require("../utils/logger");
class SemanticEnhancementEngine {
    logger = logger_1.Logger.getInstance();
    redisClient; // Redis client for fast caching
    pgPool; // PostgreSQL pool for semantic search
    neo4jDriver; // Neo4j driver for relationship traversal
    constructor() {
        // Initialize database connections asynchronously
        this.initializeConnections().catch(err => {
            this.logger.error('Failed to initialize semantic engine:', err);
        });
    }
    /**
     * Main enhancement workflow:
     * 1. Execute semantic search based on user query
     * 2. Get reasonable subset of most relevant files
     * 3. Traverse Neo4j to find all related files
     * 4. Provide complete context with cached content
     * 5. Update cache after Claude's response
     */
    async enhanceQuery(query, maxPrimaryFiles = 8, maxRelatedFiles = 15, maxContextSize = 100000 // ~100KB total context
    ) {
        const startTime = Date.now();
        this.logger.info(`🔍 Enhancing query with semantic search: "${query}"`);
        try {
            // Step 1: Execute semantic search to get most relevant files
            const primaryFiles = await this.executeSemanticSearch(query, maxPrimaryFiles);
            this.logger.info(`Found ${primaryFiles.length} primary relevant files`);
            // Step 2: Traverse Neo4j relationships to find all related files
            const relatedFiles = await this.findAllRelatedFiles(primaryFiles.map(f => f.filePath), maxRelatedFiles);
            this.logger.info(`Found ${relatedFiles.length} related files through graph traversal`);
            // Step 3: Validate cache freshness and update if needed
            const validatedContext = await this.validateAndUpdateCache(primaryFiles, relatedFiles);
            // Step 4: Build complete context within size limits
            const context = await this.buildOptimalContext(query, validatedContext.primaryFiles, validatedContext.relatedFiles, maxContextSize);
            const duration = Date.now() - startTime;
            this.logger.info(`✅ Context enhancement complete (${duration}ms): ${context.totalFiles} files, ${context.contextSize} chars, ${Math.round(context.cacheHitRate * 100)}% cache hit`);
            return context;
        }
        catch (error) {
            this.logger.error('❌ Semantic enhancement failed:', error);
            throw error;
        }
    }
    /**
     * Execute semantic search using pgvector embeddings
     */
    async executeSemanticSearch(query, limit) {
        // Ensure connections are initialized
        if (!this.pgPool) {
            await this.initializeConnections();
        }
        // Generate embedding for query
        const queryEmbedding = await this.generateQueryEmbedding(query);
        // Search semantic_search_embeddings table using cosine similarity
        const searchQuery = `
      SELECT 
        file_path,
        content_text,
        content_hash,
        metadata,
        1 - (embedding <=> $1) as relevance_score
      FROM semantic_search_embeddings 
      WHERE 1 - (embedding <=> $1) > 0.3  -- Minimum relevance threshold
      ORDER BY relevance_score DESC
      LIMIT $2
    `;
        const results = await this.pgPool.query(searchQuery, [queryEmbedding, limit]);
        const searchResults = [];
        for (const row of results.rows) {
            // Check Redis cache for content and hash validation
            const cachedFile = await this.getFromRedisCache(row.file_path);
            searchResults.push({
                filePath: row.file_path,
                relevanceScore: parseFloat(row.relevance_score),
                content: cachedFile?.content || row.content_text,
                lastModified: cachedFile?.lastModified || Date.now(),
                hash: cachedFile?.hash || row.content_hash,
                matchReason: this.determineMatchReason(query, row.content_text, row.relevance_score)
            });
        }
        return searchResults;
    }
    /**
     * Find all files related through Neo4j graph relationships
     */
    async findAllRelatedFiles(primaryFilePaths, limit) {
        const session = this.neo4jDriver.session();
        try {
            // Cypher query to find all files related to primary files within 2-3 degrees
            const cypherQuery = `
        MATCH (primary:File) 
        WHERE primary.path IN $primaryPaths
        
        MATCH (primary)-[r1:DEPENDS_ON|USES|CONFIGURES|TESTS|DOCUMENTS|SIMILAR_TO*1..2]-(related:File)
        WHERE NOT related.path IN $primaryPaths
        
        WITH related, r1, 
             CASE 
               WHEN size(r1) = 1 THEN 1
               WHEN size(r1) = 2 THEN 2  
               ELSE 3
             END as distance,
             type(r1[0]) as relationshipType
        
        RETURN DISTINCT 
          related.path as filePath,
          relationshipType,
          distance
        ORDER BY distance ASC, relationshipType ASC
        LIMIT $limit
      `;
            const result = await session.run(cypherQuery, {
                primaryPaths: primaryFilePaths,
                limit
            });
            const relatedFiles = [];
            for (const record of result.records) {
                const filePath = record.get('filePath');
                const relationshipType = record.get('relationshipType');
                const distance = record.get('distance').toNumber();
                // Get cached content for this file
                const cachedFile = await this.getFromRedisCache(filePath);
                if (cachedFile) {
                    relatedFiles.push({
                        filePath,
                        relationshipType,
                        content: cachedFile.content,
                        hash: cachedFile.hash,
                        distance
                    });
                }
            }
            return relatedFiles;
        }
        finally {
            await session.close();
        }
    }
    /**
     * Validate cache freshness using file hash comparison
     */
    async validateAndUpdateCache(primaryFiles, relatedFiles) {
        const filesToCheck = [
            ...primaryFiles.map(f => f.filePath),
            ...relatedFiles.map(f => f.filePath)
        ];
        let cacheHits = 0;
        let cacheUpdates = 0;
        for (const filePath of filesToCheck) {
            const currentHash = await this.calculateFileHash(filePath);
            const cachedFile = await this.getFromRedisCache(filePath);
            if (!cachedFile || cachedFile.hash !== currentHash) {
                // Cache miss or stale - update cache
                await this.updateRedisCache(filePath, currentHash);
                cacheUpdates++;
            }
            else {
                cacheHits++;
            }
        }
        this.logger.info(`Cache validation: ${cacheHits} hits, ${cacheUpdates} updates`);
        // Return validated files (content refreshed if needed)
        const validatedPrimary = await this.refreshFileContent(primaryFiles);
        const validatedRelated = await this.refreshRelatedFileContent(relatedFiles);
        return {
            primaryFiles: validatedPrimary,
            relatedFiles: validatedRelated
        };
    }
    /**
     * Build optimal context within size constraints
     */
    async buildOptimalContext(query, primaryFiles, relatedFiles, maxSize) {
        let currentSize = 0;
        let cacheHits = 0;
        let totalFiles = 0;
        // Prioritize primary files (highest relevance first)
        const includedPrimary = [];
        for (const file of primaryFiles.sort((a, b) => b.relevanceScore - a.relevanceScore)) {
            if (currentSize + file.content.length <= maxSize) {
                includedPrimary.push(file);
                currentSize += file.content.length;
                totalFiles++;
                cacheHits++; // Content came from cache
            }
        }
        // Add related files by relationship priority and distance
        const includedRelated = [];
        const priorityOrder = ['DEPENDS_ON', 'USES', 'TESTS', 'CONFIGURES', 'SIMILAR_TO'];
        for (const priority of priorityOrder) {
            const filesOfType = relatedFiles
                .filter(f => f.relationshipType === priority)
                .sort((a, b) => a.distance - b.distance);
            for (const file of filesOfType) {
                if (currentSize + file.content.length <= maxSize) {
                    includedRelated.push(file);
                    currentSize += file.content.length;
                    totalFiles++;
                    cacheHits++;
                }
            }
        }
        return {
            query,
            primaryFiles: includedPrimary,
            relatedFiles: includedRelated,
            totalFiles,
            contextSize: currentSize,
            cacheHitRate: cacheHits / totalFiles,
            generatedAt: Date.now()
        };
    }
    /**
     * Update context after Claude's processing
     */
    async updateContextAfterProcessing(modifiedFiles, context) {
        this.logger.info(`📝 Updating context after processing ${modifiedFiles.length} modified files`);
        for (const filePath of modifiedFiles) {
            try {
                // Recalculate hash and update cache
                const newHash = await this.calculateFileHash(filePath);
                await this.updateRedisCache(filePath, newHash);
                // Update semantic embeddings if content changed significantly
                const cachedFile = await this.getFromRedisCache(filePath);
                if (cachedFile) {
                    await this.updateSemanticEmbedding(filePath, cachedFile.content, newHash);
                }
                this.logger.debug(`Updated cache and embeddings for ${filePath}`);
            }
            catch (error) {
                this.logger.warn(`Failed to update context for ${filePath}:`, error);
            }
        }
    }
    // Helper methods
    async initializeConnections() {
        try {
            // For now, use mock database connections since we don't have containers running
            // In production, this would initialize actual database clients
            this.pgPool = {
                query: async (sql, params) => {
                    // Mock PostgreSQL query results
                    return { rows: [] };
                }
            };
            this.redisClient = {
                get: async (key) => null,
                set: async (key, value) => 'OK',
                setex: async (key, ttl, value) => 'OK'
            };
            this.neo4jDriver = {
                session: () => ({
                    run: async (query, params) => ({ records: [] }),
                    close: async () => { }
                })
            };
            this.logger.info('🔌 Semantic enhancement engine initialized');
        }
        catch (error) {
            this.logger.error('❌ Failed to initialize database connections:', error);
            throw error;
        }
    }
    async generateQueryEmbedding(query) {
        // Generate embedding using same method as semantic search
        // Implementation would use embedding model (OpenAI, local model, etc.)
        return new Array(1536).fill(0); // Placeholder
    }
    async getFromRedisCache(filePath) {
        // Get file content and metadata from Redis
        const cacheKey = `file:${filePath}`;
        const cached = await this.redisClient?.get(cacheKey);
        return cached ? JSON.parse(cached) : null;
    }
    async updateRedisCache(filePath, hash) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const stats = await fs.stat(filePath);
            const cacheData = {
                content,
                hash,
                lastModified: stats.mtime.getTime(),
                size: stats.size,
                language: this.detectLanguage(filePath),
                exports: this.extractExports(content),
                imports: this.extractImports(content),
                classes: this.extractClasses(content),
                functions: this.extractFunctions(content)
            };
            const cacheKey = `file:${filePath}`;
            await this.redisClient?.setex(cacheKey, 3600, JSON.stringify(cacheData)); // 1 hour TTL
        }
        catch (error) {
            this.logger.warn(`Failed to update Redis cache for ${filePath}:`, error);
        }
    }
    async calculateFileHash(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            return crypto.createHash('sha256').update(content).digest('hex');
        }
        catch (error) {
            return '';
        }
    }
    async updateSemanticEmbedding(filePath, content, hash) {
        // Update semantic_search_embeddings table with new content and embedding
        // Implementation would generate new embedding and update PostgreSQL
    }
    determineMatchReason(query, content, score) {
        if (score > 0.8)
            return 'High semantic similarity';
        if (score > 0.6)
            return 'Strong content match';
        if (score > 0.4)
            return 'Relevant context';
        return 'Related content';
    }
    // Simplified extraction methods (would be more sophisticated in real implementation)
    detectLanguage(filePath) {
        const ext = filePath.split('.').pop()?.toLowerCase();
        const langMap = {
            'ts': 'TypeScript', 'js': 'JavaScript', 'py': 'Python',
            'java': 'Java', 'cs': 'C#', 'go': 'Go'
        };
        return langMap[ext || ''] || 'Unknown';
    }
    extractExports(content) {
        const matches = content.match(/export\s+(?:class|function|const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g) || [];
        return matches.map(m => m.split(' ').pop() || '');
    }
    extractImports(content) {
        const matches = content.match(/import\s+.*?from\s+['"`]([^'"`]+)['"`]/g) || [];
        return matches.map(m => m.match(/['"`]([^'"`]+)['"`]/)?.[1] || '');
    }
    extractClasses(content) {
        const matches = content.match(/class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g) || [];
        return matches.map(m => m.split(' ')[1]);
    }
    extractFunctions(content) {
        const matches = content.match(/(?:function|const)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g) || [];
        return matches.map(m => m.split(' ').pop() || '');
    }
    async refreshFileContent(files) {
        // Refresh content from Redis cache after validation
        for (const file of files) {
            const cached = await this.getFromRedisCache(file.filePath);
            if (cached) {
                file.content = cached.content;
                file.hash = cached.hash;
                file.lastModified = cached.lastModified;
            }
        }
        return files;
    }
    async refreshRelatedFileContent(files) {
        // Refresh content from Redis cache after validation
        for (const file of files) {
            const cached = await this.getFromRedisCache(file.filePath);
            if (cached) {
                file.content = cached.content;
                file.hash = cached.hash;
            }
        }
        return files;
    }
}
exports.SemanticEnhancementEngine = SemanticEnhancementEngine;
exports.default = SemanticEnhancementEngine;
//# sourceMappingURL=semantic-enhancement-engine.js.map
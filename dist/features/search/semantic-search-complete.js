"use strict";
/**
 * Complete Semantic Search Tool Implementation
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
exports.SemanticSearchTool = void 0;
const tool_interface_1 = require("../../shared/tool-interface");
const logger_1 = require("../../utils/logger");
const multi_level_cache_1 = require("../../shared/multi-level-cache");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const fast_glob_1 = require("fast-glob");
const crypto_1 = __importDefault(require("crypto"));
class SemanticSearchTool extends tool_interface_1.AnalysisTool {
    // Tool metadata
    id = 'semantic-search';
    name = 'Semantic Search';
    description = 'Intelligent semantic search across codebase using vector embeddings';
    version = '1.0.0';
    category = 'search';
    languages = ['any'];
    frameworks = ['any'];
    purposes = ['search', 'discovery', 'comprehension'];
    intents = ['search', 'find', 'locate', 'discover', 'similarity', 'semantic'];
    keywords = ['search', 'semantic', 'find', 'similar', 'vector', 'embedding'];
    logger;
    openaiApiKey;
    cache = null;
    constructor() {
        super();
        this.logger = new logger_1.Logger(logger_1.LogLevel.INFO, 'SemanticSearchTool');
        this.openaiApiKey = process.env.OPENAI_API_KEY;
        if (!this.openaiApiKey) {
            this.logger.warn('OPENAI_API_KEY not found. Embeddings will not be generated.');
        }
    }
    async initializeCache(projectPath) {
        if (!this.cache) {
            this.cache = new multi_level_cache_1.SemanticSearchCache(projectPath);
            await this.cache.initialize();
            this.logger.info('🗄️  Semantic search cache initialized');
        }
    }
    getDatabaseToolName() {
        return 'semantic-search';
    }
    async performAnalysis(projectPath, projectId, parameters = {}) {
        this.logger.info(`Starting semantic analysis for project ${projectId}`);
        // Initialize cache
        await this.initializeCache(projectPath);
        try {
            // Extract code segments - use file context if available
            const segments = parameters.fileContext
                ? await this.extractCodeSegmentsFromFiles(projectPath, parameters.fileContext)
                : await this.extractCodeSegments(projectPath);
            this.logger.info(`Extracted ${segments.length} code segments`);
            // Prepare data for database storage with caching
            const embeddingData = [];
            let cacheHits = 0;
            let cacheGenerated = 0;
            for (const segment of segments) {
                try {
                    let embedding = null;
                    const contentHash = this.generateContentHash(segment.contentText);
                    // Check cache first for embeddings
                    if (this.openaiApiKey && !parameters.skipEmbeddings) {
                        // Try to get embedding from cache
                        const cachedEmbedding = await this.cache.getEmbedding(segment.contentText, contentHash);
                        if (cachedEmbedding) {
                            embedding = cachedEmbedding;
                            cacheHits++;
                            this.logger.debug(`🎯 Cache hit for embedding: ${segment.filePath}`);
                        }
                        else {
                            // Generate new embedding
                            embedding = await this.generateEmbedding(segment.contentText);
                            await this.cache.setEmbedding(segment.contentText, embedding, contentHash);
                            cacheGenerated++;
                            this.logger.debug(`💾 Generated and cached embedding: ${segment.filePath}`);
                            await this.delay(100); // Rate limiting
                        }
                    }
                    embeddingData.push({
                        project_id: projectId,
                        file_path: segment.filePath,
                        content_type: segment.contentType,
                        content_text: segment.contentText,
                        content_hash: contentHash,
                        embedding: embedding ? `[${embedding.join(',')}]` : null, // Convert to PostgreSQL array format
                        metadata: segment.metadata
                    });
                }
                catch (error) {
                    this.logger.warn(`Failed to process segment ${segment.id}: ${error}`);
                }
            }
            // Store embeddings in database
            await this.storeEmbeddings(projectId, embeddingData);
            return {
                source: 'analysis',
                data: embeddingData,
                analysis: {
                    totalSegments: embeddingData.length,
                    embeddingsGenerated: embeddingData.filter(d => d.embedding).length,
                    cacheHits,
                    cacheGenerated,
                    cacheEfficiency: cacheHits + cacheGenerated > 0 ? (cacheHits / (cacheHits + cacheGenerated) * 100).toFixed(2) + '%' : '0%',
                    languages: this.getLanguageStats(embeddingData),
                    contentTypes: this.getContentTypeStats(embeddingData),
                    cacheStats: this.cache ? this.cache.getStats() : null
                },
                recommendations: this.generateRecommendations(embeddingData)
            };
        }
        catch (error) {
            this.logger.error(`Semantic analysis failed: ${error}`);
            throw error;
        }
    }
    async extractCodeSegmentsFromFiles(projectPath, fileContext) {
        const segments = [];
        // Use discovered files from context
        const filesToProcess = fileContext.primaryFiles ?
            fileContext.primaryFiles.concat(fileContext.relatedFiles || []) :
            fileContext.discoveredFiles || [];
        for (const fileInfo of filesToProcess) {
            try {
                const filePath = path.resolve(projectPath, fileInfo.filePath || fileInfo);
                const relativePath = path.relative(projectPath, filePath);
                const contentHash = await this.calculateFileHash(filePath);
                // Check cache for segments first
                const cachedSegments = await this.cache.getSegments(relativePath, contentHash);
                if (cachedSegments) {
                    segments.push(...cachedSegments);
                    this.logger.debug(`🎯 Cache hit for segments: ${relativePath}`);
                    continue;
                }
                // Generate new segments
                const content = await fs.readFile(filePath, 'utf-8');
                const language = this.getLanguageFromExtension(path.extname(filePath));
                // Generate segments for this file
                const fileSegments = [];
                // Add whole file segment
                fileSegments.push({
                    id: `file_${crypto_1.default.createHash('md5').update(filePath).digest('hex')}`,
                    filePath: relativePath,
                    contentType: 'file',
                    contentText: content.substring(0, 4000), // Limit for embedding
                    metadata: {
                        language,
                        fileSize: content.length,
                        lines: content.split('\n').length,
                        relevanceScore: fileInfo.relevanceScore || 1.0
                    }
                });
                // Extract functions from focused files
                await this.extractFunctions(content, relativePath, language, fileSegments);
                // Cache the segments for this file
                await this.cache.setSegments(relativePath, fileSegments, contentHash);
                segments.push(...fileSegments);
            }
            catch (error) {
                this.logger.warn(`Failed to process file ${fileInfo.filePath}: ${error}`);
            }
        }
        return segments;
    }
    async extractCodeSegments(projectPath) {
        const segments = [];
        const filePatterns = ['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx'];
        const filePaths = await (0, fast_glob_1.glob)(filePatterns, {
            cwd: projectPath,
            absolute: true,
            ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**']
        });
        for (const filePath of filePaths) {
            try {
                const content = await fs.readFile(filePath, 'utf-8');
                const relativePath = path.relative(projectPath, filePath);
                const language = this.getLanguageFromExtension(path.extname(filePath));
                // Add whole file segment
                segments.push({
                    id: `file_${crypto_1.default.createHash('md5').update(filePath).digest('hex')}`,
                    filePath: relativePath,
                    contentType: 'file',
                    contentText: content.substring(0, 4000), // Limit for embedding
                    metadata: {
                        language,
                        fileSize: content.length,
                        lines: content.split('\n').length
                    }
                });
                // Extract functions
                await this.extractFunctions(content, relativePath, language, segments);
            }
            catch (error) {
                this.logger.warn(`Failed to process file ${filePath}: ${error}`);
            }
        }
        return segments;
    }
    async extractFunctions(content, filePath, language, segments) {
        if (language === 'typescript' || language === 'javascript') {
            const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/g;
            let match;
            while ((match = functionRegex.exec(content)) !== null) {
                const name = match[1] || match[2];
                const lineNumber = content.substring(0, match.index).split('\n').length;
                const bodyStart = match.index;
                let bodyEnd = content.indexOf('\n\n', bodyStart);
                if (bodyEnd === -1)
                    bodyEnd = Math.min(bodyStart + 1000, content.length);
                const bodyText = content.substring(bodyStart, bodyEnd);
                segments.push({
                    id: `function_${crypto_1.default.createHash('md5').update(`${filePath}_${name}_${lineNumber}`).digest('hex')}`,
                    filePath,
                    contentType: 'function',
                    contentText: bodyText,
                    startLine: lineNumber,
                    metadata: {
                        language,
                        name,
                        exported: match[0].includes('export')
                    }
                });
            }
        }
    }
    async generateEmbedding(text) {
        if (!this.openaiApiKey) {
            throw new Error('OPENAI_API_KEY required');
        }
        const response = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.openaiApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'text-embedding-ada-002',
                input: text.substring(0, 8000) // OpenAI limit
            })
        });
        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return data.data[0].embedding;
    }
    getLanguageFromExtension(ext) {
        const langMap = {
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.js': 'javascript',
            '.jsx': 'javascript'
        };
        return langMap[ext] || 'unknown';
    }
    generateContentHash(content) {
        return crypto_1.default.createHash('sha256').update(content).digest('hex');
    }
    getLanguageStats(data) {
        return data.reduce((stats, item) => {
            const lang = item.metadata?.language || 'unknown';
            stats[lang] = (stats[lang] || 0) + 1;
            return stats;
        }, {});
    }
    getContentTypeStats(data) {
        return data.reduce((stats, item) => {
            stats[item.content_type] = (stats[item.content_type] || 0) + 1;
            return stats;
        }, {});
    }
    generateRecommendations(data) {
        const recommendations = [];
        if (data.length > 1000) {
            recommendations.push('Large codebase detected - consider filtering by content type for better performance');
        }
        const embeddingCount = data.filter(d => d.embedding).length;
        if (embeddingCount === 0) {
            recommendations.push('No embeddings generated - set OPENAI_API_KEY to enable semantic search');
        }
        else if (embeddingCount < data.length * 0.5) {
            recommendations.push('Partial embeddings generated - check OpenAI API key and rate limits');
        }
        return recommendations;
    }
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    async calculateFileHash(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            return crypto_1.default.createHash('sha256').update(content).digest('hex');
        }
        catch (error) {
            // If we can't read the file, use the file path as fallback
            return crypto_1.default.createHash('sha256').update(filePath).digest('hex');
        }
    }
    async storeEmbeddings(projectId, embeddingData) {
        for (const embedding of embeddingData) {
            try {
                const embeddingVector = embedding.embedding ?
                    embedding.embedding.replace(/^\[|\]$/g, '').split(',').map(Number) : null;
                await this.saveData(projectId, [{
                        project_id: projectId,
                        file_path: embedding.file_path,
                        content_type: embedding.content_type,
                        content_text: embedding.content_text,
                        content_hash: embedding.content_hash,
                        embedding: embeddingVector,
                        metadata: embedding.metadata
                    }]);
            }
            catch (error) {
                this.logger.warn(`Failed to store embedding for ${embedding.file_path}: ${error}`);
            }
        }
    }
    isApplicable(projectPath, context) {
        return true;
    }
    getRecommendations(analysisResult) {
        return analysisResult.recommendations || [];
    }
}
exports.SemanticSearchTool = SemanticSearchTool;
//# sourceMappingURL=semantic-search-complete.js.map
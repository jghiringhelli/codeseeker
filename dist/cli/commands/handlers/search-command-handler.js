"use strict";
/**
 * Search Command Handler
 * Single Responsibility: Handle search commands including semantic search
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
exports.SearchCommandHandler = void 0;
const base_command_handler_1 = require("../base-command-handler");
const embedding_service_1 = require("../../services/data/embedding/embedding-service");
const analysis_repository_consolidated_1 = require("../../../shared/analysis-repository-consolidated");
const logger_1 = require("../../../utils/logger");
const path_1 = __importDefault(require("path"));
const fast_glob_1 = require("fast-glob");
const fs = __importStar(require("fs/promises"));
class SearchCommandHandler extends base_command_handler_1.BaseCommandHandler {
    logger = logger_1.Logger.getInstance();
    async handle(args) {
        // Parse arguments first to check for --index flag
        const parts = args.trim() ? args.split(' ') : [];
        const isIndex = parts.includes('--index');
        // Allow args with only flags if indexing
        const nonFlagParts = parts.filter(p => !p.startsWith('--'));
        if (nonFlagParts.length === 0 && !isIndex) {
            return {
                success: false,
                message: 'Usage: search <query> [--index] [--threshold=0.7] [--limit=10] [--verbose]'
            };
        }
        const isVerbose = parts.includes('--verbose');
        // Extract threshold and limit
        const thresholdArg = parts.find(p => p.startsWith('--threshold='));
        const limitArg = parts.find(p => p.startsWith('--limit='));
        const threshold = thresholdArg ? parseFloat(thresholdArg.split('=')[1]) : 0.7;
        const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 10;
        // Get query (remove flags)
        const query = parts.filter(p => !p.startsWith('--')).join(' ');
        try {
            const projectPath = this.context.currentProject?.projectPath || process.cwd();
            this.logger.info(`Using project path: ${projectPath}`);
            this.logger.info(`Context project ID: ${this.context.currentProject?.projectId}`);
            const projectId = this.context.currentProject?.projectId || await this.generateProjectId(projectPath);
            this.logger.info(`Final project ID for search: ${projectId}`);
            if (isIndex) {
                return await this.indexProject(projectPath, projectId);
            }
            else if (query) {
                return await this.searchCode(query, projectId, { threshold, limit, verbose: isVerbose });
            }
            else {
                return {
                    success: false,
                    message: 'Please provide a search query or use --index to index the codebase'
                };
            }
        }
        catch (error) {
            this.logger.error('Search failed:', error);
            return {
                success: false,
                message: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
    /**
     * Index the current project for semantic search (incremental)
     * Only reindexes files that have changed based on content hash
     */
    async indexProject(projectPath, projectId) {
        console.log('🔄 Indexing codebase for semantic search...');
        console.log(`📁 Project: ${projectPath}`);
        try {
            // Get all code files
            const files = await (0, fast_glob_1.glob)(['**/*.{ts,js,jsx,tsx,py,java,cs,cpp,c,h,hpp}'], {
                cwd: projectPath,
                ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**']
            });
            console.log(`📂 Found ${files.length} files to scan`);
            if (files.length === 0) {
                return {
                    success: false,
                    message: 'No code files found to index'
                };
            }
            // Get existing file hashes from database to enable incremental indexing
            const existingHashes = await this.getExistingFileHashes(projectId);
            console.log(`   📊 Found ${existingHashes.size} previously indexed files`);
            // Compute current file hashes and determine what needs updating
            const crypto = require('crypto');
            const filesToProcess = [];
            const filesToDelete = [];
            const currentFiles = new Set();
            for (const file of files) {
                currentFiles.add(file);
                const filePath = path_1.default.join(projectPath, file);
                try {
                    const content = await fs.readFile(filePath, 'utf-8');
                    if (content.length < 50)
                        continue; // Skip very small files
                    const fileHash = crypto.createHash('md5').update(content).digest('hex');
                    const existingHash = existingHashes.get(file);
                    if (!existingHash || existingHash !== fileHash) {
                        filesToProcess.push(file);
                        if (existingHash) {
                            filesToDelete.push(file); // File changed, delete old embeddings first
                        }
                    }
                }
                catch (error) {
                    this.logger.warn(`Failed to read file ${file}:`, error);
                }
            }
            // Find deleted files (in DB but not in current file system)
            for (const [file] of existingHashes) {
                if (!currentFiles.has(file)) {
                    filesToDelete.push(file);
                }
            }
            // Delete old embeddings for changed/deleted files
            if (filesToDelete.length > 0) {
                await this.deleteFileEmbeddings(projectId, filesToDelete);
                console.log(`   🗑️  Removed embeddings for ${filesToDelete.length} changed/deleted files`);
            }
            if (filesToProcess.length === 0) {
                console.log(`✅ All ${files.length} files are up to date - no reindexing needed`);
                return {
                    success: true,
                    message: `Project already indexed: ${files.length} files up to date`,
                    data: { segments: 0, files: 0, unchanged: files.length }
                };
            }
            console.log(`   📝 Processing ${filesToProcess.length} new/changed files...`);
            // Initialize embedding service
            const embeddingService = new embedding_service_1.EmbeddingService({
                provider: 'xenova',
                model: 'Xenova/all-MiniLM-L6-v2'
            });
            const embeddings = [];
            let processedFiles = 0;
            for (const file of filesToProcess.slice(0, 50)) { // Limit to 50 files for MVP
                try {
                    const filePath = path_1.default.join(projectPath, file);
                    const content = await fs.readFile(filePath, 'utf-8');
                    if (content.length < 50)
                        continue;
                    // Create simple chunks (split by lines for now)
                    const lines = content.split('\n');
                    const chunks = [];
                    for (let i = 0; i < lines.length; i += 20) {
                        const chunk = lines.slice(i, i + 20).join('\n');
                        if (chunk.trim().length > 20) {
                            chunks.push(chunk);
                        }
                    }
                    // Compute full file hash for incremental indexing comparison
                    const fullFileHash = crypto.createHash('md5').update(content).digest('hex');
                    // Generate embeddings for each chunk
                    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
                        const chunk = chunks[chunkIndex];
                        try {
                            const embedding = {
                                project_id: projectId,
                                file_path: file,
                                chunk_index: chunkIndex,
                                content_type: 'code',
                                content_text: chunk,
                                content_hash: crypto.createHash('md5').update(chunk).digest('hex'),
                                // Store full file hash in metadata for incremental indexing
                                metadata: {
                                    full_file_hash: fullFileHash,
                                    total_chunks: chunks.length
                                }
                            };
                            embeddings.push(embedding);
                        }
                        catch (error) {
                            this.logger.warn(`Failed to process chunk ${chunkIndex} in ${file}:`, error);
                        }
                    }
                    processedFiles++;
                    if (processedFiles % 10 === 0) {
                        console.log(`   Processed ${processedFiles}/${filesToProcess.length} files...`);
                    }
                }
                catch (error) {
                    this.logger.warn(`Failed to process file ${file}:`, error);
                }
            }
            // Save embeddings to database
            if (embeddings.length > 0) {
                await analysis_repository_consolidated_1.analysisRepository.saveMultipleEmbeddings(embeddings);
                console.log(`✅ Generated embeddings for ${embeddings.length} code segments`);
                console.log(`📊 Processed ${processedFiles} new/changed files (${files.length - filesToProcess.length} unchanged)`);
                return {
                    success: true,
                    message: `Project indexed: ${embeddings.length} segments from ${processedFiles} files`,
                    data: {
                        segments: embeddings.length,
                        files: processedFiles,
                        unchanged: files.length - filesToProcess.length,
                        deleted: filesToDelete.length
                    }
                };
            }
            else {
                return {
                    success: true,
                    message: 'No new code segments to index',
                    data: { segments: 0, files: 0 }
                };
            }
        }
        catch (error) {
            this.logger.error('Indexing failed:', error);
            return {
                success: false,
                message: `Indexing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
    /**
     * Get existing file hashes from database for incremental indexing
     */
    async getExistingFileHashes(projectId) {
        try {
            return await analysis_repository_consolidated_1.analysisRepository.getFileHashes(projectId);
        }
        catch (error) {
            this.logger.warn('Could not get existing file hashes:', error);
            return new Map();
        }
    }
    /**
     * Delete embeddings for specified files
     */
    async deleteFileEmbeddings(projectId, files) {
        if (files.length === 0)
            return;
        try {
            await analysis_repository_consolidated_1.analysisRepository.deleteEmbeddingsForFiles(projectId, files);
        }
        catch (error) {
            this.logger.warn('Could not delete file embeddings:', error);
        }
    }
    /**
     * Search for code using semantic similarity
     */
    async searchCode(query, projectId, options) {
        console.log(`🔍 Searching for: "${query}"`);
        try {
            // Get embeddings from database
            const embeddings = await analysis_repository_consolidated_1.analysisRepository.getEmbeddings(projectId, {
                limit: options.limit
            });
            if (embeddings.length === 0) {
                console.log('   No embeddings found - run "search --index" first');
                return {
                    success: false,
                    message: 'No embeddings found. Please run "search --index" first to index the codebase.'
                };
            }
            console.log(`🧠 Found ${embeddings.length} code segments to search`);
            // For MVP, do simple text-based search without actual vector similarity
            const queryLower = query.toLowerCase();
            const results = embeddings
                .map((embedding, index) => ({
                file_path: embedding.file_path,
                content_type: embedding.content_type,
                content_text: embedding.content_text,
                similarity_score: this.calculateTextSimilarity(queryLower, embedding.content_text?.toLowerCase() || ''),
                chunk_index: embedding.chunk_index
            }))
                .filter(result => result.similarity_score >= options.threshold)
                .sort((a, b) => b.similarity_score - a.similarity_score)
                .slice(0, options.limit);
            console.log(`\n🔍 Search Results (${results.length} found):`);
            if (results.length === 0) {
                console.log('   No similar code segments found');
                console.log('   Try lowering the similarity threshold or using different search terms');
            }
            else {
                results.forEach((result, index) => {
                    console.log(`\n📄 Result ${index + 1}:`);
                    console.log(`   File: ${result.file_path}`);
                    console.log(`   Type: ${result.content_type}`);
                    console.log(`   Similarity: ${(result.similarity_score * 100).toFixed(1)}%`);
                    if (options.verbose) {
                        console.log(`   Content Preview:`);
                        const preview = result.content_text.substring(0, 200);
                        console.log(`   ${preview}${result.content_text.length > 200 ? '...' : ''}`);
                    }
                });
            }
            console.log(`\n💡 Tips:`);
            console.log(`   • Use --verbose for more details`);
            console.log(`   • Use --threshold to adjust similarity filtering`);
            console.log(`   • Use search --index to index your codebase first`);
            return {
                success: true,
                message: `Found ${results.length} matches`,
                data: { query, results }
            };
        }
        catch (error) {
            this.logger.error('Search failed:', error);
            return {
                success: false,
                message: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
    /**
     * Calculate simple text-based similarity for MVP
     */
    calculateTextSimilarity(query, content) {
        if (!query || !content)
            return 0;
        const queryWords = query.split(/\s+/).filter(w => w.length > 2);
        const contentWords = content.split(/\s+/).map(w => w.toLowerCase());
        if (queryWords.length === 0)
            return 0;
        let matches = 0;
        for (const word of queryWords) {
            if (contentWords.some(cw => cw.includes(word) || word.includes(cw))) {
                matches++;
            }
        }
        return matches / queryWords.length;
    }
    /**
     * Get existing project ID from database
     */
    async generateProjectId(projectPath) {
        try {
            // Normalize the path for consistent lookup
            const normalizedPath = path_1.default.resolve(projectPath);
            this.logger.info(`Looking up project with path: ${normalizedPath}`);
            // Try to find existing project by path
            const projects = await analysis_repository_consolidated_1.analysisRepository.getProjects({ projectPath: normalizedPath });
            this.logger.info(`Found ${projects.length} projects matching path`);
            if (projects.length > 0) {
                this.logger.info(`Using project ID: ${projects[0].id}`);
                return projects[0].id;
            }
            // Also try without normalization in case paths were stored differently
            const projectsOrig = await analysis_repository_consolidated_1.analysisRepository.getProjects({ projectPath });
            if (projectsOrig.length > 0) {
                this.logger.info(`Found project with original path, using ID: ${projectsOrig[0].id}`);
                return projectsOrig[0].id;
            }
            // Get all projects to debug
            const allProjects = await analysis_repository_consolidated_1.analysisRepository.getProjects({});
            this.logger.info(`Total projects in database: ${allProjects.length}`);
            allProjects.forEach(p => {
                this.logger.info(`Project: ${p.project_name}, Path: ${p.project_path}, ID: ${p.id}`);
            });
            // Fallback: this should not happen if init was run properly
            this.logger.error(`No project found for path: ${projectPath} (normalized: ${normalizedPath})`);
            throw new Error(`Project not found for path: ${projectPath}. Please run "codemind setup" first.`);
        }
        catch (error) {
            this.logger.error('Could not retrieve project ID:', error);
            throw error;
        }
    }
}
exports.SearchCommandHandler = SearchCommandHandler;
//# sourceMappingURL=search-command-handler.js.map
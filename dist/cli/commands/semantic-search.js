"use strict";
/**
 * Semantic Search CLI Command
 *
 * Provides command-line interface for semantic code search
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
exports.createSemanticSearchCommand = createSemanticSearchCommand;
const commander_1 = require("commander");
const logger_1 = require("../../utils/logger");
const embedding_service_1 = require("../services/data/embedding/embedding-service");
const path_1 = __importDefault(require("path"));
const logger = new logger_1.Logger(logger_1.LogLevel.INFO, 'SemanticSearchCLI');
function createSemanticSearchCommand() {
    const searchCmd = new commander_1.Command('semantic-search');
    searchCmd
        .description('Perform semantic search across the codebase')
        .argument('[project-path]', 'Path to project (defaults to current directory)', process.cwd())
        .option('-q, --query <query>', 'Search query text')
        .option('-p, --project-id <id>', 'Project ID (will attempt to auto-detect if not provided)')
        .option('-t, --types <types>', 'Comma-separated content types (file, function, class, comment)')
        .option('--threshold <threshold>', 'Similarity threshold (0.0-1.0)', '0.7')
        .option('-l, --limit <limit>', 'Maximum number of results', '10')
        .option('--index', 'Index the codebase for semantic search', false)
        .option('-v, --verbose', 'Verbose output', false)
        .action(async (projectPath, options) => {
        try {
            if (options.verbose) {
                logger.setLevel('debug');
            }
            const resolvedProjectPath = path_1.default.resolve(projectPath);
            logger.info(`Semantic search for project at: ${resolvedProjectPath}`);
            // Auto-detect or validate project ID
            const projectId = await getProjectId(resolvedProjectPath, options.projectId);
            if (!projectId) {
                console.error('❌ Could not determine project ID. Use --project-id or ensure project is initialized.');
                process.exit(1);
            }
            logger.info(`Using project ID: ${projectId}`);
            // Initialize semantic search tool
            const searchFactory = require('../../core/factories/search-service-factory').SearchServiceFactory;
            const searchTool = searchFactory.getInstance().createSemanticSearchService();
            if (options.index) {
                // Index the codebase
                console.log('🔄 Indexing codebase for semantic search...');
                const analysisResult = await searchTool.analyze(resolvedProjectPath, projectId, {
                    skipEmbeddings: false // Always generate embeddings with Xenova
                });
                if (analysisResult.data && analysisResult.data.length > 0) {
                    // Save to database via API
                    const apiUrl = process.env.TOOL_API_URL || 'http://localhost:3003';
                    const response = await fetch(`${apiUrl}/api/tools/${projectId}/semantic-search`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(analysisResult.data)
                    });
                    if (response.ok) {
                        const result = await response.json();
                        console.log(`✅ Indexed ${result.inserted}/${result.total} code segments`);
                        if (result.errors > 0) {
                            console.log(`⚠️  ${result.errors} segments failed to index`);
                        }
                    }
                    else {
                        console.error('❌ Failed to save embeddings to database:', await response.text());
                    }
                }
                console.log('📊 Analysis Summary:');
                console.log(`   Total Segments: ${analysisResult.analysis.totalSegments}`);
                console.log(`   Embeddings Generated: ${analysisResult.analysis.embeddingsGenerated}`);
                console.log(`   Languages: ${Object.keys(analysisResult.analysis.languages).join(', ')}`);
                console.log(`   Content Types: ${Object.keys(analysisResult.analysis.contentTypes).join(', ')}`);
                if (analysisResult.recommendations && analysisResult.recommendations.length > 0) {
                    console.log('\n💡 Recommendations:');
                    analysisResult.recommendations.forEach((rec) => {
                        console.log(`   • ${rec}`);
                    });
                }
            }
            else if (options.query) {
                // Perform search using Xenova embeddings
                console.log(`🔍 Searching for: "${options.query}"`);
                try {
                    // Initialize embedding service with Xenova transformers
                    const embeddingService = new embedding_service_1.EmbeddingService({
                        provider: 'xenova',
                        model: 'Xenova/all-MiniLM-L6-v2',
                        chunkSize: 8000,
                        maxTokens: 8191
                    });
                    // Generate embedding for query using Xenova
                    const queryEmbedding = await embeddingService.generateEmbedding(options.query, 'query.txt');
                    // Search using API
                    const apiUrl = process.env.TOOL_API_URL || 'http://localhost:3003';
                    const searchResponse = await fetch(`${apiUrl}/api/tools/${projectId}/semantic-search/search`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            query: options.query,
                            queryEmbedding,
                            contentTypes: options.types ? options.types.split(',').map((t) => t.trim()) : undefined,
                            threshold: parseFloat(options.threshold),
                            limit: parseInt(options.limit)
                        })
                    });
                    if (searchResponse.ok) {
                        const searchResults = await searchResponse.json();
                        displaySearchResults(searchResults, options.verbose);
                    }
                    else {
                        console.error('❌ Search failed:', await searchResponse.text());
                    }
                }
                catch (error) {
                    console.error('❌ Search failed:', error instanceof Error ? error.message : error);
                    process.exit(1);
                }
            }
            else {
                console.error('❌ Please specify either --index to index the codebase or --query to search');
                console.log('Examples:');
                console.log('  semantic-search --index                          # Index codebase');
                console.log('  semantic-search --query "authentication logic"  # Search for similar code');
                process.exit(1);
            }
        }
        catch (error) {
            logger.error(`Semantic search failed: ${error}`);
            console.error(`❌ Semantic search failed: ${error instanceof Error ? error.message : error}`);
            process.exit(1);
        }
    });
    return searchCmd;
}
/**
 * Attempt to get project ID from various sources
 */
async function getProjectId(projectPath, providedId) {
    if (providedId) {
        return providedId;
    }
    // Try to get from database by path
    try {
        // For now, return a mock project ID
        const crypto = await Promise.resolve().then(() => __importStar(require('crypto')));
        const pathHash = crypto.createHash('md5').update(projectPath).digest('hex');
        return pathHash.substring(0, 8);
    }
    catch (error) {
        logger.warn(`Could not generate project ID: ${error}`);
    }
    return null;
}
/**
 * Display search results in a formatted way
 */
function displaySearchResults(searchResults, verbose = false) {
    console.log(`\n🔍 Search Results (${searchResults.count} found):`);
    if (searchResults.results.length === 0) {
        console.log('   No similar code segments found');
        console.log('   Try lowering the similarity threshold or indexing more code');
        return;
    }
    searchResults.results.forEach((result, index) => {
        console.log(`\n📄 Result ${index + 1}:`);
        console.log(`   File: ${result.file_path}`);
        console.log(`   Type: ${result.content_type}`);
        console.log(`   Similarity: ${(result.similarity_score * 100).toFixed(1)}%`);
        if (verbose) {
            console.log(`   Content Preview:`);
            const preview = result.content_text.substring(0, 200);
            console.log(`   ${preview}${result.content_text.length > 200 ? '...' : ''}`);
            if (result.metadata) {
                console.log(`   Metadata:`, JSON.stringify(result.metadata, null, 2));
            }
        }
    });
    console.log(`\n💡 Tips:`);
    console.log(`   • Use --verbose for more details`);
    console.log(`   • Use --threshold to adjust similarity filtering`);
    console.log(`   • Use --types to filter by content type (file,function,class,comment)`);
}
//# sourceMappingURL=semantic-search.js.map
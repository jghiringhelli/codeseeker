"use strict";
/**
 * Semantic Search Orchestrator Service
 * Single Responsibility: Coordinate semantic search operations using PostgreSQL pgvector
 *
 * This service queries the semantic_search_embeddings table in PostgreSQL
 * to find code files relevant to the user's query using vector similarity.
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
exports.SemanticSearchOrchestrator = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const database_config_1 = require("../../../config/database-config");
const logger_1 = require("../../../utils/logger");
class SemanticSearchOrchestrator {
    logger = logger_1.Logger.getInstance();
    dbConnections;
    projectId;
    // Fallback to file-based search when DB is unavailable
    dbAvailable = true;
    constructor(dbConnections) {
        this.dbConnections = dbConnections || new database_config_1.DatabaseConnections();
    }
    /**
     * Set project ID for scoped searches
     */
    setProjectId(projectId) {
        this.projectId = projectId;
    }
    /**
     * Resolve project ID from database by project path
     */
    async resolveProjectId(projectPath) {
        try {
            const postgres = await this.dbConnections.getPostgresConnection();
            // Normalize path for comparison (handle Windows/Unix differences)
            const normalizedPath = projectPath.replace(/\//g, '\\');
            const unixPath = projectPath.replace(/\\/g, '/');
            const result = await postgres.query(`
        SELECT id FROM projects
        WHERE project_path = $1
           OR project_path = $2
           OR project_path ILIKE $3
        LIMIT 1
      `, [normalizedPath, unixPath, `%${path.basename(projectPath)}`]);
            if (result.rows.length > 0) {
                return result.rows[0].id;
            }
        }
        catch (error) {
            this.logger.debug(`Could not resolve project ID: ${error instanceof Error ? error.message : error}`);
        }
        return undefined;
    }
    /**
     * Perform semantic search using PostgreSQL pgvector
     * Falls back to file-based search if database is unavailable
     */
    async performSemanticSearch(query, projectPath) {
        try {
            // Resolve project ID from database if not already set
            if (!this.projectId || this.projectId === 'default') {
                const resolvedId = await this.resolveProjectId(projectPath);
                if (resolvedId) {
                    this.projectId = resolvedId;
                    this.logger.debug(`Resolved project ID: ${resolvedId}`);
                }
            }
            // Try database search first
            if (this.dbAvailable) {
                const dbResults = await this.searchDatabase(query, projectPath);
                if (dbResults.length > 0) {
                    return dbResults;
                }
            }
            // Fallback to file-based search
            this.logger.debug('Using file-based search fallback');
            return await this.searchFileSystem(query, projectPath);
        }
        catch (error) {
            this.logger.warn(`Semantic search error: ${error instanceof Error ? error.message : error}`);
            // Mark DB as unavailable for this session to avoid repeated failures
            this.dbAvailable = false;
            return await this.searchFileSystem(query, projectPath);
        }
    }
    /**
     * Search using PostgreSQL - True Hybrid Search
     *
     * Search Strategy:
     * 1. Run BOTH Full-Text Search AND ILIKE pattern matching in parallel
     * 2. Merge results with weighted average scoring
     * 3. FTS captures semantic/linguistic similarity, ILIKE captures exact patterns
     *
     * Weight Configuration:
     * - FTS weight: 0.6 (semantic understanding, stemming, language-aware)
     * - ILIKE weight: 0.4 (exact matches, identifier patterns)
     */
    async searchDatabase(query, projectPath) {
        const FTS_WEIGHT = 0.6;
        const ILIKE_WEIGHT = 0.4;
        try {
            const postgres = await this.dbConnections.getPostgresConnection();
            // First, check if we have embeddings for this project
            const projectCheck = await postgres.query(`
        SELECT COUNT(*) as count
        FROM semantic_search_embeddings
        WHERE project_id = $1 OR file_path LIKE $2
      `, [this.projectId || 'default', `${projectPath}%`]);
            const embeddingCount = parseInt(projectCheck.rows[0]?.count || '0');
            if (embeddingCount === 0) {
                this.logger.debug('No embeddings found in database, falling back to file search');
                return [];
            }
            // Run both search methods in parallel
            const hasFtsColumn = await this.checkFtsColumnExists(postgres);
            const [ftsResults, ilikeResults] = await Promise.all([
                hasFtsColumn
                    ? this.performFullTextSearch(postgres, query, projectPath)
                    : Promise.resolve({ rows: [] }),
                this.performIlikeFallbackSearch(postgres, query, projectPath)
            ]);
            this.logger.debug(`Hybrid search: FTS found ${ftsResults.rows.length}, ILIKE found ${ilikeResults.rows.length}`);
            // Merge results with weighted scoring
            const mergedResults = this.mergeSearchResults(ftsResults.rows, ilikeResults.rows, FTS_WEIGHT, ILIKE_WEIGHT, projectPath);
            // Sort by combined score and limit
            mergedResults.sort((a, b) => b.combinedScore - a.combinedScore);
            const topResults = mergedResults.slice(0, 15);
            this.logger.debug(`Hybrid search merged ${mergedResults.length} results, returning top ${topResults.length}`);
            return topResults;
        }
        catch (error) {
            this.logger.error('Database search failed:', error);
            throw error;
        }
    }
    /**
     * Check if the content_tsvector column exists for full-text search
     */
    async checkFtsColumnExists(postgres) {
        try {
            const result = await postgres.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'semantic_search_embeddings'
        AND column_name = 'content_tsvector'
      `);
            return result.rows.length > 0;
        }
        catch {
            return false;
        }
    }
    /**
     * Check if table has a specific column
     */
    async hasColumn(postgres, columnName) {
        try {
            const result = await postgres.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'semantic_search_embeddings'
        AND column_name = $1
      `, [columnName]);
            return result.rows.length > 0;
        }
        catch {
            return false;
        }
    }
    /**
     * Perform Full-Text Search using PostgreSQL tsvector/tsquery
     * Uses the FULL query text for semantic matching
     */
    async performFullTextSearch(postgres, query, projectPath) {
        // Check if line columns exist (for backward compatibility with older schemas)
        const hasLineColumns = await this.hasColumn(postgres, 'chunk_start_line');
        // Build query dynamically based on available columns
        const lineColumns = hasLineColumns
            ? 'chunk_start_line, chunk_end_line,'
            : '(COALESCE(chunk_index, 0) * 20 + 1) as chunk_start_line, (COALESCE(chunk_index, 0) * 20 + 20) as chunk_end_line,';
        // Use websearch_to_tsquery for natural language query parsing
        // This handles phrases, OR, NOT, and other natural language patterns
        const searchQuery = `
      SELECT
        file_path,
        content_text,
        chunk_index,
        metadata,
        ${lineColumns}
        -- Full-text search rank (normalized)
        ts_rank_cd(content_tsvector, websearch_to_tsquery('english', $1), 32) as similarity
      FROM semantic_search_embeddings
      WHERE (project_id = $2 OR file_path LIKE $3)
        AND content_tsvector @@ websearch_to_tsquery('english', $1)
      ORDER BY similarity DESC
      LIMIT 15
    `;
        return await postgres.query(searchQuery, [
            query, // Full query text - let PostgreSQL handle parsing
            this.projectId || 'default',
            `${projectPath}%`
        ]);
    }
    /**
     * Fallback to ILIKE pattern matching when FTS is unavailable or returns no results
     */
    async performIlikeFallbackSearch(postgres, query, projectPath) {
        const searchTerms = this.extractSearchTerms(query);
        // Clean the full query for ILIKE search
        const cleanedQuery = query.toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        // Use full phrase as primary search term
        const fullPhrasePattern = `%${cleanedQuery}%`;
        // Use first keyword (if any) as secondary
        const primaryTerm = searchTerms.length > 0 ? `%${searchTerms[0]}%` : fullPhrasePattern;
        // Use all keywords joined for pattern matching
        const anyTermPattern = searchTerms.length > 0 ? `%${searchTerms.join('%')}%` : fullPhrasePattern;
        // Check if line columns exist (for backward compatibility with older schemas)
        const hasLineColumns = await this.hasColumn(postgres, 'chunk_start_line');
        // Build query dynamically based on available columns
        const lineColumns = hasLineColumns
            ? 'chunk_start_line, chunk_end_line,'
            : '(COALESCE(chunk_index, 0) * 20 + 1) as chunk_start_line, (COALESCE(chunk_index, 0) * 20 + 20) as chunk_end_line,';
        const searchQuery = `
      SELECT
        file_path,
        content_text,
        chunk_index,
        metadata,
        ${lineColumns}
        -- Text-based relevance score combining phrase and keyword matching
        (
          CASE
            WHEN content_text ILIKE $1 THEN 0.95  -- Full phrase match (highest)
            WHEN content_text ILIKE $2 THEN 0.85  -- Primary keyword match
            WHEN content_text ILIKE $3 THEN 0.75  -- Any keyword pattern
            WHEN file_path ILIKE $2 THEN 0.65     -- Keyword in file path
            WHEN file_path ILIKE $1 THEN 0.60    -- Phrase in file path
            ELSE 0.4
          END
        ) as similarity
      FROM semantic_search_embeddings
      WHERE (project_id = $4 OR file_path LIKE $5)
        AND (
          content_text ILIKE $1      -- Full phrase
          OR content_text ILIKE $3   -- Any keyword pattern
          OR file_path ILIKE $2      -- Primary keyword in path
          OR file_path ILIKE $1      -- Full phrase in path
          OR metadata::text ILIKE $2
        )
      ORDER BY similarity DESC
      LIMIT 15
    `;
        return await postgres.query(searchQuery, [
            fullPhrasePattern, // $1 - full query phrase
            primaryTerm, // $2 - primary keyword
            anyTermPattern, // $3 - all keywords pattern
            this.projectId || 'default', // $4 - project ID
            `${projectPath}%` // $5 - project path pattern
        ]);
    }
    /**
     * Merge results from FTS and ILIKE searches with weighted scoring
     *
     * For files found by both methods:
     * - combinedScore = (ftsScore * ftsWeight) + (ilikeScore * ilikeWeight)
     *
     * For files found by only one method:
     * - Apply a penalty (0.8x) since we're less confident
     * - combinedScore = score * weight * 0.8
     */
    mergeSearchResults(ftsRows, ilikeRows, ftsWeight, ilikeWeight, projectPath) {
        const excludePaths = ['archive', 'backup', 'old', 'deprecated', 'node_modules', 'dist'];
        // Build maps keyed by file path for efficient lookup
        const ftsMap = new Map();
        const ilikeMap = new Map();
        for (const row of ftsRows) {
            const relativePath = path.isAbsolute(row.file_path)
                ? path.relative(projectPath, row.file_path)
                : row.file_path;
            // Skip excluded directories
            const lowerPath = relativePath.toLowerCase();
            if (excludePaths.some(ex => lowerPath.startsWith(ex + '/') || lowerPath.startsWith(ex + '\\'))) {
                continue;
            }
            // Keep highest score per file
            const existing = ftsMap.get(relativePath);
            if (!existing || (parseFloat(row.similarity) || 0) > (parseFloat(existing.similarity) || 0)) {
                ftsMap.set(relativePath, { ...row, relativePath });
            }
        }
        for (const row of ilikeRows) {
            const relativePath = path.isAbsolute(row.file_path)
                ? path.relative(projectPath, row.file_path)
                : row.file_path;
            // Skip excluded directories
            const lowerPath = relativePath.toLowerCase();
            if (excludePaths.some(ex => lowerPath.startsWith(ex + '/') || lowerPath.startsWith(ex + '\\'))) {
                continue;
            }
            // Keep highest score per file
            const existing = ilikeMap.get(relativePath);
            if (!existing || (parseFloat(row.similarity) || 0) > (parseFloat(existing.similarity) || 0)) {
                ilikeMap.set(relativePath, { ...row, relativePath });
            }
        }
        // Get all unique file paths
        const allFiles = new Set([...ftsMap.keys(), ...ilikeMap.keys()]);
        const results = [];
        for (const filePath of allFiles) {
            const ftsResult = ftsMap.get(filePath);
            const ilikeResult = ilikeMap.get(filePath);
            let combinedScore;
            let ftsScore = ftsResult ? parseFloat(ftsResult.similarity) || 0 : 0;
            let ilikeScore = ilikeResult ? parseFloat(ilikeResult.similarity) || 0 : 0;
            // Use the row with more data (prefer FTS if both exist)
            const primaryRow = ftsResult || ilikeResult;
            if (ftsResult && ilikeResult) {
                // Both methods found this file - weighted average
                combinedScore = (ftsScore * ftsWeight) + (ilikeScore * ilikeWeight);
            }
            else if (ftsResult) {
                // Only FTS found it - apply penalty for single-source
                combinedScore = ftsScore * ftsWeight * 1.2; // Slight boost since FTS is more semantic
            }
            else {
                // Only ILIKE found it - apply penalty for single-source
                combinedScore = ilikeScore * ilikeWeight * 1.2;
            }
            results.push({
                file: filePath,
                type: this.determineFileType(primaryRow.file_path),
                similarity: combinedScore, // Use combined score as similarity for compatibility
                content: this.formatContent(primaryRow.content_text, primaryRow.metadata),
                lineStart: primaryRow.chunk_start_line || (primaryRow.chunk_index || 0) * 20 + 1,
                lineEnd: primaryRow.chunk_end_line || (primaryRow.chunk_index || 0) * 20 + 20,
                combinedScore,
                // Include individual scores for debugging/transparency
                // ftsScore,
                // ilikeScore
            });
        }
        return results;
    }
    /**
     * Fallback file-based search when database is unavailable
     */
    async searchFileSystem(query, projectPath) {
        const results = [];
        const lowerQuery = query.toLowerCase();
        const searchTerms = this.extractSearchTerms(query);
        // Detect if this is a general "understand the project" query
        const isGeneralProjectQuery = this.isGeneralProjectQuery(lowerQuery);
        try {
            const files = await this.discoverFiles(projectPath);
            // For general project queries, also include key entry point files
            if (isGeneralProjectQuery) {
                const entryPointResults = await this.getEntryPointFiles(projectPath, files);
                results.push(...entryPointResults);
            }
            for (const filePath of files) {
                // Skip files already added as entry points
                const relativePath = path.relative(projectPath, filePath);
                if (results.some(r => r.file === relativePath))
                    continue;
                const relevance = await this.calculateFileRelevance(filePath, lowerQuery, searchTerms);
                if (relevance > 0.2) {
                    const content = await this.getFilePreview(filePath);
                    results.push({
                        file: relativePath,
                        type: this.determineFileType(filePath),
                        similarity: relevance,
                        content: content,
                        lineStart: 1,
                        lineEnd: 50
                    });
                }
            }
            // Deduplicate by file path (keep highest similarity)
            const deduped = this.deduplicateResults(results);
            // Sort by relevance and limit results
            deduped.sort((a, b) => b.similarity - a.similarity);
            return deduped.slice(0, 10);
        }
        catch (error) {
            this.logger.warn(`File system search failed: ${error}`);
            return [];
        }
    }
    /**
     * Deduplicate results by file path, keeping highest similarity
     */
    deduplicateResults(results) {
        const fileMap = new Map();
        for (const result of results) {
            const existing = fileMap.get(result.file);
            if (!existing || result.similarity > existing.similarity) {
                fileMap.set(result.file, result);
            }
        }
        return Array.from(fileMap.values());
    }
    /**
     * Detect if query is asking about the project in general
     */
    isGeneralProjectQuery(lowerQuery) {
        const generalPatterns = [
            /what\s+(does|is)\s+(this\s+)?project/,
            /about\s+(this\s+)?project/,
            /explain\s+(this\s+)?project/,
            /describe\s+(this\s+)?project/,
            /overview/,
            /how\s+does\s+(this\s+)?(project|codebase|code)\s+work/,
            /understand\s+(this\s+)?(project|codebase)/,
            /what\s+(is|are)\s+(this|the)/,
            /project\s+structure/,
            /architecture/
        ];
        return generalPatterns.some(pattern => pattern.test(lowerQuery));
    }
    /**
     * Get key entry point files for understanding the project
     */
    async getEntryPointFiles(projectPath, allFiles) {
        const results = [];
        // Priority entry point patterns (higher = more important)
        const entryPointPatterns = [
            { pattern: /(?:^|[/\\])(?:index|main|app|server)\.(ts|js|tsx|jsx)$/i, priority: 0.95 },
            { pattern: /(?:^|[/\\])(?:cli|bin)[/\\][^/\\]+\.(ts|js)$/i, priority: 0.90 },
            { pattern: /(?:^|[/\\])src[/\\](?:index|main|app)\.(ts|js|tsx|jsx)$/i, priority: 0.92 },
            { pattern: /(?:^|[/\\])package\.json$/i, priority: 0.85 },
            { pattern: /(?:^|[/\\])README\.md$/i, priority: 0.80 },
            { pattern: /(?:^|[/\\])(?:routes|router|controllers?)[/\\]index\.(ts|js)$/i, priority: 0.75 },
            { pattern: /(?:^|[/\\])(?:services?|api)[/\\]index\.(ts|js)$/i, priority: 0.70 },
        ];
        for (const filePath of allFiles) {
            const relativePath = path.relative(projectPath, filePath);
            for (const { pattern, priority } of entryPointPatterns) {
                if (pattern.test(relativePath)) {
                    try {
                        const content = await this.getFilePreview(filePath);
                        results.push({
                            file: relativePath,
                            type: this.determineFileType(filePath),
                            similarity: priority,
                            content,
                            lineStart: 1,
                            lineEnd: 50
                        });
                    }
                    catch {
                        // Skip files that can't be read
                    }
                    break; // Only match first pattern per file
                }
            }
        }
        // Also check for package.json and README.md in root
        const rootFiles = ['package.json', 'README.md', 'CLAUDE.md', 'CODEMIND.md'];
        for (const rootFile of rootFiles) {
            const fullPath = path.join(projectPath, rootFile);
            const relativePath = rootFile;
            // Skip if already added
            if (results.some(r => r.file === relativePath))
                continue;
            try {
                const content = await this.getFilePreview(fullPath);
                results.push({
                    file: relativePath,
                    type: rootFile.endsWith('.json') ? 'configuration' : 'documentation',
                    similarity: rootFile === 'package.json' ? 0.85 : 0.80,
                    content,
                    lineStart: 1,
                    lineEnd: 50
                });
            }
            catch {
                // File doesn't exist, skip
            }
        }
        return results;
    }
    /**
     * Extract meaningful search terms from query
     */
    extractSearchTerms(query) {
        const stopWords = new Set(['a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been',
            'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
            'may', 'might', 'must', 'shall', 'can', 'need', 'to', 'of', 'in', 'for', 'on', 'with',
            'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above',
            'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there',
            'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some',
            'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
            'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while', 'this', 'that',
            'these', 'those', 'what', 'which', 'who', 'whom', 'add', 'create', 'make', 'build',
            'implement', 'write', 'code', 'file', 'files', 'want', 'need', 'please', 'help']);
        return query
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2 && !stopWords.has(word));
    }
    /**
     * Calculate file relevance based on query terms
     */
    async calculateFileRelevance(filePath, lowerQuery, searchTerms) {
        let score = 0;
        const fileName = path.basename(filePath, path.extname(filePath)).toLowerCase();
        const dirPath = path.dirname(filePath).toLowerCase();
        // Check filename matches
        for (const term of searchTerms) {
            if (fileName.includes(term)) {
                score += 0.4;
            }
            if (dirPath.includes(term)) {
                score += 0.2;
            }
        }
        // Check file content for matches (lightweight check)
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const lowerContent = content.toLowerCase();
            for (const term of searchTerms) {
                if (lowerContent.includes(term)) {
                    score += 0.3;
                }
            }
            // Bonus for class/function definitions matching query
            if (lowerQuery.includes('class') && /class\s+\w+/.test(content)) {
                score += 0.2;
            }
            if (lowerQuery.includes('function') && /function\s+\w+/.test(content)) {
                score += 0.2;
            }
        }
        catch {
            // Ignore file read errors
        }
        return Math.min(score, 1.0);
    }
    /**
     * Discover code files in project
     */
    async discoverFiles(projectPath) {
        const files = [];
        const excludeDirs = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.vscode', '.idea', 'archive', 'backup', 'old', 'deprecated']);
        const includeExts = new Set(['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.go', '.rs', '.cpp', '.c', '.h']);
        const scanDir = async (dir) => {
            try {
                const entries = await fs.readdir(dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.name.startsWith('.') && entry.name !== '.')
                        continue;
                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        if (!excludeDirs.has(entry.name)) {
                            await scanDir(fullPath);
                        }
                    }
                    else if (entry.isFile()) {
                        const ext = path.extname(entry.name);
                        if (includeExts.has(ext)) {
                            files.push(fullPath);
                        }
                    }
                }
            }
            catch {
                // Ignore directory read errors
            }
        };
        await scanDir(projectPath);
        return files;
    }
    /**
     * Get preview of file content
     */
    async getFilePreview(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const lines = content.split('\n');
            const fileName = path.basename(filePath);
            const fileType = this.determineFileType(filePath);
            // Extract key elements
            const classes = content.match(/class\s+(\w+)/g) || [];
            const functions = content.match(/(?:function\s+(\w+)|(\w+)\s*=\s*(?:async\s*)?\()/g) || [];
            const exports = content.match(/export\s+(?:default\s+)?(?:class|function|const|interface)\s+(\w+)/g) || [];
            let preview = `File: ${fileName} (${fileType})`;
            if (classes.length > 0) {
                preview += `\nClasses: ${classes.slice(0, 3).join(', ')}`;
            }
            if (exports.length > 0) {
                preview += `\nExports: ${exports.length} items`;
            }
            // Add first meaningful lines
            const meaningfulLines = lines
                .slice(0, 20)
                .filter(line => line.trim() && !line.trim().startsWith('//') && !line.trim().startsWith('*'))
                .slice(0, 5);
            if (meaningfulLines.length > 0) {
                preview += `\n\nPreview:\n${meaningfulLines.join('\n')}`;
            }
            return preview;
        }
        catch {
            return `File: ${path.basename(filePath)}`;
        }
    }
    /**
     * Format content from database with metadata
     */
    formatContent(content, metadata) {
        let formatted = content;
        if (metadata) {
            try {
                const meta = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
                if (meta.classes) {
                    formatted = `Classes: ${meta.classes.join(', ')}\n\n${formatted}`;
                }
                if (meta.functions) {
                    formatted = `Functions: ${meta.functions.slice(0, 5).join(', ')}\n\n${formatted}`;
                }
            }
            catch {
                // Ignore metadata parse errors
            }
        }
        // Truncate if too long
        if (formatted.length > 500) {
            formatted = formatted.substring(0, 500) + '...';
        }
        return formatted;
    }
    /**
     * Determine file type based on path and name
     */
    determineFileType(filePath) {
        const fileName = path.basename(filePath).toLowerCase();
        const dirPath = path.dirname(filePath).toLowerCase();
        // Specific patterns
        if (fileName.includes('controller'))
            return 'controller';
        if (fileName.includes('service'))
            return 'service';
        if (fileName.includes('manager'))
            return 'manager';
        if (fileName.includes('handler'))
            return 'handler';
        if (fileName.includes('middleware'))
            return 'middleware';
        if (fileName.includes('auth') || fileName.includes('login'))
            return 'authentication';
        if (fileName.includes('api') || fileName.includes('route'))
            return 'api';
        if (fileName.includes('model') || fileName.includes('entity'))
            return 'model';
        if (fileName.includes('test') || fileName.includes('spec'))
            return 'test';
        if (fileName.includes('config'))
            return 'configuration';
        if (fileName.includes('util') || fileName.includes('helper'))
            return 'utility';
        if (fileName.includes('interface') || fileName.includes('types'))
            return 'interface';
        if (fileName.includes('repository') || fileName.includes('dao'))
            return 'repository';
        // Directory-based detection
        if (dirPath.includes('controller'))
            return 'controller';
        if (dirPath.includes('service'))
            return 'service';
        if (dirPath.includes('auth'))
            return 'authentication';
        if (dirPath.includes('api') || dirPath.includes('route'))
            return 'api';
        if (dirPath.includes('model') || dirPath.includes('entity'))
            return 'model';
        if (dirPath.includes('test'))
            return 'test';
        if (dirPath.includes('config'))
            return 'configuration';
        // Extension-based fallback
        const ext = path.extname(filePath);
        if (['.ts', '.js'].includes(ext))
            return 'module';
        if (['.json', '.yaml', '.yml'].includes(ext))
            return 'configuration';
        if (['.md', '.txt', '.rst'].includes(ext))
            return 'documentation';
        return 'module';
    }
}
exports.SemanticSearchOrchestrator = SemanticSearchOrchestrator;
//# sourceMappingURL=semantic-search-orchestrator.js.map
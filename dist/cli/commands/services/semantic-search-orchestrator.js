"use strict";
/**
 * Semantic Search Orchestrator Service
 * Single Responsibility: Coordinate semantic search operations
 * Uses semantic search service and enhances results with file analysis
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
class SemanticSearchOrchestrator {
    // Cache for file discovery and content to avoid repeated file system operations
    static fileCache = new Map();
    static contentCache = new Map();
    static CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    static cacheTimestamp = new Map();
    // Pre-compiled patterns for better performance
    static RELEVANCE_PATTERNS = {
        auth: /(auth|login|session|jwt|token)/i,
        api: /(api|route|endpoint|controller)/i,
        database: /(db|database|model|schema|migration)/i,
        test: /(test|spec|mock|fixture)/i,
        component: /(component|view|ui|interface)/i,
        service: /(service|manager|handler|processor)/i,
        config: /(config|setting|env|option)/i,
        util: /(util|helper|tool|common)/i
    };
    static FILE_EXTENSIONS = new Set(['.ts', '.js', '.json']);
    static EXCLUDED_DIRS = new Set(['.git', 'node_modules', 'dist', '.vscode', 'coverage']);
    /**
     * Perform semantic search and enhance with file analysis
     */
    async performSemanticSearch(query, projectPath) {
        try {
            const results = [];
            const lowerQuery = query.toLowerCase();
            // Use cached file discovery to avoid repeated file system operations
            const files = await this.discoverFilesCached(projectPath);
            // Parallel processing for better performance
            const relevancePromises = files.map(async (filePath) => {
                const relevance = this.calculateFileRelevanceOptimized(filePath, lowerQuery);
                if (relevance > 0.3) { // Lowered threshold for more results
                    const fileType = this.determineFileType(filePath);
                    const content = await this.getFilePreviewCached(filePath);
                    return {
                        file: path.relative(projectPath, filePath),
                        type: fileType,
                        similarity: relevance,
                        content: content,
                        lineStart: 1,
                        lineEnd: Math.min(50, content.split('\n').length)
                    };
                }
                return null;
            });
            // Wait for all relevance calculations
            const allResults = await Promise.all(relevancePromises);
            results.push(...allResults.filter(result => result !== null));
            // Sort by relevance and limit results
            results.sort((a, b) => b.similarity - a.similarity);
            return results.slice(0, 10);
        }
        catch (error) {
            // Log error and return empty results instead of throwing
            console.warn(`Semantic search failed: ${error instanceof Error ? error.message : error}`);
            return [];
        }
    }
    /**
     * Cached file discovery with TTL
     */
    async discoverFilesCached(projectPath) {
        const now = Date.now();
        const cacheKey = projectPath;
        // Check if cache is still valid
        const cacheTime = SemanticSearchOrchestrator.cacheTimestamp.get(cacheKey);
        if (cacheTime && (now - cacheTime < SemanticSearchOrchestrator.CACHE_TTL)) {
            const cached = SemanticSearchOrchestrator.fileCache.get(cacheKey);
            if (cached) {
                return cached;
            }
        }
        // Cache miss or expired, discover files
        const files = await this.discoverFiles(projectPath);
        SemanticSearchOrchestrator.fileCache.set(cacheKey, files);
        SemanticSearchOrchestrator.cacheTimestamp.set(cacheKey, now);
        return files;
    }
    /**
     * Cached file preview with memory management
     */
    async getFilePreviewCached(filePath) {
        if (SemanticSearchOrchestrator.contentCache.has(filePath)) {
            return SemanticSearchOrchestrator.contentCache.get(filePath);
        }
        const content = await this.getFilePreview(filePath);
        // Memory management: limit cache size
        if (SemanticSearchOrchestrator.contentCache.size > 100) {
            // Remove oldest entries
            const entries = Array.from(SemanticSearchOrchestrator.contentCache.entries());
            const toRemove = entries.slice(0, 20); // Remove 20 oldest
            toRemove.forEach(([key]) => SemanticSearchOrchestrator.contentCache.delete(key));
        }
        SemanticSearchOrchestrator.contentCache.set(filePath, content);
        return content;
    }
    /**
     * Optimized file relevance calculation using pre-compiled patterns
     */
    calculateFileRelevanceOptimized(filePath, lowerQuery) {
        let score = 0;
        const fileName = path.basename(filePath, path.extname(filePath)).toLowerCase();
        const dirPath = path.dirname(filePath).toLowerCase();
        // Use pre-compiled patterns for better performance
        for (const [category, pattern] of Object.entries(SemanticSearchOrchestrator.RELEVANCE_PATTERNS)) {
            if (pattern.test(lowerQuery)) {
                // File name scoring
                if (pattern.test(fileName)) {
                    score += 0.8;
                }
                // Directory path scoring
                if (pattern.test(dirPath)) {
                    score += 0.5;
                }
            }
        }
        // Direct name matches (highest priority)
        if (fileName.includes(lowerQuery.split(' ')[0])) {
            score += 1.0;
        }
        return Math.min(score, 1.0);
    }
    /**
     * Calculate file relevance to the query
     */
    calculateFileRelevance(filePath, lowerQuery) {
        let score = 0;
        const fileName = path.basename(filePath, path.extname(filePath)).toLowerCase();
        const dirPath = path.dirname(filePath).toLowerCase();
        // File name matches
        if (lowerQuery.includes('auth') && (fileName.includes('auth') || fileName.includes('login'))) {
            score += 0.9;
        }
        if (lowerQuery.includes('api') && (fileName.includes('api') || fileName.includes('route'))) {
            score += 0.9;
        }
        if (lowerQuery.includes('database') && (fileName.includes('db') || fileName.includes('model'))) {
            score += 0.9;
        }
        if (lowerQuery.includes('test') && fileName.includes('test')) {
            score += 0.9;
        }
        // Directory structure matches
        if (lowerQuery.includes('auth') && dirPath.includes('auth'))
            score += 0.8;
        if (lowerQuery.includes('api') && (dirPath.includes('api') || dirPath.includes('route')))
            score += 0.8;
        if (lowerQuery.includes('test') && dirPath.includes('test'))
            score += 0.8;
        // General relevance patterns
        if (lowerQuery.includes('service') && fileName.includes('service'))
            score += 0.7;
        if (lowerQuery.includes('manager') && fileName.includes('manager'))
            score += 0.7;
        if (lowerQuery.includes('controller') && fileName.includes('controller'))
            score += 0.7;
        return Math.min(score, 1.0);
    }
    /**
     * Determine file type based on path and content
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
        // File extension fallback
        const ext = path.extname(filePath);
        if (['.ts', '.js'].includes(ext))
            return 'module';
        if (['.json'].includes(ext))
            return 'configuration';
        if (['.md', '.txt'].includes(ext))
            return 'documentation';
        return 'module';
    }
    /**
     * Get a preview of file content
     */
    async getFilePreview(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const lines = content.split('\n');
            return `File: ${path.basename(filePath)} - ${this.determineFileType(filePath)}`;
        }
        catch {
            return `File: ${path.basename(filePath)}`;
        }
    }
    /**
     * Discover relevant files in the project
     */
    async discoverFiles(projectPath) {
        const files = [];
        try {
            const entries = await fs.readdir(projectPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(projectPath, entry.name);
                // Skip hidden directories and node_modules
                if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') {
                    continue;
                }
                if (entry.isDirectory()) {
                    const subFiles = await this.discoverFiles(fullPath);
                    files.push(...subFiles);
                }
                else if (entry.isFile()) {
                    const ext = path.extname(entry.name);
                    if (['.ts', '.js', '.json'].includes(ext)) {
                        files.push(fullPath);
                    }
                }
            }
        }
        catch (error) {
            console.warn(`Failed to discover files in ${projectPath}:`, error);
        }
        return files;
    }
}
exports.SemanticSearchOrchestrator = SemanticSearchOrchestrator;
//# sourceMappingURL=semantic-search-orchestrator.js.map
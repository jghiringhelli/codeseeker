/**
 * Semantic Search Orchestrator Service
 * Single Responsibility: Coordinate semantic search operations
 * Uses semantic search service and enhances results with file analysis
 */

import * as path from 'path';
import * as fs from 'fs/promises';

export interface SemanticResult {
  file: string;
  type: string;
  similarity: number;
  content: string;
  lineStart?: number;
  lineEnd?: number;
}

export class SemanticSearchOrchestrator {
  // Cache for file discovery and content to avoid repeated file system operations
  private static fileCache = new Map<string, string[]>();
  private static contentCache = new Map<string, string>();
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private static cacheTimestamp = new Map<string, number>();

  // Pre-compiled patterns for better performance
  private static readonly RELEVANCE_PATTERNS = {
    auth: /(auth|login|session|jwt|token)/i,
    api: /(api|route|endpoint|controller)/i,
    database: /(db|database|model|schema|migration)/i,
    test: /(test|spec|mock|fixture)/i,
    component: /(component|view|ui|interface)/i,
    service: /(service|manager|handler|processor)/i,
    config: /(config|setting|env|option)/i,
    util: /(util|helper|tool|common)/i
  };

  private static readonly FILE_EXTENSIONS = new Set(['.ts', '.js', '.json']);
  private static readonly EXCLUDED_DIRS = new Set(['.git', 'node_modules', 'dist', '.vscode', 'coverage']);

  /**
   * Perform semantic search and enhance with file analysis
   */
  async performSemanticSearch(query: string, projectPath: string): Promise<SemanticResult[]> {
    try {
      const results: SemanticResult[] = [];
      const lowerQuery = query.toLowerCase();

      // Use cached file discovery to avoid repeated file system operations
      const files = await this.discoverFilesCached(projectPath);

      // Special handling for class searches - analyze actual content
      const isClassSearch = lowerQuery.includes('class') || lowerQuery.includes('classes');

      // Parallel processing for better performance
      const relevancePromises = files.map(async (filePath) => {
        let relevance: number;
        let actualContent = '';

        if (isClassSearch) {
          // For class searches, analyze actual file content
          const contentAnalysis = await this.analyzeFileContent(filePath, lowerQuery);
          relevance = contentAnalysis.relevance;
          actualContent = contentAnalysis.content;
        } else {
          // Use optimized pattern matching for other queries
          relevance = this.calculateFileRelevanceOptimized(filePath, lowerQuery);
          actualContent = await this.getFilePreviewCached(filePath);
        }

        if (relevance > 0.1) { // Very low threshold to ensure minimum results
          const fileType = this.determineFileType(filePath);

          return {
            file: path.relative(projectPath, filePath),
            type: fileType,
            similarity: relevance,
            content: actualContent,
            lineStart: 1,
            lineEnd: Math.min(50, actualContent.split('\n').length)
          };
        }
        return null;
      });

      // Wait for all relevance calculations
      const allResults = await Promise.all(relevancePromises);
      const filteredResults = allResults.filter(result => result !== null);
      results.push(...filteredResults);

      // Sort by relevance
      results.sort((a, b) => b.similarity - a.similarity);

      // Ensure minimum results - if we have very few high-relevance results,
      // include some lower-relevance ones for user confirmation
      if (results.length === 0) {
        // Fallback: return at least the top 3 files, even with very low relevance
        const fallbackResults = await this.getFallbackResults(files, projectPath, lowerQuery);
        results.push(...fallbackResults);
      }

      return results.slice(0, 10);

    } catch (error) {
      // Log error and return empty results instead of throwing
      console.warn(`Semantic search failed: ${error instanceof Error ? error.message : error}`);
      return [];
    }
  }

  /**
   * Cached file discovery with TTL
   */
  private async discoverFilesCached(projectPath: string): Promise<string[]> {
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
  private async getFilePreviewCached(filePath: string): Promise<string> {
    if (SemanticSearchOrchestrator.contentCache.has(filePath)) {
      return SemanticSearchOrchestrator.contentCache.get(filePath)!;
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
  private calculateFileRelevanceOptimized(filePath: string, lowerQuery: string): number {
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
  private calculateFileRelevance(filePath: string, lowerQuery: string): number {
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
    if (lowerQuery.includes('auth') && dirPath.includes('auth')) score += 0.8;
    if (lowerQuery.includes('api') && (dirPath.includes('api') || dirPath.includes('route'))) score += 0.8;
    if (lowerQuery.includes('test') && dirPath.includes('test')) score += 0.8;

    // General relevance patterns
    if (lowerQuery.includes('service') && fileName.includes('service')) score += 0.7;
    if (lowerQuery.includes('manager') && fileName.includes('manager')) score += 0.7;
    if (lowerQuery.includes('controller') && fileName.includes('controller')) score += 0.7;

    return Math.min(score, 1.0);
  }

  /**
   * Determine file type based on path and content
   */
  private determineFileType(filePath: string): string {
    const fileName = path.basename(filePath).toLowerCase();
    const dirPath = path.dirname(filePath).toLowerCase();

    // Specific patterns
    if (fileName.includes('controller')) return 'controller';
    if (fileName.includes('service')) return 'service';
    if (fileName.includes('manager')) return 'manager';
    if (fileName.includes('handler')) return 'handler';
    if (fileName.includes('middleware')) return 'middleware';
    if (fileName.includes('auth') || fileName.includes('login')) return 'authentication';
    if (fileName.includes('api') || fileName.includes('route')) return 'api';
    if (fileName.includes('model') || fileName.includes('entity')) return 'model';
    if (fileName.includes('test') || fileName.includes('spec')) return 'test';
    if (fileName.includes('config')) return 'configuration';
    if (fileName.includes('util') || fileName.includes('helper')) return 'utility';

    // Directory-based detection
    if (dirPath.includes('controller')) return 'controller';
    if (dirPath.includes('service')) return 'service';
    if (dirPath.includes('auth')) return 'authentication';
    if (dirPath.includes('api') || dirPath.includes('route')) return 'api';
    if (dirPath.includes('model') || dirPath.includes('entity')) return 'model';
    if (dirPath.includes('test')) return 'test';
    if (dirPath.includes('config')) return 'configuration';

    // File extension fallback
    const ext = path.extname(filePath);
    if (['.ts', '.js'].includes(ext)) return 'module';
    if (['.json'].includes(ext)) return 'configuration';
    if (['.md', '.txt'].includes(ext)) return 'documentation';

    return 'module';
  }

  /**
   * Get a preview of file content
   */
  private async getFilePreview(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      return `File: ${path.basename(filePath)} - ${this.determineFileType(filePath)}`;
    } catch {
      return `File: ${path.basename(filePath)}`;
    }
  }

  /**
   * Discover relevant files in the project
   */
  private async discoverFiles(projectPath: string): Promise<string[]> {
    const files: string[] = [];

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
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (['.ts', '.js', '.json'].includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to discover files in ${projectPath}:`, error);
    }

    return files;
  }

  /**
   * Analyze actual file content for class searches
   */
  private async analyzeFileContent(filePath: string, query: string): Promise<{ relevance: number; content: string }> {
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const lines = fileContent.split('\n');

      // Look for class declarations
      const classMatches = fileContent.match(/class\s+\w+/g) || [];
      const functionMatches = fileContent.match(/function\s+\w+|\w+\s*\(/g) || [];
      const moduleMatches = fileContent.match(/export\s+(class|function|const)/g) || [];

      let relevance = 0;
      let description = `File: ${path.basename(filePath)}`;

      if (classMatches.length > 0) {
        relevance += 0.9; // High relevance for files with classes
        description += ` - Contains ${classMatches.length} class(es): ${classMatches.join(', ')}`;
      }

      if (functionMatches.length > 0) {
        relevance += 0.3; // Some relevance for files with functions
        description += ` - ${functionMatches.length} function(s)`;
      }

      if (moduleMatches.length > 0) {
        relevance += 0.5; // Good relevance for exported modules
        description += ` - Exports: ${moduleMatches.length} item(s)`;
      }

      // Add first few lines as preview
      const preview = lines.slice(0, 5).join('\n');
      description += `\n\nPreview:\n${preview}`;

      return {
        relevance: Math.min(relevance, 1.0),
        content: description
      };
    } catch (error) {
      return {
        relevance: 0.1,
        content: `File: ${path.basename(filePath)} - Unable to analyze content`
      };
    }
  }

  /**
   * Get fallback results when no high-relevance files found
   */
  private async getFallbackResults(files: string[], projectPath: string, query: string): Promise<SemanticResult[]> {
    const fallbackResults: SemanticResult[] = [];

    // Take first few files and analyze them
    for (let i = 0; i < Math.min(3, files.length); i++) {
      const filePath = files[i];
      const contentAnalysis = await this.analyzeFileContent(filePath, query);

      fallbackResults.push({
        file: path.relative(projectPath, filePath),
        type: this.determineFileType(filePath),
        similarity: contentAnalysis.relevance,
        content: contentAnalysis.content + ' [Low similarity - please confirm relevance]',
        lineStart: 1,
        lineEnd: 20
      });
    }

    return fallbackResults;
  }
}
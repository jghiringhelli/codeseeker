/**
 * Semantic Search Orchestrator Service
 * Single Responsibility: Coordinate semantic search operations using PostgreSQL
 *
 * HYBRID SEARCH STRATEGY:
 * Combines multiple search methods and fuses results using Reciprocal Rank Fusion (RRF):
 *
 * 1. Vector Similarity (pgvector) - Semantic understanding of concepts
 * 2. Full-Text Search (PostgreSQL FTS) - TF-IDF-like ranking with ts_rank + synonym expansion
 * 3. File Path Matching - Directory/filename pattern matching
 *
 * The hybrid approach solves the problem where:
 * - "command handler" doesn't match "controller" semantically
 * - But FTS with synonym expansion (handler → controller) catches it
 *
 * PERSISTENCE:
 * - Vector embeddings: Stored in semantic_search_embeddings.embedding (pgvector)
 * - FTS index: content_tsvector column with GIN index (idx_semantic_embeddings_fts)
 * - Both are persistent and updated on code changes
 *
 * NO FILE FALLBACK: If DB is unavailable or has no results, returns empty array.
 * Claude handles file discovery natively - we don't duplicate that functionality.
 */

import * as path from 'path';
import { DatabaseConnections } from '../../../config/database-config';
import { Logger } from '../../../utils/logger';
import { EmbeddingGeneratorAdapter } from '../../services/search/embedding-generator-adapter';

export interface SemanticResult {
  file: string;
  type: string;
  similarity: number;
  content: string;
  lineStart?: number;
  lineEnd?: number;
}

export class SemanticSearchOrchestrator {
  private logger = Logger.getInstance();
  private dbConnections: DatabaseConnections;
  private projectId?: string;
  private embeddingGenerator: EmbeddingGeneratorAdapter;

  constructor(dbConnections?: DatabaseConnections) {
    this.dbConnections = dbConnections || new DatabaseConnections();
    this.embeddingGenerator = new EmbeddingGeneratorAdapter();
  }

  /**
   * Set project ID for scoped searches
   */
  setProjectId(projectId: string): void {
    this.projectId = projectId;
  }

  /**
   * Resolve project ID from database by project path
   */
  private async resolveProjectId(projectPath: string): Promise<string | undefined> {
    try {
      const postgres = await this.dbConnections.getPostgresConnection();

      // Normalize path for comparison (handle Windows/Unix differences)
      const normalizedPath = projectPath.replace(/\//g, '\\');
      const unixPath = projectPath.replace(/\\/g, '/');

      // Also resolve absolute path
      const absolutePath = path.resolve(projectPath);
      const absoluteNormalized = absolutePath.replace(/\//g, '\\');
      const absoluteUnix = absolutePath.replace(/\\/g, '/');

      const result = await postgres.query(`
        SELECT id FROM projects
        WHERE project_path = $1
           OR project_path = $2
           OR project_path = $3
           OR project_path = $4
           OR project_path ILIKE $5
        LIMIT 1
      `, [normalizedPath, unixPath, absoluteNormalized, absoluteUnix, `%${path.basename(projectPath)}`]);

      if (result.rows.length > 0) {
        return result.rows[0].id;
      }
    } catch (error) {
      this.logger.debug(`Could not resolve project ID: ${error instanceof Error ? error.message : error}`);
    }
    return undefined;
  }

  /**
   * Perform HYBRID semantic search using PostgreSQL pgvector + keyword matching
   * Combines vector similarity with keyword/synonym matching for better recall
   * Returns empty array if DB unavailable or no results - Claude handles file discovery natively
   */
  async performSemanticSearch(query: string, projectPath: string): Promise<SemanticResult[]> {
    try {
      // Resolve project ID from database if not already set or if set to non-UUID value
      if (!this.projectId || this.projectId === 'default' || !this.isValidUUID(this.projectId)) {
        const resolvedId = await this.resolveProjectId(projectPath);
        if (resolvedId) {
          this.projectId = resolvedId;
          this.logger.debug(`Resolved project ID: ${resolvedId}`);
        } else {
          this.logger.debug('No project ID resolved - search will use file_path matching only');
        }
      }

      // Perform HYBRID search: vector + keyword + path matching
      return await this.performHybridSearch(query, projectPath);

    } catch (error) {
      // Log at debug level - Claude handles file discovery anyway
      this.logger.debug(`Semantic search unavailable: ${error instanceof Error ? error.message : error}`);
      return [];
    }
  }

  /**
   * Hybrid search: Combines vector similarity, keyword matching, and file path matching
   * Uses Reciprocal Rank Fusion (RRF) to merge results from different search methods
   */
  private async performHybridSearch(query: string, projectPath: string): Promise<SemanticResult[]> {
    const k = 60; // RRF constant (standard value)

    // Run all search methods in parallel
    const [vectorResults, keywordResults, pathResults] = await Promise.all([
      this.searchByVectorSimilarity(query, projectPath),
      this.searchByKeywords(query, projectPath),
      this.searchByFilePath(query, projectPath)
    ]);

    this.logger.debug(`Hybrid search: vector=${vectorResults.length}, keyword=${keywordResults.length}, path=${pathResults.length}`);

    // Calculate RRF scores for each file
    const rrfScores = new Map<string, { score: number; result: SemanticResult; sources: string[] }>();

    // Process vector results (weight: 0.5)
    vectorResults.forEach((result, rank) => {
      const existing = rrfScores.get(result.file);
      const rrfScore = 0.5 / (k + rank + 1);
      if (existing) {
        existing.score += rrfScore;
        existing.sources.push('vector');
        // Keep higher similarity
        if (result.similarity > existing.result.similarity) {
          existing.result = result;
        }
      } else {
        rrfScores.set(result.file, { score: rrfScore, result, sources: ['vector'] });
      }
    });

    // Process keyword results (weight: 0.35)
    keywordResults.forEach((result, rank) => {
      const existing = rrfScores.get(result.file);
      const rrfScore = 0.35 / (k + rank + 1);
      if (existing) {
        existing.score += rrfScore;
        existing.sources.push('keyword');
        if (result.similarity > existing.result.similarity) {
          existing.result = result;
        }
      } else {
        rrfScores.set(result.file, { score: rrfScore, result, sources: ['keyword'] });
      }
    });

    // Process path results (weight: 0.15)
    pathResults.forEach((result, rank) => {
      const existing = rrfScores.get(result.file);
      const rrfScore = 0.15 / (k + rank + 1);
      if (existing) {
        existing.score += rrfScore;
        existing.sources.push('path');
        if (result.similarity > existing.result.similarity) {
          existing.result = result;
        }
      } else {
        rrfScores.set(result.file, { score: rrfScore, result, sources: ['path'] });
      }
    });

    // Sort by RRF score and return top results
    const sortedResults = Array.from(rrfScores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 15);

    // Log fusion results for debugging
    sortedResults.slice(0, 5).forEach(r => {
      this.logger.debug(`  ${r.result.file}: RRF=${r.score.toFixed(4)} (${r.sources.join('+')})`);
    });

    return sortedResults.map(r => r.result);
  }

  /**
   * Search using PostgreSQL Full-Text Search (FTS) with ts_rank
   * Uses the existing content_tsvector column and GIN index for TF-IDF-like ranking
   *
   * Benefits over ILIKE:
   * - Uses GIN index (fast)
   * - Proper TF-IDF ranking with ts_rank
   * - Handles stemming and word boundaries
   * - Supports phrase matching and boolean operators
   */
  private async searchByKeywords(query: string, projectPath: string): Promise<SemanticResult[]> {
    if (!this.projectId) return [];

    try {
      const postgres = await this.dbConnections.getPostgresConnection();

      // Extract keywords and expand with synonyms
      const keywords = this.extractKeywords(query);
      const expandedTerms = this.expandWithSynonyms(keywords);

      if (expandedTerms.length === 0) return [];

      // Build FTS query: terms connected with OR for broader matching
      // Format: term1 | term2 | term3 (OR operator in tsquery)
      const ftsQuery = expandedTerms.join(' | ');

      this.logger.debug(`FTS query: ${ftsQuery}`);

      // Use ts_rank for TF-IDF-like scoring
      // ts_rank considers document length and term frequency
      // Normalization flag 32 = divide by document length (favors shorter, focused docs)
      const searchQuery = `
        SELECT DISTINCT ON (file_path)
          file_path,
          content_text,
          metadata,
          ts_rank(content_tsvector, to_tsquery('english', $2), 32) as fts_rank
        FROM semantic_search_embeddings
        WHERE project_id = $1
          AND content_tsvector @@ to_tsquery('english', $2)
        ORDER BY file_path, fts_rank DESC
        LIMIT 20
      `;

      const results = await postgres.query(searchQuery, [this.projectId, ftsQuery]);

      this.logger.debug(`FTS found ${results.rows.length} results`);

      // Normalize ts_rank scores to 0-1 range for RRF fusion
      // ts_rank typically returns values 0-1 but can exceed for multiple matches
      const maxRank = Math.max(...results.rows.map(r => parseFloat(r.fts_rank) || 0), 0.001);

      return results.rows.map(row => ({
        file: path.isAbsolute(row.file_path)
          ? path.relative(projectPath, row.file_path)
          : row.file_path,
        type: this.determineFileType(row.file_path),
        similarity: Math.min((parseFloat(row.fts_rank) || 0) / maxRank, 1.0), // Normalized 0-1
        content: this.formatContent(row.content_text, row.metadata),
        lineStart: 1,
        lineEnd: 20
      }));
    } catch (error) {
      // Fallback to ILIKE if FTS fails (e.g., invalid tsquery syntax)
      this.logger.debug(`FTS error (falling back to ILIKE): ${error instanceof Error ? error.message : error}`);
      return this.searchByKeywordsILIKE(query, projectPath);
    }
  }

  /**
   * Fallback keyword search using ILIKE (slower but more forgiving)
   * Used when FTS fails due to special characters or syntax issues
   */
  private async searchByKeywordsILIKE(query: string, projectPath: string): Promise<SemanticResult[]> {
    if (!this.projectId) return [];

    try {
      const postgres = await this.dbConnections.getPostgresConnection();

      const keywords = this.extractKeywords(query);
      const expandedTerms = this.expandWithSynonyms(keywords);

      if (expandedTerms.length === 0) return [];

      // Build ILIKE conditions for each term
      const conditions = expandedTerms.map((_, i) => `(content_text ILIKE $${i + 2} OR file_path ILIKE $${i + 2})`);
      const params = [this.projectId, ...expandedTerms.map(t => `%${t}%`)];

      const searchQuery = `
        SELECT DISTINCT ON (file_path)
          file_path,
          content_text,
          metadata,
          CASE
            WHEN ${expandedTerms.map((_, i) => `content_text ILIKE $${i + 2}`).join(' AND ')} THEN 0.95
            WHEN ${expandedTerms.map((_, i) => `content_text ILIKE $${i + 2}`).join(' OR ')} THEN 0.75
            ELSE 0.5
          END as similarity
        FROM semantic_search_embeddings
        WHERE project_id = $1
          AND (${conditions.join(' OR ')})
        ORDER BY file_path, similarity DESC
        LIMIT 20
      `;

      const results = await postgres.query(searchQuery, params);

      return results.rows.map(row => ({
        file: path.isAbsolute(row.file_path)
          ? path.relative(projectPath, row.file_path)
          : row.file_path,
        type: this.determineFileType(row.file_path),
        similarity: parseFloat(row.similarity) || 0.5,
        content: this.formatContent(row.content_text, row.metadata),
        lineStart: 1,
        lineEnd: 20
      }));
    } catch (error) {
      this.logger.debug(`ILIKE fallback error: ${error instanceof Error ? error.message : error}`);
      return [];
    }
  }

  /**
   * Search by file path patterns
   * Matches directory names and file names against query terms
   */
  private async searchByFilePath(query: string, projectPath: string): Promise<SemanticResult[]> {
    if (!this.projectId) return [];

    try {
      const postgres = await this.dbConnections.getPostgresConnection();

      // Extract keywords and expand with synonyms for path matching
      const keywords = this.extractKeywords(query);
      const expandedTerms = this.expandWithSynonyms(keywords);

      if (expandedTerms.length === 0) return [];

      // Match against file paths
      const conditions = expandedTerms.map((_, i) => `file_path ILIKE $${i + 2}`);
      const params = [this.projectId, ...expandedTerms.map(t => `%${t}%`)];

      const searchQuery = `
        SELECT DISTINCT ON (file_path)
          file_path,
          content_text,
          metadata,
          CASE
            WHEN ${expandedTerms.map((_, i) => `file_path ILIKE $${i + 2}`).join(' AND ')} THEN 0.9
            ELSE 0.6
          END as similarity
        FROM semantic_search_embeddings
        WHERE project_id = $1
          AND (${conditions.join(' OR ')})
        ORDER BY file_path, similarity DESC
        LIMIT 15
      `;

      const results = await postgres.query(searchQuery, params);

      return results.rows.map(row => ({
        file: path.isAbsolute(row.file_path)
          ? path.relative(projectPath, row.file_path)
          : row.file_path,
        type: this.determineFileType(row.file_path),
        similarity: parseFloat(row.similarity) || 0.6,
        content: this.formatContent(row.content_text, row.metadata),
        lineStart: 1,
        lineEnd: 20
      }));
    } catch (error) {
      this.logger.debug(`Path search error: ${error instanceof Error ? error.message : error}`);
      return [];
    }
  }

  /**
   * Extract meaningful keywords from query
   * Removes stop words and short terms
   */
  private extractKeywords(query: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
      'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
      'some', 'such', 'no', 'not', 'only', 'own', 'same', 'so', 'than',
      'too', 'very', 'just', 'also', 'now', 'here', 'there', 'when',
      'where', 'why', 'how', 'what', 'which', 'who', 'whom', 'this',
      'that', 'these', 'those', 'am', 'find', 'show', 'get', 'list',
      'me', 'my', 'i', 'you', 'your', 'we', 'our', 'they', 'their'
    ]);

    return query
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length >= 3 && !stopWords.has(word));
  }

  /**
   * Expand keywords with programming synonyms
   * Maps common programming terms to their alternatives
   */
  private expandWithSynonyms(keywords: string[]): string[] {
    const synonymMap: Record<string, string[]> = {
      // Request handling
      'handler': ['controller', 'handler', 'processor', 'middleware', 'route', 'endpoint'],
      'controller': ['controller', 'handler', 'processor', 'action'],
      'endpoint': ['endpoint', 'route', 'api', 'handler', 'controller'],
      'route': ['route', 'endpoint', 'handler', 'path', 'api'],
      'middleware': ['middleware', 'interceptor', 'filter', 'handler'],

      // Commands
      'command': ['command', 'handler', 'controller', 'action', 'processor'],
      'action': ['action', 'handler', 'command', 'method'],

      // Data operations
      'service': ['service', 'provider', 'manager', 'helper', 'util'],
      'repository': ['repository', 'dao', 'store', 'persistence', 'database'],
      'model': ['model', 'entity', 'schema', 'type', 'interface'],
      'database': ['database', 'db', 'repository', 'store', 'persistence'],

      // Authentication
      'auth': ['auth', 'authentication', 'login', 'session', 'token', 'jwt'],
      'authentication': ['authentication', 'auth', 'login', 'security'],
      'login': ['login', 'auth', 'signin', 'authentication'],

      // Validation
      'validation': ['validation', 'validator', 'validate', 'check', 'verify'],
      'validator': ['validator', 'validation', 'checker', 'verify'],

      // Error handling
      'error': ['error', 'exception', 'failure', 'fault'],
      'exception': ['exception', 'error', 'throw', 'catch'],

      // Testing
      'test': ['test', 'spec', 'mock', 'stub', 'fixture'],

      // Configuration
      'config': ['config', 'configuration', 'settings', 'options', 'env'],
      'configuration': ['configuration', 'config', 'settings', 'setup'],

      // Utilities
      'util': ['util', 'utility', 'helper', 'common', 'shared'],
      'helper': ['helper', 'util', 'utility', 'support'],

      // API
      'api': ['api', 'endpoint', 'route', 'rest', 'graphql', 'controller'],

      // Factory patterns
      'factory': ['factory', 'builder', 'creator', 'provider'],
      'builder': ['builder', 'factory', 'creator'],

      // User related
      'user': ['user', 'account', 'member', 'profile', 'customer'],
      'account': ['account', 'user', 'profile'],

      // CRUD operations
      'create': ['create', 'add', 'insert', 'new', 'post'],
      'read': ['read', 'get', 'fetch', 'find', 'retrieve', 'query'],
      'update': ['update', 'edit', 'modify', 'patch', 'put'],
      'delete': ['delete', 'remove', 'destroy', 'drop']
    };

    const expanded = new Set<string>();

    for (const keyword of keywords) {
      // Always add the original keyword
      expanded.add(keyword);

      // Check if keyword matches any synonym group
      const synonyms = synonymMap[keyword];
      if (synonyms) {
        synonyms.forEach(s => expanded.add(s));
      }

      // Also check if keyword is in any synonym list (reverse lookup)
      for (const [key, values] of Object.entries(synonymMap)) {
        if (values.includes(keyword)) {
          expanded.add(key);
          values.forEach(s => expanded.add(s));
        }
      }
    }

    return Array.from(expanded);
  }

  /**
   * Check if string is valid UUID
   */
  private isValidUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }

  /**
   * Search using pgvector similarity
   *
   * Strategy:
   * 1. Generate embedding for the query text
   * 2. Use pgvector's <=> operator (cosine distance) to find similar embeddings
   * 3. Return results sorted by similarity (1 - distance = similarity)
   */
  private async searchByVectorSimilarity(query: string, projectPath: string): Promise<SemanticResult[]> {
    try {
      const postgres = await this.dbConnections.getPostgresConnection();

      // First, check if we have embeddings for this project
      let embeddingCount = 0;
      if (this.projectId && this.isValidUUID(this.projectId)) {
        const countResult = await postgres.query(
          'SELECT COUNT(*) as count FROM semantic_search_embeddings WHERE project_id = $1',
          [this.projectId]
        );
        embeddingCount = parseInt(countResult.rows[0]?.count || '0');
      }

      if (embeddingCount === 0) {
        this.logger.debug('No embeddings found in database for this project');
        return [];
      }

      this.logger.debug(`Found ${embeddingCount} embeddings for project, generating query embedding...`);

      // Generate embedding for the query
      const queryEmbedding = await this.embeddingGenerator.generateQueryEmbedding(query);

      if (!queryEmbedding || queryEmbedding.length === 0) {
        this.logger.debug('Failed to generate query embedding');
        return [];
      }

      // Format embedding as PostgreSQL vector literal
      const embeddingStr = `[${queryEmbedding.join(',')}]`;

      // Check for line columns
      const hasLineColumns = await this.hasColumn(postgres, 'chunk_start_line');
      const lineColumns = hasLineColumns
        ? 'chunk_start_line, chunk_end_line,'
        : '(COALESCE(chunk_index, 0) * 20 + 1) as chunk_start_line, (COALESCE(chunk_index, 0) * 20 + 20) as chunk_end_line,';

      // Perform vector similarity search using pgvector's <=> operator (cosine distance)
      // 1 - distance = similarity (closer to 1 is more similar)
      const searchQuery = `
        SELECT
          file_path,
          content_text,
          chunk_index,
          metadata,
          ${lineColumns}
          1 - (embedding <=> $1::vector) as similarity
        FROM semantic_search_embeddings
        WHERE project_id = $2
          AND embedding IS NOT NULL
        ORDER BY embedding <=> $1::vector
        LIMIT 15
      `;

      const results = await postgres.query(searchQuery, [embeddingStr, this.projectId]);

      this.logger.debug(`Vector search found ${results.rows.length} results`);

      // Convert to SemanticResult format
      const semanticResults: SemanticResult[] = [];
      const seenFiles = new Set<string>();

      for (const row of results.rows) {
        // Use relative path
        const relativePath = path.isAbsolute(row.file_path)
          ? path.relative(projectPath, row.file_path)
          : row.file_path;

        // Skip archive/backup folders
        const lowerPath = relativePath.toLowerCase();
        const excludePaths = ['archive', 'backup', 'old', 'deprecated', 'node_modules', 'dist'];
        if (excludePaths.some(ex => lowerPath.startsWith(ex + '/') || lowerPath.startsWith(ex + '\\'))) {
          continue;
        }

        // Dedupe by file (keep highest similarity chunk)
        if (seenFiles.has(relativePath)) {
          continue;
        }
        seenFiles.add(relativePath);

        const similarity = parseFloat(row.similarity) || 0;

        semanticResults.push({
          file: relativePath,
          type: this.determineFileType(row.file_path),
          similarity,
          content: this.formatContent(row.content_text, row.metadata),
          lineStart: row.chunk_start_line || 1,
          lineEnd: row.chunk_end_line || 20
        });
      }

      return semanticResults;

    } catch (error) {
      this.logger.debug(`Vector search error: ${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }

  /**
   * Check if table has a specific column
   */
  private async hasColumn(postgres: any, columnName: string): Promise<boolean> {
    try {
      const result = await postgres.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'semantic_search_embeddings'
        AND column_name = $1
      `, [columnName]);
      return result.rows.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Format content from database with metadata
   */
  private formatContent(content: string, metadata: any): string {
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
      } catch {
        // Ignore metadata parse errors
      }
    }

    // Allow ~50 lines of content (~2500 chars) to support meaningful file previews
    // This reduces Claude's need to Read files, saving tool call tokens
    if (formatted.length > 2500) {
      formatted = formatted.substring(0, 2500) + '...';
    }

    return formatted;
  }

  /**
   * Determine file type based on path and name
   */
  private determineFileType(filePath: string): string {
    const fileName = path.basename(filePath).toLowerCase();
    const dirPath = path.dirname(filePath).toLowerCase();

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
    if (fileName.includes('interface') || fileName.includes('types')) return 'interface';
    if (fileName.includes('repository') || fileName.includes('dao')) return 'repository';

    if (dirPath.includes('controller')) return 'controller';
    if (dirPath.includes('service')) return 'service';
    if (dirPath.includes('auth')) return 'authentication';
    if (dirPath.includes('api') || dirPath.includes('route')) return 'api';
    if (dirPath.includes('model') || dirPath.includes('entity')) return 'model';
    if (dirPath.includes('test')) return 'test';
    if (dirPath.includes('config')) return 'configuration';

    const ext = path.extname(filePath);
    if (['.ts', '.js'].includes(ext)) return 'module';
    if (['.json', '.yaml', '.yml'].includes(ext)) return 'configuration';
    if (['.md', '.txt', '.rst'].includes(ext)) return 'documentation';

    return 'module';
  }
}

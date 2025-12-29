/**
 * Semantic Search Orchestrator Service
 * Single Responsibility: Coordinate semantic search operations
 *
 * STORAGE MODES:
 * - Embedded (default): Uses SQLite for vectors + MiniSearch for text search
 * - Server: Uses PostgreSQL with pgvector for production deployments
 *
 * HYBRID SEARCH STRATEGY:
 * Combines multiple search methods and fuses results using Reciprocal Rank Fusion (RRF):
 *
 * 1. Vector Similarity - Semantic understanding of concepts
 * 2. MiniSearch Text Search - BM25 scoring with synonym expansion and CamelCase tokenization
 * 3. File Path Matching - Directory/filename pattern matching
 *
 * The hybrid approach solves the problem where:
 * - "command handler" doesn't match "controller" semantically
 * - But text search with synonym expansion (handler → controller) catches it
 *
 * NO FILE FALLBACK: If storage is unavailable or has no results, returns empty array.
 * Claude handles file discovery natively - we don't duplicate that functionality.
 */

import * as path from 'path';
import { Logger } from '../../../utils/logger';
import { EmbeddingGeneratorAdapter } from '../../services/search/embedding-generator-adapter';
import { getStorageManager, isUsingEmbeddedStorage, StorageManager } from '../../../storage';
import type { IVectorStore, IProjectStore } from '../../../storage/interfaces';

export interface SemanticResult {
  file: string;
  type: string;
  similarity: number;
  content: string;
  lineStart?: number;
  lineEnd?: number;
  /** Debug info for verbose mode - score breakdown by source */
  debug?: {
    vectorScore: number;      // Semantic similarity (cosine similarity 0-1)
    textScore: number;        // Inverted index score (MiniSearch BM25, 0-20+)
    pathMatch: boolean;       // Whether file path matched query terms
    matchSource: string;      // e.g., "semantic+text+path", "text", "semantic"
  };
}

export class SemanticSearchOrchestrator {
  private logger = Logger.getInstance();
  private projectId?: string;
  private embeddingGenerator: EmbeddingGeneratorAdapter;
  private storageManager: StorageManager | null = null;
  private useEmbedded: boolean = false;
  private vectorStore?: IVectorStore;
  private projectStore?: IProjectStore;

  constructor() {
    this.embeddingGenerator = new EmbeddingGeneratorAdapter();
  }

  /**
   * Initialize storage - checks if we should use embedded or server mode
   */
  private async initStorage(): Promise<void> {
    if (this.storageManager !== null) return; // Already initialized

    try {
      this.storageManager = await getStorageManager();
      this.useEmbedded = isUsingEmbeddedStorage();
      this.vectorStore = this.storageManager.getVectorStore();
      this.projectStore = this.storageManager.getProjectStore();
      this.logger.debug(`Semantic search using ${this.useEmbedded ? 'embedded' : 'server'} storage`);
    } catch (error) {
      this.logger.debug(`Storage manager init failed: ${error}`);
      this.useEmbedded = false;
    }
  }

  /**
   * Set project ID for scoped searches
   */
  setProjectId(projectId: string): void {
    this.projectId = projectId;
  }

  /**
   * Resolve project ID from storage by project path
   */
  private async resolveProjectId(projectPath: string): Promise<string | undefined> {
    try {
      if (!this.projectStore) return undefined;

      // Get all projects and find matching one
      const projects = await this.projectStore.list();
      const absolutePath = path.resolve(projectPath);

      // Try to match by various path formats
      const project = projects.find(p => {
        const projectAbsolute = path.resolve(p.path);
        return p.path === projectPath ||
               p.path === absolutePath ||
               projectAbsolute === absolutePath ||
               path.basename(p.path) === path.basename(projectPath);
      });

      if (project) {
        return project.id;
      }
    } catch (error) {
      this.logger.debug(`Could not resolve project ID: ${error instanceof Error ? error.message : error}`);
    }
    return undefined;
  }

  /**
   * Perform HYBRID semantic search
   * Uses storage interface abstraction for both embedded and server modes
   * Combines vector similarity with keyword/synonym matching for better recall
   * Returns empty array if storage unavailable or no results - Claude handles file discovery natively
   */
  async performSemanticSearch(query: string, projectPath: string): Promise<SemanticResult[]> {
    try {
      // Initialize storage mode detection
      await this.initStorage();

      if (!this.vectorStore || !this.projectStore) {
        this.logger.debug('Storage not initialized');
        return [];
      }

      // Resolve project ID from storage if not already set or if set to non-UUID value
      if (!this.projectId || this.projectId === 'default' || !this.isValidUUID(this.projectId)) {
        const resolvedId = await this.resolveProjectId(projectPath);
        if (resolvedId) {
          this.projectId = resolvedId;
          this.logger.debug(`Resolved project ID: ${resolvedId}`);
        } else {
          this.logger.debug('No project ID resolved - returning empty results');
          return [];
        }
      }

      // Perform HYBRID search using storage interface
      return await this.performHybridSearchViaInterface(query, projectPath);

    } catch (error) {
      // Log at debug level - Claude handles file discovery anyway
      this.logger.debug(`Semantic search unavailable: ${error instanceof Error ? error.message : error}`);
      return [];
    }
  }

  /**
   * Perform hybrid search using the storage interface abstraction
   * Works for both embedded (SQLite + MiniSearch) and server (PostgreSQL + pgvector) modes
   * The IVectorStore implementation handles the specific search logic internally
   */
  private async performHybridSearchViaInterface(query: string, projectPath: string): Promise<SemanticResult[]> {
    if (!this.vectorStore || !this.projectId) return [];

    try {
      this.logger.debug(`Performing hybrid search for project: ${this.projectId}`);

      // Generate query embedding for vector search
      let queryEmbedding: number[] = [];
      try {
        queryEmbedding = await this.embeddingGenerator.generateQueryEmbedding(query);
      } catch (error) {
        this.logger.debug(`Query embedding generation failed, using text search only: ${error}`);
      }

      // Use the storage interface's hybrid search
      // The implementation handles vector similarity, text search (MiniSearch), and path matching internally
      // Request more results to allow for deduplication by file path
      const results = await this.vectorStore.searchHybrid(query, queryEmbedding, this.projectId, 30);

      this.logger.debug(`Hybrid search found ${results.length} results (before dedup)`);

      // Deduplicate by file path with multi-chunk boost
      // If multiple chunks from the same file match, that file is more relevant
      // We keep the best chunk's content but boost the score based on chunk count
      const fileMap = new Map<string, { result: typeof results[0]; chunkCount: number; totalScore: number }>();

      for (const r of results) {
        const filePath = path.isAbsolute(r.document.filePath)
          ? path.relative(projectPath, r.document.filePath)
          : r.document.filePath;

        const existing = fileMap.get(filePath);
        if (existing) {
          // File already seen - increment count and accumulate score
          existing.chunkCount++;
          existing.totalScore += r.score;
          // Keep the highest scoring chunk's content
          if (r.score > existing.result.score) {
            existing.result = r;
          }
        } else {
          fileMap.set(filePath, { result: r, chunkCount: 1, totalScore: r.score });
        }
      }

      // Calculate boosted scores:
      // - Base: best chunk score
      // - Boost: +10% per additional matching chunk (capped at 50% boost)
      // - Final score ALWAYS capped at 1.0 (100%)
      const boostedResults = Array.from(fileMap.values()).map(entry => {
        const chunkBoost = Math.min((entry.chunkCount - 1) * 0.10, 0.50);
        const boostedScore = Math.min(1.0, entry.result.score * (1 + chunkBoost));
        return {
          ...entry.result,
          score: boostedScore,
          _chunkCount: entry.chunkCount // For debugging
        };
      });

      // Sort by boosted score and limit to 15 unique files
      const uniqueResults = boostedResults
        .sort((a, b) => b.score - a.score)
        .slice(0, 15);

      this.logger.debug(`Returning ${uniqueResults.length} unique files`);

      return uniqueResults.map(r => ({
        file: path.isAbsolute(r.document.filePath)
          ? path.relative(projectPath, r.document.filePath)
          : r.document.filePath,
        type: this.determineFileType(r.document.filePath),
        similarity: r.score,
        content: this.formatContent(r.document.content, r.document.metadata),
        lineStart: 1,
        lineEnd: 20,
        // Pass through debug info for verbose mode
        debug: r.debug
      }));

    } catch (error) {
      this.logger.debug(`Hybrid search error: ${error instanceof Error ? error.message : error}`);
      return [];
    }
  }

  /**
   * Check if string is valid UUID
   */
  private isValidUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
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

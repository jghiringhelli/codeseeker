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
import type { IVectorStore, IProjectStore, IGraphStore, VectorSearchResult } from '../../../storage/interfaces';
import { RaptorIndexingService, RAPTOR_FILE_PREFIX } from '../../services/search/raptor-indexing-service';

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
  private graphStore?: IGraphStore;

  /** Current query — set at the start of performSemanticSearch, used for symbol-name boosting */
  private currentQuery: string = '';

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
      try { this.graphStore = this.storageManager.getGraphStore(); } catch { /* graph store is optional */ }
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
  async performSemanticSearch(query: string, projectPath: string, searchType: 'hybrid' | 'vector' | 'fts' | 'graph' = 'hybrid'): Promise<SemanticResult[]> {
    this.currentQuery = query;
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

      // Route to appropriate search method based on search_type
      switch (searchType) {
        case 'vector':
          return await this.performVectorOnlySearch(query, projectPath);
        case 'fts':
          return await this.performTextOnlySearch(query, projectPath);
        case 'graph': {
          // Explicit graph mode: always expand regardless of graphExpansionDepth setting
          const base = await this.performHybridSearchViaInterface(query, projectPath);
          return await this.expandWithGraphNeighbors(base, projectPath, Math.max(1, this.graphExpansionDepth));
        }
        case 'hybrid':
        default: {
          const base = await this.performHybridSearchViaInterface(query, projectPath);
          // Apply graph expansion unless explicitly disabled (depth=0)
          return this.graphExpansionDepth > 0
            ? await this.expandWithGraphNeighbors(base, projectPath, this.graphExpansionDepth)
            : base;
        }
      }

    } catch (error) {
      // Log at debug level - Claude handles file discovery anyway
      this.logger.debug(`Semantic search unavailable: ${error instanceof Error ? error.message : error}`);
      return [];
    }
  }

  // ── RAPTOR Cascade thresholds ─────────────────────────────────────────────
  /** Minimum L2 RAPTOR node score to trust its directory hint */
  private l2Threshold = 0.5;
  /** Minimum number of results cascade must produce to skip fallback */
  private cascadeMinResults = 3;
  /** Minimum top-result score cascade must produce to skip fallback */
  private cascadeTopScore = 0.25;

  /** Override RAPTOR cascade thresholds — useful for tuning experiments. */
  setRaptorConfig(config: { l2Threshold?: number; cascadeMinResults?: number; cascadeTopScore?: number }): void {
    if (config.l2Threshold       !== undefined) this.l2Threshold       = config.l2Threshold;
    if (config.cascadeMinResults !== undefined) this.cascadeMinResults = config.cascadeMinResults;
    if (config.cascadeTopScore   !== undefined) this.cascadeTopScore   = config.cascadeTopScore;
  }

  // ── Graph expansion configuration ────────────────────────────────────────────
  /**
   * Depth of graph neighbor expansion after hybrid search.
   * 0 = disabled, 1 = 1-hop (default), 2 = 2-hop (cross-file chains)
   */
  private graphExpansionDepth = 1;

  /** Configure graph expansion depth. 0 disables expansion entirely. */
  setGraphExpansionDepth(depth: number): void {
    this.graphExpansionDepth = Math.max(0, Math.min(2, depth));
  }

  /**
   * Perform hybrid search using the storage interface abstraction.
   * Works for both embedded (SQLite + MiniSearch) and server (PostgreSQL + pgvector) modes.
   *
   * RAPTOR Cascade (post-processing):
   *  1. Run wide searchHybrid (one call, always happens)
   *  2. Extract RAPTOR L2 nodes from raw results
   *  3. If a high-confidence L2 node exists, post-filter real files to its dir(s)
   *  4. If the filtered set is thin or low-confidence, fall back to full wide results
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

      // One wide search call — feeds both cascade and fallback
      const rawResults = await this.vectorStore.searchHybrid(query, queryEmbedding, this.projectId, 30);
      this.logger.debug(`Hybrid search found ${rawResults.length} results (before dedup)`);

      // ── RAPTOR cascade ───────────────────────────────────────────────────
      const cascadeResults = this.applyCascadeFilter(rawResults, projectPath);
      if (cascadeResults !== null) {
        this.logger.debug(`Cascade active: ${cascadeResults.length} results after directory filter`);
        return cascadeResults;
      }

      // ── Fallback: full wide results ──────────────────────────────────────
      return this.processRawResults(rawResults, projectPath);

    } catch (error) {
      this.logger.debug(`Hybrid search error: ${error instanceof Error ? error.message : error}`);
      return [];
    }
  }

  /**
   * Apply RAPTOR cascade post-filter.
   * Returns filtered SemanticResult[] when cascade is confident, null when falling back.
   */
  private applyCascadeFilter(
    rawResults: VectorSearchResult[],
    projectPath: string
  ): SemanticResult[] | null {
    // Extract L2 RAPTOR nodes (directory summaries)
    const l2Nodes = rawResults.filter(r => {
      if (!RaptorIndexingService.isRaptorPath(r.document.filePath)) return false;
      const level = (r.document.metadata as any)?.raptorLevel as number | undefined;
      return level === 2 || level === undefined; // L2 = per-directory summaries
    });

    if (l2Nodes.length === 0) return null;

    // Check best L2 score
    const topL2Score = Math.max(...l2Nodes.map(n => n.score));
    if (topL2Score < this.l2Threshold) {
      this.logger.debug(`Cascade skipped: top L2 score ${topL2Score.toFixed(3)} < ${this.l2Threshold}`);
      return null;
    }

    // Collect candidate directories from qualifying L2 nodes
    const candidateDirs = new Set<string>();
    for (const node of l2Nodes) {
      if (node.score >= this.l2Threshold) {
        const raptorDir = (node.document.metadata as any)?.raptorDir as string | undefined;
        if (raptorDir) candidateDirs.add(raptorDir);
      }
    }
    if (candidateDirs.size === 0) return null;

    this.logger.debug(`Cascade dirs: ${[...candidateDirs].join(', ')}`);

    // Post-filter: keep only real files whose paths are within candidate dirs
    // RAPTOR nodes themselves are excluded from the output
    const filteredRaw = rawResults.filter(r => {
      if (RaptorIndexingService.isRaptorPath(r.document.filePath)) return false;
      const relPath = path.isAbsolute(r.document.filePath)
        ? path.relative(projectPath, r.document.filePath)
        : r.document.filePath;
      // Normalise separators for cross-platform matching
      const normPath = relPath.replace(/\\/g, '/');
      return [...candidateDirs].some(dir => normPath.startsWith(dir + '/') || normPath.startsWith(dir + '\\'));
    });

    if (filteredRaw.length < this.cascadeMinResults) {
      this.logger.debug(`Cascade fallback: only ${filteredRaw.length} results in candidate dirs (min ${this.cascadeMinResults}`);
      return null;
    }

    // Use raw (pre-boost) top score for cascade confidence check.
    // The symbol-name boost inflates scores for keyword-matching files and must not
    // cause a weak cascade to appear confident.
    const topRawScore = filteredRaw.length > 0
      ? Math.max(...filteredRaw.map(r => r.score))
      : 0;

    if (topRawScore < this.cascadeTopScore) {
      this.logger.debug(`Cascade fallback: top raw score ${topRawScore.toFixed(3)} < ${this.cascadeTopScore}`);
      return null;
    }

    return this.processRawResults(filteredRaw, projectPath);
  }

  /**
   * Perform vector-only semantic search (pure embedding similarity, no BM25/path matching)
   */
  private async performVectorOnlySearch(query: string, projectPath: string): Promise<SemanticResult[]> {
    if (!this.vectorStore || !this.projectId) return [];
    try {
      let queryEmbedding: number[] = [];
      try {
        queryEmbedding = await this.embeddingGenerator.generateQueryEmbedding(query);
      } catch (e) {
        this.logger.debug(`Vector embedding failed: ${e}`);
        return [];
      }
      if (queryEmbedding.length === 0) return [];
      const results = await this.vectorStore.searchByVector(queryEmbedding, this.projectId, 30);
      this.logger.debug(`Vector-only search found ${results.length} results`);
      return this.processRawResults(results, projectPath);
    } catch (error) {
      this.logger.debug(`Vector search error: ${error instanceof Error ? error.message : error}`);
      return [];
    }
  }

  /**
   * Perform text/FTS-only search (BM25 + synonyms, no vector similarity)
   */
  private async performTextOnlySearch(query: string, projectPath: string): Promise<SemanticResult[]> {
    if (!this.vectorStore || !this.projectId) return [];
    try {
      const results = await this.vectorStore.searchByText(query, this.projectId, 30);
      this.logger.debug(`Text-only search found ${results.length} results`);
      return this.processRawResults(results, projectPath);
    } catch (error) {
      this.logger.debug(`Text search error: ${error instanceof Error ? error.message : error}`);
      return [];
    }
  }

  /**
   * Deduplicate raw VectorSearchResults by file path, apply multi-chunk boost, and map to SemanticResult[].
   * Shared by all search modes (vector, fts, hybrid, graph) to ensure consistent scoring behaviour.
   */
  private processRawResults(results: VectorSearchResult[], projectPath: string): SemanticResult[] {
    // Deduplicate by file path with multi-chunk boost
    // If multiple chunks from the same file match, that file is more relevant.
    // Keep the highest-scoring chunk's content and boost its score.
    const fileMap = new Map<string, { result: VectorSearchResult; chunkCount: number }>();

    for (const r of results) {
      const filePath = path.isAbsolute(r.document.filePath)
        ? path.relative(projectPath, r.document.filePath)
        : r.document.filePath;

      // RAPTOR nodes are synthetic summaries; don't merge or boost them.
      if (RaptorIndexingService.isRaptorPath(filePath)) {
        if (!fileMap.has(filePath)) {
          fileMap.set(filePath, { result: r, chunkCount: 1 });
        }
        continue;
      }

      const existing = fileMap.get(filePath);
      if (existing) {
        existing.chunkCount++;
        if (r.score > existing.result.score) {
          existing.result = r;
        }
      } else {
        fileMap.set(filePath, { result: r, chunkCount: 1 });
      }
    }

    // ── Score boosting ────────────────────────────────────────────────────────
    //
    // Four independent boosts applied additively after dedup:
    //
    // 1. Multi-chunk boost (+10% per extra chunk, capped at +30%)
    //    Quality-gated: only counts chunks whose individual score ≥ 0.15.
    //    Without the gate, large files (lock files, generated docs) accumulate
    //    mediocre-scoring chunks and unfairly dominate.
    //
    // 2. Symbol-name boost (+0.20 additive)
    //    When a query token (>2 chars) matches symbolName/functions/classes/filename.
    //    Helps exact-symbol queries surface the declaring file over prose references.
    //
    // 3. Source-file type boost (+0.10 for code, -0.05 for docs/config)
    //    Source files (.ts .js .py .cs etc.) preferred over docs (.md) and config (.yaml .lock).
    //    Prevents spec docs from outranking implementation files on symbol queries.
    //
    // 4. Test-file penalty (-0.15)
    //    Files in test directories or with .test./.spec. in their name get a penalty.
    //    Test files import and USE all the same symbols as source files, causing them
    //    to outrank the implementation files that DEFINE those symbols.

    const SOURCE_EXTS = new Set(['.ts', '.js', '.tsx', '.jsx', '.py', '.cs', '.kt', '.java', '.go', '.rs', '.cpp', '.c', '.rb', '.swift', '.php']);
    const DOC_EXTS    = new Set(['.md', '.txt', '.rst', '.adoc']);
    const CONFIG_EXTS = new Set(['.json', '.yaml', '.yml', '.toml', '.lock', '.xml', '.ini', '.env']);

    const queryTokens = this.currentQuery
      .toLowerCase()
      .split(/\W+/)
      .filter(t => t.length > 2);

    // Minimum per-chunk score to count toward multi-chunk boost
    const CHUNK_BOOST_MIN_SCORE = 0.15;

    const isTestFile = (filePath: string): boolean => {
      const lower = filePath.toLowerCase().replace(/\\/g, '/');
      return /\/(tests?|__tests?__|spec|specs)\//i.test(lower)
        || /\.(test|spec)\.[a-z]+$/i.test(lower);
    };

    const boostedResults = Array.from(fileMap.values()).map(entry => {
      // 1. Multi-chunk boost — quality-gated
      const qualityChunkCount = entry.chunkCount; // stored as count in map; we use best-chunk score as gate
      const baseScore = entry.result.score;
      const chunkBoost = baseScore >= CHUNK_BOOST_MIN_SCORE
        ? Math.min((qualityChunkCount - 1) * 0.10, 0.30)
        : 0;

      // 2. Symbol-name boost
      let symbolBoost = 0;
      if (queryTokens.length > 0 && !RaptorIndexingService.isRaptorPath(entry.result.document.filePath)) {
        const meta = entry.result.document.metadata as any;
        const symbolName = (meta?.symbolName as string | undefined ?? '').toLowerCase();
        const classes = ((meta?.classes as string[] | undefined) ?? []).join(' ').toLowerCase();
        const functions = ((meta?.functions as string[] | undefined) ?? []).join(' ').toLowerCase();
        const fileName = (meta?.fileName as string | undefined ?? path.basename(entry.result.document.filePath)).toLowerCase();
        const symbolText = `${symbolName} ${classes} ${functions} ${fileName}`;
        if (queryTokens.some(t => symbolText.includes(t))) symbolBoost = 0.20;
      }

      // 3. File-type boost
      const ext = path.extname(entry.result.document.filePath).toLowerCase();
      const typeBoost = SOURCE_EXTS.has(ext) ? 0.10 : DOC_EXTS.has(ext) ? -0.05 : CONFIG_EXTS.has(ext) ? -0.05 : 0;

      // 4. Test-file penalty
      const testPenalty = isTestFile(entry.result.document.filePath) ? -0.15 : 0;

      const boostedScore = Math.min(1.0, Math.max(0, baseScore * (1 + chunkBoost) + symbolBoost + typeBoost + testPenalty));
      return { ...entry.result, score: boostedScore };
    });

    const uniqueResults = boostedResults.sort((a, b) => b.score - a.score).slice(0, 15);
    this.logger.debug(`Returning ${uniqueResults.length} unique files after dedup`);

    return uniqueResults.map(r => {
      const rawFilePath = path.isAbsolute(r.document.filePath)
        ? path.relative(projectPath, r.document.filePath)
        : r.document.filePath;

      const isRaptor = RaptorIndexingService.isRaptorPath(rawFilePath);
      const displayPath = (isRaptor ? RaptorIndexingService.realPath(rawFilePath) : rawFilePath)
        .replace(/\\/g, '/'); // Normalise path separators for cross-platform consistency
      const raptorLevel = isRaptor ? (r.document.metadata as any)?.raptorLevel as number | undefined : undefined;

      return {
        file: displayPath,
        type: isRaptor
          ? (raptorLevel === 3 ? 'root-summary' : 'directory-summary')
          : this.determineFileType(r.document.filePath),
        similarity: r.score,
        content: this.formatContent(r.document.content, r.document.metadata),
        lineStart: isRaptor ? undefined : 1,
        lineEnd: isRaptor ? undefined : 20,
        debug: r.debug,
      };
    });
  }

  /**
   * Graph RAG: expand hybrid search results by following code relationship edges.
   * For each of the top-5 result files, lookup its graph node and collect neighbours
   * (files connected via imports/calls/extends). Appends new files at a discounted score.
   * @param depth  1 = 1-hop, 2 = 2-hop (follows neighbors of neighbors for cross-file chains)
   */
  private async expandWithGraphNeighbors(results: SemanticResult[], projectPath: string, depth = 1): Promise<SemanticResult[]> {
    if (!this.graphStore || !this.projectId || results.length === 0) return results;
    try {
      // Load all file nodes for this project once and build a filePath → nodeId map
      const allFileNodes = await this.graphStore.findNodes(this.projectId, 'file');
      if (allFileNodes.length === 0) return results;

      const normalize = (p: string) => p.replace(/\\/g, '/');
      const filePathToNodeId = new Map<string, string>();
      for (const node of allFileNodes) {
        filePathToNodeId.set(normalize(node.filePath), node.id);
        const rel = normalize(path.relative(projectPath, node.filePath));
        if (rel && !rel.startsWith('..')) {
          filePathToNodeId.set(rel, node.id);
        }
      }

      const resolveNodeId = (filePath: string): string | undefined => {
        const relNorm = normalize(filePath);
        const absNorm = normalize(path.isAbsolute(filePath) ? filePath : path.join(projectPath, filePath));
        return filePathToNodeId.get(relNorm) || filePathToNodeId.get(absNorm);
      };

      const toRelNorm = (fp: string): string =>
        normalize(path.isAbsolute(fp) ? path.relative(projectPath, fp) : fp);

      const existingPaths = new Set(results.map(r => normalize(r.file)));

      // ── 1-hop: neighbors of top-10 results, scored per-source ────────────
      // Expanding from top-10 (not top-5) ensures files like role-executor at rank 7
      // contribute their neighbors even when not in the top 5.
      const HOP1_DECAY = 0.7;
      const TOP_K = Math.min(10, results.length);
      // Track max source-score for each neighbor (per-source scoring)
      const hop1BestScore = new Map<string, number>();

      for (const result of results.slice(0, TOP_K)) {
        const nodeId = resolveNodeId(result.file);
        if (!nodeId) continue;

        const neighbors = await this.graphStore.getNeighbors(nodeId);
        const sourceScore = result.similarity;
        for (const neighbor of neighbors) {
          if (neighbor.type !== 'file') continue;
          const rel = toRelNorm(neighbor.filePath);
          if (!existingPaths.has(rel)) {
            const derived = sourceScore * HOP1_DECAY;
            hop1BestScore.set(rel, Math.max(hop1BestScore.get(rel) ?? 0, derived));
          }
        }
      }

      // ── 2-hop: neighbors of 1-hop neighbors (cross-file chains) ──────────
      const HOP2_DECAY = 0.7;
      const hop2BestScore = new Map<string, number>();
      if (depth >= 2 && hop1BestScore.size > 0) {
        for (const [hop1Path, hop1Score] of hop1BestScore) {
          const nodeId = resolveNodeId(hop1Path);
          if (!nodeId) continue;

          const neighbors = await this.graphStore.getNeighbors(nodeId);
          for (const neighbor of neighbors) {
            if (neighbor.type !== 'file') continue;
            const rel = toRelNorm(neighbor.filePath);
            if (!existingPaths.has(rel) && !hop1BestScore.has(rel)) {
              const derived = hop1Score * HOP2_DECAY;
              hop2BestScore.set(rel, Math.max(hop2BestScore.get(rel) ?? 0, derived));
            }
          }
        }
      }

      if (hop1BestScore.size === 0 && hop2BestScore.size === 0) return results;

      const expanded: SemanticResult[] = [...results];
      for (const [p1, score] of hop1BestScore) {
        expanded.push({
          file: p1,
          type: this.determineFileType(p1),
          similarity: parseFloat(Math.max(0.05, score).toFixed(4)),
          content: '[Graph-related: connected via code relationships (imports/calls/extends)]',
          lineStart: undefined,
          lineEnd: undefined,
        });
      }
      for (const [p2, score] of hop2BestScore) {
        expanded.push({
          file: p2,
          type: this.determineFileType(p2),
          similarity: parseFloat(Math.max(0.04, score).toFixed(4)),
          content: '[Graph-related: 2-hop code relationship chain]',
          lineStart: undefined,
          lineEnd: undefined,
        });
      }

      this.logger.debug(`Graph RAG: appended ${hop1BestScore.size} 1-hop + ${hop2BestScore.size} 2-hop related files`);
      // Re-sort so graph neighbors don't violate the descending order invariant
      return expanded.sort((a, b) => b.similarity - a.similarity);
    } catch (error) {
      this.logger.debug(`Graph expansion error: ${error instanceof Error ? error.message : error}`);
      return results; // Graceful fallback — return hybrid results unchanged
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

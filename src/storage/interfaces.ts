/**
 * Storage Abstraction Interfaces
 *
 * Enables CodeMind to work with either:
 * - Embedded storage (SQLite + graphology + lru-cache) - zero setup, default
 * - Server storage (PostgreSQL + Neo4j + Redis) - optional, for production
 *
 * All implementations support disk persistence for durability.
 */

// ============================================================================
// Vector Store Interface
// ============================================================================

export interface VectorDocument {
  id: string;
  projectId: string;
  filePath: string;
  content: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface VectorSearchResult {
  document: VectorDocument;
  score: number;
  matchType: 'vector' | 'fts' | 'hybrid';
  /** Debug info for verbose mode - score breakdown by source */
  debug?: {
    vectorScore: number;      // Semantic similarity (cosine similarity 0-1)
    textScore: number;        // Inverted index score (MiniSearch BM25, 0-20+)
    pathMatch: boolean;       // Whether file path matched query terms
    matchSource: string;      // e.g., "semantic+text+path", "text", "semantic"
  };
}

export interface IVectorStore {
  /** Store or update a document with its embedding */
  upsert(doc: Omit<VectorDocument, 'createdAt' | 'updatedAt'>): Promise<void>;

  /** Bulk upsert for efficiency */
  upsertMany(docs: Array<Omit<VectorDocument, 'createdAt' | 'updatedAt'>>): Promise<void>;

  /** Search by vector similarity */
  searchByVector(embedding: number[], projectId: string, limit?: number): Promise<VectorSearchResult[]>;

  /** Search by full-text query */
  searchByText(query: string, projectId: string, limit?: number): Promise<VectorSearchResult[]>;

  /** Hybrid search (vector + FTS with RRF fusion) */
  searchHybrid(query: string, embedding: number[], projectId: string, limit?: number): Promise<VectorSearchResult[]>;

  /** Delete documents for a project */
  deleteByProject(projectId: string): Promise<number>;

  /** Delete a specific document */
  delete(id: string): Promise<boolean>;

  /** Get document/chunk count for a project */
  count(projectId: string): Promise<number>;

  /** Get unique file count for a project */
  countFiles(projectId: string): Promise<number>;

  /** Get stored file metadata for change detection (hash + mtime) */
  getFileMetadata(projectId: string, filePath: string): Promise<{ fileHash: string; indexedAt: string } | null>;

  /** Persist to disk (for embedded mode) */
  flush(): Promise<void>;

  /** Close connections and cleanup */
  close(): Promise<void>;
}

// ============================================================================
// Graph Store Interface
// ============================================================================

export interface GraphNode {
  id: string;
  type: 'file' | 'class' | 'function' | 'method' | 'variable' | 'import' | 'export';
  name: string;
  filePath: string;
  projectId: string;
  properties?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'imports' | 'exports' | 'calls' | 'extends' | 'implements' | 'contains' | 'uses' | 'depends_on';
  properties?: Record<string, unknown>;
}

export interface GraphQueryResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface IGraphStore {
  /** Add or update a node */
  upsertNode(node: GraphNode): Promise<void>;

  /** Add or update an edge */
  upsertEdge(edge: GraphEdge): Promise<void>;

  /** Bulk operations */
  upsertNodes(nodes: GraphNode[]): Promise<void>;
  upsertEdges(edges: GraphEdge[]): Promise<void>;

  /** Find nodes by type and project */
  findNodes(projectId: string, type?: GraphNode['type']): Promise<GraphNode[]>;

  /** Find node by ID */
  getNode(id: string): Promise<GraphNode | null>;

  /** Get edges from/to a node */
  getEdges(nodeId: string, direction?: 'in' | 'out' | 'both'): Promise<GraphEdge[]>;

  /** Find related nodes (1-hop neighbors) */
  getNeighbors(nodeId: string, edgeType?: GraphEdge['type']): Promise<GraphNode[]>;

  /** Find path between nodes */
  findPath(sourceId: string, targetId: string, maxDepth?: number): Promise<GraphNode[]>;

  /** Delete all nodes/edges for a project */
  deleteByProject(projectId: string): Promise<number>;

  /** Get node count for a project */
  countNodes(projectId: string): Promise<number>;

  /** Persist to disk (for embedded mode) */
  flush(): Promise<void>;

  /** Close and cleanup */
  close(): Promise<void>;
}

// ============================================================================
// Cache Store Interface
// ============================================================================

export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  expiresAt?: Date;
  tags?: string[];
}

export interface ICacheStore {
  /** Get a cached value */
  get<T>(key: string): Promise<T | null>;

  /** Set a value with optional TTL (seconds) */
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;

  /** Delete a cached value */
  delete(key: string): Promise<boolean>;

  /** Check if key exists */
  has(key: string): Promise<boolean>;

  /** Delete all keys matching a pattern */
  deletePattern(pattern: string): Promise<number>;

  /** Delete all keys with a specific tag */
  deleteByTag(tag: string): Promise<number>;

  /** Clear entire cache */
  clear(): Promise<void>;

  /** Get cache statistics */
  stats(): Promise<{ size: number; hits: number; misses: number }>;

  /** Persist to disk (for embedded mode) */
  flush(): Promise<void>;

  /** Close and cleanup */
  close(): Promise<void>;
}

// ============================================================================
// Project Store Interface (relational data)
// ============================================================================

export interface Project {
  id: string;
  name: string;
  path: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface IProjectStore {
  /** Create or update a project */
  upsert(project: Omit<Project, 'createdAt' | 'updatedAt'>): Promise<Project>;

  /** Find project by path */
  findByPath(path: string): Promise<Project | null>;

  /** Find project by ID */
  findById(id: string): Promise<Project | null>;

  /** List all projects */
  list(): Promise<Project[]>;

  /** Delete a project and all related data */
  delete(id: string): Promise<boolean>;

  /** Persist to disk */
  flush(): Promise<void>;

  /** Close and cleanup */
  close(): Promise<void>;
}

// ============================================================================
// Text Store Interface (Full-Text Search)
// ============================================================================

export interface TextDocument {
  id: string;
  projectId: string;
  filePath: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface TextSearchResult {
  document: TextDocument;
  score: number;
  matchedTerms: string[];
}

export interface Synonym {
  term: string;
  synonyms: string[];
  projectId?: string; // null = global synonyms
}

export interface ITextStore {
  /** Index a document for full-text search */
  index(doc: TextDocument): Promise<void>;

  /** Bulk index documents */
  indexMany(docs: TextDocument[]): Promise<void>;

  /** Search by text query with BM25 scoring */
  search(query: string, projectId: string, limit?: number): Promise<TextSearchResult[]>;

  /** Search with synonym expansion */
  searchWithSynonyms(query: string, projectId: string, limit?: number): Promise<TextSearchResult[]>;

  /** Remove a document from the index */
  remove(id: string): Promise<boolean>;

  /** Remove all documents for a project */
  removeByProject(projectId: string): Promise<number>;

  /** Add a synonym mapping */
  addSynonym(term: string, synonyms: string[], projectId?: string): Promise<void>;

  /** Remove a synonym mapping */
  removeSynonym(term: string, projectId?: string): Promise<boolean>;

  /** Get all synonyms */
  getSynonyms(projectId?: string): Promise<Synonym[]>;

  /** Clear all synonyms */
  clearSynonyms(projectId?: string): Promise<void>;

  /** Get document count */
  count(projectId: string): Promise<number>;

  /** Persist to disk (for embedded mode) */
  flush(): Promise<void>;

  /** Close and cleanup */
  close(): Promise<void>;
}

// ============================================================================
// Storage Provider Interface (factory)
// ============================================================================

export type StorageMode = 'embedded' | 'server';

export interface StorageConfig {
  mode: StorageMode;

  /** Directory for embedded storage files (default: ~/.codemind/data) */
  dataDir?: string;

  /** Flush interval in seconds (default: 30) */
  flushIntervalSeconds?: number;

  /** Server configuration (only used when mode === 'server') */
  server?: {
    postgres?: {
      host: string;
      port: number;
      database: string;
      user: string;
      password: string;
    };
    neo4j?: {
      uri: string;
      user: string;
      password: string;
    };
    redis?: {
      host: string;
      port: number;
      password?: string;
    };
  };
}

export interface IStorageProvider {
  /** Get the vector store */
  getVectorStore(): IVectorStore;

  /** Get the graph store */
  getGraphStore(): IGraphStore;

  /** Get the cache store */
  getCacheStore(): ICacheStore;

  /** Get the project store */
  getProjectStore(): IProjectStore;

  /** Get the text store (full-text search) */
  getTextStore(): ITextStore;

  /** Get current storage mode */
  getMode(): StorageMode;

  /** Persist all stores to disk */
  flushAll(): Promise<void>;

  /** Close all connections */
  closeAll(): Promise<void>;

  /** Check if storage is healthy */
  healthCheck(): Promise<{ healthy: boolean; details: Record<string, boolean> }>;
}
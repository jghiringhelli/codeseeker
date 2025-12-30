/**
 * Redis File Change Sync Service
 *
 * Detects file changes and triggers automatic reindexing across all databases:
 * - PostgreSQL: files, chunks, FTS, vectors (semantic_search_embeddings)
 * - Neo4j: triads/relationships (File, Class, Function nodes)
 * - Redis: hash tracking, query cache invalidation
 *
 * Also provides query result caching with optional vector-based similarity detection.
 */

import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import Redis from 'ioredis';
import { Logger } from '../utils/logger';
import { DatabaseConnections } from '../config/database-config';

// ============================================
// INTERFACES
// ============================================

export interface FileChangeInfo {
  filePath: string;
  absolutePath: string;
  changeType: 'new' | 'modified' | 'deleted';
  oldHash?: string;
  newHash?: string;
  lastModified: number;
  size: number;
}

export interface SyncStatus {
  projectId: string;
  lastSyncTime: number;
  filesChecked: number;
  changesDetected: number;
  reindexedPostgres: number;
  reindexedNeo4j: number;
  cacheInvalidated: number;
  duration: number;
}

export interface QueryCacheEntry {
  query: string;
  queryVector?: number[];
  results: any[];
  cachedAt: number;
  hitCount: number;
  projectId: string;
}

export interface ReindexOptions {
  updateEmbeddings?: boolean;
  updateNeo4j?: boolean;
  invalidateCache?: boolean;
  batchSize?: number;
}

// ============================================
// MAIN SERVICE
// ============================================

export class RedisFileChangeSyncService {
  private redis: Redis | null = null;
  private logger = Logger.getInstance();
  private dbConnections: DatabaseConnections;
  private embeddingService: any = null;

  // Redis key prefixes
  private readonly FILE_HASH_PREFIX = 'codemind:filehash:';
  private readonly QUERY_CACHE_PREFIX = 'codemind:querycache:';
  private readonly SYNC_META_PREFIX = 'codemind:syncmeta:';
  private readonly PENDING_CHANGES_PREFIX = 'codemind:pending:';

  // Configuration
  private readonly QUERY_CACHE_TTL = 3600; // 1 hour
  private readonly FILE_HASH_TTL = 86400 * 30; // 30 days
  private readonly SIMILARITY_THRESHOLD = 0.95; // For query deduplication

  constructor(dbConnections?: DatabaseConnections) {
    this.dbConnections = dbConnections || new DatabaseConnections();
  }

  // ============================================
  // REDIS CONNECTION
  // ============================================

  private async getRedis(): Promise<Redis> {
    if (!this.redis) {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        connectTimeout: 5000
      });

      this.redis.on('error', () => {
        // Silent - handled by caller
      });

      await this.redis.connect();
    }
    return this.redis;
  }

  // ============================================
  // FILE CHANGE DETECTION
  // ============================================

  /**
   * Detect all file changes for a project
   */
  async detectFileChanges(
    projectId: string,
    projectPath: string,
    fileExtensions: string[] = ['.ts', '.js', '.py', '.java', '.cs', '.go', '.rs']
  ): Promise<FileChangeInfo[]> {
    const redis = await this.getRedis();
    const changes: FileChangeInfo[] = [];

    // Get current files on disk
    const currentFiles = await this.scanProjectFiles(projectPath, fileExtensions);
    const currentFilePaths = new Set(currentFiles.map(f => f.relativePath));

    // Get stored file hashes from Redis
    const storedHashes = await this.getStoredFileHashes(projectId);
    const storedFilePaths = new Set(Object.keys(storedHashes));

    // Check for new and modified files
    for (const file of currentFiles) {
      const stored = storedHashes[file.relativePath];

      if (!stored) {
        // New file
        changes.push({
          filePath: file.relativePath,
          absolutePath: file.absolutePath,
          changeType: 'new',
          newHash: file.hash,
          lastModified: file.lastModified,
          size: file.size
        });
      } else if (stored.hash !== file.hash) {
        // Modified file
        changes.push({
          filePath: file.relativePath,
          absolutePath: file.absolutePath,
          changeType: 'modified',
          oldHash: stored.hash,
          newHash: file.hash,
          lastModified: file.lastModified,
          size: file.size
        });
      }
    }

    // Check for deleted files
    for (const storedPath of storedFilePaths) {
      if (!currentFilePaths.has(storedPath)) {
        changes.push({
          filePath: storedPath,
          absolutePath: path.join(projectPath, storedPath),
          changeType: 'deleted',
          oldHash: storedHashes[storedPath].hash,
          lastModified: Date.now(),
          size: 0
        });
      }
    }

    this.logger.info(`Detected ${changes.length} file changes for project ${projectId}`);
    return changes;
  }

  /**
   * Scan project files and compute hashes
   */
  private async scanProjectFiles(
    projectPath: string,
    extensions: string[]
  ): Promise<{ relativePath: string; absolutePath: string; hash: string; lastModified: number; size: number }[]> {
    const files: { relativePath: string; absolutePath: string; hash: string; lastModified: number; size: number }[] = [];

    const scanDir = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(projectPath, fullPath);

          // Skip common ignored directories
          if (entry.isDirectory()) {
            if (!['node_modules', 'dist', '.git', '.next', 'build', 'coverage', '__pycache__'].includes(entry.name) &&
                !entry.name.startsWith('.')) {
              await scanDir(fullPath);
            }
          } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
            try {
              const content = await fs.readFile(fullPath, 'utf-8');
              const stats = await fs.stat(fullPath);
              const hash = crypto.createHash('sha256').update(content).digest('hex');

              files.push({
                relativePath,
                absolutePath: fullPath,
                hash,
                lastModified: stats.mtime.getTime(),
                size: stats.size
              });
            } catch {
              // Skip files we can't read
            }
          }
        }
      } catch {
        // Skip directories we can't read
      }
    };

    await scanDir(projectPath);
    return files;
  }

  /**
   * Get stored file hashes from Redis
   */
  private async getStoredFileHashes(projectId: string): Promise<Record<string, { hash: string; lastSync: number }>> {
    const redis = await this.getRedis();
    const key = `${this.FILE_HASH_PREFIX}${projectId}`;
    const data = await redis.hgetall(key);

    const hashes: Record<string, { hash: string; lastSync: number }> = {};
    for (const [filePath, value] of Object.entries(data)) {
      try {
        hashes[filePath] = JSON.parse(value);
      } catch {
        hashes[filePath] = { hash: value, lastSync: 0 };
      }
    }

    return hashes;
  }

  /**
   * Update file hash in Redis after successful reindex
   */
  private async updateFileHash(projectId: string, filePath: string, hash: string): Promise<void> {
    const redis = await this.getRedis();
    const key = `${this.FILE_HASH_PREFIX}${projectId}`;
    const value = JSON.stringify({ hash, lastSync: Date.now() });
    await redis.hset(key, filePath, value);
    await redis.expire(key, this.FILE_HASH_TTL);
  }

  /**
   * Remove file hash from Redis (for deleted files)
   */
  private async removeFileHash(projectId: string, filePath: string): Promise<void> {
    const redis = await this.getRedis();
    const key = `${this.FILE_HASH_PREFIX}${projectId}`;
    await redis.hdel(key, filePath);
  }

  // ============================================
  // AUTOMATIC REINDEXING
  // ============================================

  /**
   * Main sync method - detect changes and reindex
   */
  async syncProject(
    projectId: string,
    projectPath: string,
    options: ReindexOptions = {}
  ): Promise<SyncStatus> {
    const startTime = Date.now();
    const opts = {
      updateEmbeddings: true,
      updateNeo4j: true,
      invalidateCache: true,
      batchSize: 10,
      ...options
    };

    this.logger.info(`Starting sync for project ${projectId}`);

    // Detect changes
    const changes = await this.detectFileChanges(projectId, projectPath);

    let reindexedPostgres = 0;
    let reindexedNeo4j = 0;
    let cacheInvalidated = 0;

    if (changes.length === 0) {
      this.logger.info('No changes detected');
      return {
        projectId,
        lastSyncTime: Date.now(),
        filesChecked: 0,
        changesDetected: 0,
        reindexedPostgres: 0,
        reindexedNeo4j: 0,
        cacheInvalidated: 0,
        duration: Date.now() - startTime
      };
    }

    // Process changes in batches
    const newAndModified = changes.filter(c => c.changeType !== 'deleted');
    const deleted = changes.filter(c => c.changeType === 'deleted');

    // Reindex PostgreSQL (embeddings, chunks, FTS)
    if (opts.updateEmbeddings && newAndModified.length > 0) {
      reindexedPostgres = await this.reindexPostgres(projectId, projectPath, newAndModified, opts.batchSize);
    }

    // Reindex Neo4j (graph relationships)
    if (opts.updateNeo4j && newAndModified.length > 0) {
      reindexedNeo4j = await this.reindexNeo4j(projectId, projectPath, newAndModified);
    }

    // Handle deletions
    if (deleted.length > 0) {
      await this.handleDeletedFiles(projectId, deleted);
    }

    // Invalidate query cache
    if (opts.invalidateCache) {
      cacheInvalidated = await this.invalidateQueryCache(projectId);
    }

    // Update file hashes in Redis
    for (const change of newAndModified) {
      if (change.newHash) {
        await this.updateFileHash(projectId, change.filePath, change.newHash);
      }
    }

    // Update sync metadata
    await this.updateSyncMetadata(projectId, {
      lastSyncTime: Date.now(),
      changesProcessed: changes.length
    });

    const status: SyncStatus = {
      projectId,
      lastSyncTime: Date.now(),
      filesChecked: newAndModified.length + deleted.length,
      changesDetected: changes.length,
      reindexedPostgres,
      reindexedNeo4j,
      cacheInvalidated,
      duration: Date.now() - startTime
    };

    this.logger.info(`Sync complete: ${JSON.stringify(status)}`);
    return status;
  }

  /**
   * Reindex files in PostgreSQL
   */
  private async reindexPostgres(
    projectId: string,
    projectPath: string,
    changes: FileChangeInfo[],
    batchSize: number
  ): Promise<number> {
    let reindexed = 0;

    try {
      const postgres = await this.dbConnections.getPostgresConnection();

      // Initialize embedding service if not already done
      if (!this.embeddingService) {
        try {
          const { EmbeddingService } = await import('../cli/services/data/embedding/embedding-service');
          this.embeddingService = new EmbeddingService({
            provider: 'xenova',
            model: 'Xenova/all-MiniLM-L6-v2',
            batchSize: 32
          });
        } catch {
          this.logger.warn('EmbeddingService not available, skipping vector updates');
        }
      }

      // Process in batches
      for (let i = 0; i < changes.length; i += batchSize) {
        const batch = changes.slice(i, i + batchSize);

        for (const change of batch) {
          try {
            const content = await fs.readFile(change.absolutePath, 'utf-8');
            const hash = crypto.createHash('sha256').update(content).digest('hex');

            // Generate embedding if service is available
            let embedding: number[] | null = null;
            if (this.embeddingService) {
              try {
                await this.embeddingService.embeddingProvider?.initialize?.();
                embedding = await this.embeddingService.generateEmbedding(content, change.filePath);
              } catch {
                // Continue without embedding
              }
            }

            // Extract metadata
            const classes = this.extractClasses(content);
            const functions = this.extractFunctions(content);
            const imports = this.extractImports(content);
            const metadata = { classes, functions: functions.slice(0, 20), imports };

            // Upsert into semantic_search_embeddings
            if (embedding && embedding.length > 0) {
              const vectorString = `[${embedding.join(',')}]`;
              await postgres.query(`
                INSERT INTO semantic_search_embeddings (
                  chunk_id, project_id, file_path, content_text, chunk_start_line, chunk_end_line,
                  chunk_index, is_full_file, content_hash, metadata, embedding, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::vector, NOW())
                ON CONFLICT (project_id, chunk_id) DO UPDATE SET
                  content_text = EXCLUDED.content_text,
                  content_hash = EXCLUDED.content_hash,
                  metadata = EXCLUDED.metadata,
                  embedding = EXCLUDED.embedding,
                  updated_at = NOW()
              `, [
                `${projectId}:${change.filePath}:0`,
                projectId,
                change.filePath,
                content.substring(0, 10000),
                1,
                content.split('\n').length,
                0,
                true,
                hash,
                JSON.stringify(metadata),
                vectorString
              ]);
            } else {
              // Update without embedding
              await postgres.query(`
                INSERT INTO semantic_search_embeddings (
                  chunk_id, project_id, file_path, content_text, chunk_start_line, chunk_end_line,
                  chunk_index, is_full_file, content_hash, metadata, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
                ON CONFLICT (project_id, chunk_id) DO UPDATE SET
                  content_text = EXCLUDED.content_text,
                  content_hash = EXCLUDED.content_hash,
                  metadata = EXCLUDED.metadata,
                  updated_at = NOW()
              `, [
                `${projectId}:${change.filePath}:0`,
                projectId,
                change.filePath,
                content.substring(0, 10000),
                1,
                content.split('\n').length,
                0,
                true,
                hash,
                JSON.stringify(metadata)
              ]);
            }

            reindexed++;

          } catch (err) {
            this.logger.warn(`Failed to reindex ${change.filePath}: ${err}`);
          }
        }
      }

    } catch (err) {
      this.logger.error(`PostgreSQL reindex failed: ${err}`);
    }

    return reindexed;
  }

  /**
   * Reindex files in Neo4j
   */
  private async reindexNeo4j(
    projectId: string,
    projectPath: string,
    changes: FileChangeInfo[]
  ): Promise<number> {
    let reindexed = 0;

    try {
      const neo4j = await this.dbConnections.getNeo4jConnection();
      const session = neo4j.session();

      try {
        for (const change of changes) {
          try {
            const content = await fs.readFile(change.absolutePath, 'utf-8');
            const fileName = path.basename(change.filePath);
            const fileType = this.determineFileType(change.filePath);
            const hash = crypto.createHash('sha256').update(content).digest('hex');

            // Create or update file node
            await session.run(`
              MERGE (f:File {path: $path, projectId: $projectId})
              ON CREATE SET
                f.name = $name,
                f.type = $type,
                f.hash = $hash,
                f.createdAt = datetime(),
                f.updatedAt = datetime()
              ON MATCH SET
                f.hash = $hash,
                f.updatedAt = datetime()
            `, {
              path: change.filePath,
              projectId,
              name: fileName,
              type: fileType,
              hash
            });

            // Extract and create class nodes with relationships
            const classes = this.extractClasses(content);
            for (const className of classes) {
              await session.run(`
                MERGE (c:Class {name: $className, projectId: $projectId})
                ON CREATE SET c.createdAt = datetime()
                SET c.updatedAt = datetime()
                WITH c
                MATCH (f:File {path: $filePath, projectId: $projectId})
                MERGE (f)-[:DEFINES]->(c)
              `, {
                className,
                projectId,
                filePath: change.filePath
              });
            }

            // Extract and create function nodes
            const functions = this.extractFunctions(content);
            for (const funcName of functions.slice(0, 30)) {
              await session.run(`
                MERGE (fn:Function {name: $funcName, filePath: $filePath, projectId: $projectId})
                ON CREATE SET fn.createdAt = datetime()
                SET fn.updatedAt = datetime()
                WITH fn
                MATCH (f:File {path: $filePath, projectId: $projectId})
                MERGE (f)-[:CONTAINS]->(fn)
              `, {
                funcName,
                projectId,
                filePath: change.filePath
              });
            }

            // Create import relationships
            const imports = this.extractImports(content);
            for (const importPath of imports) {
              await session.run(`
                MATCH (f1:File {path: $filePath, projectId: $projectId})
                MERGE (f2:File {path: $importPath, projectId: $projectId})
                ON CREATE SET f2.createdAt = datetime(), f2.type = 'dependency'
                MERGE (f1)-[:IMPORTS]->(f2)
              `, {
                filePath: change.filePath,
                importPath,
                projectId
              });
            }

            reindexed++;

          } catch (err) {
            this.logger.warn(`Failed to reindex ${change.filePath} in Neo4j: ${err}`);
          }
        }
      } finally {
        await session.close();
      }

    } catch (err) {
      this.logger.warn(`Neo4j reindex skipped (connection unavailable): ${err}`);
    }

    return reindexed;
  }

  /**
   * Handle deleted files - remove from all databases
   */
  private async handleDeletedFiles(projectId: string, deleted: FileChangeInfo[]): Promise<void> {
    // Remove from PostgreSQL
    try {
      const postgres = await this.dbConnections.getPostgresConnection();
      for (const file of deleted) {
        await postgres.query(
          'DELETE FROM semantic_search_embeddings WHERE project_id = $1 AND file_path = $2',
          [projectId, file.filePath]
        );
      }
    } catch (err) {
      this.logger.warn(`PostgreSQL deletion failed: ${err}`);
    }

    // Remove from Neo4j
    try {
      const neo4j = await this.dbConnections.getNeo4jConnection();
      const session = neo4j.session();
      try {
        for (const file of deleted) {
          await session.run(`
            MATCH (f:File {path: $path, projectId: $projectId})
            OPTIONAL MATCH (f)-[r]-()
            DELETE r, f
          `, { path: file.filePath, projectId });
        }
      } finally {
        await session.close();
      }
    } catch (err) {
      this.logger.warn(`Neo4j deletion skipped: ${err}`);
    }

    // Remove from Redis
    for (const file of deleted) {
      await this.removeFileHash(projectId, file.filePath);
    }

    this.logger.info(`Removed ${deleted.length} deleted files from all databases`);
  }

  // ============================================
  // QUERY CACHING
  // ============================================

  /**
   * Get cached query result
   */
  async getCachedQueryResult(
    projectId: string,
    query: string,
    queryVector?: number[]
  ): Promise<any[] | null> {
    const redis = await this.getRedis();

    // Try exact match first
    const exactKey = `${this.QUERY_CACHE_PREFIX}${projectId}:${this.hashQuery(query)}`;
    const exactResult = await redis.get(exactKey);

    if (exactResult) {
      const entry: QueryCacheEntry = JSON.parse(exactResult);
      // Update hit count
      entry.hitCount++;
      await redis.set(exactKey, JSON.stringify(entry), 'EX', this.QUERY_CACHE_TTL);
      this.logger.debug(`Query cache hit (exact): ${query.substring(0, 50)}...`);
      return entry.results;
    }

    // Try vector similarity if vector is provided
    if (queryVector && queryVector.length > 0) {
      const similarResult = await this.findSimilarCachedQuery(projectId, queryVector);
      if (similarResult) {
        this.logger.debug(`Query cache hit (similar): ${query.substring(0, 50)}...`);
        return similarResult;
      }
    }

    return null;
  }

  /**
   * Cache query result
   */
  async cacheQueryResult(
    projectId: string,
    query: string,
    results: any[],
    queryVector?: number[]
  ): Promise<void> {
    const redis = await this.getRedis();

    const entry: QueryCacheEntry = {
      query,
      queryVector,
      results,
      cachedAt: Date.now(),
      hitCount: 0,
      projectId
    };

    const key = `${this.QUERY_CACHE_PREFIX}${projectId}:${this.hashQuery(query)}`;
    await redis.set(key, JSON.stringify(entry), 'EX', this.QUERY_CACHE_TTL);

    this.logger.debug(`Cached query result: ${query.substring(0, 50)}...`);
  }

  /**
   * Find similar cached query using vector similarity
   */
  private async findSimilarCachedQuery(projectId: string, queryVector: number[]): Promise<any[] | null> {
    const redis = await this.getRedis();

    // Get all cached queries for this project
    const pattern = `${this.QUERY_CACHE_PREFIX}${projectId}:*`;
    const keys = await redis.keys(pattern);

    let bestMatch: { entry: QueryCacheEntry; similarity: number } | null = null;

    for (const key of keys) {
      const data = await redis.get(key);
      if (!data) continue;

      try {
        const entry: QueryCacheEntry = JSON.parse(data);
        if (!entry.queryVector || entry.queryVector.length === 0) continue;

        const similarity = this.cosineSimilarity(queryVector, entry.queryVector);

        if (similarity >= this.SIMILARITY_THRESHOLD) {
          if (!bestMatch || similarity > bestMatch.similarity) {
            bestMatch = { entry, similarity };
          }
        }
      } catch {
        // Skip invalid entries
      }
    }

    if (bestMatch) {
      // Update hit count
      bestMatch.entry.hitCount++;
      const key = `${this.QUERY_CACHE_PREFIX}${projectId}:${this.hashQuery(bestMatch.entry.query)}`;
      await redis.set(key, JSON.stringify(bestMatch.entry), 'EX', this.QUERY_CACHE_TTL);
      return bestMatch.entry.results;
    }

    return null;
  }

  /**
   * Invalidate query cache for a project
   */
  async invalidateQueryCache(projectId: string): Promise<number> {
    const redis = await this.getRedis();
    const pattern = `${this.QUERY_CACHE_PREFIX}${projectId}:*`;
    const keys = await redis.keys(pattern);

    if (keys.length > 0) {
      await redis.del(...keys);
    }

    this.logger.info(`Invalidated ${keys.length} cached queries for project ${projectId}`);
    return keys.length;
  }

  /**
   * Generate embedding for query (for similarity caching)
   */
  async generateQueryVector(query: string): Promise<number[] | null> {
    if (!this.embeddingService) {
      try {
        const { EmbeddingService } = await import('../cli/services/data/embedding/embedding-service');
        this.embeddingService = new EmbeddingService({
          provider: 'xenova',
          model: 'Xenova/all-MiniLM-L6-v2'
        });
      } catch {
        return null;
      }
    }

    try {
      await this.embeddingService.embeddingProvider?.initialize?.();
      return await this.embeddingService.generateEmbedding(query);
    } catch {
      return null;
    }
  }

  // ============================================
  // SYNC METADATA
  // ============================================

  private async updateSyncMetadata(projectId: string, metadata: Record<string, any>): Promise<void> {
    const redis = await this.getRedis();
    const key = `${this.SYNC_META_PREFIX}${projectId}`;
    await redis.hmset(key, {
      ...metadata,
      updatedAt: Date.now().toString()
    });
  }

  async getSyncMetadata(projectId: string): Promise<Record<string, string>> {
    const redis = await this.getRedis();
    const key = `${this.SYNC_META_PREFIX}${projectId}`;
    return await redis.hgetall(key);
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private hashQuery(query: string): string {
    return crypto.createHash('md5').update(query.toLowerCase().trim()).digest('hex');
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  private extractClasses(content: string): string[] {
    const matches = content.match(/class\s+(\w+)/g) || [];
    return matches.map(m => m.replace('class ', ''));
  }

  private extractFunctions(content: string): string[] {
    const functionRegex = /(?:function\s+(\w+)|(\w+)\s*=\s*(?:async\s*)?\()/g;
    const matches: string[] = [];
    let match;

    while ((match = functionRegex.exec(content)) !== null) {
      const name = match[1] || match[2];
      if (name && !['if', 'for', 'while', 'switch', 'catch', 'constructor'].includes(name)) {
        matches.push(name);
      }
    }

    return [...new Set(matches)];
  }

  private extractImports(content: string): string[] {
    const importRegex = /import.*?from\s+['"]([^'"]+)['"]/g;
    const imports: string[] = [];
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      if (match[1].startsWith('.')) {
        imports.push(match[1]);
      }
    }

    return imports;
  }

  private determineFileType(filePath: string): string {
    const fileName = path.basename(filePath).toLowerCase();

    if (fileName.includes('controller')) return 'controller';
    if (fileName.includes('service')) return 'service';
    if (fileName.includes('manager')) return 'manager';
    if (fileName.includes('handler')) return 'handler';
    if (fileName.includes('middleware')) return 'middleware';
    if (fileName.includes('model')) return 'model';
    if (fileName.includes('test') || fileName.includes('spec')) return 'test';
    if (fileName.includes('config')) return 'configuration';
    if (fileName.includes('util') || fileName.includes('helper')) return 'utility';

    return 'module';
  }

  // ============================================
  // CLEANUP
  // ============================================

  async cleanup(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }

    if (this.embeddingService) {
      await this.embeddingService.cleanup?.();
      this.embeddingService = null;
    }

    await this.dbConnections.closeAll();
  }
}

export default RedisFileChangeSyncService;
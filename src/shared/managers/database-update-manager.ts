/**
 * Database Update Manager
 * SOLID Principles: Single Responsibility - Handle database updates across all systems
 *
 * This manager coordinates updates to:
 * - Vector Store (semantic search embeddings) - SQLite or PostgreSQL
 * - Graph Store (knowledge graph relationships) - Graphology or Neo4j
 * - Cache Store (caching layer) - LRU-cache or Redis
 *
 * Uses storage abstraction to work with either embedded or server mode.
 * Used after each Claude Code execution to keep databases in sync with code changes.
 */

import { Logger } from '../logger';
import { DatabaseConnections } from '../../config/database-config';
import { getStorageManager, isUsingEmbeddedStorage } from '../../storage';
import type { IVectorStore, IGraphStore, ICacheStore, IProjectStore } from '../../storage/interfaces';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

export interface GraphUpdateResult {
  nodesCreated: number;
  nodesUpdated: number;
  relationshipsCreated: number;
}

export interface CacheUpdateResult {
  filesUpdated: number;
  hashesUpdated: number;
}

export interface DatabaseUpdateResult {
  recordsUpdated: number;
  recordsInserted: number;
}

export class DatabaseUpdateManager {
  private logger = Logger.getInstance();
  private dbConnections: DatabaseConnections;
  private projectId: string;
  private projectPath: string;
  private useEmbedded: boolean;

  // Cached storage interfaces
  private vectorStore?: IVectorStore;
  private graphStore?: IGraphStore;
  private cacheStore?: ICacheStore;
  private projectStore?: IProjectStore;

  constructor(projectId?: string, projectPath?: string) {
    this.dbConnections = new DatabaseConnections();
    this.projectId = projectId || 'default';
    this.projectPath = projectPath || process.cwd();
    this.useEmbedded = isUsingEmbeddedStorage();
  }

  /**
   * Initialize storage interfaces (lazy loading)
   */
  private async initStorage(): Promise<void> {
    if (this.vectorStore) return; // Already initialized

    const storageManager = await getStorageManager();
    this.vectorStore = storageManager.getVectorStore();
    this.graphStore = storageManager.getGraphStore();
    this.cacheStore = storageManager.getCacheStore();
    this.projectStore = storageManager.getProjectStore();
  }

  /**
   * Set project context for updates
   */
  setProject(projectId: string, projectPath: string): void {
    this.projectId = projectId;
    this.projectPath = projectPath;
  }

  // ============================================
  // GRAPH DATABASE OPERATIONS
  // ============================================

  /**
   * Update graph with new/modified file nodes and relationships
   * Uses storage abstraction - embedded uses Graphology, server uses Neo4j
   */
  async updateGraphDatabase(files: string[]): Promise<{ nodesCreated: number; relationshipsCreated: number }> {
    this.logger.debug(`Updating graph database for ${files.length} files`);

    // Use embedded storage if available
    if (this.useEmbedded) {
      return this.updateGraphDatabaseEmbedded(files);
    }

    // Server mode: use Neo4j directly
    return this.updateGraphDatabaseNeo4j(files);
  }

  /**
   * Embedded mode: Update graph using Graphology store
   */
  private async updateGraphDatabaseEmbedded(files: string[]): Promise<{ nodesCreated: number; relationshipsCreated: number }> {
    await this.initStorage();
    if (!this.graphStore) return { nodesCreated: 0, relationshipsCreated: 0 };

    let nodesCreated = 0;
    let relationshipsCreated = 0;

    try {
      for (const filePath of files) {
        const absolutePath = path.isAbsolute(filePath)
          ? filePath
          : path.join(this.projectPath, filePath);

        try {
          await fs.access(absolutePath);
        } catch {
          continue;
        }

        const content = await fs.readFile(absolutePath, 'utf-8');
        const fileName = path.basename(filePath);
        const fileId = `file:${this.projectId}:${filePath}`;

        // Create file node
        await this.graphStore.upsertNode({
          id: fileId,
          type: 'file',
          name: fileName,
          filePath: filePath,
          projectId: this.projectId,
          properties: { hash: this.computeHash(content) }
        });
        nodesCreated++;

        // Extract classes and create nodes + relationships
        const classes = this.extractClasses(content);
        for (const className of classes) {
          const classId = `class:${this.projectId}:${className}`;
          await this.graphStore.upsertNode({
            id: classId,
            type: 'class',
            name: className,
            filePath: filePath,
            projectId: this.projectId
          });
          nodesCreated++;

          await this.graphStore.upsertEdge({
            id: `edge:${fileId}:contains:${classId}`,
            source: fileId,
            target: classId,
            type: 'contains'
          });
          relationshipsCreated++;
        }

        // Extract imports and create relationships
        const imports = this.extractImports(content);
        for (const importPath of imports) {
          const importFileId = `file:${this.projectId}:${importPath}`;
          await this.graphStore.upsertEdge({
            id: `edge:${fileId}:imports:${importFileId}`,
            source: fileId,
            target: importFileId,
            type: 'imports'
          });
          relationshipsCreated++;
        }
      }

      await this.graphStore.flush();
      this.logger.debug(`Graph updated: ${nodesCreated} nodes, ${relationshipsCreated} relationships`);
      return { nodesCreated, relationshipsCreated };

    } catch (error) {
      this.logger.debug(`Graph update error: ${error instanceof Error ? error.message : error}`);
      return { nodesCreated: 0, relationshipsCreated: 0 };
    }
  }

  /**
   * Server mode: Update graph using Neo4j
   */
  private async updateGraphDatabaseNeo4j(files: string[]): Promise<{ nodesCreated: number; relationshipsCreated: number }> {
    let nodesCreated = 0;
    let relationshipsCreated = 0;

    try {
      const neo4j = await this.dbConnections.getNeo4jConnection();
      const session = neo4j.session();

      try {
        for (const filePath of files) {
          const absolutePath = path.isAbsolute(filePath)
            ? filePath
            : path.join(this.projectPath, filePath);

          try {
            await fs.access(absolutePath);
          } catch {
            continue;
          }

          const content = await fs.readFile(absolutePath, 'utf-8');
          const fileHash = this.computeHash(content);
          const fileName = path.basename(filePath);
          const fileType = this.determineFileType(filePath);

          await session.run(`
            MERGE (f:File {path: $path, projectId: $projectId})
            ON CREATE SET f.name = $name, f.type = $type, f.hash = $hash, f.createdAt = datetime(), f.updatedAt = datetime()
            ON MATCH SET f.hash = $hash, f.updatedAt = datetime()
          `, { path: filePath, projectId: this.projectId, name: fileName, type: fileType, hash: fileHash });
          nodesCreated++;

          const classes = this.extractClasses(content);
          for (const className of classes) {
            await session.run(`
              MERGE (c:Class {name: $className, projectId: $projectId})
              ON CREATE SET c.createdAt = datetime()
              SET c.updatedAt = datetime()
              WITH c
              MATCH (f:File {path: $filePath, projectId: $projectId})
              MERGE (f)-[:DEFINES]->(c)
            `, { className, projectId: this.projectId, filePath });
            nodesCreated++;
            relationshipsCreated++;
          }

          const imports = this.extractImports(content);
          for (const importPath of imports) {
            await session.run(`
              MATCH (f1:File {path: $filePath, projectId: $projectId})
              MERGE (f2:File {path: $importPath, projectId: $projectId})
              ON CREATE SET f2.createdAt = datetime(), f2.type = 'dependency'
              MERGE (f1)-[:IMPORTS]->(f2)
            `, { filePath, importPath, projectId: this.projectId });
            relationshipsCreated++;
          }
        }
      } finally {
        await session.close();
      }

      this.logger.info(`Graph updated: ${nodesCreated} nodes, ${relationshipsCreated} relationships`);
      return { nodesCreated, relationshipsCreated };

    } catch (error) {
      this.logger.warn('Neo4j update skipped (connection unavailable)');
      return { nodesCreated: 0, relationshipsCreated: 0 };
    }
  }

  /**
   * Test graph connection
   */
  async testGraphConnection(): Promise<void> {
    if (this.useEmbedded) {
      await this.initStorage();
      // Embedded is always available
      return;
    }
    const neo4j = await this.dbConnections.getNeo4jConnection();
    const session = neo4j.session();
    try {
      await session.run('RETURN 1');
    } finally {
      await session.close();
    }
  }

  /**
   * Update properties on existing node
   */
  async updateNodeProperties(filePath: string, metadata: Record<string, any>): Promise<void> {
    if (this.useEmbedded) {
      await this.initStorage();
      if (this.graphStore) {
        const fileId = `file:${this.projectId}:${filePath}`;
        const existing = await this.graphStore.getNode(fileId);
        if (existing) {
          await this.graphStore.upsertNode({
            ...existing,
            properties: { ...existing.properties, ...metadata }
          });
        }
      }
      return;
    }

    try {
      const neo4j = await this.dbConnections.getNeo4jConnection();
      const session = neo4j.session();
      try {
        await session.run(`
          MATCH (f:File {path: $path, projectId: $projectId})
          SET f += $metadata, f.updatedAt = datetime()
        `, { path: filePath, projectId: this.projectId, metadata });
      } finally {
        await session.close();
      }
    } catch {
      this.logger.debug(`Graph node update skipped for ${filePath}`);
    }
  }

  /**
   * Clean up old graph data
   */
  async cleanupOldGraphData(_olderThanDays: number): Promise<{ nodesDeleted: number; relationshipsDeleted: number }> {
    // For embedded mode, we don't track timestamps - skip cleanup
    if (this.useEmbedded) {
      return { nodesDeleted: 0, relationshipsDeleted: 0 };
    }

    try {
      const neo4j = await this.dbConnections.getNeo4jConnection();
      const session = neo4j.session();
      try {
        const result = await session.run(`
          MATCH (n {projectId: $projectId})
          WHERE n.updatedAt < datetime() - duration({days: $days})
          DETACH DELETE n
          RETURN count(n) as deleted
        `, { projectId: this.projectId, days: _olderThanDays });

        const deleted = result.records[0]?.get('deleted')?.toNumber() || 0;
        return { nodesDeleted: deleted, relationshipsDeleted: deleted };
      } finally {
        await session.close();
      }
    } catch {
      this.logger.debug('Graph cleanup skipped');
      return { nodesDeleted: 0, relationshipsDeleted: 0 };
    }
  }

  // ============================================
  // CACHE OPERATIONS
  // ============================================

  /**
   * Update cache with file hashes and metadata
   * Uses storage abstraction - embedded uses LRU-cache, server uses Redis
   */
  async updateRedisCache(files: string[]): Promise<{ filesUpdated: number; hashesUpdated: number }> {
    this.logger.debug(`Updating cache for ${files.length} files`);

    // Use embedded storage if available
    if (this.useEmbedded) {
      return this.updateCacheEmbedded(files);
    }

    // Server mode: use Redis directly
    return this.updateCacheRedis(files);
  }

  /**
   * Embedded mode: Update cache using LRU-cache store
   */
  private async updateCacheEmbedded(files: string[]): Promise<{ filesUpdated: number; hashesUpdated: number }> {
    await this.initStorage();
    if (!this.cacheStore) return { filesUpdated: 0, hashesUpdated: 0 };

    let filesUpdated = 0;
    let hashesUpdated = 0;

    for (const filePath of files) {
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(this.projectPath, filePath);

      try {
        const content = await fs.readFile(absolutePath, 'utf-8');
        const hash = this.computeHash(content);

        // Store file hash
        await this.cacheStore.set(`hash:${this.projectId}:${filePath}`, hash);
        hashesUpdated++;

        // Store file metadata
        const metadata = {
          path: filePath,
          hash,
          size: content.length,
          type: this.determineFileType(filePath),
          updatedAt: new Date().toISOString()
        };
        await this.cacheStore.set(`meta:${this.projectId}:${filePath}`, metadata);
        filesUpdated++;

        // Invalidate search cache for this project
        await this.cacheStore.deletePattern(`search:${this.projectId}:*`);

      } catch {
        // Ignore individual file errors
      }
    }

    await this.cacheStore.flush();
    this.logger.debug(`Cache updated: ${filesUpdated} files, ${hashesUpdated} hashes`);
    return { filesUpdated, hashesUpdated };
  }

  /**
   * Server mode: Update cache using Redis
   */
  private async updateCacheRedis(files: string[]): Promise<{ filesUpdated: number; hashesUpdated: number }> {
    let filesUpdated = 0;
    let hashesUpdated = 0;

    try {
      const redis = await this.dbConnections.getRedisConnection();

      for (const filePath of files) {
        const absolutePath = path.isAbsolute(filePath)
          ? filePath
          : path.join(this.projectPath, filePath);

        try {
          const content = await fs.readFile(absolutePath, 'utf-8');
          const hash = this.computeHash(content);

          await redis.set(`codeseeker:hash:${this.projectId}:${filePath}`, hash);
          hashesUpdated++;

          const metadata = {
            path: filePath,
            hash,
            size: content.length,
            type: this.determineFileType(filePath),
            updatedAt: new Date().toISOString()
          };
          await redis.set(`codeseeker:meta:${this.projectId}:${filePath}`, JSON.stringify(metadata));
          filesUpdated++;

          const keys = await redis.keys(`codeseeker:search:${this.projectId}:*`);
          if (keys.length > 0) {
            await redis.del(keys);
          }
        } catch {
          // Ignore individual file errors
        }
      }

      this.logger.debug(`Redis cache updated: ${filesUpdated} files, ${hashesUpdated} hashes`);
      return { filesUpdated, hashesUpdated };

    } catch {
      this.logger.warn('Redis update skipped (connection unavailable)');
      return { filesUpdated: 0, hashesUpdated: 0 };
    }
  }

  /**
   * Test cache connection
   */
  async testRedisConnection(): Promise<void> {
    if (this.useEmbedded) {
      await this.initStorage();
      // Embedded is always available
      return;
    }
    const redis = await this.dbConnections.getRedisConnection();
    await redis.ping();
  }

  /**
   * Update cache hash for a file
   */
  async updateRedisHash(filePath: string, metadata: Record<string, any>): Promise<void> {
    if (this.useEmbedded) {
      await this.initStorage();
      if (this.cacheStore) {
        await this.cacheStore.set(`meta:${this.projectId}:${filePath}`, {
          ...metadata,
          updatedAt: new Date().toISOString()
        });
      }
      return;
    }

    try {
      const redis = await this.dbConnections.getRedisConnection();
      await redis.set(`codeseeker:meta:${this.projectId}:${filePath}`, JSON.stringify({
        ...metadata,
        updatedAt: new Date().toISOString()
      }));
    } catch {
      this.logger.debug(`Cache hash update skipped for ${filePath}`);
    }
  }

  /**
   * Clean up old cache data
   */
  async cleanupOldCacheData(_olderThanDays: number): Promise<{ keysDeleted: number }> {
    if (this.useEmbedded) {
      // LRU cache handles its own eviction
      return { keysDeleted: 0 };
    }

    try {
      const redis = await this.dbConnections.getRedisConnection();
      const keys = await redis.keys(`codeseeker:meta:${this.projectId}:*`);
      let keysDeleted = 0;

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - _olderThanDays);

      for (const key of keys) {
        const value = await redis.get(key);
        if (value) {
          try {
            const meta = JSON.parse(value);
            if (meta.updatedAt && new Date(meta.updatedAt) < cutoffDate) {
              await redis.del(key);
              keysDeleted++;
            }
          } catch {
            await redis.del(key);
            keysDeleted++;
          }
        }
      }
      return { keysDeleted };
    } catch {
      this.logger.debug('Cache cleanup skipped');
      return { keysDeleted: 0 };
    }
  }

  // ============================================
  // VECTOR STORE OPERATIONS
  // ============================================

  /**
   * Update vector store with file embeddings and metadata
   * Uses storage abstraction - embedded uses SQLite, server uses PostgreSQL
   */
  async updateMainDatabase(files: string[]): Promise<{ recordsUpdated: number }> {
    this.logger.debug(`Updating vector store for ${files.length} files`);

    // Use embedded storage if available
    if (this.useEmbedded) {
      return this.updateVectorStoreEmbedded(files);
    }

    // Server mode: use PostgreSQL directly
    return this.updateVectorStorePostgres(files);
  }

  /**
   * Embedded mode: Update vector store using SQLite
   */
  private async updateVectorStoreEmbedded(files: string[]): Promise<{ recordsUpdated: number }> {
    await this.initStorage();
    if (!this.vectorStore) return { recordsUpdated: 0 };

    let recordsUpdated = 0;

    for (const filePath of files) {
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(this.projectPath, filePath);

      try {
        const content = await fs.readFile(absolutePath, 'utf-8');
        const classes = this.extractClasses(content);
        const functions = this.extractFunctions(content);
        const imports = this.extractImports(content);

        const metadata = {
          classes,
          functions: functions.slice(0, 20),
          imports,
          lineCount: content.split('\n').length
        };

        await this.vectorStore.upsert({
          id: `${this.projectId}:${filePath}:0`,
          projectId: this.projectId,
          filePath: filePath,
          content: content.substring(0, 10000),
          embedding: [], // Embedding will be generated by the store if needed
          metadata
        });

        recordsUpdated++;
      } catch {
        // Ignore individual file errors
      }
    }

    await this.vectorStore.flush();
    this.logger.debug(`Vector store updated: ${recordsUpdated} records`);
    return { recordsUpdated };
  }

  /**
   * Server mode: Update vector store using PostgreSQL
   */
  private async updateVectorStorePostgres(files: string[]): Promise<{ recordsUpdated: number }> {
    let recordsUpdated = 0;

    try {
      const postgres = await this.dbConnections.getPostgresConnection();

      for (const filePath of files) {
        const absolutePath = path.isAbsolute(filePath)
          ? filePath
          : path.join(this.projectPath, filePath);

        try {
          const content = await fs.readFile(absolutePath, 'utf-8');
          const hash = this.computeHash(content);
          const classes = this.extractClasses(content);
          const functions = this.extractFunctions(content);
          const imports = this.extractImports(content);

          const metadata = {
            classes,
            functions: functions.slice(0, 20),
            imports,
            lineCount: content.split('\n').length
          };

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
            `${this.projectId}:${filePath}:0`,
            this.projectId,
            filePath,
            content.substring(0, 10000),
            1,
            content.split('\n').length,
            0,
            true,
            hash,
            JSON.stringify(metadata)
          ]);

          recordsUpdated++;
        } catch {
          // Ignore individual file errors
        }
      }

      this.logger.debug(`PostgreSQL updated: ${recordsUpdated} records`);
      return { recordsUpdated };

    } catch {
      this.logger.warn('PostgreSQL update skipped (connection unavailable)');
      return { recordsUpdated: 0 };
    }
  }

  /**
   * Test vector store connection
   */
  async testMainDatabaseConnection(): Promise<void> {
    if (this.useEmbedded) {
      await this.initStorage();
      // Embedded is always available
      return;
    }
    const postgres = await this.dbConnections.getPostgresConnection();
    await postgres.query('SELECT 1');
  }

  /**
   * Update file record with metadata
   */
  async updateFileRecord(filePath: string, metadata: Record<string, any>): Promise<void> {
    if (this.useEmbedded) {
      // For embedded, we'd need to read and re-upsert the document
      // This is a simplified implementation
      this.logger.debug(`Embedded file record update for ${filePath}`);
      return;
    }

    try {
      const postgres = await this.dbConnections.getPostgresConnection();
      await postgres.query(`
        UPDATE semantic_search_embeddings
        SET metadata = metadata || $1, updated_at = NOW()
        WHERE file_path = $2 AND project_id = $3
      `, [JSON.stringify(metadata), filePath, this.projectId]);
    } catch {
      this.logger.debug(`Vector store record update skipped for ${filePath}`);
    }
  }

  /**
   * Clean up old database records
   */
  async cleanupOldMainData(olderThanDays: number): Promise<{ recordsDeleted: number }> {
    if (this.useEmbedded) {
      // Embedded SQLite doesn't track timestamps the same way
      return { recordsDeleted: 0 };
    }

    try {
      const postgres = await this.dbConnections.getPostgresConnection();
      const result = await postgres.query(`
        DELETE FROM semantic_search_embeddings
        WHERE project_id = $1
          AND updated_at < NOW() - INTERVAL '${olderThanDays} days'
      `, [this.projectId]);

      return { recordsDeleted: result.rowCount || 0 };
    } catch {
      this.logger.debug('Vector store cleanup skipped');
      return { recordsDeleted: 0 };
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private computeHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
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

    const ext = path.extname(filePath);
    if (['.ts', '.js'].includes(ext)) return 'module';
    if (['.json', '.yaml', '.yml'].includes(ext)) return 'configuration';

    return 'module';
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
    const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
    const imports: string[] = [];
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      if (match[1].startsWith('.')) {
        imports.push(match[1]);
      }
    }

    while ((match = requireRegex.exec(content)) !== null) {
      if (match[1].startsWith('.')) {
        imports.push(match[1]);
      }
    }

    return imports;
  }

  async close(): Promise<void> {
    await this.dbConnections.closeAll();
  }
}

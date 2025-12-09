/**
 * Database Update Manager
 * SOLID Principles: Single Responsibility - Handle database updates across all systems
 *
 * This manager coordinates updates to:
 * - PostgreSQL (semantic search embeddings)
 * - Neo4j (knowledge graph relationships)
 * - Redis (caching layer)
 *
 * Used after each Claude Code execution to keep databases in sync with code changes.
 */

import { Logger } from '../logger';
import { DatabaseConnections } from '../../config/database-config';
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

  constructor(projectId?: string, projectPath?: string) {
    this.dbConnections = new DatabaseConnections();
    this.projectId = projectId || 'default';
    this.projectPath = projectPath || process.cwd();
  }

  /**
   * Set project context for updates
   */
  setProject(projectId: string, projectPath: string): void {
    this.projectId = projectId;
    this.projectPath = projectPath;
  }

  // ============================================
  // NEO4J GRAPH DATABASE OPERATIONS
  // ============================================

  /**
   * Update Neo4j graph with new/modified file nodes and relationships
   */
  async updateGraphDatabase(files: string[]): Promise<{ nodesCreated: number; relationshipsCreated: number }> {
    this.logger.debug(`Updating graph database for ${files.length} files`);

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

          // Check if file exists
          try {
            await fs.access(absolutePath);
          } catch {
            this.logger.debug(`File not found, skipping: ${filePath}`);
            continue;
          }

          const content = await fs.readFile(absolutePath, 'utf-8');
          const fileHash = this.computeHash(content);
          const fileName = path.basename(filePath);
          const fileType = this.determineFileType(filePath);

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
            path: filePath,
            projectId: this.projectId,
            name: fileName,
            type: fileType,
            hash: fileHash
          });
          nodesCreated++;

          // Extract and create class/function nodes with relationships
          const classes = this.extractClasses(content);
          const imports = this.extractImports(content);

          // Create class nodes
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
              projectId: this.projectId,
              filePath
            });
            nodesCreated++;
            relationshipsCreated++;
          }

          // Create import relationships
          for (const importPath of imports) {
            await session.run(`
              MATCH (f1:File {path: $filePath, projectId: $projectId})
              MERGE (f2:File {path: $importPath, projectId: $projectId})
              ON CREATE SET f2.createdAt = datetime(), f2.type = 'dependency'
              MERGE (f1)-[:IMPORTS]->(f2)
            `, {
              filePath,
              importPath,
              projectId: this.projectId
            });
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
   * Test Neo4j connection
   */
  async testGraphConnection(): Promise<void> {
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
    try {
      const neo4j = await this.dbConnections.getNeo4jConnection();
      const session = neo4j.session();
      try {
        await session.run(`
          MATCH (f:File {path: $path, projectId: $projectId})
          SET f += $metadata, f.updatedAt = datetime()
        `, {
          path: filePath,
          projectId: this.projectId,
          metadata
        });
      } finally {
        await session.close();
      }
    } catch (error) {
      this.logger.debug(`Neo4j node update skipped for ${filePath}`);
    }
  }

  /**
   * Clean up old graph data
   */
  async cleanupOldGraphData(olderThanDays: number): Promise<{ nodesDeleted: number; relationshipsDeleted: number }> {
    try {
      const neo4j = await this.dbConnections.getNeo4jConnection();
      const session = neo4j.session();
      try {
        const result = await session.run(`
          MATCH (n {projectId: $projectId})
          WHERE n.updatedAt < datetime() - duration({days: $days})
          DETACH DELETE n
          RETURN count(n) as deleted
        `, {
          projectId: this.projectId,
          days: olderThanDays
        });

        const deleted = result.records[0]?.get('deleted')?.toNumber() || 0;
        return { nodesDeleted: deleted, relationshipsDeleted: deleted };
      } finally {
        await session.close();
      }
    } catch (error) {
      this.logger.debug('Neo4j cleanup skipped');
      return { nodesDeleted: 0, relationshipsDeleted: 0 };
    }
  }

  // ============================================
  // REDIS CACHE OPERATIONS
  // ============================================

  /**
   * Update Redis cache with file hashes and metadata
   */
  async updateRedisCache(files: string[]): Promise<{ filesUpdated: number; hashesUpdated: number }> {
    this.logger.debug(`Updating Redis cache for ${files.length} files`);

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

          // Store file hash
          const hashKey = `codemind:hash:${this.projectId}:${filePath}`;
          await redis.set(hashKey, hash);
          hashesUpdated++;

          // Store file metadata
          const metaKey = `codemind:meta:${this.projectId}:${filePath}`;
          const metadata = {
            path: filePath,
            hash,
            size: content.length,
            type: this.determineFileType(filePath),
            updatedAt: new Date().toISOString()
          };
          await redis.set(metaKey, JSON.stringify(metadata));
          filesUpdated++;

          // Invalidate any cached search results for this project
          const cachePattern = `codemind:search:${this.projectId}:*`;
          const keys = await redis.keys(cachePattern);
          if (keys.length > 0) {
            await redis.del(keys);
          }

        } catch {
          // Ignore individual file errors
        }
      }

      this.logger.debug(`Redis cache updated: ${filesUpdated} files, ${hashesUpdated} hashes`);

      return { filesUpdated, hashesUpdated };

    } catch (error) {
      this.logger.warn('Redis update skipped (connection unavailable)');
      return { filesUpdated: 0, hashesUpdated: 0 };
    }
  }

  /**
   * Test Redis connection
   */
  async testRedisConnection(): Promise<void> {
    const redis = await this.dbConnections.getRedisConnection();
    await redis.ping();
  }

  /**
   * Update Redis hash for a file
   */
  async updateRedisHash(filePath: string, metadata: Record<string, any>): Promise<void> {
    try {
      const redis = await this.dbConnections.getRedisConnection();
      const key = `codemind:meta:${this.projectId}:${filePath}`;
      await redis.set(key, JSON.stringify({
        ...metadata,
        updatedAt: new Date().toISOString()
      }));
    } catch {
      this.logger.debug(`Redis hash update skipped for ${filePath}`);
    }
  }

  /**
   * Clean up old cache data
   */
  async cleanupOldCacheData(olderThanDays: number): Promise<{ keysDeleted: number }> {
    try {
      const redis = await this.dbConnections.getRedisConnection();

      const pattern = `codemind:meta:${this.projectId}:*`;
      const keys = await redis.keys(pattern);
      let keysDeleted = 0;

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

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
      this.logger.debug('Redis cleanup skipped');
      return { keysDeleted: 0 };
    }
  }

  // ============================================
  // POSTGRESQL OPERATIONS
  // ============================================

  /**
   * Update PostgreSQL with file embeddings and metadata
   */
  async updateMainDatabase(files: string[]): Promise<{ recordsUpdated: number }> {
    this.logger.debug(`Updating PostgreSQL for ${files.length} files`);

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

          // Extract metadata from file
          const classes = this.extractClasses(content);
          const functions = this.extractFunctions(content);
          const imports = this.extractImports(content);

          const metadata = {
            classes,
            functions: functions.slice(0, 20),
            imports,
            lineCount: content.split('\n').length
          };

          // Upsert into semantic_search_embeddings
          // Using column names from master schema v3.0.0
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

    } catch (error) {
      this.logger.warn('PostgreSQL update skipped (connection unavailable)');
      return { recordsUpdated: 0 };
    }
  }

  /**
   * Test PostgreSQL connection
   */
  async testMainDatabaseConnection(): Promise<void> {
    const postgres = await this.dbConnections.getPostgresConnection();
    await postgres.query('SELECT 1');
  }

  /**
   * Update file record with metadata
   */
  async updateFileRecord(filePath: string, metadata: Record<string, any>): Promise<void> {
    try {
      const postgres = await this.dbConnections.getPostgresConnection();
      await postgres.query(`
        UPDATE semantic_search_embeddings
        SET metadata = metadata || $1, updated_at = NOW()
        WHERE file_path = $2 AND project_id = $3
      `, [JSON.stringify(metadata), filePath, this.projectId]);
    } catch {
      this.logger.debug(`PostgreSQL record update skipped for ${filePath}`);
    }
  }

  /**
   * Clean up old database records
   */
  async cleanupOldMainData(olderThanDays: number): Promise<{ recordsDeleted: number }> {
    try {
      const postgres = await this.dbConnections.getPostgresConnection();

      const result = await postgres.query(`
        DELETE FROM semantic_search_embeddings
        WHERE project_id = $1
          AND updated_at < NOW() - INTERVAL '${olderThanDays} days'
      `, [this.projectId]);

      return { recordsDeleted: result.rowCount || 0 };

    } catch {
      this.logger.debug('PostgreSQL cleanup skipped');
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

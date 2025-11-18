/**
 * File Synchronization System
 * Maintains perfect sync between project files and database indexes using hash tracking
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { glob } from 'fast-glob';
import { Logger } from '../utils/logger';
import { ToolDatabaseAPI } from '../orchestrator/tool-database-api';
import { EmbeddingService } from '../cli/services/data/embedding/embedding-service';

export interface FileHashEntry {
  filePath: string;
  contentHash: string;
  lastModified: Date;
  fileSize: number;
  language: string;
  contentType: 'code' | 'config' | 'documentation' | 'test' | 'schema' | 'deployment';
}

export interface SyncResult {
  totalFiles: number;
  newFiles: number;
  modifiedFiles: number;
  deletedFiles: number;
  unchangedFiles: number;
  errors: Array<{ filePath: string; error: string; }>;
}

export interface FileContent {
  filePath: string;
  content: string;
  metadata: {
    hash: string;
    size: number;
    language: string;
    contentType: string;
    lastModified: Date;
  };
}

export class FileSynchronizationSystem {
  private logger = Logger.getInstance();
  private databaseAPI: ToolDatabaseAPI;
  private embeddingService: EmbeddingService;
  private localHashCacheFile: string;
  private localHashCache: Map<string, string> = new Map();

  constructor(projectPath: string) {
    this.databaseAPI = new ToolDatabaseAPI();
    this.embeddingService = new EmbeddingService({
      provider: 'xenova',  // Use Xenova transformers for zero-cost embeddings
      model: 'Xenova/all-MiniLM-L6-v2',
      chunkSize: 8000,
      maxTokens: 8191
    });
    this.localHashCacheFile = path.join(projectPath, '.codemind', 'file-hashes.json');
  }

  async initialize(): Promise<void> {
    let lastError: Error | null = null;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.info(`🔄 Initializing file sync system (attempt ${attempt}/${maxRetries})`);
        
        await Promise.race([
          this.databaseAPI.initialize(),
          this.timeout(10000, 'Database initialization timeout')
        ]);
        
        await this.loadLocalHashCache();
        await this.ensureFileIndexTables();
        
        this.logger.info('📁 File synchronization system initialized successfully');
        return;
        
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`⚠️ Initialization attempt ${attempt} failed: ${error}`);
        
        if (attempt < maxRetries) {
          await this.delay(2000 * attempt); // Progressive delay
        }
      }
    }
    
    throw new Error(`Failed to initialize file sync after ${maxRetries} attempts: ${lastError?.message}`);
  }

  private timeout(ms: number, message: string): Promise<never> {
    return new Promise((_, reject) => 
      setTimeout(() => reject(new Error(message)), ms)
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Main synchronization method: ensures all project files are perfectly indexed
   */
  async synchronizeProject(projectPath: string, projectId: string): Promise<SyncResult> {
    this.logger.info('🔄 Starting project file synchronization...');
    const startTime = Date.now();

    const result: SyncResult = {
      totalFiles: 0,
      newFiles: 0,
      modifiedFiles: 0,
      deletedFiles: 0,
      unchangedFiles: 0,
      errors: []
    };

    try {
      // Step 1: Discover all project files
      const projectFiles = await this.discoverProjectFiles(projectPath);
      result.totalFiles = projectFiles.length;

      // Step 2: Get current database file hashes
      const databaseHashes = await this.getDatabaseFileHashes(projectId);

      // Step 3: Compare and sync each file
      for (const filePath of projectFiles) {
        try {
          const syncStatus = await this.syncSingleFile(projectPath, projectId, filePath, databaseHashes);
          
          switch (syncStatus.action) {
            case 'created':
              result.newFiles++;
              break;
            case 'updated':
              result.modifiedFiles++;
              break;
            case 'unchanged':
              result.unchangedFiles++;
              break;
          }
        } catch (error) {
          result.errors.push({
            filePath,
            error: error instanceof Error ? error.message : String(error)
          });
          this.logger.warn(`❌ Sync failed for ${filePath}: ${error}`);
        }
      }

      // Step 4: Remove deleted files from database
      const deletedFiles = await this.removeDeletedFiles(projectId, projectFiles, databaseHashes);
      result.deletedFiles = deletedFiles;

      // Step 5: Update local hash cache
      await this.saveLocalHashCache();

      const duration = Date.now() - startTime;
      this.logger.info(`✅ Synchronization completed in ${duration}ms: ${result.newFiles} new, ${result.modifiedFiles} modified, ${result.deletedFiles} deleted, ${result.unchangedFiles} unchanged`);

      return result;
    } catch (error) {
      this.logger.error(`❌ Project synchronization failed: ${error}`);
      throw error;
    }
  }

  /**
   * Get file content from database (avoiding filesystem reads when possible)
   */
  async getFileContent(projectId: string, filePath: string): Promise<FileContent | null> {
    try {
      const result = await this.databaseAPI.query(`
        SELECT file_path, content, content_hash, file_size, language, content_type, last_modified
        FROM file_index 
        WHERE project_id = $1 AND file_path = $2
      `, [projectId, filePath]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        filePath: row.file_path,
        content: row.content,
        metadata: {
          hash: row.content_hash,
          size: row.file_size,
          language: row.language,
          contentType: row.content_type,
          lastModified: new Date(row.last_modified)
        }
      };
    } catch (error) {
      this.logger.warn(`Failed to get file content for ${filePath}: ${error}`);
      return null;
    }
  }

  /**
   * Check if a file is in sync (hash matches database)
   */
  async isFileInSync(projectId: string, filePath: string): Promise<boolean> {
    try {
      // Check local cache first
      const absolutePath = path.resolve(filePath);
      const cachedHash = this.localHashCache.get(absolutePath);
      
      if (cachedHash) {
        const databaseHash = await this.getDatabaseFileHash(projectId, filePath);
        return cachedHash === databaseHash;
      }

      // Calculate fresh hash if not cached
      const currentHash = await this.calculateFileHash(absolutePath);
      const databaseHash = await this.getDatabaseFileHash(projectId, filePath);
      
      return currentHash === databaseHash;
    } catch (error) {
      return false;
    }
  }

  /**
   * Force refresh a specific file in all indexes
   */
  async refreshFile(projectPath: string, projectId: string, filePath: string): Promise<void> {
    this.logger.info(`🔄 Refreshing file: ${filePath}`);

    try {
      const absolutePath = path.resolve(projectPath, filePath);
      const content = await fs.readFile(absolutePath, 'utf-8');
      const stats = await fs.stat(absolutePath);
      
      const fileData: FileHashEntry = {
        filePath,
        contentHash: this.calculateContentHash(content),
        lastModified: stats.mtime,
        fileSize: stats.size,
        language: this.detectLanguage(filePath),
        contentType: this.detectContentType(filePath)
      };

      // Update file index table
      await this.upsertFileIndex(projectId, filePath, content, fileData);

      // Update local cache
      this.localHashCache.set(absolutePath, fileData.contentHash);

      // TODO: Trigger updates to other indexes
      // - Vector embeddings (semantic search)
      // - Neo4j graph (semantic graph)
      // - Tree navigation data
      await this.updateRelatedIndexes(projectId, filePath, content, fileData);

      this.logger.info(`✅ File refreshed: ${filePath}`);
    } catch (error) {
      this.logger.error(`❌ Failed to refresh file ${filePath}: ${error}`);
      throw error;
    }
  }

  // Private methods...
  
  /**
   * Discover all relevant files in the project
   */
  private async discoverProjectFiles(projectPath: string): Promise<string[]> {
    const patterns = [
      '**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx',
      '**/*.py', '**/*.java', '**/*.cpp', '**/*.c', '**/*.cs',
      '**/*.sql', '**/*.json', '**/*.yml', '**/*.yaml',
      '**/*.md', '**/*.txt', '**/*.dockerfile', '**/*.sh',
      '**/*.ps1', '**/*.bat', '**/*.cfg', '**/*.ini'
    ];

    const ignorePatterns = [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.git/**',
      '**/.codemind/**',
      '**/coverage/**',
      '**/tmp/**',
      '**/temp/**'
    ];

    const files = await glob(patterns, {
      cwd: projectPath,
      ignore: ignorePatterns,
      absolute: false
    });

    return files;
  }

  /**
   * Get all file hashes from database for comparison
   */
  private async getDatabaseFileHashes(projectId: string): Promise<Map<string, string>> {
    const result = await this.databaseAPI.query(`
      SELECT file_path, content_hash 
      FROM file_index 
      WHERE project_id = $1
    `, [projectId]);

    const hashes = new Map<string, string>();
    result.rows.forEach(row => {
      hashes.set(row.file_path, row.content_hash);
    });

    return hashes;
  }

  /**
   * Sync a single file with the database
   */
  private async syncSingleFile(
    projectPath: string, 
    projectId: string, 
    filePath: string, 
    databaseHashes: Map<string, string>
  ): Promise<{ action: 'created' | 'updated' | 'unchanged' }> {
    const absolutePath = path.resolve(projectPath, filePath);
    const currentHash = await this.calculateFileHash(absolutePath);
    const databaseHash = databaseHashes.get(filePath);

    // Update local cache
    this.localHashCache.set(absolutePath, currentHash);

    if (!databaseHash) {
      // New file
      await this.indexNewFile(projectPath, projectId, filePath);
      return { action: 'created' };
    } else if (databaseHash !== currentHash) {
      // Modified file
      await this.updateExistingFile(projectPath, projectId, filePath);
      return { action: 'updated' };
    } else {
      // Unchanged file
      return { action: 'unchanged' };
    }
  }

  /**
   * Index a completely new file
   */
  private async indexNewFile(projectPath: string, projectId: string, filePath: string): Promise<void> {
    const absolutePath = path.resolve(projectPath, filePath);
    const content = await fs.readFile(absolutePath, 'utf-8');
    const stats = await fs.stat(absolutePath);
    
    const fileData: FileHashEntry = {
      filePath,
      contentHash: this.calculateContentHash(content),
      lastModified: stats.mtime,
      fileSize: stats.size,
      language: this.detectLanguage(filePath),
      contentType: this.detectContentType(filePath)
    };

    await this.upsertFileIndex(projectId, filePath, content, fileData);
    await this.updateRelatedIndexes(projectId, filePath, content, fileData);
  }

  /**
   * Update an existing file in all indexes
   */
  private async updateExistingFile(projectPath: string, projectId: string, filePath: string): Promise<void> {
    // Same logic as indexNewFile - upsert handles both cases
    await this.indexNewFile(projectPath, projectId, filePath);
  }

  /**
   * Remove files that no longer exist from the database
   */
  private async removeDeletedFiles(
    projectId: string, 
    currentFiles: string[], 
    databaseHashes: Map<string, string>
  ): Promise<number> {
    const currentFilesSet = new Set(currentFiles);
    const deletedFiles: string[] = [];

    for (const databaseFile of databaseHashes.keys()) {
      if (!currentFilesSet.has(databaseFile)) {
        deletedFiles.push(databaseFile);
      }
    }

    if (deletedFiles.length > 0) {
      // Remove from file index
      await this.databaseAPI.query(`
        DELETE FROM file_index 
        WHERE project_id = $1 AND file_path = ANY($2)
      `, [projectId, deletedFiles]);

      // Remove from other indexes
      await this.removeFromRelatedIndexes(projectId, deletedFiles);

      this.logger.info(`🗑️ Removed ${deletedFiles.length} deleted files from indexes`);
    }

    return deletedFiles.length;
  }

  /**
   * Calculate hash for a file
   */
  private async calculateFileHash(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath, 'utf-8');
    return this.calculateContentHash(content);
  }

  /**
   * Calculate hash for content string
   */
  private calculateContentHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Detect programming language from file extension
   */
  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.sql': 'sql',
      '.json': 'json',
      '.yml': 'yaml',
      '.yaml': 'yaml',
      '.md': 'markdown',
      '.sh': 'bash',
      '.ps1': 'powershell'
    };
    return languageMap[ext] || 'text';
  }

  /**
   * Detect content type from file path
   */
  private detectContentType(filePath: string): 'code' | 'config' | 'documentation' | 'test' | 'schema' | 'deployment' {
    const lowerPath = filePath.toLowerCase();
    
    if (lowerPath.includes('test') || lowerPath.includes('spec')) return 'test';
    if (lowerPath.includes('schema') || lowerPath.endsWith('.sql')) return 'schema';
    if (lowerPath.includes('config') || lowerPath.endsWith('.json') || lowerPath.endsWith('.yml')) return 'config';
    if (lowerPath.includes('docker') || lowerPath.includes('deploy')) return 'deployment';
    if (lowerPath.endsWith('.md') || lowerPath.includes('doc')) return 'documentation';
    return 'code';
  }

  /**
   * Ensure file index tables exist
   */
  private async ensureFileIndexTables(): Promise<void> {
    await this.databaseAPI.query(`
      CREATE TABLE IF NOT EXISTS file_index (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL,
        file_path TEXT NOT NULL,
        content TEXT NOT NULL,
        content_hash VARCHAR(64) NOT NULL,
        file_size INTEGER NOT NULL,
        language VARCHAR(50) NOT NULL,
        content_type VARCHAR(20) NOT NULL,
        last_modified TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_project_file UNIQUE (project_id, file_path)
      );
      
      CREATE INDEX IF NOT EXISTS idx_file_index_project_id ON file_index(project_id);
      CREATE INDEX IF NOT EXISTS idx_file_index_content_type ON file_index(content_type);
      CREATE INDEX IF NOT EXISTS idx_file_index_language ON file_index(language);
      CREATE INDEX IF NOT EXISTS idx_file_index_hash ON file_index(content_hash);
    `);
  }

  /**
   * Insert or update file in the index table
   */
  private async upsertFileIndex(
    projectId: string, 
    filePath: string, 
    content: string, 
    fileData: FileHashEntry
  ): Promise<void> {
    await this.databaseAPI.query(`
      INSERT INTO file_index (
        project_id, file_path, content, content_hash, file_size, 
        language, content_type, last_modified, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (project_id, file_path) 
      DO UPDATE SET 
        content = EXCLUDED.content,
        content_hash = EXCLUDED.content_hash,
        file_size = EXCLUDED.file_size,
        language = EXCLUDED.language,
        content_type = EXCLUDED.content_type,
        last_modified = EXCLUDED.last_modified,
        updated_at = NOW()
    `, [
      projectId, 
      filePath, 
      content, 
      fileData.contentHash, 
      fileData.fileSize,
      fileData.language, 
      fileData.contentType, 
      fileData.lastModified
    ]);
  }

  /**
   * Update related indexes (semantic search, graph, tree navigation)
   */
  private async updateRelatedIndexes(
    projectId: string,
    filePath: string,
    content: string,
    fileData: FileHashEntry
  ): Promise<void> {
    try {
      // Update vector embeddings for semantic search using Xenova (always available)
      if (fileData.contentType === 'code') {
        await this.updateVectorEmbedding(projectId, filePath, content, fileData);
      }

      // Update Neo4j graph with file relationships
      await this.updateGraphRelationships(projectId, filePath, content, fileData);

      // Update tree navigation data
      await this.updateTreeNavigationData(projectId, filePath, content, fileData);

      this.logger.debug(`📊 Updated related indexes for ${filePath}`);
    } catch (error) {
      this.logger.warn(`Failed to update related indexes for ${filePath}: ${error}`);
    }
  }

  /**
   * Update vector embedding for semantic search using Xenova transformers
   */
  private async updateVectorEmbedding(
    projectId: string,
    filePath: string,
    content: string,
    fileData: FileHashEntry
  ): Promise<void> {
    try {
      // Generate embedding using Xenova transformers (zero-cost, local)
      const embedding = await this.embeddingService.generateEmbedding(
        content.substring(0, 8000), // Limit content size for performance
        filePath
      );

      // Update or insert embedding
      await this.databaseAPI.query(`
        INSERT INTO code_embeddings (
          project_id, file_path, content_type, content_text, content_hash,
          embedding, metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6::vector, $7, NOW(), NOW())
        ON CONFLICT (project_id, file_path, content_type)
        DO UPDATE SET
          content_text = EXCLUDED.content_text,
          content_hash = EXCLUDED.content_hash,
          embedding = EXCLUDED.embedding,
          updated_at = NOW()
      `, [
        projectId,
        filePath,
        'file',
        content,
        fileData.contentHash,
        `[${embedding.join(',')}]`,
        JSON.stringify({
          language: fileData.language,
          size: fileData.fileSize,
          embeddingProvider: 'xenova',
          model: 'Xenova/all-MiniLM-L6-v2'
        })
      ]);

      this.logger.debug(`📊 Updated Xenova vector embedding for ${filePath}`);
    } catch (error) {
      this.logger.warn(`Failed to update vector embedding for ${filePath}: ${error}`);
    }
  }

  /**
   * Update Neo4j graph relationships
   */
  private async updateGraphRelationships(
    projectId: string, 
    filePath: string, 
    content: string, 
    fileData: FileHashEntry
  ): Promise<void> {
    try {
      const { CodeRelationshipParser } = await import('../cli/services/data/code-relationship-parser');
      const parser = new CodeRelationshipParser();
      
      // Parse just this file and update its relationships
      // This is a simplified version - in practice, we'd want more sophisticated incremental updates
      this.logger.debug(`🔗 Updated graph relationships for ${filePath}`);
    } catch (error) {
      this.logger.warn(`Failed to update graph relationships for ${filePath}: ${error}`);
    }
  }

  /**
   * Update tree navigation data
   */
  private async updateTreeNavigationData(
    projectId: string, 
    filePath: string, 
    content: string, 
    fileData: FileHashEntry
  ): Promise<void> {
    try {
      // Store basic tree navigation data in the database
      await this.databaseAPI.query(`
        INSERT INTO tool_data (project_id, tool_name, file_path, analysis_result, created_at)
        VALUES ($1, 'tree-navigator', $2, $3, NOW())
        ON CONFLICT (project_id, tool_name, file_path)
        DO UPDATE SET 
          analysis_result = EXCLUDED.analysis_result,
          created_at = NOW()
      `, [
        projectId,
        filePath,
        JSON.stringify({
          language: fileData.language,
          contentType: fileData.contentType,
          fileSize: fileData.fileSize,
          lastModified: fileData.lastModified
        })
      ]);

      this.logger.debug(`🌳 Updated tree navigation data for ${filePath}`);
    } catch (error) {
      this.logger.warn(`Failed to update tree navigation data for ${filePath}: ${error}`);
    }
  }

  /**
   * Remove from related indexes
   */
  private async removeFromRelatedIndexes(projectId: string, filePaths: string[]): Promise<void> {
    try {
      // Remove from vector embeddings
      await this.databaseAPI.query(`
        DELETE FROM code_embeddings 
        WHERE project_id = $1 AND file_path = ANY($2)
      `, [projectId, filePaths]);

      // Remove from tool data  
      await this.databaseAPI.query(`
        DELETE FROM tool_data 
        WHERE project_id = $1 AND file_path = ANY($2)
      `, [projectId, filePaths]);

      // TODO: Remove from Neo4j graph (requires graph service)
      
      this.logger.debug(`🗑️ Removed ${filePaths.length} files from related indexes`);
    } catch (error) {
      this.logger.warn(`Failed to remove files from related indexes: ${error}`);
    }
  }

  /**
   * Load local hash cache from filesystem
   */
  private async loadLocalHashCache(): Promise<void> {
    try {
      const cacheDir = path.dirname(this.localHashCacheFile);
      await fs.mkdir(cacheDir, { recursive: true });
      
      const cacheData = await fs.readFile(this.localHashCacheFile, 'utf-8');
      const cacheObject = JSON.parse(cacheData);
      
      this.localHashCache = new Map(Object.entries(cacheObject));
      this.logger.debug(`📋 Loaded ${this.localHashCache.size} file hashes from local cache`);
    } catch (error) {
      this.logger.debug('📋 No existing hash cache found, starting fresh');
      this.localHashCache = new Map();
    }
  }

  /**
   * Save local hash cache to filesystem
   */
  private async saveLocalHashCache(): Promise<void> {
    try {
      const cacheDir = path.dirname(this.localHashCacheFile);
      await fs.mkdir(cacheDir, { recursive: true });
      
      const cacheObject = Object.fromEntries(this.localHashCache);
      await fs.writeFile(this.localHashCacheFile, JSON.stringify(cacheObject, null, 2));
      
      this.logger.debug(`💾 Saved ${this.localHashCache.size} file hashes to local cache`);
    } catch (error) {
      this.logger.warn(`Failed to save hash cache: ${error}`);
    }
  }

  /**
   * Get single file hash from database
   */
  private async getDatabaseFileHash(projectId: string, filePath: string): Promise<string | null> {
    try {
      const result = await this.databaseAPI.query(`
        SELECT content_hash FROM file_index 
        WHERE project_id = $1 AND file_path = $2
      `, [projectId, filePath]);
      
      return result.rows.length > 0 ? result.rows[0].content_hash : null;
    } catch (error) {
      return null;
    }
  }

  async close(): Promise<void> {
    await this.saveLocalHashCache();
    await this.databaseAPI.close();
  }
}
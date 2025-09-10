/**
 * Semantic Enhancement Engine
 * Powers CLI cycle with semantic search and relationship traversal
 * Provides complete context to Claude without file reads
 */

import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import { Logger } from '../utils/logger';

export interface SemanticSearchResult {
  filePath: string;
  relevanceScore: number;
  content: string; // Cached content from semantic index
  lastModified: number;
  hash: string;
  matchReason: string;
}

export interface RelatedFileContext {
  filePath: string;
  relationshipType: string;
  content: string;
  hash: string;
  distance: number; // Degrees of separation from primary files
}

export interface EnhancementContext {
  query: string;
  primaryFiles: SemanticSearchResult[];
  relatedFiles: RelatedFileContext[];
  totalFiles: number;
  contextSize: number; // Total characters of content
  cacheHitRate: number;
  generatedAt: number;
}

export interface RedisFileCache {
  content: string;
  hash: string;
  lastModified: number;
  size: number;
  language: string;
  exports: string[];
  imports: string[];
  classes: string[];
  functions: string[];
}

export class SemanticEnhancementEngine {
  private logger = Logger.getInstance();
  private redisClient: any; // Redis client for fast caching
  private pgPool: any; // PostgreSQL pool for semantic search
  private neo4jDriver: any; // Neo4j driver for relationship traversal

  constructor() {
    // Initialize database connections asynchronously
    this.initializeConnections().catch(err => {
      this.logger.error('Failed to initialize semantic engine:', err);
    });
  }

  /**
   * Main enhancement workflow:
   * 1. Execute semantic search based on user query
   * 2. Get reasonable subset of most relevant files
   * 3. Traverse Neo4j to find all related files
   * 4. Provide complete context with cached content
   * 5. Update cache after Claude's response
   */
  async enhanceQuery(
    query: string,
    maxPrimaryFiles: number = 8,
    maxRelatedFiles: number = 15,
    maxContextSize: number = 100000 // ~100KB total context
  ): Promise<EnhancementContext> {
    const startTime = Date.now();
    this.logger.info(`🔍 Enhancing query with semantic search: "${query}"`);

    try {
      // Step 1: Execute semantic search to get most relevant files
      const primaryFiles = await this.executeSemanticSearch(query, maxPrimaryFiles);
      this.logger.info(`Found ${primaryFiles.length} primary relevant files`);

      // Step 2: Traverse Neo4j relationships to find all related files
      const relatedFiles = await this.findAllRelatedFiles(
        primaryFiles.map(f => f.filePath),
        maxRelatedFiles
      );
      this.logger.info(`Found ${relatedFiles.length} related files through graph traversal`);

      // Step 3: Validate cache freshness and update if needed
      const validatedContext = await this.validateAndUpdateCache(primaryFiles, relatedFiles);

      // Step 4: Build complete context within size limits
      const context = await this.buildOptimalContext(
        query,
        validatedContext.primaryFiles,
        validatedContext.relatedFiles,
        maxContextSize
      );

      const duration = Date.now() - startTime;
      this.logger.info(`✅ Context enhancement complete (${duration}ms): ${context.totalFiles} files, ${context.contextSize} chars, ${Math.round(context.cacheHitRate * 100)}% cache hit`);

      return context;
    } catch (error) {
      this.logger.error('❌ Semantic enhancement failed:', error);
      throw error;
    }
  }

  /**
   * Execute semantic search using pgvector embeddings
   */
  private async executeSemanticSearch(query: string, limit: number): Promise<SemanticSearchResult[]> {
    // Ensure connections are initialized
    if (!this.pgPool) {
      await this.initializeConnections();
    }

    // Generate embedding for query
    const queryEmbedding = await this.generateQueryEmbedding(query);

    // Search semantic_search_embeddings table using cosine similarity
    const searchQuery = `
      SELECT 
        file_path,
        content_text,
        content_hash,
        metadata,
        1 - (embedding <=> $1) as relevance_score
      FROM semantic_search_embeddings 
      WHERE 1 - (embedding <=> $1) > 0.3  -- Minimum relevance threshold
      ORDER BY relevance_score DESC
      LIMIT $2
    `;

    const results = await this.pgPool.query(searchQuery, [queryEmbedding, limit]);

    const searchResults: SemanticSearchResult[] = [];
    for (const row of results.rows) {
      // Check Redis cache for content and hash validation
      const cachedFile = await this.getFromRedisCache(row.file_path);
      
      searchResults.push({
        filePath: row.file_path,
        relevanceScore: parseFloat(row.relevance_score),
        content: cachedFile?.content || row.content_text,
        lastModified: cachedFile?.lastModified || Date.now(),
        hash: cachedFile?.hash || row.content_hash,
        matchReason: this.determineMatchReason(query, row.content_text, row.relevance_score)
      });
    }

    return searchResults;
  }

  /**
   * Find all files related through Neo4j graph relationships
   */
  private async findAllRelatedFiles(primaryFilePaths: string[], limit: number): Promise<RelatedFileContext[]> {
    const session = this.neo4jDriver.session();
    
    try {
      // Cypher query to find all files related to primary files within 2-3 degrees
      const cypherQuery = `
        MATCH (primary:File) 
        WHERE primary.path IN $primaryPaths
        
        MATCH (primary)-[r1:DEPENDS_ON|USES|CONFIGURES|TESTS|DOCUMENTS|SIMILAR_TO*1..2]-(related:File)
        WHERE NOT related.path IN $primaryPaths
        
        WITH related, r1, 
             CASE 
               WHEN size(r1) = 1 THEN 1
               WHEN size(r1) = 2 THEN 2  
               ELSE 3
             END as distance,
             type(r1[0]) as relationshipType
        
        RETURN DISTINCT 
          related.path as filePath,
          relationshipType,
          distance
        ORDER BY distance ASC, relationshipType ASC
        LIMIT $limit
      `;

      const result = await session.run(cypherQuery, {
        primaryPaths: primaryFilePaths,
        limit
      });

      const relatedFiles: RelatedFileContext[] = [];
      for (const record of result.records) {
        const filePath = record.get('filePath');
        const relationshipType = record.get('relationshipType');
        const distance = record.get('distance').toNumber();

        // Get cached content for this file
        const cachedFile = await this.getFromRedisCache(filePath);
        if (cachedFile) {
          relatedFiles.push({
            filePath,
            relationshipType,
            content: cachedFile.content,
            hash: cachedFile.hash,
            distance
          });
        }
      }

      return relatedFiles;
    } finally {
      await session.close();
    }
  }

  /**
   * Validate cache freshness using file hash comparison
   */
  private async validateAndUpdateCache(
    primaryFiles: SemanticSearchResult[],
    relatedFiles: RelatedFileContext[]
  ): Promise<{ primaryFiles: SemanticSearchResult[], relatedFiles: RelatedFileContext[] }> {
    const filesToCheck = [
      ...primaryFiles.map(f => f.filePath),
      ...relatedFiles.map(f => f.filePath)
    ];

    let cacheHits = 0;
    let cacheUpdates = 0;

    for (const filePath of filesToCheck) {
      const currentHash = await this.calculateFileHash(filePath);
      const cachedFile = await this.getFromRedisCache(filePath);

      if (!cachedFile || cachedFile.hash !== currentHash) {
        // Cache miss or stale - update cache
        await this.updateRedisCache(filePath, currentHash);
        cacheUpdates++;
      } else {
        cacheHits++;
      }
    }

    this.logger.info(`Cache validation: ${cacheHits} hits, ${cacheUpdates} updates`);

    // Return validated files (content refreshed if needed)
    const validatedPrimary = await this.refreshFileContent(primaryFiles);
    const validatedRelated = await this.refreshRelatedFileContent(relatedFiles);

    return {
      primaryFiles: validatedPrimary,
      relatedFiles: validatedRelated
    };
  }

  /**
   * Build optimal context within size constraints
   */
  private async buildOptimalContext(
    query: string,
    primaryFiles: SemanticSearchResult[],
    relatedFiles: RelatedFileContext[],
    maxSize: number
  ): Promise<EnhancementContext> {
    let currentSize = 0;
    let cacheHits = 0;
    let totalFiles = 0;

    // Prioritize primary files (highest relevance first)
    const includedPrimary = [];
    for (const file of primaryFiles.sort((a, b) => b.relevanceScore - a.relevanceScore)) {
      if (currentSize + file.content.length <= maxSize) {
        includedPrimary.push(file);
        currentSize += file.content.length;
        totalFiles++;
        cacheHits++; // Content came from cache
      }
    }

    // Add related files by relationship priority and distance
    const includedRelated = [];
    const priorityOrder = ['DEPENDS_ON', 'USES', 'TESTS', 'CONFIGURES', 'SIMILAR_TO'];
    
    for (const priority of priorityOrder) {
      const filesOfType = relatedFiles
        .filter(f => f.relationshipType === priority)
        .sort((a, b) => a.distance - b.distance);

      for (const file of filesOfType) {
        if (currentSize + file.content.length <= maxSize) {
          includedRelated.push(file);
          currentSize += file.content.length;
          totalFiles++;
          cacheHits++;
        }
      }
    }

    return {
      query,
      primaryFiles: includedPrimary,
      relatedFiles: includedRelated,
      totalFiles,
      contextSize: currentSize,
      cacheHitRate: cacheHits / totalFiles,
      generatedAt: Date.now()
    };
  }

  /**
   * Update context after Claude's processing
   */
  async updateContextAfterProcessing(
    modifiedFiles: string[],
    context: EnhancementContext
  ): Promise<void> {
    this.logger.info(`📝 Updating context after processing ${modifiedFiles.length} modified files`);

    for (const filePath of modifiedFiles) {
      try {
        // Recalculate hash and update cache
        const newHash = await this.calculateFileHash(filePath);
        await this.updateRedisCache(filePath, newHash);

        // Update semantic embeddings if content changed significantly
        const cachedFile = await this.getFromRedisCache(filePath);
        if (cachedFile) {
          await this.updateSemanticEmbedding(filePath, cachedFile.content, newHash);
        }

        this.logger.debug(`Updated cache and embeddings for ${filePath}`);
      } catch (error) {
        this.logger.warn(`Failed to update context for ${filePath}:`, error);
      }
    }
  }

  // Helper methods
  private async initializeConnections(): Promise<void> {
    try {
      // For now, use mock database connections since we don't have containers running
      // In production, this would initialize actual database clients
      this.pgPool = {
        query: async (sql: string, params: any[]) => {
          // Mock PostgreSQL query results
          return { rows: [] };
        }
      };
      
      this.redisClient = {
        get: async (key: string) => null,
        set: async (key: string, value: string) => 'OK',
        setex: async (key: string, ttl: number, value: string) => 'OK'
      };
      
      this.neo4jDriver = {
        session: () => ({
          run: async (query: string, params?: any) => ({ records: [] }),
          close: async () => {}
        })
      };
      
      this.logger.info('🔌 Semantic enhancement engine initialized');
    } catch (error) {
      this.logger.error('❌ Failed to initialize database connections:', error);
      throw error;
    }
  }

  private async generateQueryEmbedding(query: string): Promise<number[]> {
    // Generate embedding using same method as semantic search
    // Implementation would use embedding model (OpenAI, local model, etc.)
    return new Array(1536).fill(0); // Placeholder
  }

  private async getFromRedisCache(filePath: string): Promise<RedisFileCache | null> {
    // Get file content and metadata from Redis
    const cacheKey = `file:${filePath}`;
    const cached = await this.redisClient?.get(cacheKey);
    return cached ? JSON.parse(cached) : null;
  }

  private async updateRedisCache(filePath: string, hash: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const stats = await fs.stat(filePath);

      const cacheData: RedisFileCache = {
        content,
        hash,
        lastModified: stats.mtime.getTime(),
        size: stats.size,
        language: this.detectLanguage(filePath),
        exports: this.extractExports(content),
        imports: this.extractImports(content),
        classes: this.extractClasses(content),
        functions: this.extractFunctions(content)
      };

      const cacheKey = `file:${filePath}`;
      await this.redisClient?.setex(cacheKey, 3600, JSON.stringify(cacheData)); // 1 hour TTL
    } catch (error) {
      this.logger.warn(`Failed to update Redis cache for ${filePath}:`, error);
    }
  }

  private async calculateFileHash(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return crypto.createHash('sha256').update(content).digest('hex');
    } catch (error) {
      return '';
    }
  }

  private async updateSemanticEmbedding(filePath: string, content: string, hash: string): Promise<void> {
    // Update semantic_search_embeddings table with new content and embedding
    // Implementation would generate new embedding and update PostgreSQL
  }

  private determineMatchReason(query: string, content: string, score: number): string {
    if (score > 0.8) return 'High semantic similarity';
    if (score > 0.6) return 'Strong content match';
    if (score > 0.4) return 'Relevant context';
    return 'Related content';
  }

  // Simplified extraction methods (would be more sophisticated in real implementation)
  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      'ts': 'TypeScript', 'js': 'JavaScript', 'py': 'Python',
      'java': 'Java', 'cs': 'C#', 'go': 'Go'
    };
    return langMap[ext || ''] || 'Unknown';
  }

  private extractExports(content: string): string[] {
    const matches = content.match(/export\s+(?:class|function|const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g) || [];
    return matches.map(m => m.split(' ').pop() || '');
  }

  private extractImports(content: string): string[] {
    const matches = content.match(/import\s+.*?from\s+['"`]([^'"`]+)['"`]/g) || [];
    return matches.map(m => m.match(/['"`]([^'"`]+)['"`]/)?.[1] || '');
  }

  private extractClasses(content: string): string[] {
    const matches = content.match(/class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g) || [];
    return matches.map(m => m.split(' ')[1]);
  }

  private extractFunctions(content: string): string[] {
    const matches = content.match(/(?:function|const)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g) || [];
    return matches.map(m => m.split(' ').pop() || '');
  }

  private async refreshFileContent(files: SemanticSearchResult[]): Promise<SemanticSearchResult[]> {
    // Refresh content from Redis cache after validation
    for (const file of files) {
      const cached = await this.getFromRedisCache(file.filePath);
      if (cached) {
        file.content = cached.content;
        file.hash = cached.hash;
        file.lastModified = cached.lastModified;
      }
    }
    return files;
  }

  private async refreshRelatedFileContent(files: RelatedFileContext[]): Promise<RelatedFileContext[]> {
    // Refresh content from Redis cache after validation
    for (const file of files) {
      const cached = await this.getFromRedisCache(file.filePath);
      if (cached) {
        file.content = cached.content;
        file.hash = cached.hash;
      }
    }
    return files;
  }
}

export default SemanticEnhancementEngine;
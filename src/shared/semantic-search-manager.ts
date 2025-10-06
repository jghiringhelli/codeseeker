/**
 * Unified Semantic Search Manager
 * Consolidates all semantic search functionality across init, update, and retrieval cycles
 * Ensures consistent embedding generation, chunking, and storage
 */

import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import { Logger } from '../utils/logger';
import { DatabaseConnections } from '../config/database-config';
import EmbeddingService from '../cli/services/embedding-service';

export interface SemanticChunk {
  id: string;
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  chunkIndex: number;
  isFullFile: boolean;
  hash: string;
  metadata: {
    language: string;
    size: number;
    functions: string[];
    classes: string[];
    imports: string[];
    exports: string[];
    significance: 'high' | 'medium' | 'low';
  };
}

export interface SemanticSearchResult {
  chunk: SemanticChunk;
  relevanceScore: number;
  matchReason: string;
  embedding?: number[];
}

export interface SearchQuery {
  text: string;
  projectId?: string;
  maxResults?: number;
  minSimilarity?: number;
  fileTypes?: string[];
  includeChunks?: boolean;
}

export interface SearchResponse {
  query: string;
  results: SemanticSearchResult[];
  totalFound: number;
  searchTime: number;
  usedFallback: boolean;
  metadata: {
    databaseResults: number;
    fallbackResults: number;
    chunkResults: number;
    fullFileResults: number;
  };
}

// Legacy interface for compatibility with SemanticEnhancementEngine
export interface EnhancementContext {
  query: string;
  primaryFiles: Array<{
    filePath: string;
    relevanceScore: number;
    content: string;
    lastModified: number;
    hash: string;
    matchReason: string;
  }>;
  relatedFiles: Array<{
    filePath: string;
    relationshipType: string;
    content: string;
    hash: string;
    distance: number;
  }>;
  totalFiles: number;
  contextSize: number;
  cacheHitRate: number;
  generatedAt: number;
}

/**
 * Unified Semantic Search Manager
 * Single point of truth for all semantic search operations
 */
export class SemanticSearchManager {
  private logger: Logger;
  private dbConnections: DatabaseConnections;
  private embeddingService: EmbeddingService;
  private initialized = false;

  // Configuration
  private readonly CHUNK_SIZE = 8000; // Characters per chunk
  private readonly OVERLAP_SIZE = 200; // Character overlap between chunks
  private readonly MIN_CHUNK_SIZE = 500; // Minimum viable chunk size
  private readonly EMBEDDING_DIMENSIONS = 384; // OpenAI text-embedding-3-small standard

  constructor() {
    this.logger = Logger.getInstance();
    this.dbConnections = new DatabaseConnections();
    this.embeddingService = new EmbeddingService({
      provider: 'xenova',  // Use Xenova transformers for zero-cost, high-quality embeddings
      model: 'Xenova/all-MiniLM-L6-v2',     // Use Xenova transformer model
      chunkSize: this.CHUNK_SIZE,
      maxTokens: 8191
    });
  }

  /**
   * Initialize semantic search for a project during /init
   */
  async initializeProject(
    projectId: string,
    files: string[],
    progressCallback?: (progress: number, current: string, detail: string) => void
  ): Promise<{ success: number; errors: number; chunks: number; skipped: number }> {

    this.logger.info(`🚀 Initializing semantic search for project ${projectId} with ${files.length} files`);

    await this.ensureInitialized();

    let success = 0;
    let errors = 0;
    let totalChunks = 0;
    let skipped = 0;

    try {
      const pgClient = await this.dbConnections.getPostgresConnection();

      // Clear existing embeddings for this project
      await pgClient.query('DELETE FROM semantic_search_embeddings WHERE project_id = $1', [projectId]);

      for (let i = 0; i < files.length; i++) {
        const filePath = files[i];

        try {
          progressCallback?.(
            Math.round((i / files.length) * 100),
            filePath,
            'Processing file content and generating chunks...'
          );

          const result = await this.processFileForInit(projectId, filePath);

          if (result.success) {
            success++;
            totalChunks += result.chunks;
          } else if (result.skipped) {
            skipped++;
          } else {
            errors++;
          }

        } catch (error) {
          this.logger.error(`Failed to process file ${filePath}:`, error);
          errors++;
        }
      }

      this.logger.info(`✅ Semantic search initialization complete: ${success} files, ${totalChunks} chunks, ${skipped} skipped, ${errors} errors`);

      return { success, errors, chunks: totalChunks, skipped };

    } catch (error) {
      this.logger.error('Semantic search initialization failed:', error);
      throw error;
    }
  }

  /**
   * Update semantic search for modified files during cycle updates
   */
  async updateFiles(
    projectId: string,
    modifiedFiles: string[]
  ): Promise<{ updated: number; errors: number; chunks: number }> {

    this.logger.info(`🔄 Updating semantic search for ${modifiedFiles.length} modified files`);

    await this.ensureInitialized();

    let updated = 0;
    let errors = 0;
    let totalChunks = 0;

    try {
      const pgClient = await this.dbConnections.getPostgresConnection();

      for (const filePath of modifiedFiles) {
        try {
          // Remove existing chunks for this file
          await pgClient.query(
            'DELETE FROM semantic_search_embeddings WHERE project_id = $1 AND file_path = $2',
            [projectId, filePath]
          );

          // Reprocess the file
          const result = await this.processFileForInit(projectId, filePath);

          if (result.success) {
            updated++;
            totalChunks += result.chunks;
          } else {
            errors++;
          }

        } catch (error) {
          this.logger.error(`Failed to update file ${filePath}:`, error);
          errors++;
        }
      }

      this.logger.info(`✅ Semantic search update complete: ${updated} files updated, ${totalChunks} chunks, ${errors} errors`);

      return { updated, errors, chunks: totalChunks };

    } catch (error) {
      this.logger.error('Semantic search update failed:', error);
      throw error;
    }
  }

  /**
   * Perform semantic search during query/retrieval
   */
  async search(query: SearchQuery): Promise<SearchResponse> {
    const startTime = Date.now();

    this.logger.info(`🔍 Performing semantic search: "${query.text}"`);

    await this.ensureInitialized();

    try {
      // First try database search
      const databaseResults = await this.searchDatabase(query);

      // If insufficient results, use fallback
      const needsFallback = databaseResults.length < (query.maxResults || 10);
      let fallbackResults: SemanticSearchResult[] = [];

      if (needsFallback) {
        this.logger.info('Database search insufficient, using fallback discovery');
        fallbackResults = await this.searchFallback(query);
      }

      // Combine and rank results
      const allResults = [...databaseResults, ...fallbackResults];
      const finalResults = this.rankAndLimitResults(allResults, query.maxResults || 10);

      const searchTime = Date.now() - startTime;

      const response: SearchResponse = {
        query: query.text,
        results: finalResults,
        totalFound: allResults.length,
        searchTime,
        usedFallback: needsFallback,
        metadata: {
          databaseResults: databaseResults.length,
          fallbackResults: fallbackResults.length,
          chunkResults: finalResults.filter(r => !r.chunk.isFullFile).length,
          fullFileResults: finalResults.filter(r => r.chunk.isFullFile).length
        }
      };

      this.logger.info(`✅ Search complete: ${finalResults.length} results in ${searchTime}ms`);

      return response;

    } catch (error) {
      this.logger.error('Semantic search failed:', error);

      // Return fallback-only results on error
      const fallbackResults = await this.searchFallback(query);

      return {
        query: query.text,
        results: fallbackResults.slice(0, query.maxResults || 10),
        totalFound: fallbackResults.length,
        searchTime: Date.now() - startTime,
        usedFallback: true,
        metadata: {
          databaseResults: 0,
          fallbackResults: fallbackResults.length,
          chunkResults: fallbackResults.filter(r => !r.chunk.isFullFile).length,
          fullFileResults: fallbackResults.filter(r => r.chunk.isFullFile).length
        }
      };
    }
  }

  /**
   * Get statistics about the semantic search index
   */
  async getIndexStats(projectId?: string): Promise<{
    totalChunks: number;
    totalFiles: number;
    avgChunksPerFile: number;
    storageSize: string;
  }> {
    await this.ensureInitialized();

    try {
      const pgClient = await this.dbConnections.getPostgresConnection();

      const whereClause = projectId ? 'WHERE project_id = $1' : '';
      const params = projectId ? [projectId] : [];

      const result = await pgClient.query(`
        SELECT
          COUNT(*) as total_chunks,
          COUNT(DISTINCT file_path) as total_files,
          AVG(LENGTH(content)) as avg_chunk_size
        FROM semantic_search_embeddings
        ${whereClause}
      `, params);

      const stats = result.rows[0];

      return {
        totalChunks: parseInt(stats.total_chunks),
        totalFiles: parseInt(stats.total_files),
        avgChunksPerFile: stats.total_files > 0 ? stats.total_chunks / stats.total_files : 0,
        storageSize: `${Math.round(stats.avg_chunk_size * stats.total_chunks / 1024 / 1024)}MB`
      };

    } catch (error) {
      this.logger.error('Failed to get index stats:', error);
      return {
        totalChunks: 0,
        totalFiles: 0,
        avgChunksPerFile: 0,
        storageSize: '0MB'
      };
    }
  }

  // Private methods

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    try {
      // Test database connections
      const pgClient = await this.dbConnections.getPostgresConnection();
      await pgClient.query('SELECT 1');

      this.initialized = true;
      this.logger.info('🔌 Semantic search manager initialized');
    } catch (error) {
      this.logger.error('Failed to initialize semantic search manager:', error);
      throw error;
    }
  }

  private async processFileForInit(
    projectId: string,
    filePath: string
  ): Promise<{ success: boolean; skipped: boolean; chunks: number }> {

    try {
      // Read and validate file
      const content = await fs.readFile(filePath, 'utf-8');
      const stats = await fs.stat(filePath);

      if (this.shouldSkipFile(filePath, content)) {
        return { success: false, skipped: true, chunks: 0 };
      }

      // Generate file hash
      const fileHash = crypto.createHash('sha256').update(content).digest('hex');

      // Create chunks
      const chunks = await this.createSemanticChunks(filePath, content, fileHash);

      // Generate embeddings and store
      await this.storeChunksWithEmbeddings(projectId, chunks);

      return { success: true, skipped: false, chunks: chunks.length };

    } catch (error) {
      this.logger.error(`Failed to process file ${filePath}:`, error);
      return { success: false, skipped: false, chunks: 0 };
    }
  }

  private async createSemanticChunks(
    filePath: string,
    content: string,
    fileHash: string
  ): Promise<SemanticChunk[]> {

    const chunks: SemanticChunk[] = [];
    const lines = content.split('\n');

    // Always create a full-file embedding for context
    chunks.push({
      id: `${fileHash}_full`,
      filePath,
      content,
      startLine: 1,
      endLine: lines.length,
      chunkIndex: 0,
      isFullFile: true,
      hash: fileHash,
      metadata: {
        ...this.extractFileMetadata(filePath, content, 'high'),
        chunkType: 'full-file'
      } as any
    });

    // For larger files or code files, also create method/class level chunks
    if (content.length > this.CHUNK_SIZE || this.isCodeFile(filePath)) {
      const structuralChunks = await this.createStructuralChunks(filePath, content, fileHash, lines);
      chunks.push(...structuralChunks);
    }

    // If no structural chunks were created, fall back to sliding window for large files
    if (chunks.length === 1 && content.length > this.CHUNK_SIZE) {
      // Split into overlapping chunks
      let currentContent = '';
      let currentStartLine = 1;
      let chunkIndex = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] + '\n';

        if (currentContent.length + line.length > this.CHUNK_SIZE && currentContent.length > this.MIN_CHUNK_SIZE) {
          // Create chunk
          const chunkHash = crypto.createHash('md5').update(currentContent).digest('hex');

          chunks.push({
            id: `${fileHash}_chunk_${chunkIndex}`,
            filePath,
            content: currentContent.trim(),
            startLine: currentStartLine,
            endLine: i,
            chunkIndex,
            isFullFile: false,
            hash: chunkHash,
            metadata: this.extractFileMetadata(filePath, currentContent, this.determineChunkSignificance(currentContent))
          });

          // Start new chunk with overlap
          const overlapLines = this.getOverlapContent(currentContent);
          currentContent = overlapLines + line;
          currentStartLine = Math.max(1, i - Math.ceil(this.OVERLAP_SIZE / 100));
          chunkIndex++;
        } else {
          currentContent += line;
        }
      }

      // Add final chunk if there's remaining content
      if (currentContent.trim().length > this.MIN_CHUNK_SIZE) {
        const chunkHash = crypto.createHash('md5').update(currentContent).digest('hex');

        chunks.push({
          id: `${fileHash}_chunk_${chunkIndex}`,
          filePath,
          content: currentContent.trim(),
          startLine: currentStartLine,
          endLine: lines.length,
          chunkIndex,
          isFullFile: false,
          hash: chunkHash,
          metadata: this.extractFileMetadata(filePath, currentContent, this.determineChunkSignificance(currentContent))
        });
      }
    }

    return chunks;
  }

  private async storeChunksWithEmbeddings(projectId: string, chunks: SemanticChunk[]): Promise<void> {
    const pgClient = await this.dbConnections.getPostgresConnection();

    for (const chunk of chunks) {
      try {
        // Generate embedding
        const embedding = await this.embeddingService.generateEmbedding(chunk.content, chunk.filePath);
        const embeddingVector = `[${embedding.join(',')}]`;

        // Store in database
        await pgClient.query(`
          INSERT INTO semantic_search_embeddings (
            project_id,
            file_path,
            chunk_id,
            content,
            hash,
            embedding,
            metadata,
            start_line,
            end_line,
            chunk_index,
            is_full_file,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6::vector, $7, $8, $9, $10, $11, NOW(), NOW())
          ON CONFLICT (chunk_id)
          DO UPDATE SET
            content = EXCLUDED.content,
            hash = EXCLUDED.hash,
            embedding = EXCLUDED.embedding,
            metadata = EXCLUDED.metadata,
            updated_at = NOW()
        `, [
          projectId,
          chunk.filePath,
          chunk.id,
          chunk.content,
          chunk.hash,
          embeddingVector,
          JSON.stringify(chunk.metadata),
          chunk.startLine,
          chunk.endLine,
          chunk.chunkIndex,
          chunk.isFullFile
        ]);

      } catch (error) {
        this.logger.error(`Failed to store chunk ${chunk.id}:`, error);
      }
    }
  }

  private async searchDatabase(query: SearchQuery): Promise<SemanticSearchResult[]> {
    try {
      // Generate query embedding
      const queryEmbedding = await this.embeddingService.generateEmbedding(query.text, 'query.txt');
      const embeddingVector = `[${queryEmbedding.join(',')}]`;

      const pgClient = await this.dbConnections.getPostgresConnection();

      // Build search query
      let whereClause = '1 - (embedding <=> $1::vector) > $2';
      const params: any[] = [embeddingVector, query.minSimilarity || 0.3];
      let paramIndex = 2;

      if (query.projectId) {
        whereClause += ` AND project_id = $${++paramIndex}`;
        params.push(query.projectId);
      }

      if (query.fileTypes && query.fileTypes.length > 0) {
        const fileTypeConditions = query.fileTypes.map(ext => {
          return `file_path LIKE $${++paramIndex}`;
        });
        params.push(...query.fileTypes.map(ext => `%.${ext}`));
        whereClause += ` AND (${fileTypeConditions.join(' OR ')})`;
      }

      const searchQuery = `
        SELECT
          chunk_id,
          file_path,
          content,
          hash,
          metadata,
          start_line,
          end_line,
          chunk_index,
          is_full_file,
          1 - (embedding <=> $1::vector) as relevance_score
        FROM semantic_search_embeddings
        WHERE ${whereClause}
        ORDER BY relevance_score DESC
        LIMIT $${++paramIndex}
      `;
      params.push(query.maxResults || 10);

      const result = await pgClient.query(searchQuery, params);

      const results: SemanticSearchResult[] = [];

      for (const row of result.rows) {
        const metadata = JSON.parse(row.metadata || '{}');

        const chunk: SemanticChunk = {
          id: row.chunk_id,
          filePath: row.file_path,
          content: row.content,
          startLine: row.start_line,
          endLine: row.end_line,
          chunkIndex: row.chunk_index,
          isFullFile: row.is_full_file,
          hash: row.hash,
          metadata
        };

        results.push({
          chunk,
          relevanceScore: parseFloat(row.relevance_score),
          matchReason: `Semantic similarity: ${Math.round(row.relevance_score * 100)}%`
        });
      }

      return results;

    } catch (error) {
      this.logger.error('Database search failed:', error);
      return [];
    }
  }

  private async searchFallback(query: SearchQuery): Promise<SemanticSearchResult[]> {
    // Use fallback file discovery similar to semantic-enhancement-engine
    // This is simplified - in practice would use the same fallback logic
    const results: SemanticSearchResult[] = [];

    // Basic keyword-based file discovery
    const queryLower = query.text.toLowerCase();
    const fallbackFiles: string[] = [];

    // Add fallback file patterns based on query
    if (queryLower.includes('create') || queryLower.includes('generate')) {
      fallbackFiles.push(
        'client/src/App.tsx', 'server/index.js', 'package.json',
        'README.md', '.codemind/codemind.md'
      );
    }

    for (const filePath of fallbackFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const stats = await fs.stat(filePath);
        const hash = crypto.createHash('sha256').update(content).digest('hex');

        const relevanceScore = this.calculateFallbackRelevance(query.text, content, filePath);

        if (relevanceScore > 0.1) {
          const chunk: SemanticChunk = {
            id: `fallback_${hash}`,
            filePath,
            content,
            startLine: 1,
            endLine: content.split('\n').length,
            chunkIndex: 0,
            isFullFile: true,
            hash,
            metadata: this.extractFileMetadata(filePath, content, 'medium')
          };

          results.push({
            chunk,
            relevanceScore,
            matchReason: 'Fallback discovery - project structure file'
          });
        }
      } catch (error) {
        // File doesn't exist, skip
        continue;
      }
    }

    return results;
  }

  // Helper methods
  private shouldSkipFile(filePath: string, content: string): boolean {
    const skipExtensions = ['.png', '.jpg', '.gif', '.pdf', '.zip', '.exe'];
    const ext = filePath.split('.').pop()?.toLowerCase();

    return skipExtensions.includes(`.${ext}`) ||
           content.length > 200000 || // Skip very large files
           content.length === 0; // Skip empty files
  }

  private extractFileMetadata(filePath: string, content: string, significance: 'high' | 'medium' | 'low') {
    return {
      language: this.detectLanguage(filePath),
      size: content.length,
      functions: this.extractFunctions(content),
      classes: this.extractClasses(content),
      imports: this.extractImports(content),
      exports: this.extractExports(content),
      significance
    };
  }

  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      'ts': 'TypeScript', 'tsx': 'TypeScript',
      'js': 'JavaScript', 'jsx': 'JavaScript',
      'py': 'Python', 'java': 'Java', 'cs': 'C#', 'go': 'Go'
    };
    return langMap[ext || ''] || 'Unknown';
  }

  private extractFunctions(content: string): string[] {
    const matches = content.match(/(?:function|const)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g) || [];
    return matches.map(m => m.split(' ').pop() || '').slice(0, 10);
  }

  private extractClasses(content: string): string[] {
    const matches = content.match(/class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g) || [];
    return matches.map(m => m.split(' ')[1]).slice(0, 10);
  }

  private extractImports(content: string): string[] {
    const matches = content.match(/import.*?from\s+['"']([^'"']+)['"']/g) || [];
    return matches.map(m => m.match(/['"']([^'"']+)['"']/)?.[1] || '').slice(0, 10);
  }

  private extractExports(content: string): string[] {
    const matches = content.match(/export\s+(?:class|function|const)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g) || [];
    return matches.map(m => m.split(' ').pop() || '').slice(0, 10);
  }

  private determineChunkSignificance(content: string): 'high' | 'medium' | 'low' {
    const hasClasses = /class\s+/.test(content);
    const hasFunctions = /function\s+|const\s+\w+\s*=/.test(content);
    const hasExports = /export\s+/.test(content);
    const hasImports = /import\s+/.test(content);

    const score = [hasClasses, hasFunctions, hasExports, hasImports].filter(Boolean).length;

    if (score >= 3) return 'high';
    if (score >= 2) return 'medium';
    return 'low';
  }

  private getOverlapContent(content: string): string {
    const lines = content.split('\n');
    const overlapLines = Math.ceil(this.OVERLAP_SIZE / 80); // Estimate lines
    return lines.slice(-overlapLines).join('\n') + '\n';
  }

  private calculateFallbackRelevance(query: string, content: string, filePath: string): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const contentLower = content.toLowerCase();
    const pathLower = filePath.toLowerCase();

    let score = 0;

    for (const word of queryWords) {
      if (word.length < 3) continue;
      const contentMatches = (contentLower.match(new RegExp(word, 'g')) || []).length;
      const pathMatches = (pathLower.match(new RegExp(word, 'g')) || []).length;
      score += contentMatches * 0.1 + pathMatches * 0.5;
    }

    // File type bonuses
    if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) score += 0.2;
    if (filePath.includes('component')) score += 0.3;

    return Math.min(score, 1.0);
  }

  private rankAndLimitResults(results: SemanticSearchResult[], maxResults: number): SemanticSearchResult[] {
    // Sort by relevance score, then by significance
    results.sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }

      const sigOrder = { high: 3, medium: 2, low: 1 };
      return sigOrder[b.chunk.metadata.significance] - sigOrder[a.chunk.metadata.significance];
    });

    return results.slice(0, maxResults);
  }

  /**
   * Check if file is a code file that should get structural chunking
   */
  private isCodeFile(filePath: string): boolean {
    const codeExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h', '.cs', '.php', '.rb', '.go', '.rs', '.kt', '.swift', '.scala'];
    return codeExtensions.some(ext => filePath.toLowerCase().endsWith(ext));
  }

  /**
   * Create structural chunks based on code structure (classes, methods, functions)
   */
  private async createStructuralChunks(filePath: string, content: string, fileHash: string, lines: string[]): Promise<SemanticChunk[]> {
    const chunks: SemanticChunk[] = [];

    try {
      // Extract code entities similar to how Neo4j analysis works
      const entities = this.extractCodeEntities(content, lines);

      let chunkIndex = 1; // Start at 1 since 0 is the full file

      for (const entity of entities) {
        const entityContent = lines.slice(entity.startLine - 1, entity.endLine).join('\n');

        // Only create chunks for substantial entities (not single line declarations)
        if (entityContent.trim().length > 50 && (entity.endLine - entity.startLine) > 2) {
          const entityHash = require('crypto').createHash('sha256').update(entityContent).digest('hex');

          chunks.push({
            id: `${fileHash}_${entity.type}_${entity.name}_${chunkIndex}`,
            filePath,
            content: entityContent,
            startLine: entity.startLine,
            endLine: entity.endLine,
            chunkIndex,
            isFullFile: false,
            hash: entityHash,
            metadata: {
              ...this.extractFileMetadata(filePath, entityContent, 'medium'),
              chunkType: entity.type,
              entityName: entity.name,
              parentClass: entity.parentClass || null
            } as any
          });

          chunkIndex++;
        }
      }

      // If we didn't extract enough structural chunks for a large file, add logical chunks
      if (chunks.length < 3 && content.length > this.CHUNK_SIZE * 2) {
        const logicalChunks = this.createLogicalChunks(filePath, content, fileHash, lines, chunkIndex);
        chunks.push(...logicalChunks);
      }

    } catch (error) {
      this.logger.warn(`Failed to create structural chunks for ${filePath}, falling back to logical chunking`);
      // Fall back to logical chunking if structural analysis fails
      const logicalChunks = this.createLogicalChunks(filePath, content, fileHash, lines, 1);
      chunks.push(...logicalChunks);
    }

    return chunks;
  }

  /**
   * Extract code entities (classes, methods, functions) from content
   */
  private extractCodeEntities(content: string, lines: string[]): Array<{
    type: 'class' | 'method' | 'function';
    name: string;
    startLine: number;
    endLine: number;
    parentClass?: string;
  }> {
    const entities: any[] = [];
    let currentClass: string | null = null;
    let braceStack: number[] = [];
    let inFunction = false;
    let functionStart = 0;
    let functionName = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNum = i + 1;

      // Class detection
      const classMatch = line.match(/(?:class|interface)\s+(\w+)/);
      if (classMatch) {
        currentClass = classMatch[1];
        const classEnd = this.findBlockEnd(lines, i);
        entities.push({
          type: 'class',
          name: currentClass,
          startLine: lineNum,
          endLine: classEnd
        });
      }

      // Function/method detection
      const functionMatch = line.match(/(?:function\s+(\w+)|(\w+)\s*\([^)]*\)\s*\{|(\w+):\s*function|(\w+)\s*=>\s*\{|async\s+(\w+)|(\w+)\s*\([^)]*\)\s*=>)/);
      if (functionMatch && !inFunction) {
        functionName = functionMatch[1] || functionMatch[2] || functionMatch[3] || functionMatch[4] || functionMatch[5] || functionMatch[6] || 'anonymous';
        functionStart = lineNum;
        inFunction = true;
        braceStack = [];
      }

      // Track braces for function end detection
      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;

      if (inFunction) {
        for (let j = 0; j < openBraces; j++) braceStack.push(lineNum);
        for (let j = 0; j < closeBraces; j++) {
          braceStack.pop();
          if (braceStack.length === 0) {
            // Function ended
            entities.push({
              type: currentClass ? 'method' : 'function',
              name: functionName,
              startLine: functionStart,
              endLine: lineNum,
              parentClass: currentClass || undefined
            });
            inFunction = false;
            break;
          }
        }
      }
    }

    return entities;
  }

  /**
   * Find the end of a code block starting at the given line
   */
  private findBlockEnd(lines: string[], startLine: number): number {
    let braceCount = 0;
    let foundOpenBrace = false;

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];
      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;

      braceCount += openBraces - closeBraces;

      if (openBraces > 0) foundOpenBrace = true;

      if (foundOpenBrace && braceCount === 0) {
        return i + 1;
      }
    }

    return lines.length;
  }

  /**
   * Create logical chunks for files without clear structural boundaries
   */
  private createLogicalChunks(filePath: string, content: string, fileHash: string, lines: string[], startIndex: number): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];
    const targetChunkSize = this.CHUNK_SIZE;
    const overlap = Math.floor(targetChunkSize * 0.1); // 10% overlap

    let currentContent = '';
    let currentStartLine = 1;
    let chunkIndex = startIndex;

    for (let i = 0; i < lines.length; i++) {
      currentContent += lines[i] + '\n';

      // Create chunk when we reach target size or end of file
      if (currentContent.length >= targetChunkSize || i === lines.length - 1) {
        if (currentContent.trim().length > 100) { // Only create substantial chunks
          const chunkHash = require('crypto').createHash('sha256').update(currentContent).digest('hex');

          chunks.push({
            id: `${fileHash}_logical_${chunkIndex}`,
            filePath,
            content: currentContent.trim(),
            startLine: currentStartLine,
            endLine: i + 1,
            chunkIndex,
            isFullFile: false,
            hash: chunkHash,
            metadata: {
              ...this.extractFileMetadata(filePath, currentContent, 'low'),
              chunkType: 'logical'
            } as any
          });

          chunkIndex++;
        }

        // Start next chunk with overlap
        const overlapLines = Math.min(overlap, Math.floor((i + 1 - currentStartLine) * 0.3));
        currentStartLine = Math.max(1, i + 2 - overlapLines);
        currentContent = '';

        // Add overlap content
        for (let j = currentStartLine - 1; j <= i; j++) {
          if (j < lines.length) {
            currentContent += lines[j] + '\n';
          }
        }
      }
    }

    return chunks;
  }
}

export default SemanticSearchManager;
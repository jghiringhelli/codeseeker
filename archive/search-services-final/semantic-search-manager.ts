/**
 * Semantic Search Manager - SOLID Principles Compliant
 * Uses dependency injection and delegates to focused services
 */

import * as fs from 'fs/promises';
import { Logger } from '../../utils/logger';
import {
  SearchQuery,
  SearchResponse,
  IContentChunker,
  IEmbeddingGenerator,
  ISearchIndexStorage,
  ISearchQueryProcessor,
  IProjectIndexer
} from '../../core/interfaces/search-interfaces';

export class SemanticSearchManager implements IProjectIndexer {
  private logger = Logger.getInstance();

  constructor(
    private contentChunker: IContentChunker,
    private embeddingGenerator: IEmbeddingGenerator,
    private indexStorage: ISearchIndexStorage,
    private queryProcessor: ISearchQueryProcessor
  ) {}

  /**
   * Initialize project for semantic search
   */
  async initializeProject(projectId: string, projectPath: string): Promise<void> {
    this.logger.info(`🔍 Initializing semantic search for project: ${projectId}`);

    try {
      // Scan all relevant files in the project
      const filePaths = await this.scanProjectFiles(projectPath);

      // Process files in batches to avoid memory issues
      const batchSize = 50;
      for (let i = 0; i < filePaths.length; i += batchSize) {
        const batch = filePaths.slice(i, i + batchSize);
        await this.processBatch(projectId, batch);
      }

      this.logger.info(`✅ Semantic search initialization complete: ${filePaths.length} files processed`);
    } catch (error) {
      this.logger.error(`❌ Semantic search initialization failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update specific files in the search index
   */
  async updateFiles(projectId: string, filePaths: string[]): Promise<void> {
    this.logger.info(`🔄 Updating ${filePaths.length} files in search index`);

    try {
      await this.processBatch(projectId, filePaths);
      this.logger.info(`✅ File updates complete`);
    } catch (error) {
      this.logger.error(`❌ File update failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove files from the search index
   */
  async removeFiles(projectId: string, filePaths: string[]): Promise<void> {
    this.logger.info(`🗑️ Removing ${filePaths.length} files from search index`);

    try {
      await this.indexStorage.removeChunks(projectId, filePaths);
      this.logger.info(`✅ File removal complete`);
    } catch (error) {
      this.logger.error(`❌ File removal failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Perform semantic search
   */
  async search(query: SearchQuery): Promise<SearchResponse> {
    this.logger.info(`🔍 Performing semantic search: "${query.text}"`);

    try {
      const response = await this.queryProcessor.processQuery(query);
      this.logger.info(`✅ Search complete: ${response.totalResults} results in ${response.processingTime}ms`);
      return response;
    } catch (error) {
      this.logger.error(`❌ Search failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get search index statistics
   */
  async getIndexStats(projectId?: string): Promise<{
    totalFiles: number;
    totalChunks: number;
    lastUpdated: Date;
    projectSize: number;
  }> {
    return await this.indexStorage.getIndexStats(projectId);
  }

  // Private helper methods

  private async processBatch(projectId: string, filePaths: string[]): Promise<void> {
    const allChunks = [];
    const allEmbeddings = [];

    for (const filePath of filePaths) {
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const fileHash = this.calculateFileHash(content);

        // Use injected chunker service
        const chunks = await this.contentChunker.createSemanticChunks(filePath, content, fileHash);

        // Use injected embedding generator
        const embeddings = await this.embeddingGenerator.generateEmbeddings(chunks);

        allChunks.push(...chunks);
        allEmbeddings.push(...embeddings);

      } catch (error) {
        this.logger.warn(`⚠️ Failed to process file ${filePath}: ${error.message}`);
      }
    }

    if (allChunks.length > 0) {
      // Use injected storage service
      await this.indexStorage.storeChunks(projectId, allChunks, allEmbeddings);
    }
  }

  private async scanProjectFiles(projectPath: string): Promise<string[]> {
    const files: string[] = [];
    const supportedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.rs', '.go', '.cpp', '.c', '.cs'];

    const scanDirectory = async (dirPath: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = `${dirPath}/${entry.name}`;

          if (entry.isDirectory() && !this.shouldSkipDirectory(entry.name)) {
            await scanDirectory(fullPath);
          } else if (entry.isFile() && this.shouldIncludeFile(entry.name, supportedExtensions)) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        this.logger.warn(`⚠️ Failed to scan directory ${dirPath}: ${error.message}`);
      }
    };

    await scanDirectory(projectPath);
    return files;
  }

  private shouldSkipDirectory(dirName: string): boolean {
    const skipDirs = ['node_modules', '.git', 'dist', 'build', 'target', '__pycache__', '.venv', 'venv', 'coverage'];
    return skipDirs.includes(dirName) || dirName.startsWith('.');
  }

  private shouldIncludeFile(fileName: string, supportedExtensions: string[]): boolean {
    const ext = '.' + fileName.split('.').pop();
    return supportedExtensions.includes(ext) && !fileName.includes('.test.') && !fileName.includes('.spec.');
  }

  private calculateFileHash(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}
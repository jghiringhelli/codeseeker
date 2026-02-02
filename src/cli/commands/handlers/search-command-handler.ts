/**
 * Search Command Handler
 * Single Responsibility: Handle search commands including semantic search
 *
 * STORAGE MODES:
 * - Embedded (default): Uses SQLite vector store via StorageManager
 * - Server: Uses PostgreSQL via analysisRepository
 */

import { BaseCommandHandler } from '../base-command-handler';
import { CommandResult } from '../command-context';
import { EmbeddingService } from '../../services/data/embedding/embedding-service';
import { analysisRepository } from '../../../shared/analysis-repository-consolidated';
import { getStorageManager, isUsingEmbeddedStorage } from '../../../storage';
import { Logger } from '../../../utils/logger';
import path from 'path';
import { glob } from 'fast-glob';
import * as fs from 'fs/promises';

export class SearchCommandHandler extends BaseCommandHandler {
  private logger = Logger.getInstance();

  /**
   * Convert similarity score (0-1) to star rating display
   * ★★★★★ = 90-100% (Excellent match)
   * ★★★★☆ = 75-89%  (Very good match)
   * ★★★☆☆ = 60-74%  (Good match)
   * ★★☆☆☆ = 45-59%  (Fair match)
   * ★☆☆☆☆ = 30-44%  (Weak match)
   * ☆☆☆☆☆ = 0-29%   (Poor match)
   */
  private getStarRating(score: number): string {
    // Ensure score is in 0-1 range
    const normalizedScore = Math.max(0, Math.min(1, score));
    const percentage = normalizedScore * 100;

    if (percentage >= 90) return '★★★★★';
    if (percentage >= 75) return '★★★★☆';
    if (percentage >= 60) return '★★★☆☆';
    if (percentage >= 45) return '★★☆☆☆';
    if (percentage >= 30) return '★☆☆☆☆';
    return '☆☆☆☆☆';
  }

  async handle(args: string): Promise<CommandResult> {
    // Parse arguments first to check for --index flag
    const parts = args.trim() ? args.split(' ') : [];
    const isIndex = parts.includes('--index');

    // Allow args with only flags if indexing
    const nonFlagParts = parts.filter(p => !p.startsWith('--'));
    if (nonFlagParts.length === 0 && !isIndex) {
      return {
        success: false,
        message: 'Usage: search <query> [--index] [--threshold=0.7] [--limit=10] [--verbose]'
      };
    }

    const isVerbose = parts.includes('--verbose');

    // Extract threshold and limit
    const thresholdArg = parts.find(p => p.startsWith('--threshold='));
    const limitArg = parts.find(p => p.startsWith('--limit='));
    const threshold = thresholdArg ? parseFloat(thresholdArg.split('=')[1]) : 0.7;
    const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 10;

    // Get query (remove flags)
    const query = parts.filter(p => !p.startsWith('--')).join(' ');

    try {
      const projectPath = this.context.currentProject?.projectPath || process.cwd();
      this.logger.info(`Using project path: ${projectPath}`);
      this.logger.info(`Context project ID: ${this.context.currentProject?.projectId}`);

      const projectId = this.context.currentProject?.projectId || await this.generateProjectId(projectPath);
      this.logger.info(`Final project ID for search: ${projectId}`);

      if (isIndex) {
        return await this.indexProject(projectPath, projectId);
      } else if (query) {
        return await this.searchCode(query, projectId, { threshold, limit, verbose: isVerbose });
      } else {
        return {
          success: false,
          message: 'Please provide a search query or use --index to index the codebase'
        };
      }

    } catch (error) {
      this.logger.error('Search failed:', error);
      return {
        success: false,
        message: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Index the current project for semantic search (incremental)
   * Only reindexes files that have changed based on content hash
   */
  private async indexProject(projectPath: string, projectId: string): Promise<CommandResult> {
    console.log('🔄 Indexing codebase for semantic search...');
    console.log(`📁 Project: ${projectPath}`);

    try {
      // Get all code files
      const files = await glob(['**/*.{ts,js,jsx,tsx,py,java,cs,cpp,c,h,hpp}'], {
        cwd: projectPath,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**']
      });

      console.log(`📂 Found ${files.length} files to scan`);

      if (files.length === 0) {
        return {
          success: false,
          message: 'No code files found to index'
        };
      }

      // Get existing file hashes from database to enable incremental indexing
      const existingHashes = await this.getExistingFileHashes(projectId);
      console.log(`   📊 Found ${existingHashes.size} previously indexed files`);

      // Compute current file hashes and determine what needs updating
      const crypto = require('crypto');
      const filesToProcess: string[] = [];
      const filesToDelete: string[] = [];
      const currentFiles = new Set<string>();

      for (const file of files) {
        currentFiles.add(file);
        const filePath = path.join(projectPath, file);

        try {
          const content = await fs.readFile(filePath, 'utf-8');
          if (content.length < 50) continue; // Skip very small files

          const fileHash = crypto.createHash('md5').update(content).digest('hex');
          const existingHash = existingHashes.get(file);

          if (!existingHash || existingHash !== fileHash) {
            filesToProcess.push(file);
            if (existingHash) {
              filesToDelete.push(file); // File changed, delete old embeddings first
            }
          }
        } catch (error) {
          this.logger.warn(`Failed to read file ${file}:`, error);
        }
      }

      // Find deleted files (in DB but not in current file system)
      for (const [file] of existingHashes) {
        if (!currentFiles.has(file)) {
          filesToDelete.push(file);
        }
      }

      // Delete old embeddings for changed/deleted files
      if (filesToDelete.length > 0) {
        await this.deleteFileEmbeddings(projectId, filesToDelete);
        console.log(`   🗑️  Removed embeddings for ${filesToDelete.length} changed/deleted files`);
      }

      if (filesToProcess.length === 0) {
        console.log(`✅ All ${files.length} files are up to date - no reindexing needed`);
        return {
          success: true,
          message: `Project already indexed: ${files.length} files up to date`,
          data: { segments: 0, files: 0, unchanged: files.length }
        };
      }

      console.log(`   📝 Processing ${filesToProcess.length} new/changed files...`);

      // Initialize embedding service
      const embeddingService = new EmbeddingService({
        provider: 'xenova',
        model: 'Xenova/all-MiniLM-L6-v2'
      });

      const embeddings = [];
      let processedFiles = 0;

      for (const file of filesToProcess.slice(0, 50)) { // Limit to 50 files for MVP
        try {
          const filePath = path.join(projectPath, file);
          const content = await fs.readFile(filePath, 'utf-8');

          if (content.length < 50) continue;

          // Create simple chunks (split by lines for now)
          const lines = content.split('\n');
          const chunks = [];
          for (let i = 0; i < lines.length; i += 20) {
            const chunk = lines.slice(i, i + 20).join('\n');
            if (chunk.trim().length > 20) {
              chunks.push(chunk);
            }
          }

          // Compute full file hash for incremental indexing comparison
          const fullFileHash = crypto.createHash('md5').update(content).digest('hex');

          // Generate embeddings for each chunk
          for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
            const chunk = chunks[chunkIndex];
            try {
              // Generate the actual embedding vector
              const embeddingVector = await embeddingService.generateEmbedding(chunk, file);

              const embedding = {
                project_id: projectId,
                file_path: file,
                chunk_index: chunkIndex,
                content_type: 'code' as const,
                content_text: chunk,
                content_hash: crypto.createHash('md5').update(chunk).digest('hex'),
                embedding: embeddingVector, // Include the actual embedding vector
                // Store full file hash in metadata for incremental indexing
                metadata: {
                  full_file_hash: fullFileHash,
                  total_chunks: chunks.length
                }
              };

              embeddings.push(embedding);
            } catch (error) {
              this.logger.warn(`Failed to process chunk ${chunkIndex} in ${file}:`, error);
            }
          }

          processedFiles++;
          if (processedFiles % 10 === 0) {
            console.log(`   Processed ${processedFiles}/${filesToProcess.length} files...`);
          }

        } catch (error) {
          this.logger.warn(`Failed to process file ${file}:`, error);
        }
      }

      // Save embeddings to appropriate storage (embedded or server)
      if (embeddings.length > 0) {
        // Get storage manager first to ensure singleton is initialized
        const storageManager = await getStorageManager();

        if (storageManager.getMode() === 'embedded') {
          // Use embedded SQLite vector store
          const vectorStore = storageManager.getVectorStore();

          // Convert to VectorDocument format and upsert
          const docs = embeddings.map(e => ({
            id: `${e.project_id}-${e.file_path}-${e.chunk_index}`,
            projectId: e.project_id,
            filePath: e.file_path,
            content: e.content_text,
            embedding: e.embedding || [],
            metadata: e.metadata
          }));

          await vectorStore.upsertMany(docs);
        } else {
          // Use PostgreSQL (server mode)
          await analysisRepository.saveMultipleEmbeddings(embeddings);
        }

        console.log(`✅ Generated embeddings for ${embeddings.length} code segments`);
        console.log(`📊 Processed ${processedFiles} new/changed files (${files.length - filesToProcess.length} unchanged)`);

        return {
          success: true,
          message: `Project indexed: ${embeddings.length} segments from ${processedFiles} files`,
          data: {
            segments: embeddings.length,
            files: processedFiles,
            unchanged: files.length - filesToProcess.length,
            deleted: filesToDelete.length
          }
        };
      } else {
        return {
          success: true,
          message: 'No new code segments to index',
          data: { segments: 0, files: 0 }
        };
      }

    } catch (error) {
      this.logger.error('Indexing failed:', error);
      return {
        success: false,
        message: `Indexing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get existing file hashes from database for incremental indexing
   */
  private async getExistingFileHashes(projectId: string): Promise<Map<string, string>> {
    try {
      const storageManager = await getStorageManager();
      if (storageManager.getMode() === 'embedded') {
        // Use the vector store's getFileHashes method for embedded mode
        const vectorStore = storageManager.getVectorStore();
        return await vectorStore.getFileHashes(projectId);
      }
      return await analysisRepository.getFileHashes(projectId);
    } catch (error) {
      this.logger.warn('Could not get existing file hashes:', error);
      return new Map<string, string>();
    }
  }

  /**
   * Delete embeddings for specified files (incremental)
   */
  private async deleteFileEmbeddings(projectId: string, files: string[]): Promise<void> {
    if (files.length === 0) return;

    try {
      const storageManager = await getStorageManager();
      if (storageManager.getMode() === 'embedded') {
        // Use deleteByFiles for targeted removal (true incremental indexing)
        const vectorStore = storageManager.getVectorStore();
        await vectorStore.deleteByFiles(projectId, files);
      } else {
        await analysisRepository.deleteEmbeddingsForFiles(projectId, files);
      }
    } catch (error) {
      this.logger.warn('Could not delete file embeddings:', error);
    }
  }

  /**
   * Search for code using semantic similarity
   */
  private async searchCode(query: string, projectId: string, options: { threshold: number; limit: number; verbose: boolean }): Promise<CommandResult> {
    console.log(`🔍 Searching for: "${query}"`);

    try {
      // Get storage manager first to ensure singleton is initialized
      const storageManager = await getStorageManager();

      let results: Array<{
        file_path: string;
        content_type: string;
        content_text: string;
        similarity_score: number;
        chunk_index: number;
      }> = [];

      if (storageManager.getMode() === 'embedded') {
        // Use embedded SQLite + MiniSearch for text search
        const vectorStore = storageManager.getVectorStore();
        const searchResults = await vectorStore.searchByText(query, projectId, options.limit);

        if (searchResults.length === 0) {
          console.log('   No indexed content found - run "search --index" first');
          return {
            success: false,
            message: 'No indexed content found. Please run "search --index" first to index the codebase.'
          };
        }

        console.log(`🧠 Found ${searchResults.length} matching code segments`);

        results = searchResults
          .filter(r => r.score >= options.threshold)
          .map(r => ({
            file_path: r.document.filePath,
            content_type: 'code',
            content_text: r.document.content,
            similarity_score: r.score,
            chunk_index: 0
          }));
      } else {
        // Use PostgreSQL (server mode)
        const embeddings = await analysisRepository.getEmbeddings(projectId, {
          limit: options.limit
        });

        if (embeddings.length === 0) {
          console.log('   No embeddings found - run "search --index" first');
          return {
            success: false,
            message: 'No embeddings found. Please run "search --index" first to index the codebase.'
          };
        }

        console.log(`🧠 Found ${embeddings.length} code segments to search`);

        // For server mode, do simple text-based search
        const queryLower = query.toLowerCase();
        results = embeddings
          .map((embedding) => ({
            file_path: embedding.file_path,
            content_type: embedding.content_type,
            content_text: embedding.content_text,
            similarity_score: this.calculateTextSimilarity(queryLower, embedding.content_text?.toLowerCase() || ''),
            chunk_index: embedding.chunk_index
          }))
          .filter(result => result.similarity_score >= options.threshold)
          .sort((a, b) => b.similarity_score - a.similarity_score)
          .slice(0, options.limit);
      }

      console.log(`\n🔍 Search Results (${results.length} found):`);

      if (results.length === 0) {
        console.log('   No similar code segments found');
        console.log('   Try lowering the similarity threshold or using different search terms');
      } else {
        results.forEach((result, index) => {
          const stars = this.getStarRating(result.similarity_score);

          console.log(`\n📄 Result ${index + 1}:`);
          console.log(`   File: ${result.file_path}`);
          console.log(`   Type: ${result.content_type}`);
          console.log(`   Match: ${stars}`);

          if (options.verbose) {
            const percentage = Math.min(100, result.similarity_score * 100).toFixed(0);
            console.log(`   Score: ${percentage}%`);
            console.log(`   Content Preview:`);
            const preview = result.content_text.substring(0, 200);
            console.log(`   ${preview}${result.content_text.length > 200 ? '...' : ''}`);
          }
        });
      }

      console.log(`\n💡 Tips:`);
      console.log(`   • Use --verbose for more details`);
      console.log(`   • Use --threshold to adjust similarity filtering`);
      console.log(`   • Use search --index to index your codebase first`);

      return {
        success: true,
        message: `Found ${results.length} matches`,
        data: { query, results }
      };

    } catch (error) {
      this.logger.error('Search failed:', error);
      return {
        success: false,
        message: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Calculate simple text-based similarity for MVP
   */
  private calculateTextSimilarity(query: string, content: string): number {
    if (!query || !content) return 0;

    const queryWords = query.split(/\s+/).filter(w => w.length > 2);
    const contentWords = content.split(/\s+/).map(w => w.toLowerCase());

    if (queryWords.length === 0) return 0;

    let matches = 0;
    for (const word of queryWords) {
      if (contentWords.some(cw => cw.includes(word) || word.includes(cw))) {
        matches++;
      }
    }

    return matches / queryWords.length;
  }

  /**
   * Get existing project ID from database
   */
  private async generateProjectId(projectPath: string): Promise<string> {
    try {
      // Normalize the path for consistent lookup
      const normalizedPath = path.resolve(projectPath);
      this.logger.info(`Looking up project with path: ${normalizedPath}`);

      // Get storage manager to check mode
      const storageManager = await getStorageManager();

      if (storageManager.getMode() === 'embedded') {
        // Use embedded project store
        const projectStore = storageManager.getProjectStore();

        // Try to find existing project by path
        const project = await projectStore.findByPath(normalizedPath);
        if (project) {
          this.logger.info(`Using project ID: ${project.id}`);
          return project.id;
        }

        // Also try without normalization
        const projectOrig = await projectStore.findByPath(projectPath);
        if (projectOrig) {
          this.logger.info(`Found project with original path, using ID: ${projectOrig.id}`);
          return projectOrig.id;
        }

        // For embedded mode, generate a deterministic project ID from the path
        // This allows searching without explicit initialization
        const crypto = require('crypto');
        const generatedId = crypto.createHash('md5').update(normalizedPath).digest('hex').substring(0, 16);
        this.logger.info(`Generated project ID from path: ${generatedId}`);
        return generatedId;
      } else {
        // Use server mode (PostgreSQL)
        const projects = await analysisRepository.getProjects({ projectPath: normalizedPath });
        this.logger.info(`Found ${projects.length} projects matching path`);

        if (projects.length > 0) {
          this.logger.info(`Using project ID: ${projects[0].id}`);
          return projects[0].id;
        }

        // Also try without normalization in case paths were stored differently
        const projectsOrig = await analysisRepository.getProjects({ projectPath });
        if (projectsOrig.length > 0) {
          this.logger.info(`Found project with original path, using ID: ${projectsOrig[0].id}`);
          return projectsOrig[0].id;
        }

        // Get all projects to debug
        const allProjects = await analysisRepository.getProjects({});
        this.logger.info(`Total projects in database: ${allProjects.length}`);
        allProjects.forEach(p => {
          this.logger.info(`Project: ${p.project_name}, Path: ${p.project_path}, ID: ${p.id}`);
        });

        // Fallback: this should not happen if init was run properly
        this.logger.error(`No project found for path: ${projectPath} (normalized: ${normalizedPath})`);
        throw new Error(`Project not found for path: ${projectPath}. Please run "codeseeker setup" first.`);
      }
    } catch (error) {
      this.logger.error('Could not retrieve project ID:', error);
      throw error;
    }
  }

}
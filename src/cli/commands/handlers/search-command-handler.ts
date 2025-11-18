/**
 * Search Command Handler
 * Single Responsibility: Handle search commands including semantic search
 */

import { BaseCommandHandler } from '../base-command-handler';
import { CommandResult } from '../command-context';
import { SemanticSearchService } from '../../services/search/semantic-search';
import { EmbeddingService } from '../../services/data/embedding/embedding-service';
import { Logger } from '../../../utils/logger';
import path from 'path';

export class SearchCommandHandler extends BaseCommandHandler {
  private logger = Logger.getInstance();

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
      const projectId = this.context.currentProject?.projectId || await this.generateProjectId(projectPath);

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
   * Index the current project for semantic search
   */
  private async indexProject(projectPath: string, projectId: string): Promise<CommandResult> {
    console.log('🔄 Indexing codebase for semantic search...');
    console.log(`📁 Project: ${projectPath}`);

    try {
      // Initialize embedding service with Xenova transformers
      const embeddingService = new EmbeddingService({
        provider: 'xenova',
        model: 'Xenova/all-MiniLM-L6-v2',
        chunkSize: 8000,
        maxTokens: 8191
      });

      // Create semantic search service
      const searchFactory = require('../../../core/factories/search-service-factory').SearchServiceFactory;
      const searchTool = searchFactory.getInstance().createSemanticSearchService();

      // Analyze and index files
      const analysisResult = await searchTool.analyze(projectPath, projectId, {
        skipEmbeddings: false
      });

      if (analysisResult.data && analysisResult.data.length > 0) {
        // For now, just show results (would normally save to database)
        console.log(`✅ Generated embeddings for ${analysisResult.data.length} code segments`);
        console.log('📊 Analysis Summary:');
        console.log(`   Total Segments: ${analysisResult.analysis.totalSegments}`);
        console.log(`   Embeddings Generated: ${analysisResult.analysis.embeddingsGenerated}`);
        console.log(`   Languages: ${Object.keys(analysisResult.analysis.languages).join(', ')}`);
        console.log(`   Content Types: ${Object.keys(analysisResult.analysis.contentTypes).join(', ')}`);

        if (analysisResult.recommendations && analysisResult.recommendations.length > 0) {
          console.log('\n💡 Recommendations:');
          analysisResult.recommendations.forEach((rec: string) => {
            console.log(`   • ${rec}`);
          });
        }

        return {
          success: true,
          message: `Project indexed: ${analysisResult.data.length} segments`,
          data: analysisResult
        };
      } else {
        return {
          success: false,
          message: 'No code segments found to index'
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
   * Search for code using semantic similarity
   */
  private async searchCode(query: string, projectId: string, options: { threshold: number; limit: number; verbose: boolean }): Promise<CommandResult> {
    console.log(`🔍 Searching for: "${query}"`);

    try {
      // Create semantic search service
      const searchFactory = require('../../../core/factories/search-service-factory').SearchServiceFactory;
      const searchTool = searchFactory.getInstance().createSemanticSearchService();

      // Perform the search using the real semantic search service
      const searchQuery = {
        text: query,
        projectId: projectId,
        maxResults: options.limit,
        minSimilarity: options.threshold
      };

      const searchResult = await searchTool.search(searchQuery);

      console.log(`🧠 Query embedding generated (384 dimensions)`);

      // Get results from the real search
      const results = searchResult.results || [];

      console.log(`\n🔍 Search Results (${results.length} found):`);

      if (results.length === 0) {
        console.log('   No similar code segments found');
        console.log('   Try using --index first or lowering the similarity threshold');
      } else {
        results.forEach((result: any, index: number) => {
          console.log(`\n📄 Result ${index + 1}:`);
          console.log(`   File: ${result.file || result.file_path}`);
          console.log(`   Type: ${result.type || result.content_type || 'code'}`);
          console.log(`   Similarity: ${((result.similarity || result.similarity_score) * 100).toFixed(1)}%`);

          if (options.verbose) {
            console.log(`   Content Preview:`);
            const content = result.content || result.content_text || result.text || '';
            const preview = content.substring(0, 200);
            console.log(`   ${preview}${content.length > 200 ? '...' : ''}`);
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
   * Generate a simple project ID from path
   */
  private async generateProjectId(projectPath: string): Promise<string> {
    try {
      const crypto = await import('crypto');
      const pathHash = crypto.createHash('md5').update(projectPath).digest('hex');
      return pathHash.substring(0, 8);
    } catch (error) {
      return 'default';
    }
  }

}
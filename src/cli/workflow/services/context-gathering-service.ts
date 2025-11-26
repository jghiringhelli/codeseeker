/**
 * Context Gathering Service
 * SOLID Principles: Single Responsibility - Handle semantic context gathering only
 */

import { Logger } from '../../../shared/logger';
import { SemanticEnhancementEngine } from '../../../shared/semantic-enhancement-engine';
import {
  IContextGatheringService,
  ProcessedIntent,
  EnhancementContext
} from '../interfaces/index';

export class ContextGatheringService implements IContextGatheringService {
  private logger = Logger.getInstance();
  private semanticEngine: SemanticEnhancementEngine;

  constructor(semanticEngine?: SemanticEnhancementEngine) {
    this.semanticEngine = semanticEngine || new SemanticEnhancementEngine();
  }

  async gatherSemanticContext(query: string, intent: ProcessedIntent): Promise<EnhancementContext> {
    this.logger.info('🔍 Gathering semantic context...');

    try {
      // Use semantic enhancement engine to get complete context
      const enhancedContext = await this.semanticEngine.enhanceUserQuery(query);

      // Build comprehensive context from enhancement results
      const context = this.buildEnhancedContext(
        enhancedContext.searchResults || [],
        enhancedContext.relationships || []
      );

      // Optimize context based on intent complexity
      const optimizedContext = this.optimizeContextForTokens(context, this.getTokenLimit(intent.complexity));

      this.logger.debug(`Context gathered: ${optimizedContext.totalFiles} files, ${optimizedContext.contextSize} bytes`);
      return optimizedContext;
    } catch (error) {
      this.logger.error('Context gathering failed:', error);

      // Return minimal fallback context
      return this.createFallbackContext();
    }
  }

  buildEnhancedContext(searchResults: any[], relationships: any[]): EnhancementContext {
    const relevantFiles = new Set<string>();
    let totalContextSize = 0;

    // Extract files from search results
    for (const result of searchResults) {
      if (result.file_path) {
        relevantFiles.add(result.file_path);
        totalContextSize += result.content?.length || 0;
      }
    }

    // Extract files from relationships
    for (const relationship of relationships) {
      if (relationship.source_file) relevantFiles.add(relationship.source_file);
      if (relationship.target_file) relevantFiles.add(relationship.target_file);
    }

    return {
      totalFiles: relevantFiles.size,
      contextSize: totalContextSize,
      relevantFiles: Array.from(relevantFiles),
      relationships,
      searchResults
    };
  }

  optimizeContextForTokens(context: EnhancementContext, maxTokens: number): EnhancementContext {
    const maxBytes = maxTokens * 4; // Rough estimate: 4 bytes per token

    if (context.contextSize <= maxBytes) {
      return context;
    }

    this.logger.info(`Optimizing context: ${context.contextSize} bytes -> ${maxBytes} bytes`);

    // Prioritize search results by relevance score
    const prioritizedResults = context.searchResults
      .sort((a, b) => (b.similarity_score || 0) - (a.similarity_score || 0))
      .slice(0, Math.floor(context.searchResults.length * 0.7));

    // Keep high-priority relationships
    const prioritizedRelationships = context.relationships
      .filter(rel => rel.relationship_type === 'imports' || rel.relationship_type === 'extends')
      .slice(0, Math.floor(context.relationships.length * 0.8));

    // Rebuild context with prioritized data
    return this.buildEnhancedContext(prioritizedResults, prioritizedRelationships);
  }

  private getTokenLimit(complexity: 'simple' | 'medium' | 'complex'): number {
    const limits = {
      simple: 8000,   // ~32KB context
      medium: 12000,  // ~48KB context
      complex: 16000  // ~64KB context
    };

    return limits[complexity];
  }

  private createFallbackContext(): EnhancementContext {
    return {
      totalFiles: 0,
      contextSize: 0,
      relevantFiles: [],
      relationships: [],
      searchResults: []
    };
  }

  // Additional utility methods for context analysis
  getContextSummary(context: EnhancementContext): {
    filesByType: Record<string, number>;
    relationshipTypes: Record<string, number>;
    averageRelevance: number;
  } {
    const filesByType: Record<string, number> = {};
    const relationshipTypes: Record<string, number> = {};

    // Analyze file types
    for (const file of context.relevantFiles) {
      const extension = file.split('.').pop() || 'unknown';
      filesByType[extension] = (filesByType[extension] || 0) + 1;
    }

    // Analyze relationship types
    for (const rel of context.relationships) {
      const type = rel.relationship_type || 'unknown';
      relationshipTypes[type] = (relationshipTypes[type] || 0) + 1;
    }

    // Calculate average relevance
    const relevanceScores = context.searchResults
      .map(r => r.similarity_score || 0)
      .filter(score => score > 0);

    const averageRelevance = relevanceScores.length > 0
      ? relevanceScores.reduce((sum, score) => sum + score, 0) / relevanceScores.length
      : 0;

    return {
      filesByType,
      relationshipTypes,
      averageRelevance
    };
  }

  formatContextForClaude(context: EnhancementContext): string {
    const summary = this.getContextSummary(context);

    const lines = [
      '# Enhanced Project Context',
      '',
      `## Overview`,
      `- Total relevant files: ${context.totalFiles}`,
      `- Context size: ${Math.round(context.contextSize / 1024)}KB`,
      `- Average relevance: ${Math.round(summary.averageRelevance * 100)}%`,
      '',
      '## File Types',
      ...Object.entries(summary.filesByType).map(([ext, count]) => `- .${ext}: ${count} files`),
      '',
      '## Key Relationships',
      ...Object.entries(summary.relationshipTypes).map(([type, count]) => `- ${type}: ${count} connections`),
      '',
      '## Most Relevant Files',
      ...context.searchResults
        .slice(0, 10)
        .map(result => `- ${result.file_path} (${Math.round((result.similarity_score || 0) * 100)}% match)`)
    ];

    return lines.join('\n');
  }
}